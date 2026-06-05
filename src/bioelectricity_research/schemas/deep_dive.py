from typing import Any, Optional
from pydantic import BaseModel


class DeepDivePaper(BaseModel):
    paper_id: str
    title: str
    section: str
    year: str
    key_finding: str


class DeepDiveSummaryResponse(BaseModel):
    claim_id: Optional[str] = None
    summary: Optional[str] = None
    cached: Optional[bool] = None
    generated_at: Optional[str] = None
    rag_query: Optional[str] = None
    papers_retrieved: Optional[int] = None
    papers: Optional[list[DeepDivePaper]] = None
    error: Optional[str] = None
    traceback: Optional[str] = None
