#!/usr/bin/env python3
"""
Generate claim-entity relevance explanations for the knowledge graph.

This script pre-computes WHY each entity in a claim's subgraph is relevant
to that specific claim, enabling the UI to explain entity connections.

Usage:
    python scripts/knowledge_graph/generate_claim_relevance.py --all
    python scripts/knowledge_graph/generate_claim_relevance.py --sample 10
    python scripts/knowledge_graph/generate_claim_relevance.py --claim-ids "lex_325|00:00:00-0"
    python scripts/knowledge_graph/generate_claim_relevance.py --force  # Re-generate all
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

try:
    from google import genai
except ImportError:
    genai = None

# Setup paths
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

# Load .env file
_env_file = REPO_ROOT / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Paths
CLAIMS_CACHE_PATH = REPO_ROOT / "cache" / "podcast_lex_325_claims.json"
KNOWLEDGE_GRAPH_PATH = REPO_ROOT / "data" / "knowledge_graph" / "knowledge_graph.json"
OUTPUT_PATH = REPO_ROOT / "data" / "knowledge_graph" / "claim_entity_relevance.json"

# Gemini config
GEMINI_API_KEY_ENV = "GEMINI_API_KEY"
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-pro-preview")

# Claim roles
CLAIM_ROLES = [
    "claim_concept",         # Directly mentioned in the claim
    "experimental_technique", # Methods/tools used to study this
    "mechanism",             # Underlying molecular/cellular process
    "supporting_context",    # Background context from papers
]

CLAIM_RELEVANCE_PROMPT = """You are analyzing a scientific claim and its related knowledge graph entities from bioelectricity research.

## CLAIM
"{claim_text}"

## ENTITIES IN KNOWLEDGE GRAPH SUBGRAPH
{entities_json}

## RELATIONSHIPS BETWEEN ENTITIES
{edges_json}

## YOUR TASK
For EACH entity in the subgraph, explain in 1-2 sentences WHY it is relevant to understanding this specific claim. Also categorize each entity's role:

- "claim_concept": Entity is directly mentioned or clearly implied in the claim text
- "experimental_technique": Methods, tools, or techniques used to study the phenomena in the claim
- "mechanism": Underlying molecular, cellular, or bioelectric process that explains HOW the claim works
- "supporting_context": Background scientific context that helps understand the claim

## OUTPUT FORMAT (JSON only, no commentary)
{{
  "entity_id_1": {{
    "relevance_to_claim": "1-2 sentence explanation of why this entity matters for this specific claim",
    "claim_role": "claim_concept|experimental_technique|mechanism|supporting_context"
  }},
  "entity_id_2": {{
    "relevance_to_claim": "...",
    "claim_role": "..."
  }}
}}

