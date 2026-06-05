from typing import Any, Optional
from pydantic import BaseModel


class TaxonomyClusterListResponse(BaseModel):
    clusters: Optional[list[Any]] = None
    error: Optional[str] = None


class ClusterDetailsResponse(BaseModel):
    cluster: Optional[Any] = None
    papers: Optional[list[Any]] = None
    claims: Optional[list[Any]] = None
    error: Optional[str] = None


class ClusterCoverageResponse(BaseModel):
    podcast_id: Optional[str] = None
    clusters: Optional[list[Any]] = None
    cluster_count: Optional[int] = None
    error: Optional[str] = None


class ClusterDistributionResponse(BaseModel):
    distribution: Optional[list[Any]] = None
    total_bookmarks: Optional[int] = None
    explored_cluster_count: Optional[int] = None
    total_cluster_count: Optional[int] = None
    episode_id: Optional[str] = None
    error: Optional[str] = None


class ComparisonSummary(BaseModel):
    episode_cluster_count: int
    notebook_cluster_count: int
    new_territory_count: int
    overlap_count: int
    total_clusters: int


class ClusterComparisonResponse(BaseModel):
    podcast_id: Optional[str] = None
    new_clusters: Optional[list[Any]] = None
    overlapping_clusters: Optional[list[Any]] = None
    existing_only_clusters: Optional[list[Any]] = None
    unexplored_clusters: Optional[list[Any]] = None
    summary: Optional[ComparisonSummary] = None
    error: Optional[str] = None


class BubbleMapBounds(BaseModel):
    minX: float
    maxX: float
    minY: float
    maxY: float


class BubbleMapResponse(BaseModel):
    nodes: Optional[list[Any]] = None
    bounds: Optional[BubbleMapBounds] = None
    cluster_count: Optional[int] = None
    error: Optional[str] = None
