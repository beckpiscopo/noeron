"""Evidence threads generation tool."""

import asyncio
import logging
from typing import Any

from pydantic import BaseModel, Field

from ..cache_store import (
    _load_claims_cache,
    _load_evidence_threads_cache,
    _load_papers_collection,
    _save_evidence_threads_cache,
)
from ..config import GEMINI_MODEL
from ..evidence_thread_utils import (
    _call_gemini_for_threads,
    _format_papers_for_thread_prompt,
    _should_generate_threads,
    _validate_threads,
)
from ..mcp_app import mcp, get_vectorstore
from ..prompts import EVIDENCE_THREAD_PROMPT
from ..rag_utils import _build_research_query
from ..schemas.evidence import EvidenceThreadsResponse

logger = logging.getLogger(__name__)


class GenerateEvidenceThreadsInput(BaseModel):
    """Input for generating evidence threads."""
    claim_id: str = Field(
        ...,
        description="The claim ID in format 'segment_key-index' (e.g., 'lex_325|00:00:00.160|1-0')"
    )
    episode_id: str = Field(
        default="lex_325",
        description="The episode ID"
    )
    n_results: int = Field(
        default=10,
        description="Number of RAG results to retrieve for thread analysis (default: 10)"
    )
    force_regenerate: bool = Field(
        default=False,
        description="If True, regenerate even if cached threads exist"
    )


@mcp.tool()
async def generate_evidence_threads(params: GenerateEvidenceThreadsInput) -> EvidenceThreadsResponse:
    """
    Generate evidence threads for a scientific claim - coherent research narratives
    that trace how understanding of the claim developed over time.

    Flow:
    1. Load claim from cache
    2. Build research query from claim data
    3. Query ChromaDB for relevant papers (need 4+ with 3+ year span)
    4. Check eligibility (enough papers with temporal spread)
    5. Call Gemini to identify threads
    6. Validate threads reference real papers
    7. Cache and return
    """
    try:
        from datetime import datetime

        # Check cache first (unless force_regenerate)
        cache_key = f"{params.episode_id}:{params.claim_id}"

        if not params.force_regenerate:
            cache = _load_evidence_threads_cache()
            if cache_key in cache:
                return {
                    "claim_id": params.claim_id,
                    "threads": cache[cache_key]["threads"],
                    "cached": True,
                    "generated_at": cache[cache_key].get("generated_at", "unknown"),
                    "papers_analyzed": cache[cache_key].get("papers_analyzed", 0),
                    "eligible": cache[cache_key].get("eligible", True),
                    "eligibility_reason": cache[cache_key].get("eligibility_reason", "eligible"),
                }

        # Step 1: Load claim from cache
        claims_cache = _load_claims_cache()

        # Parse claim_id
        parts = params.claim_id.rsplit("-", 1)
        if len(parts) != 2:
            return {"error": f"Invalid claim_id format: {params.claim_id}"}

        segment_key = parts[0]
        try:
            claim_index = int(parts[1])
        except ValueError:
            return {"error": f"Invalid claim index in claim_id: {params.claim_id}"}

        # Get segment and claim data
        segments = claims_cache.get("segments", {})
        segment_data = segments.get(segment_key)

        if not segment_data:
            return {"error": f"Segment not found: {segment_key}"}

        claims_list = segment_data.get("claims", [])
        if claim_index >= len(claims_list):
            return {"error": f"Claim index {claim_index} out of range"}

        claim_data = claims_list[claim_index]
        claim_text = claim_data.get("claim_text", "")

        # Step 2: Build research query
        research_query = _build_research_query(claim_data)

        # Step 3: Query ChromaDB with more results for thread analysis
        vs = get_vectorstore()
        rag_results_raw = vs.search(research_query, n_results=params.n_results)

        # Parse RAG results
        docs = rag_results_raw.get("documents", [[]])[0]
        metas = rag_results_raw.get("metadatas", [[]])[0]

        rag_results = []
        for doc, meta in zip(docs, metas):
            rag_results.append({
                "text": doc,
                "paper_id": meta.get("paper_id", ""),
                "paper_title": meta.get("paper_title", ""),
                "section": meta.get("section_heading", ""),
                "page": meta.get("page", ""),
                "year": meta.get("year", ""),
            })

        # Step 4: Check eligibility
        eligible, eligibility_reason = _should_generate_threads(rag_results)

        if not eligible:
            # Cache and return empty result
            result = {
                "claim_id": params.claim_id,
                "threads": [],
                "cached": False,
                "generated_at": datetime.utcnow().isoformat(),
                "papers_analyzed": len(rag_results),
                "eligible": False,
                "eligibility_reason": eligibility_reason,
            }

            cache = _load_evidence_threads_cache()
            cache[cache_key] = result
            _save_evidence_threads_cache(cache)

            return result

        # Step 5: Load papers collection and format for prompt
        papers_collection = _load_papers_collection()
        papers_json = _format_papers_for_thread_prompt(rag_results, papers_collection)

        # Build prompt
        prompt = EVIDENCE_THREAD_PROMPT.format(
            claim_text=claim_text,
            papers_json=papers_json,
        )

        # Step 6: Call Gemini
        gemini_result = await asyncio.to_thread(
            _call_gemini_for_threads,
            prompt,
            GEMINI_MODEL,
        )

        if gemini_result.get("error"):
            return {
                "claim_id": params.claim_id,
                "threads": [],
                "error": gemini_result["error"],
                "papers_analyzed": len(rag_results),
            }

        raw_threads = gemini_result.get("threads", [])

        # Step 7: Validate threads
        validated_threads = _validate_threads(raw_threads, rag_results)

        # Step 8: Cache and return
        result = {
            "claim_id": params.claim_id,
            "threads": validated_threads,
            "cached": False,
            "generated_at": datetime.utcnow().isoformat(),
            "papers_analyzed": len(rag_results),
            "eligible": True,
            "eligibility_reason": "eligible",
            "raw_thread_count": len(raw_threads),
            "validated_thread_count": len(validated_threads),
        }

        cache = _load_evidence_threads_cache()
        cache[cache_key] = result
        _save_evidence_threads_cache(cache)

        return result

    except Exception as e:
        import traceback
        return {
            "error": f"Error generating evidence threads: {str(e)}",
            "traceback": traceback.format_exc(),
        }
