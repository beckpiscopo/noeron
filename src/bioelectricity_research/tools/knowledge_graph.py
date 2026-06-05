"""Knowledge graph subgraph retrieval tool."""

import logging
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..cache_store import _load_claims_cache, _load_claim_relevance_cache, _load_knowledge_graph
from ..knowledge_graph_utils import (
    _extract_entities_with_gemini,
    _extract_subgraph,
    _find_matching_entities,
)
from ..mcp_app import mcp
from ..schemas.knowledge_graph import KGSubgraphResponse

logger = logging.getLogger(__name__)


class GetRelevantKGSubgraphInput(BaseModel):
    """Input for retrieving a relevant knowledge graph subgraph."""
    claim_id: Optional[str] = Field(
        default=None,
        description="The claim ID to get KG context for (format: 'segment_key-index')"
    )
    claim_text: Optional[str] = Field(
        default=None,
        description="Direct claim text to search (alternative to claim_id)"
    )
    episode_id: str = Field(
        default="lex_325",
        description="The episode ID (used with claim_id)"
    )
    max_hops: int = Field(
        default=1,
        ge=1,
        le=2,
        description="How many hops from matched entities to include (1-2)"
    )
    use_gemini_extraction: bool = Field(
        default=False,
        description="Use Gemini for entity extraction (slower but more accurate)"
    )


@mcp.tool()
async def get_relevant_kg_subgraph(params: GetRelevantKGSubgraphInput) -> KGSubgraphResponse:
    """
    Get a relevant subgraph from the knowledge graph for a given claim.

    This tool extracts entities mentioned in the claim and returns the
    portion of the knowledge graph containing those entities and their
    relationships.

    Flow:
    1. Get claim text (from claim_id or directly)
    2. Extract entities from claim using keyword matching or Gemini
    3. Find matching entities in the knowledge graph
    4. Extract subgraph with specified hop distance
    5. Return nodes and edges
    """
    try:
        # Step 1: Get claim text
        claim_text = params.claim_text

        if not claim_text and params.claim_id:
            # Load from claims cache
            claims_cache = _load_claims_cache()

            parts = params.claim_id.rsplit("-", 1)
            if len(parts) != 2:
                return {"error": f"Invalid claim_id format: {params.claim_id}"}

            segment_key = parts[0]
            try:
                claim_index = int(parts[1])
            except ValueError:
                return {"error": f"Invalid claim index in claim_id: {params.claim_id}"}

            segments = claims_cache.get("segments", {})
            segment_data = segments.get(segment_key)

            if not segment_data:
                return {"error": f"Segment not found: {segment_key}"}

            claims_list = segment_data.get("claims", [])
            if claim_index >= len(claims_list):
                return {"error": f"Claim index {claim_index} out of range"}

            claim_data = claims_list[claim_index]
            claim_text = claim_data.get("claim_text", "")

        if not claim_text:
            return {"error": "No claim text provided. Use claim_id or claim_text parameter."}

        # Step 2: Load knowledge graph
        kg = _load_knowledge_graph()
        kg_nodes = kg.get("nodes", [])
        kg_edges = kg.get("edges", [])

        if not kg_nodes:
            return {
                "error": "Knowledge graph is empty. Run the extraction pipeline first.",
                "hint": "python3 scripts/knowledge_graph/extract_kg_from_papers.py --all"
            }

        # Step 3: Extract/match entities
        if params.use_gemini_extraction:
            # Use Gemini to extract entity names, then match to KG
            extracted_names = await _extract_entities_with_gemini(claim_text)
            matched_ids = []
            for name in extracted_names:
                ids = _find_matching_entities(name, kg_nodes, min_word_overlap=1)
                matched_ids.extend(ids)
            matched_ids = list(set(matched_ids))
        else:
            # Direct keyword matching
            matched_ids = _find_matching_entities(claim_text, kg_nodes, min_word_overlap=2)

        if not matched_ids:
            # Try with looser matching
            matched_ids = _find_matching_entities(claim_text, kg_nodes, min_word_overlap=1)

        if not matched_ids:
            return {
                "claim_text": claim_text,
                "matched_entities": [],
                "nodes": [],
                "edges": [],
                "message": "No matching entities found in knowledge graph for this claim."
            }

        # Step 4: Extract subgraph
        subgraph = _extract_subgraph(
            matched_ids,
            kg_nodes,
            kg_edges,
            max_hops=params.max_hops
        )

        # Step 5: Format response
        # Mark which nodes were direct matches vs expanded
        for node in subgraph["nodes"]:
            node["is_direct_match"] = node["id"] in matched_ids

        # Step 6: Inject pre-computed claim-entity relevance
        if params.claim_id:
            relevance_cache = _load_claim_relevance_cache()
            claim_relevance = relevance_cache.get("claims", {}).get(params.claim_id, {}).get("entities", {})

            for node in subgraph["nodes"]:
                node_id = node["id"]
                if node_id in claim_relevance:
                    node["relevance_to_claim"] = claim_relevance[node_id].get("relevance_to_claim")
                    node["claim_role"] = claim_relevance[node_id].get("claim_role")
                else:
                    node["relevance_to_claim"] = None
                    node["claim_role"] = "supporting_context"

        # Sort edges by relationship type for better display
        subgraph["edges"].sort(key=lambda e: e.get("relationship", ""))

        return {
            "claim_text": claim_text,
            "matched_entity_ids": matched_ids,
            "matched_entity_names": [
                next((n["name"] for n in kg_nodes if n["id"] == eid), eid)
                for eid in matched_ids
            ],
            "nodes": subgraph["nodes"],
            "edges": subgraph["edges"],
            "stats": {
                "direct_matches": len(matched_ids),
                "total_nodes": len(subgraph["nodes"]),
                "total_edges": len(subgraph["edges"]),
            }
        }

    except Exception as e:
        import traceback
        return {
            "error": f"Error retrieving KG subgraph: {str(e)}",
            "traceback": traceback.format_exc(),
        }