IMPORTANT:
- Be specific to THIS claim, not generic descriptions
- Explain the CONNECTION between the entity and the claim
- Every entity in the subgraph must be in your output
- Return ONLY valid JSON, no markdown fences or commentary
"""

_GENAI_CLIENT: Optional[genai.Client] = None


def _ensure_gemini_client() -> genai.Client:
    """Initialize or return the Gemini client."""
    global _GENAI_CLIENT
    if _GENAI_CLIENT is not None:
        return _GENAI_CLIENT
    if genai is None:
        raise RuntimeError("google-genai is not installed. Run: pip install google-genai")
    api_key = os.environ.get(GEMINI_API_KEY_ENV)
    if not api_key:
        raise RuntimeError(f"{GEMINI_API_KEY_ENV} environment variable is required")
    _GENAI_CLIENT = genai.Client(api_key=api_key)
    return _GENAI_CLIENT


def load_claims_cache() -> dict[str, Any]:
    """Load the claims cache."""
    if not CLAIMS_CACHE_PATH.exists():
        logger.error(f"Claims cache not found: {CLAIMS_CACHE_PATH}")
        return {}
    return json.loads(CLAIMS_CACHE_PATH.read_text())


def load_knowledge_graph() -> dict[str, Any]:
    """Load the knowledge graph."""
    if not KNOWLEDGE_GRAPH_PATH.exists():
        logger.error(f"Knowledge graph not found: {KNOWLEDGE_GRAPH_PATH}")
        return {"nodes": [], "edges": []}
    return json.loads(KNOWLEDGE_GRAPH_PATH.read_text())


def load_existing_relevance() -> dict[str, Any]:
    """Load existing relevance cache if it exists."""
    if OUTPUT_PATH.exists():
        return json.loads(OUTPUT_PATH.read_text())
    return {"metadata": {}, "claims": {}}


def normalize_for_matching(text: str) -> str:
    """Normalize text for fuzzy matching."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def find_matching_entities(
    query_text: str,
    kg_nodes: list[dict],
    min_word_overlap: int = 2
) -> list[str]:
    """Find entities in the KG that match terms in the query text."""
    query_normalized = normalize_for_matching(query_text)
    query_words = set(query_normalized.split())

    matched_entities = []

    for node in kg_nodes:
        node_id = node.get("id", "")
        node_name = node.get("name", "")
        aliases = node.get("aliases", [])

        all_names = [node_name] + aliases

        for name in all_names:
            name_normalized = normalize_for_matching(name)
            name_words = set(name_normalized.split())

            overlap = query_words & name_words

            if name_normalized in query_normalized or query_normalized in name_normalized:
                matched_entities.append(node_id)
                break
            elif len(overlap) >= min(min_word_overlap, len(name_words)):
                matched_entities.append(node_id)
                break

    return list(set(matched_entities))


def extract_subgraph(
    entity_ids: list[str],
    kg_nodes: list[dict],
    kg_edges: list[dict],
    max_hops: int = 1
) -> dict[str, Any]:
    """Extract a subgraph containing the specified entities and their connections."""
    nodes_by_id = {n["id"]: n for n in kg_nodes}

    included_entity_ids = set(entity_ids)

    for _ in range(max_hops):
        new_entities = set()
        for edge in kg_edges:
            source = edge.get("source", "")
            target = edge.get("target", "")

            if source in included_entity_ids:
                new_entities.add(target)
            if target in included_entity_ids:
                new_entities.add(source)

        included_entity_ids.update(new_entities)

    subgraph_edges = [
        edge for edge in kg_edges
        if edge.get("source") in included_entity_ids
        and edge.get("target") in included_entity_ids
    ]

    subgraph_nodes = [
        nodes_by_id[eid] for eid in included_entity_ids
        if eid in nodes_by_id
    ]

    return {
        "nodes": subgraph_nodes,
        "edges": subgraph_edges,
    }


async def generate_relevance_for_claim(
    claim_id: str,
    claim_text: str,
    subgraph: dict[str, Any]
) -> dict[str, dict[str, str]]:
    """Generate relevance explanations for all entities in a claim's subgraph."""
    if not subgraph["nodes"]:
        return {}

    client = _ensure_gemini_client()

    # Format entities for prompt
    entities_for_prompt = []
    for node in subgraph["nodes"]:
        entities_for_prompt.append({
            "id": node["id"],
            "name": node["name"],
            "type": node.get("type", "concept"),
            "description": node.get("description", ""),
        })

    # Format edges for prompt
    edges_for_prompt = []
    for edge in subgraph["edges"][:30]:  # Limit edges to avoid token overflow
        edges_for_prompt.append({
            "source": edge["source"],
            "target": edge["target"],
            "relationship": edge.get("relationship", "related"),
            "evidence": edge.get("evidence", "")[:200],  # Truncate evidence
        })

    prompt = CLAIM_RELEVANCE_PROMPT.format(
        claim_text=claim_text,
        entities_json=json.dumps(entities_for_prompt, indent=2),
        edges_json=json.dumps(edges_for_prompt, indent=2),
    )

    try:
        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
        )

        # Extract text
        text = None
        if hasattr(response, "text"):
            text = response.text
        elif hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "content") and hasattr(candidate.content, "parts"):
                text = "".join(part.text for part in candidate.content.parts if hasattr(part, "text"))

        if not text:
            logger.warning(f"Empty response for claim {claim_id}")
            return {}

        # Clean and parse JSON
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
        text = text.strip()

        result = json.loads(text)

        # Validate and normalize claim_role
        for entity_id, data in result.items():
            role = data.get("claim_role", "supporting_context")
            if role not in CLAIM_ROLES:
                data["claim_role"] = "supporting_context"

        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error for claim {claim_id}: {e}")
        logger.debug(f"Raw response: {text[:500] if text else 'None'}")
        return {}
    except Exception as e:
        logger.error(f"Error generating relevance for claim {claim_id}: {e}")
        return {}


