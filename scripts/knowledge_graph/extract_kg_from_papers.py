#!/usr/bin/env python3
"""
Knowledge Graph Extraction Pipeline for Scientific Papers.

Extracts entities and relationships from Michael Levin's bioelectricity research corpus
using Gemini API with structured extraction prompts.

Usage:
    python scripts/knowledge_graph/extract_kg_from_papers.py --paper-ids PAPER_ID1 PAPER_ID2
    python scripts/knowledge_graph/extract_kg_from_papers.py --sample 5
    python scripts/knowledge_graph/extract_kg_from_papers.py --all
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
GROBID_DIR = REPO_ROOT / "data" / "grobid_fulltext"
PAPERS_COLLECTION = REPO_ROOT / "data" / "papers_collection.json"
KG_OUTPUT_DIR = REPO_ROOT / "data" / "knowledge_graph"
RAW_EXTRACTIONS_DIR = KG_OUTPUT_DIR / "raw_extractions"
MERGED_GRAPH_PATH = KG_OUTPUT_DIR / "knowledge_graph.json"
ENTITY_ALIASES_PATH = KG_OUTPUT_DIR / "entity_aliases.json"

# Gemini config
GEMINI_API_KEY_ENV = "GEMINI_API_KEY"
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-pro-preview")
GEMINI_MAX_OUTPUT_TOKENS = 8192

# Entity types for bioelectricity domain
ENTITY_TYPES = [
    "concept",           # Scientific concepts (bioelectric signals, morphogenesis, etc.)
    "organism",          # Model organisms (planaria, xenopus, hydra, etc.)
    "technique",         # Experimental techniques (optogenetics, voltage-sensitive dyes, etc.)
    "molecule",          # Molecules (ion channels, gap junctions, neurotransmitters, etc.)
    "gene",              # Genes and proteins
    "anatomical_structure",  # Body parts, tissues, organs
    "process",           # Biological processes (regeneration, development, etc.)
    "phenomenon",        # Observable phenomena (left-right asymmetry, etc.)
]

# Relationship types
RELATIONSHIP_TYPES = [
    "regulates",         # X regulates Y (e.g., voltage gradients regulate gene expression)
    "enables",           # X enables Y (e.g., gap junctions enable bioelectric signaling)
    "disrupts",          # X disrupts Y (e.g., blocking ion channels disrupts regeneration)
    "precedes",          # X precedes Y temporally (e.g., depolarization precedes cell division)
    "correlates_with",   # X correlates with Y (statistical association)
    "required_for",      # X is required for Y (necessity relationship)
    "inhibits",          # X inhibits Y
    "activates",         # X activates Y
    "produces",          # X produces Y
    "expressed_in",      # X is expressed in Y (gene/protein in tissue)
    "interacts_with",    # General interaction
    "part_of",           # X is part of Y
    "measured_by",       # X is measured by technique Y
]

EXTRACTION_PROMPT = """You are an expert scientific knowledge graph extractor specializing in bioelectricity and developmental biology research.

Your task is to extract entities and relationships from a scientific paper to build a knowledge graph.

## Entity Types to Extract:
{entity_types}

## Relationship Types to Extract:
{relationship_types}

## Output Schema:

Return a JSON object with this exact structure:
```json
{{
  "paper_id": "string - the paper ID provided",
  "entities": [
    {{
      "id": "lowercase_snake_case_id",
      "name": "Human readable name",
      "type": "one of the entity types above",
      "description": "Brief description from the paper context",
      "aliases": ["list", "of", "alternative", "names"],
      "mentions": 3
    }}
  ],
  "relationships": [
    {{
      "source": "entity_id",
      "target": "entity_id",
      "relationship": "one of the relationship types above",
      "evidence": "Direct quote or paraphrase from paper supporting this relationship",
      "confidence": 0.9,
      "section": "which section this was found in"
    }}
  ],
  "paper_metadata": {{
    "title": "paper title",
    "year": 2020,
    "organisms": ["list of model organisms studied"],
    "techniques": ["list of experimental techniques used"],
    "key_findings": ["list of 2-3 main findings"]
  }}
}}
```

## Guidelines:

1. **Entity IDs**: Use lowercase_snake_case, be consistent (e.g., "voltage_gradient" not "voltage gradient" or "Voltage_Gradient")

2. **Entity Deduplication**:
   - Use canonical names (e.g., "gap_junction" not "gj" or "gap-junction")
   - Include common aliases in the aliases field
   - Merge concepts that refer to the same thing (e.g., "membrane potential" = "transmembrane voltage" = "Vmem")

