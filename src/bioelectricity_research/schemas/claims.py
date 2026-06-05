from typing import Any, Optional
from pydantic import BaseModel


class EvidenceCounts(BaseModel):
    primary: int
    replication: int
    counter: int


class ConfidenceMetrics(BaseModel):
    confidence_level: str
    confidence_score: float
    consensus_percentage: int
    evidence_counts: EvidenceCounts


class ClaimSynthesis(BaseModel):
    claim_text: str
    rationale: str
    speaker_stance: str
    claim_type: str
    context_tags: Any


class SegmentInfo(BaseModel):
    timestamp: str
    speaker: str
    transcript_excerpt: str


class ClaimContextResponse(BaseModel):
    claim_id: Optional[str] = None
    claim_data: Optional[Any] = None
    evidence_threads: Optional[list[Any]] = None
    related_concepts: Optional[list[Any]] = None
    synthesis: Optional[ClaimSynthesis] = None
    confidence_metrics: Optional[ConfidenceMetrics] = None
    segment_info: Optional[SegmentInfo] = None
    error: Optional[str] = None
