from typing import Any, Optional
from pydantic import BaseModel


class ExpansionStats(BaseModel):
    rag_results_used: int
    papers_referenced: int
    existing_kg_edges: int
    new_concepts_found: int
    evidence_found: int
    counter_arguments_found: int
    cross_domain_found: int


class ConceptExpansionResponse(BaseModel):
    concept_name: Optional[str] = None
    concept_context: Optional[str] = None
    related_concepts: Optional[list[Any]] = None
    supporting_evidence: Optional[list[Any]] = None
    counter_arguments: Optional[list[Any]] = None
    cross_domain: Optional[list[Any]] = None
    analysis_notes: Optional[str] = None
    stats: Optional[ExpansionStats] = None
    error: Optional[str] = None
    traceback: Optional[str] = None
