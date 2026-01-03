"""Knowledge Graph Extraction Pipeline for Bioelectricity Research."""

from .extract_kg_from_papers import (
    extract_kg_from_paper,
    merge_extractions,
    KnowledgeGraph,
    Entity,
    Relationship,
)
from .deduplicate_entities import (
    EntityDeduplicator,
    normalize_id,
    deduplicate_graph,
)
from .validate_kg import (
    validate_extraction,
    validate_merged_graph,
)

__all__ = [
    "extract_kg_from_paper",
    "merge_extractions",
    "KnowledgeGraph",
    "Entity",
    "Relationship",
    "EntityDeduplicator",
    "normalize_id",
    "deduplicate_graph",
    "validate_extraction",
    "validate_merged_graph",
]