3. **Relationships**:
   - Only extract relationships explicitly stated or strongly implied in the text
   - Include the evidence quote that supports the relationship
   - Assign confidence based on how directly the relationship is stated (1.0 = explicit, 0.7 = implied, 0.5 = speculative)

4. **Focus Areas for Bioelectricity Research**:
   - Bioelectric signaling mechanisms
   - Ion channels and gap junctions
   - Voltage gradients and their effects
   - Morphogenesis and pattern formation
   - Regeneration and development
   - Model organisms: planaria, xenopus, hydra, zebrafish

5. **Quality over Quantity**: Extract 10-30 high-quality entities and 15-40 meaningful relationships per paper. Skip trivial or overly generic relationships.

## Paper Content:

Title: {title}
Abstract: {abstract}

Full Text (sections):
{sections_text}

---

Extract the knowledge graph as JSON only. No additional commentary.
"""


@dataclass
class Entity:
    id: str
    name: str
    type: str
    description: str = ""
    aliases: List[str] = field(default_factory=list)
    mentions: int = 1
    papers: List[str] = field(default_factory=list)
    organisms: List[str] = field(default_factory=list)
    techniques: List[str] = field(default_factory=list)


@dataclass
class Relationship:
    source: str
    target: str
    relationship: str
    evidence: str = ""
    confidence: float = 0.8
    section: str = ""
    paper_id: str = ""


@dataclass
class KnowledgeGraph:
    nodes: List[Entity] = field(default_factory=list)
    edges: List[Relationship] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": [asdict(n) for n in self.nodes],
            "edges": [asdict(e) for e in self.edges],
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeGraph":
        nodes = [Entity(**n) for n in data.get("nodes", [])]
        edges = [Relationship(**e) for e in data.get("edges", [])]
        return cls(nodes=nodes, edges=edges, metadata=data.get("metadata", {}))


_GENAI_CLIENT: Optional[genai.Client] = None


def _ensure_gemini_client() -> genai.Client:
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


def load_grobid_paper(paper_id: str) -> Optional[Dict[str, Any]]:
    """Load a paper from GROBID fulltext directory."""
    # Try direct filename match
    grobid_path = GROBID_DIR / f"{paper_id}.json"
    if grobid_path.exists():
        return json.loads(grobid_path.read_text())

    # Try with _arxiv suffix
    arxiv_path = GROBID_DIR / f"{paper_id}_arxiv.json"
    if arxiv_path.exists():
        return json.loads(arxiv_path.read_text())

    # Search through all files for matching paper_id
    for path in GROBID_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text())
            if data.get("paper_id") == paper_id:
                return data
            if data.get("metadata", {}).get("paperId") == paper_id:
                return data
        except (json.JSONDecodeError, KeyError):
            continue

    return None


def list_available_papers() -> List[str]:
    """List all paper IDs available in GROBID directory."""
    paper_ids = []
    for path in GROBID_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text())
            paper_id = data.get("paper_id") or path.stem
            paper_ids.append(paper_id)
        except (json.JSONDecodeError, KeyError):
            continue
    return paper_ids


def prepare_paper_text(paper_data: Dict[str, Any], max_tokens: int = 30000) -> Tuple[str, str, str]:
    """Extract title, abstract, and sections text from paper data."""
    content = paper_data.get("content", {})
    metadata = paper_data.get("metadata", {})

    title = content.get("title") or metadata.get("title") or "Unknown Title"
    abstract = content.get("abstract") or metadata.get("abstract") or ""

    sections = content.get("sections", [])
    sections_text_parts = []

    for section in sections:
        heading = section.get("heading", "")
        text = section.get("text", "")
        if heading and text:
            sections_text_parts.append(f"## {heading}\n{text}")
        elif text:
            sections_text_parts.append(text)

    sections_text = "\n\n".join(sections_text_parts)

    # Rough token estimation (4 chars per token)
    estimated_tokens = len(sections_text) // 4
    if estimated_tokens > max_tokens:
        # Truncate to fit
        max_chars = max_tokens * 4
        sections_text = sections_text[:max_chars] + "\n\n[... truncated for length ...]"

    return title, abstract, sections_text


def build_extraction_prompt(title: str, abstract: str, sections_text: str) -> str:
    """Build the extraction prompt with paper content."""
    entity_types_str = "\n".join(f"- {et}" for et in ENTITY_TYPES)
    relationship_types_str = "\n".join(f"- {rt}" for rt in RELATIONSHIP_TYPES)

    return EXTRACTION_PROMPT.format(
        entity_types=entity_types_str,
        relationship_types=relationship_types_str,
        title=title,
        abstract=abstract,
        sections_text=sections_text,
    )


def extract_json_from_response(text: str) -> Dict[str, Any]:
    """Extract JSON from Gemini response, handling markdown code blocks."""
    text = text.strip()

    # Remove markdown code blocks if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```)
        lines = lines[1:]
        # Remove last line if it's ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    # Try to parse JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        import re
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        raise ValueError(f"Could not extract valid JSON from response:\n{text[:500]}...")


def _call_gemini_extraction(prompt: str, paper_id: str) -> Dict[str, Any]:
    """Call Gemini API for knowledge graph extraction."""
    client = _ensure_gemini_client()

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config={
            "max_output_tokens": GEMINI_MAX_OUTPUT_TOKENS,
            "temperature": 0.1,  # Low temperature for consistent extraction
        }
    )

    # Extract text from response
    text = ""
    if hasattr(response, "text"):
        text = response.text
    elif hasattr(response, "candidates") and response.candidates:
        for candidate in response.candidates:
            if hasattr(candidate, "content") and candidate.content:
                for part in candidate.content.parts:
                    if hasattr(part, "text"):
                        text += part.text

    if not text:
        raise ValueError("Empty response from Gemini")

    return extract_json_from_response(text)


async def extract_kg_from_paper(
    paper_id: str,
    force: bool = False,
) -> Optional[Dict[str, Any]]:
    """Extract knowledge graph from a single paper."""
    # Check for cached extraction
    cache_path = RAW_EXTRACTIONS_DIR / f"{paper_id}.json"
    if cache_path.exists() and not force:
        logger.info(f"Loading cached extraction for {paper_id}")
        return json.loads(cache_path.read_text())

    # Load paper
    paper_data = load_grobid_paper(paper_id)
    if not paper_data:
        logger.warning(f"Paper {paper_id} not found in GROBID directory")
        return None

    title, abstract, sections_text = prepare_paper_text(paper_data)

    if not sections_text and not abstract:
        logger.warning(f"Paper {paper_id} has no content to extract from")
        return None

    logger.info(f"Extracting KG from: {title[:60]}...")

    prompt = build_extraction_prompt(title, abstract, sections_text)

    try:
        result = await asyncio.to_thread(_call_gemini_extraction, prompt, paper_id)

        # Ensure paper_id is set
        result["paper_id"] = paper_id
        result["extracted_at"] = datetime.utcnow().isoformat()

        # Save to cache
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(result, indent=2))
        logger.info(f"Extracted {len(result.get('entities', []))} entities, "
                   f"{len(result.get('relationships', []))} relationships")

        return result

    except Exception as e:
        logger.error(f"Extraction failed for {paper_id}: {e}")
        return None


def merge_extractions(extractions: List[Dict[str, Any]]) -> KnowledgeGraph:
    """Merge multiple paper extractions into a unified knowledge graph."""
    from scripts.knowledge_graph.deduplicate_entities import EntityDeduplicator

    all_entities: Dict[str, Entity] = {}
    all_edges: List[Relationship] = []

    deduplicator = EntityDeduplicator()

    for extraction in extractions:
        paper_id = extraction.get("paper_id", "unknown")
        paper_meta = extraction.get("paper_metadata", {})

        # Process entities
        for ent_data in extraction.get("entities", []):
            entity_id = ent_data.get("id", "").lower().replace(" ", "_").replace("-", "_")
            if not entity_id:
                continue

            # Deduplicate/canonicalize
            canonical_id = deduplicator.get_canonical_id(entity_id, ent_data.get("aliases", []))

            if canonical_id in all_entities:
                # Merge with existing
                existing = all_entities[canonical_id]
                existing.mentions += ent_data.get("mentions", 1)
                if paper_id not in existing.papers:
                    existing.papers.append(paper_id)
                # Merge aliases
                for alias in ent_data.get("aliases", []):
                    if alias not in existing.aliases:
                        existing.aliases.append(alias)
                # Merge organisms/techniques
                for org in paper_meta.get("organisms", []):
                    if org not in existing.organisms:
                        existing.organisms.append(org)
                for tech in paper_meta.get("techniques", []):
                    if tech not in existing.techniques:
                        existing.techniques.append(tech)
            else:
                # Create new entity
                all_entities[canonical_id] = Entity(
                    id=canonical_id,
                    name=ent_data.get("name", entity_id),
                    type=ent_data.get("type", "concept"),
                    description=ent_data.get("description", ""),
                    aliases=ent_data.get("aliases", []),
                    mentions=ent_data.get("mentions", 1),
                    papers=[paper_id],
                    organisms=paper_meta.get("organisms", []),
                    techniques=paper_meta.get("techniques", []),
                )
                deduplicator.register_entity(canonical_id, ent_data.get("aliases", []))

        # Process relationships
        for rel_data in extraction.get("relationships", []):
            source_id = rel_data.get("source", "").lower().replace(" ", "_").replace("-", "_")
            target_id = rel_data.get("target", "").lower().replace(" ", "_").replace("-", "_")

            if not source_id or not target_id:
                continue

            # Canonicalize IDs
            source_id = deduplicator.get_canonical_id(source_id, [])
            target_id = deduplicator.get_canonical_id(target_id, [])

            all_edges.append(Relationship(
                source=source_id,
                target=target_id,
                relationship=rel_data.get("relationship", "relates_to"),
                evidence=rel_data.get("evidence", ""),
                confidence=rel_data.get("confidence", 0.8),
                section=rel_data.get("section", ""),
                paper_id=paper_id,
            ))

    # Save aliases
    deduplicator.save_aliases(ENTITY_ALIASES_PATH)

    return KnowledgeGraph(
        nodes=list(all_entities.values()),
        edges=all_edges,
        metadata={
            "created_at": datetime.utcnow().isoformat(),
            "num_papers": len(extractions),
            "paper_ids": [e.get("paper_id") for e in extractions],
        }
    )


async def main():
    parser = argparse.ArgumentParser(description="Extract knowledge graph from papers")

    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--paper-ids",
        nargs="+",
        help="Specific paper IDs to process",
    )
    input_group.add_argument(
        "--sample",
        type=int,
        help="Process a random sample of N papers",
    )
    input_group.add_argument(
        "--all",
        action="store_true",
        help="Process all available papers",
    )
    input_group.add_argument(
        "--list",
        action="store_true",
        help="List available paper IDs and exit",
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-extraction even if cached",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Merge all cached extractions into unified graph",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=MERGED_GRAPH_PATH,
        help="Output path for merged graph",
    )

    args = parser.parse_args()

    # Ensure output directories exist
    KG_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    RAW_EXTRACTIONS_DIR.mkdir(parents=True, exist_ok=True)

    if args.list:
        papers = list_available_papers()
        print(f"Available papers ({len(papers)}):")
        for pid in sorted(papers)[:20]:
            print(f"  {pid}")
        if len(papers) > 20:
            print(f"  ... and {len(papers) - 20} more")
        return

    # Determine which papers to process
    paper_ids = []
    if args.paper_ids:
        paper_ids = args.paper_ids
    elif args.sample:
        import random
        all_papers = list_available_papers()
        paper_ids = random.sample(all_papers, min(args.sample, len(all_papers)))
    elif args.all:
        paper_ids = list_available_papers()

    if not args.merge:
        # Extract from papers
        logger.info(f"Processing {len(paper_ids)} papers...")

        extractions = []
        for i, paper_id in enumerate(paper_ids, 1):
            logger.info(f"[{i}/{len(paper_ids)}] Processing {paper_id}")
            result = await extract_kg_from_paper(paper_id, force=args.force)
            if result:
                extractions.append(result)

        logger.info(f"Successfully extracted from {len(extractions)}/{len(paper_ids)} papers")

    # Merge extractions
    if args.merge or len(paper_ids) > 0:
        # Load all cached extractions
        cached_extractions = []
        for path in RAW_EXTRACTIONS_DIR.glob("*.json"):
            try:
                cached_extractions.append(json.loads(path.read_text()))
            except json.JSONDecodeError:
                continue

        if cached_extractions:
            logger.info(f"Merging {len(cached_extractions)} extractions...")
            graph = merge_extractions(cached_extractions)

            # Save merged graph
            args.output.write_text(json.dumps(graph.to_dict(), indent=2))
            logger.info(f"Saved merged graph to {args.output}")
            logger.info(f"Graph contains {len(graph.nodes)} nodes and {len(graph.edges)} edges")
        else:
            logger.warning("No cached extractions found to merge")


if __name__ == "__main__":
    asyncio.run(main())