def collect_all_claims(claims_cache: dict) -> list[tuple[str, str]]:
    """
    Collect all claim IDs and texts from the cache.

    Returns list of (claim_id, claim_text) tuples.
    """
    claims = []
    segments = claims_cache.get("segments", {})

    for segment_key, segment_data in segments.items():
        segment_claims = segment_data.get("claims", [])
        for idx, claim in enumerate(segment_claims):
            claim_id = f"{segment_key}-{idx}"
            # Handle both dict and string claim formats
            if isinstance(claim, dict):
                claim_text = claim.get("claim_text", "")
            elif isinstance(claim, str):
                claim_text = claim
            else:
                continue
            if claim_text:
                claims.append((claim_id, claim_text))

    return claims


async def process_single_claim(
    claim_id: str,
    claim_text: str,
    kg_nodes: list[dict],
    kg_edges: list[dict],
) -> tuple[str, str, dict | None]:
    """
    Process a single claim and return (claim_id, claim_text, entity_relevance or None).
    This is designed to be run in parallel with other claims.
    """
    # Find matching entities
    matched_ids = find_matching_entities(claim_text, kg_nodes, min_word_overlap=2)

    # Try looser matching if no results
    if not matched_ids:
        matched_ids = find_matching_entities(claim_text, kg_nodes, min_word_overlap=1)

    if not matched_ids:
        logger.debug(f"No entities matched for claim: {claim_id[:50]}...")
        return (claim_id, claim_text, None)

    # Extract subgraph
    subgraph = extract_subgraph(matched_ids, kg_nodes, kg_edges, max_hops=1)

    if not subgraph["nodes"]:
        return (claim_id, claim_text, None)

    logger.info(f"Processing claim {claim_id} ({len(subgraph['nodes'])} entities)...")

    # Generate relevance
    entity_relevance = await generate_relevance_for_claim(claim_id, claim_text, subgraph)

    return (claim_id, claim_text, entity_relevance)


# Default concurrency level for parallel processing
DEFAULT_CONCURRENCY = 5


