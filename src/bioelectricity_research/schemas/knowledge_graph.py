from typing import Any, Optional
from pydantic import BaseModel


class KGStats(BaseModel):
    direct_matches: int
    total_nodes: int
    total_edges: int


class KGSubgraphResponse(BaseModel):
    claim_text: Optional[str] = None
    matched_entity_ids: Optional[list[str]] = None
    matched_entity_names: Optional[list[str]] = None
    nodes: Optional[list[Any]] = None
    edges: Optional[list[Any]] = None
    stats: Optional[KGStats] = None
    message: Optional[str] = None
    error: Optional[str] = None
    hint: Optional[str] = None
    traceback: Optional[str] = None
