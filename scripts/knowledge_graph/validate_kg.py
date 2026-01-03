#!/usr/bin/env python3
"""
Knowledge Graph Validation and Inspection Script.

Validates extracted knowledge graph for quality and consistency.
Provides tools for manual inspection and tuning of extraction prompts.

Usage:
    python scripts/knowledge_graph/validate_kg.py --graph data/knowledge_graph/knowledge_graph.json
    python scripts/knowledge_graph/validate_kg.py --extraction data/knowledge_graph/raw_extractions/PAPER_ID.json
    python scripts/knowledge_graph/validate_kg.py --stats
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# Setup paths
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
KG_OUTPUT_DIR = REPO_ROOT / "data" / "knowledge_graph"
RAW_EXTRACTIONS_DIR = KG_OUTPUT_DIR / "raw_extractions"
MERGED_GRAPH_PATH = KG_OUTPUT_DIR / "knowledge_graph.json"


def load_graph(path: Path) -> Dict[str, Any]:
    """Load a knowledge graph from JSON."""
    if not path.exists():
        raise FileNotFoundError(f"Graph file not found: {path}")
    return json.loads(path.read_text())


def validate_extraction(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate a single paper extraction for quality issues.

    Returns a dict with validation results and any issues found.
    """
    issues: List[str] = []
    warnings: List[str] = []
    stats: Dict[str, Any] = {}

    entities = data.get("entities", [])
    relationships = data.get("relationships", [])

    stats["entity_count"] = len(entities)
    stats["relationship_count"] = len(relationships)

    # Check entity count
    if len(entities) < 5:
        warnings.append(f"Low entity count ({len(entities)}). Expected 10-30.")
    elif len(entities) > 50:
        warnings.append(f"High entity count ({len(entities)}). May include noise.")

    # Check relationship count
    if len(relationships) < 5:
        warnings.append(f"Low relationship count ({len(relationships)}). Expected 15-40.")
    elif len(relationships) > 60:
        warnings.append(f"High relationship count ({len(relationships)}). May include noise.")

    # Validate entity structure
    entity_ids = set()
    entity_types = Counter()
    for i, entity in enumerate(entities):
        eid = entity.get("id", "")
        if not eid:
            issues.append(f"Entity {i} missing ID")
            continue

        if eid in entity_ids:
            issues.append(f"Duplicate entity ID: {eid}")
        entity_ids.add(eid)

        if not entity.get("name"):
            warnings.append(f"Entity '{eid}' missing name")

        etype = entity.get("type", "unknown")
        entity_types[etype] += 1

    stats["entity_types"] = dict(entity_types)

    # Validate relationships
    relationship_types = Counter()
    orphan_sources = set()
    orphan_targets = set()
    confidence_scores = []

    for i, rel in enumerate(relationships):
        source = rel.get("source", "")
        target = rel.get("target", "")
        rtype = rel.get("relationship", "")

        if not source:
            issues.append(f"Relationship {i} missing source")
        elif source not in entity_ids:
            orphan_sources.add(source)

        if not target:
            issues.append(f"Relationship {i} missing target")
        elif target not in entity_ids:
            orphan_targets.add(target)

        if not rtype:
            issues.append(f"Relationship {i} missing relationship type")

        relationship_types[rtype] += 1

        conf = rel.get("confidence", 0.8)
        confidence_scores.append(conf)

        if not rel.get("evidence"):
            warnings.append(f"Relationship '{source}' -> '{target}' ({rtype}) missing evidence")

    if orphan_sources:
        warnings.append(f"Relationships reference unknown source entities: {orphan_sources}")
    if orphan_targets:
        warnings.append(f"Relationships reference unknown target entities: {orphan_targets}")

    stats["relationship_types"] = dict(relationship_types)
    if confidence_scores:
        stats["avg_confidence"] = sum(confidence_scores) / len(confidence_scores)
        stats["min_confidence"] = min(confidence_scores)
        stats["max_confidence"] = max(confidence_scores)

    # Check for self-loops
    self_loops = [
        r for r in relationships
        if r.get("source") == r.get("target")
    ]
    if self_loops:
        warnings.append(f"Found {len(self_loops)} self-loop relationships")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "stats": stats,
    }


