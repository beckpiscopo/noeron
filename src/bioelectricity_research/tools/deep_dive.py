"""Deep dive summary generation tool."""

import asyncio
import logging
from typing import Any, Literal

from pydantic import BaseModel, Field

from ..cache_store import (
    _load_claims_cache,
    _load_deep_dive_cache,
    _load_papers_collection,
    _save_deep_dive_cache,
)
from ..config import GEMINI_MODEL
from ..deep_dive_utils import _call_gemini_for_deep_dive
from ..mcp_app import mcp, get_vectorstore
from ..prompts import (
    DEEP_DIVE_PROMPT_TEMPLATE_SIMPLIFIED,
    DEEP_DIVE_PROMPT_TEMPLATE_TECHNICAL,
    _extract_summary_without_findings,
    _parse_paper_key_findings,
)
from ..rag_utils import _build_research_query, _format_rag_results_for_prompt
from ..schemas.deep_dive import DeepDiveSummaryResponse

logger = logging.getLogger(__name__)


class GenerateDeepDiveSummaryInput(BaseModel):
    """Input for generating a deep dive summary."""
    claim_id: str = Field(
        ...,
        description="The claim ID in format 'segment_key-index' (e.g., 'lex_325|00:00:00.160|1-0')"
    )
    episode_id: str = Field(
        default="lex_325",
        description="The episode ID"
    )
    n_results: int = Field(
        default=7,
        description="Number of RAG results to retrieve (default: 7)"
    )
    force_regenerate: bool = Field(
        default=False,
        description="If True, regenerate even if cached summary exists"
    )
    style: Literal["technical", "simplified"] = Field(
        default="technical",
        description="Controls prompt depth. 'technical' for detailed/mechanistic, 'simplified' for accessible summary."
    )


@mcp.tool()
async def generate_deep_dive_summary(params: GenerateDeepDiveSummaryInput) -> DeepDiveSummaryResponse:
    """
    Generate a deep dive summary for a scientific claim using RAG retrieval + Gemini synthesis.

    Flow:
    1. Load claim from cache
    2. Build research query from claim data
    3. Query ChromaDB for relevant paper chunks
    4. Enrich with paper metadata
    5. Call Gemini to synthesize a structured summary
    6. Cache and return the result
    """
    try:
        # Check cache first (unless force_regenerate)
        cache_key = f"{params.episode_id}:{params.claim_id}:{params.style}"

        if not params.force_regenerate:
            cache = _load_deep_dive_cache()
            if cache_key in cache:
                return {
                    "claim_id": params.claim_id,
                    "summary": cache[cache_key]["summary"],
                    "cached": True,
                    "generated_at": cache[cache_key].get("generated_at", "unknown"),
                    "rag_query": cache[cache_key].get("rag_query", ""),
                    "papers_retrieved": cache[cache_key].get("papers_retrieved", 0),
                    "papers": cache[cache_key].get("papers", []),
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

        # Step 2: Build research query
        research_query = _build_research_query(claim_data)

        # Step 3: Query ChromaDB
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

        # Step 4: Load papers collection for metadata enrichment
        papers_collection = _load_papers_collection()

        # Step 5: Format evidence and build prompt
        evidence_summary = _format_rag_results_for_prompt(rag_results, papers_collection)

        if params.style == "simplified":
            prompt_template = DEEP_DIVE_PROMPT_TEMPLATE_SIMPLIFIED
        else:
            prompt_template = DEEP_DIVE_PROMPT_TEMPLATE_TECHNICAL

        prompt = prompt_template.format(
            claim_text=claim_data.get("claim_text", ""),
            speaker_stance=claim_data.get("speaker_stance", "assertion"),
            needs_backing=claim_data.get("needs_backing_because", "No specific reason provided"),
            evidence_summary=evidence_summary,
        )

        # Step 6: Call Gemini
        raw_summary = await asyncio.to_thread(
            _call_gemini_for_deep_dive,
            prompt,
            GEMINI_MODEL,
        )

        # Step 7: Parse key findings and clean summary
        num_papers = min(len(rag_results), 7)  # Match the limit in _format_rag_results_for_prompt
        key_findings = _parse_paper_key_findings(raw_summary, num_papers)
        clean_summary = _extract_summary_without_findings(raw_summary)

        # Build papers list with paper_id and key_finding
        papers_list = []
        for i, r in enumerate(rag_results[:num_papers]):
            papers_list.append({
                "paper_id": r.get("paper_id", ""),
                "title": r.get("paper_title", ""),
                "section": r.get("section", ""),
                "year": r.get("year", ""),
                "key_finding": key_findings[i] if i < len(key_findings) else "",
            })

        # Step 8: Cache the result
        from datetime import datetime
        cache = _load_deep_dive_cache()
        cache[cache_key] = {
            "summary": clean_summary,
            "generated_at": datetime.utcnow().isoformat(),
            "rag_query": research_query,
            "papers_retrieved": len(rag_results),
            "claim_text": claim_data.get("claim_text", ""),
            "papers": papers_list,
        }
        _save_deep_dive_cache(cache)

        # Return structured response
        return {
            "claim_id": params.claim_id,
            "summary": clean_summary,
            "cached": False,
            "generated_at": cache[cache_key]["generated_at"],
            "rag_query": research_query,
            "papers_retrieved": len(rag_results),
            "papers": papers_list,
        }

    except Exception as e:
        import traceback
        return {
            "error": f"Error generating deep dive summary: {str(e)}",
            "traceback": traceback.format_exc(),
        }
