from typing import Any, Optional
from pydantic import BaseModel


class TemporalWindow(BaseModel):
    start: Optional[str] = None
    end: Optional[str] = None


class ContextMetadata(BaseModel):
    episode_id: Optional[str] = None
    current_timestamp: Optional[str] = None
    temporal_window: Optional[TemporalWindow] = None
    evidence_cards_count: Optional[int] = None


class ChatResponse(BaseModel):
    response: Optional[str] = None
    sources: Optional[list[Any]] = None
    query_used: Optional[str] = None
    model: Optional[str] = None
    thinking: Optional[str] = None
    context_metadata: Optional[ContextMetadata] = None
    error: Optional[str] = None
    traceback: Optional[str] = None
