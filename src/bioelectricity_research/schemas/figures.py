from typing import Any, Optional
from pydantic import BaseModel


class FigureAnalysisResponse(BaseModel):
    paper_id: Optional[str] = None
    figures: Optional[list[Any]] = None
    total_figures: Optional[int] = None
    cached: Optional[bool] = None
    generated_at: Optional[str] = None
    error: Optional[str] = None
