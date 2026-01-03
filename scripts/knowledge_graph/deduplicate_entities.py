#!/usr/bin/env python3
"""
Entity Deduplication for Bioelectricity Knowledge Graph.

Handles canonicalization and merging of equivalent entities.
E.g., "voltage gradient" = "bioelectric potential" = "membrane voltage"
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

# Pre-defined synonym groups for bioelectricity domain
# Each group has a canonical ID and list of known synonyms
BIOELECTRICITY_SYNONYMS = {
    # Bioelectric concepts
    "membrane_potential": [
        "membrane voltage", "transmembrane voltage", "vmem", "vm",
        "transmembrane potential", "resting potential", "resting membrane potential",
        "bioelectric potential", "cell voltage",
    ],
    "voltage_gradient": [
        "bioelectric gradient", "voltage pattern", "bioelectric pattern",
        "electric field", "endogenous electric field", "voltage distribution",
    ],
    "gap_junction": [
        "gap junctions", "gj", "gap junction channel", "connexin channel",
        "electrical synapse", "intercellular channel",
    ],
    "ion_channel": [
        "ion channels", "voltage-gated channel", "ion channel protein",
        "ionic channel", "membrane channel",
    ],
    "bioelectric_signaling": [
        "bioelectric signal", "bioelectrical signaling", "bioelectric signals",
        "electrical signaling", "bioelectricity",
    ],

    # Organisms
    "planaria": [
        "planarian", "planarians", "flatworm", "flatworms",
        "dugesia japonica", "schmidtea mediterranea", "girardia tigrina",
    ],
    "xenopus": [
        "xenopus laevis", "xenopus frog", "african clawed frog",
        "frog embryo", "frog tadpole",
    ],
    "tadpole": [
        "tadpoles", "frog tadpole", "xenopus tadpole",
    ],
    "zebrafish": [
        "danio rerio", "zebrafish embryo", "zebrafish larva",
    ],
    "hydra": [
        "hydra vulgaris", "freshwater polyp",
    ],

    # Techniques
    "optogenetics": [
        "optogenetic", "light-gated channels", "channelrhodopsin",
        "halorhodopsin", "optogenetic control",
    ],
    "voltage_sensitive_dye": [
        "voltage-sensitive dyes", "voltage dye", "voltage dyes",
        "vsds", "voltage indicator", "voltage imaging",
        "membrane voltage dye", "potentiometric dye",
    ],
    "ion_flux_measurement": [
        "ion flux", "ion transport measurement", "ion flow measurement",
        "vibrating probe", "self-referencing electrode",
    ],

    # Molecular components
    "connexin": [
        "connexins", "cx", "gap junction protein",
    ],
    "serotonin": [
        "5-ht", "5-hydroxytryptamine", "serotonin signaling",
    ],
    "potassium_channel": [
        "k+ channel", "potassium channels", "kv channel",
        "voltage-gated potassium channel",
    ],
    "sodium_channel": [
        "na+ channel", "sodium channels", "nav channel",
        "voltage-gated sodium channel",
    ],
    "chloride_channel": [
        "cl- channel", "chloride channels", "clc channel",
    ],
    "calcium_channel": [
        "ca2+ channel", "calcium channels", "cav channel",
        "voltage-gated calcium channel",
    ],
    "kir4_1": [
        "kir4.1", "kir41", "kcnj10", "inward rectifying potassium channel 4.1",
    ],

    # Processes
    "regeneration": [
        "regenerative process", "tissue regeneration", "organ regeneration",
        "limb regeneration", "appendage regeneration",
    ],
    "morphogenesis": [
        "pattern formation", "body patterning", "anatomical patterning",
        "morphogenetic process", "shape formation",
    ],
    "cell_proliferation": [
        "cell division", "mitosis", "cell growth",
        "proliferative activity",
    ],
    "apoptosis": [
        "programmed cell death", "cell death", "apoptotic",
    ],
    "left_right_asymmetry": [
        "left-right axis", "lr asymmetry", "laterality",
        "left right patterning", "lr patterning", "situs",
    ],
    "wound_healing": [
        "wound repair", "tissue repair", "healing response",
    ],

    # Anatomical structures
    "blastema": [
        "regeneration blastema", "blastema formation",
    ],
    "neural_tube": [
        "neural fold", "neurulation",
    ],

    # Key genes/proteins
    "notch_signaling": [
        "notch pathway", "notch", "notch receptor",
    ],
    "wnt_signaling": [
        "wnt pathway", "wnt", "beta-catenin pathway",
    ],
    "bmp_signaling": [
        "bmp pathway", "bmp", "bone morphogenetic protein",
    ],
    "h_v_atpase": [
        "v-atpase", "proton pump", "vacuolar atpase",
        "hydrogen pump", "h+ pump",
    ],
}


def normalize_id(text: str) -> str:
    """Normalize a string to a valid entity ID."""
    # Lowercase
    text = text.lower()
    # Replace spaces, hyphens, and special chars with underscore
    text = re.sub(r'[\s\-/\\]+', '_', text)
    # Remove non-alphanumeric except underscores
    text = re.sub(r'[^a-z0-9_]', '', text)
    # Remove multiple underscores
    text = re.sub(r'_+', '_', text)
    # Strip leading/trailing underscores
    text = text.strip('_')
    return text


class EntityDeduplicator:
    """Handles entity deduplication and canonicalization."""

    def __init__(self, custom_aliases: Optional[Dict[str, List[str]]] = None):
        # Build reverse lookup: alias -> canonical_id
        self.alias_to_canonical: Dict[str, str] = {}
        self.canonical_to_aliases: Dict[str, Set[str]] = defaultdict(set)

        # Load predefined synonyms
        for canonical_id, aliases in BIOELECTRICITY_SYNONYMS.items():
            self.alias_to_canonical[normalize_id(canonical_id)] = canonical_id
            self.canonical_to_aliases[canonical_id].add(normalize_id(canonical_id))
            for alias in aliases:
                norm_alias = normalize_id(alias)
                self.alias_to_canonical[norm_alias] = canonical_id
                self.canonical_to_aliases[canonical_id].add(norm_alias)

        # Load custom aliases if provided
        if custom_aliases:
            for canonical_id, aliases in custom_aliases.items():
                self.alias_to_canonical[normalize_id(canonical_id)] = canonical_id
                for alias in aliases:
                    norm_alias = normalize_id(alias)
                    self.alias_to_canonical[norm_alias] = canonical_id
                    self.canonical_to_aliases[canonical_id].add(norm_alias)

    def get_canonical_id(self, entity_id: str, aliases: Optional[List[str]] = None) -> str:
        """
        Get the canonical ID for an entity.

        First checks if the entity_id or any of its aliases match known synonyms.
        If not found, returns the normalized entity_id as-is.
        """
        norm_id = normalize_id(entity_id)

        # Check if this ID is a known alias
        if norm_id in self.alias_to_canonical:
            return self.alias_to_canonical[norm_id]

        # Check aliases
        if aliases:
            for alias in aliases:
                norm_alias = normalize_id(alias)
                if norm_alias in self.alias_to_canonical:
                    # Register the original ID as an alias too
                    canonical = self.alias_to_canonical[norm_alias]
                    self.alias_to_canonical[norm_id] = canonical
                    self.canonical_to_aliases[canonical].add(norm_id)
                    return canonical

        # Not found in known synonyms, return as-is
        return norm_id

    def register_entity(self, canonical_id: str, aliases: List[str]) -> None:
        """Register a new entity with its aliases for future deduplication."""
        norm_canonical = normalize_id(canonical_id)

        # Only register if not already a known synonym
        if norm_canonical not in self.alias_to_canonical:
            self.alias_to_canonical[norm_canonical] = canonical_id
            self.canonical_to_aliases[canonical_id].add(norm_canonical)

        for alias in aliases:
            norm_alias = normalize_id(alias)
            if norm_alias not in self.alias_to_canonical:
                self.alias_to_canonical[norm_alias] = canonical_id
                self.canonical_to_aliases[canonical_id].add(norm_alias)

    def find_similar_entities(
        self,
        entities: List[Tuple[str, str]],  # List of (id, name) tuples
        threshold: float = 0.8,
    ) -> List[Tuple[str, str, float]]:
        """
        Find potentially similar entities that might be duplicates.

        Uses simple string similarity for now. Returns list of
        (entity1_id, entity2_id, similarity_score) tuples.
        """
        from difflib import SequenceMatcher

        potential_duplicates = []

        for i, (id1, name1) in enumerate(entities):
            for id2, name2 in entities[i + 1:]:
                # Skip if already same canonical ID
                if self.get_canonical_id(id1) == self.get_canonical_id(id2):
                    continue

                # Compare names
                similarity = SequenceMatcher(None, name1.lower(), name2.lower()).ratio()
                if similarity >= threshold:
                    potential_duplicates.append((id1, id2, similarity))

                # Also compare IDs
                id_similarity = SequenceMatcher(None, normalize_id(id1), normalize_id(id2)).ratio()
                if id_similarity >= threshold and (id1, id2, id_similarity) not in potential_duplicates:
                    potential_duplicates.append((id1, id2, id_similarity))

        return sorted(potential_duplicates, key=lambda x: -x[2])

    def save_aliases(self, path: Path) -> None:
        """Save the current alias mappings to a JSON file."""
        # Convert sets to lists for JSON serialization
        data = {
            canonical: sorted(list(aliases))
            for canonical, aliases in self.canonical_to_aliases.items()
        }
        path.write_text(json.dumps(data, indent=2, sort_keys=True))

    def load_aliases(self, path: Path) -> None:
        """Load alias mappings from a JSON file."""
        if not path.exists():
            return

        data = json.loads(path.read_text())
        for canonical_id, aliases in data.items():
            for alias in aliases:
                norm_alias = normalize_id(alias)
                self.alias_to_canonical[norm_alias] = canonical_id
                self.canonical_to_aliases[canonical_id].add(norm_alias)

    def get_stats(self) -> Dict[str, int]:
        """Get statistics about the deduplication mappings."""
        return {
            "total_aliases": len(self.alias_to_canonical),
            "canonical_entities": len(self.canonical_to_aliases),
            "predefined_synonyms": len(BIOELECTRICITY_SYNONYMS),
        }


def deduplicate_graph(
    graph_path: Path,
    output_path: Optional[Path] = None,
    aliases_path: Optional[Path] = None,
) -> Dict[str, any]:
    """
    Deduplicate entities in an existing knowledge graph.

    Args:
        graph_path: Path to the knowledge graph JSON
        output_path: Path for deduplicated output (defaults to overwrite)
        aliases_path: Path to load/save custom aliases

    Returns:
        Statistics about the deduplication
    """
    # Load graph
    graph_data = json.loads(graph_path.read_text())

    # Initialize deduplicator
    deduplicator = EntityDeduplicator()
    if aliases_path and aliases_path.exists():
        deduplicator.load_aliases(aliases_path)

    # Track entity ID mappings
    id_mapping: Dict[str, str] = {}
    merged_entities: Dict[str, Dict] = {}

    original_entity_count = len(graph_data.get("nodes", []))
    original_edge_count = len(graph_data.get("edges", []))

    # Process entities
    for entity in graph_data.get("nodes", []):
        old_id = entity["id"]
        canonical_id = deduplicator.get_canonical_id(old_id, entity.get("aliases", []))
        id_mapping[old_id] = canonical_id

        if canonical_id in merged_entities:
            # Merge with existing
            existing = merged_entities[canonical_id]
            existing["mentions"] = existing.get("mentions", 1) + entity.get("mentions", 1)
            # Merge lists
            for key in ["aliases", "papers", "organisms", "techniques"]:
                existing_list = existing.get(key, [])
                for item in entity.get(key, []):
                    if item not in existing_list:
                        existing_list.append(item)
                existing[key] = existing_list
        else:
            merged_entities[canonical_id] = {
                **entity,
                "id": canonical_id,
            }
            deduplicator.register_entity(canonical_id, entity.get("aliases", []))

    # Update edges with canonical IDs
    updated_edges = []
    for edge in graph_data.get("edges", []):
        new_edge = {
            **edge,
            "source": id_mapping.get(edge["source"], edge["source"]),
            "target": id_mapping.get(edge["target"], edge["target"]),
        }
        # Skip self-loops created by deduplication
        if new_edge["source"] != new_edge["target"]:
            updated_edges.append(new_edge)

    # Remove duplicate edges
    seen_edges = set()
    unique_edges = []
    for edge in updated_edges:
        edge_key = (edge["source"], edge["target"], edge["relationship"])
        if edge_key not in seen_edges:
            seen_edges.add(edge_key)
            unique_edges.append(edge)

    # Build output
    output = {
        "nodes": list(merged_entities.values()),
        "edges": unique_edges,
        "metadata": {
            **graph_data.get("metadata", {}),
            "deduplicated_at": __import__("datetime").datetime.utcnow().isoformat(),
        },
    }

    # Save
    output_path = output_path or graph_path
    output_path.write_text(json.dumps(output, indent=2))

    if aliases_path:
        deduplicator.save_aliases(aliases_path)

    return {
        "original_entities": original_entity_count,
        "merged_entities": len(merged_entities),
        "entities_reduced": original_entity_count - len(merged_entities),
        "original_edges": original_edge_count,
        "final_edges": len(unique_edges),
        "edges_reduced": original_edge_count - len(unique_edges),
    }


def main():
    """CLI for entity deduplication."""
    import argparse

    parser = argparse.ArgumentParser(description="Deduplicate entities in knowledge graph")
    parser.add_argument("graph_path", type=Path, help="Path to knowledge graph JSON")
    parser.add_argument("--output", "-o", type=Path, help="Output path (default: overwrite input)")
    parser.add_argument("--aliases", "-a", type=Path, help="Path to custom aliases JSON")
    parser.add_argument("--stats", action="store_true", help="Show deduplicator statistics")

    args = parser.parse_args()

    if args.stats:
        dedup = EntityDeduplicator()
        if args.aliases and args.aliases.exists():
            dedup.load_aliases(args.aliases)
        stats = dedup.get_stats()
        print("Deduplicator Statistics:")
        for key, value in stats.items():
            print(f"  {key}: {value}")
        return

    stats = deduplicate_graph(args.graph_path, args.output, args.aliases)
    print("Deduplication Results:")
    for key, value in stats.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