def validate_merged_graph(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate the merged knowledge graph."""
    issues: List[str] = []
    warnings: List[str] = []
    stats: Dict[str, Any] = {}

    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    metadata = data.get("metadata", {})

    stats["node_count"] = len(nodes)
    stats["edge_count"] = len(edges)
    stats["paper_count"] = metadata.get("num_papers", 0)

    # Build entity lookup
    entity_ids = {n.get("id"): n for n in nodes}

    # Validate nodes
    entity_types = Counter()
    papers_per_entity = []
    mentions_per_entity = []

    for node in nodes:
        eid = node.get("id", "")
        etype = node.get("type", "unknown")
        entity_types[etype] += 1

        papers = node.get("papers", [])
        papers_per_entity.append(len(papers))

        mentions = node.get("mentions", 1)
        mentions_per_entity.append(mentions)

    stats["entity_types"] = dict(entity_types)
    if papers_per_entity:
        stats["avg_papers_per_entity"] = sum(papers_per_entity) / len(papers_per_entity)
        stats["max_papers_per_entity"] = max(papers_per_entity)
    if mentions_per_entity:
        stats["avg_mentions_per_entity"] = sum(mentions_per_entity) / len(mentions_per_entity)

    # Validate edges
    relationship_types = Counter()
    orphan_refs = set()

    for edge in edges:
        source = edge.get("source", "")
        target = edge.get("target", "")
        rtype = edge.get("relationship", "unknown")

        if source not in entity_ids:
            orphan_refs.add(source)
        if target not in entity_ids:
            orphan_refs.add(target)

        relationship_types[rtype] += 1

    if orphan_refs:
        warnings.append(f"Edges reference {len(orphan_refs)} unknown entities: {list(orphan_refs)[:10]}")

    stats["relationship_types"] = dict(relationship_types)

    # Check for isolated nodes (no edges)
    connected_entities = set()
    for edge in edges:
        connected_entities.add(edge.get("source"))
        connected_entities.add(edge.get("target"))

    isolated = [eid for eid in entity_ids if eid not in connected_entities]
    if isolated:
        warnings.append(f"Found {len(isolated)} isolated entities with no relationships")
        stats["isolated_entities"] = len(isolated)

    # Find most connected entities
    connection_counts = Counter()
    for edge in edges:
        connection_counts[edge.get("source")] += 1
        connection_counts[edge.get("target")] += 1

    stats["top_connected_entities"] = [
        {"id": eid, "name": entity_ids[eid].get("name", eid), "connections": count}
        for eid, count in connection_counts.most_common(10)
    ]

    # Cross-paper connections
    cross_paper_edges = 0
    for edge in edges:
        source_papers = set(entity_ids.get(edge.get("source"), {}).get("papers", []))
        target_papers = set(entity_ids.get(edge.get("target"), {}).get("papers", []))
        if source_papers and target_papers and source_papers != target_papers:
            cross_paper_edges += 1

    stats["cross_paper_connections"] = cross_paper_edges

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "stats": stats,
    }


def print_validation_report(result: Dict[str, Any], title: str = "Validation Report"):
    """Pretty print a validation report."""
    print(f"\n{'=' * 60}")
    print(f" {title}")
    print(f"{'=' * 60}")

    if result["valid"]:
        print("\n[PASSED] No critical issues found")
    else:
        print(f"\n[FAILED] {len(result['issues'])} critical issues found")

    if result["issues"]:
        print(f"\nIssues ({len(result['issues'])}):")
        for issue in result["issues"]:
            print(f"  - {issue}")

    if result["warnings"]:
        print(f"\nWarnings ({len(result['warnings'])}):")
        for warning in result["warnings"][:10]:  # Limit to first 10
            print(f"  - {warning}")
        if len(result["warnings"]) > 10:
            print(f"  ... and {len(result['warnings']) - 10} more")

    print("\nStatistics:")
    for key, value in result["stats"].items():
        if isinstance(value, dict):
            print(f"  {key}:")
            for k, v in sorted(value.items(), key=lambda x: -x[1])[:10]:
                print(f"    {k}: {v}")
        elif isinstance(value, list):
            print(f"  {key}:")
            for item in value[:5]:
                print(f"    - {item}")
        elif isinstance(value, float):
            print(f"  {key}: {value:.2f}")
        else:
            print(f"  {key}: {value}")

    print(f"\n{'=' * 60}\n")


def inspect_relationships(
    data: Dict[str, Any],
    entity_filter: Optional[str] = None,
    relationship_filter: Optional[str] = None,
    limit: int = 20,
):
    """Interactively inspect relationships in the graph."""
    edges = data.get("edges", [])
    nodes = {n.get("id"): n for n in data.get("nodes", [])}

    # Filter edges
    filtered = edges
    if entity_filter:
        entity_filter = entity_filter.lower()
        filtered = [
            e for e in filtered
            if entity_filter in e.get("source", "").lower()
            or entity_filter in e.get("target", "").lower()
        ]
    if relationship_filter:
        relationship_filter = relationship_filter.lower()
        filtered = [
            e for e in filtered
            if relationship_filter in e.get("relationship", "").lower()
        ]

    print(f"\nShowing {min(limit, len(filtered))} of {len(filtered)} relationships:\n")

    for i, edge in enumerate(filtered[:limit]):
        source_id = edge.get("source", "?")
        target_id = edge.get("target", "?")
        source_name = nodes.get(source_id, {}).get("name", source_id)
        target_name = nodes.get(target_id, {}).get("name", target_id)
        rtype = edge.get("relationship", "?")
        confidence = edge.get("confidence", "?")
        evidence = edge.get("evidence", "No evidence")[:100]

        print(f"{i+1}. {source_name} --[{rtype}]--> {target_name}")
        print(f"   Confidence: {confidence}")
        print(f"   Evidence: {evidence}...")
        print()


def get_all_extractions_stats() -> Dict[str, Any]:
    """Get statistics across all raw extractions."""
    if not RAW_EXTRACTIONS_DIR.exists():
        return {"error": "No raw extractions directory found"}

    extraction_files = list(RAW_EXTRACTIONS_DIR.glob("*.json"))
    if not extraction_files:
        return {"error": "No extraction files found"}

    total_entities = 0
    total_relationships = 0
    all_entity_types = Counter()
    all_relationship_types = Counter()
    papers_processed = []
    issues_count = 0

    for path in extraction_files:
        try:
            data = json.loads(path.read_text())
            papers_processed.append(path.stem)

            entities = data.get("entities", [])
            relationships = data.get("relationships", [])

            total_entities += len(entities)
            total_relationships += len(relationships)

            for e in entities:
                all_entity_types[e.get("type", "unknown")] += 1

            for r in relationships:
                all_relationship_types[r.get("relationship", "unknown")] += 1

            # Quick validation
            result = validate_extraction(data)
            if not result["valid"]:
                issues_count += 1

        except (json.JSONDecodeError, KeyError) as e:
            issues_count += 1
            continue

    return {
        "papers_processed": len(papers_processed),
        "total_entities": total_entities,
        "total_relationships": total_relationships,
        "avg_entities_per_paper": total_entities / len(papers_processed) if papers_processed else 0,
        "avg_relationships_per_paper": total_relationships / len(papers_processed) if papers_processed else 0,
        "entity_types": dict(all_entity_types),
        "relationship_types": dict(all_relationship_types),
        "papers_with_issues": issues_count,
    }


def main():
    parser = argparse.ArgumentParser(description="Validate and inspect knowledge graph")

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--graph",
        type=Path,
        help="Path to merged knowledge graph JSON",
    )
    group.add_argument(
        "--extraction",
        type=Path,
        help="Path to single paper extraction JSON",
    )
    group.add_argument(
        "--stats",
        action="store_true",
        help="Show statistics across all extractions",
    )

    parser.add_argument(
        "--inspect",
        action="store_true",
        help="Interactive relationship inspection mode",
    )
    parser.add_argument(
        "--entity",
        type=str,
        help="Filter to relationships involving this entity",
    )
    parser.add_argument(
        "--relationship",
        type=str,
        help="Filter to this relationship type",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Max relationships to show in inspect mode",
    )

    args = parser.parse_args()

    if args.stats:
        stats = get_all_extractions_stats()
        print("\n" + "=" * 60)
        print(" Knowledge Graph Extraction Statistics")
        print("=" * 60)
        for key, value in stats.items():
            if isinstance(value, dict):
                print(f"\n{key}:")
                for k, v in sorted(value.items(), key=lambda x: -x[1])[:15]:
                    print(f"  {k}: {v}")
            elif isinstance(value, float):
                print(f"{key}: {value:.2f}")
            else:
                print(f"{key}: {value}")
        print()
        return

    if args.graph:
        data = load_graph(args.graph)
        if args.inspect:
            inspect_relationships(data, args.entity, args.relationship, args.limit)
        else:
            result = validate_merged_graph(data)
            print_validation_report(result, f"Merged Graph Validation: {args.graph.name}")

    elif args.extraction:
        data = load_graph(args.extraction)
        if args.inspect:
            # For single extraction, wrap in graph format
            inspect_relationships({
                "nodes": data.get("entities", []),
                "edges": data.get("relationships", []),
            }, args.entity, args.relationship, args.limit)
        else:
            result = validate_extraction(data)
            print_validation_report(result, f"Paper Extraction: {args.extraction.name}")


if __name__ == "__main__":
    main()
