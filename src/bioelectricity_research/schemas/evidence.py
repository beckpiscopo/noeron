from typing import Any, Optional
from pydantic import BaseModel


class EvidenceThreadsResponse(BaseModel):
    claim_id: Optional[str] = None
    threads: Optional[list[Any]] = None
    cached: Optional[bool] = None
    generated_at: Optional[str] = None
    papers_analyzed: Optional[int] = None
    eligible: Optional[bool] = None
    eligibility_reason: Optional[str] = None
    raw_thread_count: Optional[int] = None
    validated_thread_count: Optional[int] = None
    error: Optional[str] = None
    traceback: Optional[str] = None
