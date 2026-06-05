"""Knowledge graph matching, subgraph extraction, and Gemini entity extraction."""

import asyncio
import json
import logging
import re
from typing import Any

from .mcp_app import _ensure_gemini_client_ready, _get_genai_client, genai
from .config import GEMINI_MODEL

logger = logging.getLogger(__name__)

ENTITY_EXTRACTION_PROMPT = """Extract the key scientific concepts, molecules, organisms, processes, and phenomena mentioned in this claim.

CLAIM: "{claim_text}"

Return ONLY a JSON array of entity names (strings), nothing else. Focus on:
- Molecules/proteins (e.g., "membrane voltage", "ion channels", "V-ATPase")
- Organisms (e.g., "Xenopus", "planaria", "zebrafish")
- Processes (e.g., "regeneration", "left-right patterning")
- Techniques (e.g., "optogenetics", "voltage imaging")

Example output: ["membrane voltage", "ion channels", "regeneration", "planaria"]

Output ONLY the JSON array:"""


def _normalize_for_matching(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def _find_matching_entities(
    query_text: str,
    kg_nodes: list[dict],
    min_word_overlap: int = 2,
) -> list[str]:
    """Find entity IDs in kg_nodes that match terms in query_text via keyword overlap."""
    query_normalized = _normalize_for_matching(query_text)
    query_words = set(query_normalized.split())
    matched: list[str] = []

    for node in kg_nodes:
        node_id = node.get("id", "")
        all_names = [node.get("name", "")] + node.get("aliases", [])

        for name in all_names:
            name_normalized = _normalize_for_matching(name)
            name_words = set(name_normalized.split())
            overlap = query_words & name_words

            if name_normalized in query_normalized or query_normalized in name_normalized:
                matched.append(node_id)
                break
            elif len(overlap) >= min(min_word_overlap, len(name_words)):
                matched.append(node_id)
                break

    return list(set(matched))


def _extract_subgraph(
    entity_ids: list[str],
    kg_nodes: list[dict],
    kg_edges: list[dict],
    max_hops: int = 1,
) -> dict[str, Any]:
    """Extract a subgraph of entities reachable within max_hops from entity_ids."""
    nodes_by_id = {n["id"]: n for n in kg_nodes}
    included = set(entity_ids)

    for _ in range(max_hops):
        new_entities: set[str] = set()
        for edge in kg_edges:
            source = edge.get("source", "")
            target = edge.get("target", "")
            if source in included:
                new_entities.add(target)
            if target in included:
                new_entities.add(source)
        included.update(new_entities)

    subgraph_edges = [
        e for e in kg_edges
        if e.get("source") in included and e.get("target") in included
    ]
    subgraph_nodes = [nodes_by_id[eid] for eid in included if eid in nodes_by_id]

    return {"nodes": subgraph_nodes, "edges": subgraph_edges}


async def _extract_entities_with_gemini(claim_text: str) -> list[str]:
    """Use Gemini to extract entity names from claim text as a JSON array."""
    try:
        _ensure_gemini_client_ready()
        prompt = ENTITY_EXTRACTION_PROMPT.format(claim_text=claim_text)

        response = await asyncio.to_thread(
            lambda: _get_genai_client().models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
        )

        text = None
        if hasattr(response, "text"):
            text = response.text
        elif hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                text = "".join(p.text for p in candidate.content.parts if hasattr(p, "text"))

        if not text:
            return []

        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        entities = json.loads(text)
        return entities if isinstance(entities, list) else []

    except Exception:
        logger.exception("Gemini entity extraction failed for claim: %s", claim_text[:80])
        return []