async def process_claims(
    claims: list[tuple[str, str]],
    kg_nodes: list[dict],
    kg_edges: list[dict],
    existing_cache: dict[str, Any],
    force: bool = False,
    concurrency: int = DEFAULT_CONCURRENCY
) -> dict[str, Any]:
    """Process all claims and generate relevance using parallel processing."""
    result = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "claims_processed": 0,
            "gemini_model": GEMINI_MODEL,
            "concurrency": concurrency,
        },
        "claims": existing_cache.get("claims", {}) if not force else {},
    }

    processed = 0
    skipped = 0
    errors = 0

    # Filter out already-cached claims
    claims_to_process = []
    for claim_id, claim_text in claims:
        if not force and claim_id in result["claims"]:
            skipped += 1
        else:
            claims_to_process.append((claim_id, claim_text))

    logger.info(f"Processing {len(claims_to_process)} claims with concurrency={concurrency} (skipped {skipped} cached)")

    # Process in batches for parallel execution
    for batch_start in range(0, len(claims_to_process), concurrency):
        batch = claims_to_process[batch_start:batch_start + concurrency]

        logger.info(f"Starting batch {batch_start // concurrency + 1} ({len(batch)} claims)...")

        # Process batch in parallel
        tasks = [
            process_single_claim(claim_id, claim_text, kg_nodes, kg_edges)
            for claim_id, claim_text in batch
        ]

        batch_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect results
        for res in batch_results:
            if isinstance(res, Exception):
                logger.error(f"Batch task failed: {res}")
                errors += 1
                continue

            claim_id, claim_text, entity_relevance = res

            if entity_relevance:
                result["claims"][claim_id] = {
                    "claim_text": claim_text,
                    "entities": entity_relevance,
                }
                processed += 1
            elif entity_relevance is None:
                # No matching entities - not an error, just skip
                pass
            else:
                errors += 1

        # Save progress after each batch
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_PATH.write_text(json.dumps(result, indent=2))
        logger.info(f"Saved progress: {processed} claims processed, {errors} errors")

        # Small delay between batches to be nice to the API
        await asyncio.sleep(1)

    result["metadata"]["claims_processed"] = processed
    result["metadata"]["claims_skipped"] = skipped
    result["metadata"]["claims_errors"] = errors

    return result


async def main():
    parser = argparse.ArgumentParser(description="Generate claim-entity relevance explanations")
    parser.add_argument("--all", action="store_true", help="Process all claims")
    parser.add_argument("--sample", type=int, help="Process a random sample of N claims")
    parser.add_argument("--claim-ids", nargs="+", help="Process specific claim IDs")
    parser.add_argument("--force", action="store_true", help="Re-generate even if cached")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY,
                        help=f"Number of claims to process in parallel (default: {DEFAULT_CONCURRENCY})")
    args = parser.parse_args()

    if not (args.all or args.sample or args.claim_ids):
        parser.error("Must specify --all, --sample N, or --claim-ids")

    # Load data
    logger.info("Loading claims cache...")
    claims_cache = load_claims_cache()
    if not claims_cache:
        logger.error("Failed to load claims cache")
        return

    logger.info("Loading knowledge graph...")
    kg = load_knowledge_graph()
    kg_nodes = kg.get("nodes", [])
    kg_edges = kg.get("edges", [])

    if not kg_nodes:
        logger.error("Knowledge graph is empty")
        return

    logger.info(f"Loaded {len(kg_nodes)} entities and {len(kg_edges)} relationships")

    # Load existing cache
    existing_cache = load_existing_relevance()
    logger.info(f"Existing cache has {len(existing_cache.get('claims', {}))} claims")

    # Collect claims to process
    all_claims = collect_all_claims(claims_cache)
    logger.info(f"Found {len(all_claims)} claims in cache")

    if args.claim_ids:
        claims_to_process = [(cid, ct) for cid, ct in all_claims if cid in args.claim_ids]
    elif args.sample:
        import random
        claims_to_process = random.sample(all_claims, min(args.sample, len(all_claims)))
    else:
        claims_to_process = all_claims

    logger.info(f"Processing {len(claims_to_process)} claims...")

    # Process
    result = await process_claims(
        claims_to_process,
        kg_nodes,
        kg_edges,
        existing_cache,
        force=args.force,
        concurrency=args.concurrency
    )

    # Save final result
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(result, indent=2))

    logger.info(f"\nDone! Saved to {OUTPUT_PATH}")
    logger.info(f"  Processed: {result['metadata'].get('claims_processed', 0)}")
    logger.info(f"  Skipped (cached): {result['metadata'].get('claims_skipped', 0)}")
    logger.info(f"  Errors: {result['metadata'].get('claims_errors', 0)}")


if __name__ == "__main__":
    asyncio.run(main())
