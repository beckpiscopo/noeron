"""Claim context retrieval tool."""

import logging
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..cache_store import _load_claims_cache, _load_context_card_registry, _load_papers_collection
from ..mcp_app import mcp, get_vectorstore
from ..schemas.claims import ClaimContextResponse

logger = logging.getLogger(__name__)


class GetClaimContextInput(BaseModel):
    claim_id: str = Field(min_length=1, max_length=200, description="The claim ID (format: segment_key-index)")
    episode_id: str = Field(default="lex_325", description="The episode ID")
    include_related_concepts: bool = Field(default=True, description="Whether to search for related concepts")
    related_concepts_limit: int = Field(default=5, ge=1, le=20, description="Number of related concepts to return")


@mcp.tool()
async def get_claim_context(params: GetClaimContextInput) -> ClaimContextResponse:
    """
    Get enriched context data for a specific claim including evidence threads,
    related research papers, and related concepts.
    """
    try:
        # Load claims cache to get the claim data
        claims_cache = _load_claims_cache()

        # Parse claim_id to get segment_key and claim_index
        # Format: "episode_id|timestamp|window-claim_index"
        parts = params.claim_id.rsplit("-", 1)
        if len(parts) != 2:
            return {
                "error": f"Invalid claim_id format: {params.claim_id}. Expected format: segment_key-index"
            }

        segment_key = parts[0]
        try:
            claim_index = int(parts[1])
        except ValueError:
            return {
                "error": f"Invalid claim index in claim_id: {params.claim_id}"
            }

        # Get segment data
        segments = claims_cache.get("segments", {})
        segment_data = segments.get(segment_key)

        if not segment_data:
            return {
                "error": f"Segment not found: {segment_key}"
            }

        # Get specific claim
        claims_list = segment_data.get("claims", [])
        if claim_index >= len(claims_list):
            return {
                "error": f"Claim index {claim_index} out of range for segment {segment_key}"
            }

        claim_data = claims_list[claim_index]

        # Load context card registry
        registry = _load_context_card_registry()
        segment_registry = registry.get("segments", {}).get(segment_key, {})

        # Get RAG results from REGISTRY (not from segment_data)
        # RAG results are stored in the context card registry
        rag_results = segment_registry.get("rag_results", [])

        # Load papers collection for metadata
        papers_collection = _load_papers_collection()

        # Build evidence threads from RAG results
        evidence_threads = []
        paper_ids_seen = set()

        for rag_result in rag_results:
            # Match this RAG result to the specific claim if possible
            if rag_result.get("claim_text") and claim_data.get("claim_text"):
                if rag_result["claim_text"] != claim_data["claim_text"]:
                    continue

            paper_id = rag_result.get("paper_id")
            if not paper_id or paper_id in paper_ids_seen:
                continue

            paper_ids_seen.add(paper_id)

            # Get paper metadata from collection
            paper_metadata = papers_collection.get(paper_id, {}).get("metadata", {})

            # Classify evidence type based on confidence score and claim type
            confidence = rag_result.get("confidence_score", 0.5)
            claim_type = rag_result.get("claim_type", "")

            if confidence >= 0.7 or "primary" in claim_type.lower():
                evidence_type = "primary"
            elif "counter" in claim_type.lower() or "alternative" in claim_type.lower():
                evidence_type = "counter"
            else:
                evidence_type = "replication"

            # Format authors
            authors = paper_metadata.get("authors", [])
            author_str = "Unknown"
            if authors:
                first_author = authors[0].get("name", "Unknown")
                if len(authors) > 1:
                    author_str = f"{first_author} et al."
                else:
                    author_str = first_author

            year = paper_metadata.get("year", "")
            venue = paper_metadata.get("venue", "")

            evidence_threads.append({
                "type": evidence_type,
                "title": f"{author_str}, {venue} ({year})" if venue else f"{author_str} ({year})",
                "paper_title": rag_result.get("paper_title", paper_metadata.get("title", "")),
                "description": rag_result.get("rationale", "")[:200],
                "paper_id": paper_id,
                "source_link": rag_result.get("source_link", ""),
                "confidence_score": confidence,
                "citation_count": paper_metadata.get("citationCount", 0),
                "highlighted": evidence_type == "primary",
            })

        # Sort evidence threads: primary first, then by citation count
        evidence_threads.sort(key=lambda x: (
            0 if x["type"] == "primary" else 1 if x["type"] == "replication" else 2,
            -x["citation_count"]
        ))

        # Search for related concepts using vector store if requested
        related_concepts = []
        if params.include_related_concepts and claim_data.get("claim_text"):
            try:
                vs = get_vectorstore()
                search_results = vs.search(
                    claim_data["claim_text"],
                    n_results=params.related_concepts_limit
                )

                docs = search_results.get("documents", [[]])[0]
                metas = search_results.get("metadatas", [[]])[0]

                seen_titles = set()
                for doc, meta in zip(docs, metas):
                    paper_title = meta.get("paper_title", "")
                    if paper_title and paper_title not in seen_titles:
                        seen_titles.add(paper_title)

                        section = meta.get("section_heading", paper_title)

                        related_concepts.append({
                            "title": section if section else paper_title,
                            "description": doc[:150] + "..." if len(doc) > 150 else doc,
                            "paper_title": paper_title,
                            "paper_id": meta.get("paper_id", ""),
                            "year": meta.get("year", ""),
                        })
            except Exception as e:
                logger.warning("Error searching for related concepts: %s", e)

        # Generate synthesis from claim data
        synthesis = {
            "claim_text": claim_data.get("claim_text", ""),
            "rationale": claim_data.get("needs_backing_because", ""),
            "speaker_stance": claim_data.get("speaker_stance", "assertion"),
            "claim_type": claim_data.get("claim_type", ""),
            "context_tags": claim_data.get("context_tags", {}),
        }

        # Calculate confidence metrics
        confidence_scores = [et["confidence_score"] for et in evidence_threads if et["confidence_score"]]
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.5

        # Consensus based on evidence type distribution
        evidence_types = [et["type"] for et in evidence_threads]
        primary_count = evidence_types.count("primary")
        replication_count = evidence_types.count("replication")
        counter_count = evidence_types.count("counter")
        total = len(evidence_types)

        consensus_pct = 0
        if total > 0:
            supporting = primary_count + replication_count
            consensus_pct = int((supporting / total) * 100)

        confidence_level = "High" if avg_confidence >= 0.7 else "Medium" if avg_confidence >= 0.4 else "Low"

        return {
            "claim_id": params.claim_id,
            "claim_data": claim_data,
            "evidence_threads": evidence_threads[:10],  # Limit to top 10
            "related_concepts": related_concepts,
            "synthesis": synthesis,
            "confidence_metrics": {
                "confidence_level": confidence_level,
                "confidence_score": round(avg_confidence, 2),
                "consensus_percentage": consensus_pct,
                "evidence_counts": {
                    "primary": primary_count,
                    "replication": replication_count,
                    "counter": counter_count,
                }
            },
            "segment_info": {
                "timestamp": segment_data.get("timestamp", ""),
                "speaker": segment_data.get("speaker", ""),
                "transcript_excerpt": segment_data.get("transcript_text", "")[:300],
            }
        }

    except Exception as e:
        return {
            "error": f"Error getting claim context: {str(e)}"
        }
