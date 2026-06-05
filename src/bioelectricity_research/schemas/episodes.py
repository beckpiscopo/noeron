from typing import Any, Optional
from pydantic import BaseModel


class EpisodeClaim(BaseModel):
    id: str
    timestamp: float
    category: str
    title: str
    description: str
    source: str
    status: str
    timing: Optional[Any] = None
