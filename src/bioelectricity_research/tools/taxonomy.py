"""Taxonomy cluster visualization and comparison tools."""

import logging
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..mcp_app import mcp, _get_supabase_client
from ..schemas.taxonomy import (
    TaxonomyClusterListResponse,
    ClusterDetailsResponse,
    ClusterCoverageResponse,
    ClusterDistributionResponse,
    ClusterComparisonResponse,
    BubbleMapResponse,
)

logger = logging.getLogger(__name__)


class ListTaxonomyClustersInput(BaseModel):
    include_papers: bool = Field(default=False, description="Include top papers per cluster")
    limit_papers: int = Field(default=5, ge=1, le=20, description="Number of top papers to include per cluster")


class GetClusterDetailsInput(BaseModel):
    cluster_id: int = Field(ge=0, description="The cluster ID (0-indexed)")
    include_papers: bool = Field(default=True, description="Include papers in this cluster")
    include_claims: bool = Field(default=False, description="Include claims in this cluster")
    limit: int = Field(default=20, ge=1, le=100, description="Maximum items to return")


class GetEpisodeClusterCoverageInput(BaseModel):
    podcast_id: str = Field(min_length=1, description="The podcast/episode ID (e.g., lex_325)")


class GetNotebookClusterDistributionInput(BaseModel):
    episode_id: Optional[str] = Field(default=None, description="Optional episode ID to filter by")


class CompareEpisodeToNotebookInput(BaseModel):
    podcast_id: str = Field(min_length=1, description="The podcast/episode ID to compare")


@mcp.tool()
async def list_taxonomy_clusters(params: ListTaxonomyClustersInput) -> TaxonomyClusterListResponse:
    """
    List all taxonomy clusters with their labels and positions.

    Returns cluster metadata for rendering the bubble map visualization.
    Each cluster represents a concept territory in the bioelectricity research landscape.

    Returns:
        clusters: List of cluster objects with id, label, description, keywords, position, paper_count
    """
    try:
        db = _get_supabase_client()
        clusters = db.get_taxonomy_clusters()

        if params.include_papers:
            for cluster in clusters:
                papers = db.get_cluster_papers(
                    cluster_id=cluster["cluster_id"],
                    limit=params.limit_papers,
                    include_paper_details=True
                )
                cluster["top_papers"] = [
                    {
                        "paper_id": p["paper_id"],
                        "title": p.get("papers", {}).get("title", ""),
                        "year": p.get("papers", {}).get("year"),
                        "confidence": p["confidence"]
                    }
                    for p in papers
                ]

        return {"clusters": clusters}

    except Exception as e:
        return {"error": f"Error listing clusters: {str(e)}", "clusters": []}


@mcp.tool()
async def get_cluster_details(params: GetClusterDetailsInput) -> ClusterDetailsResponse:
    """
    Get detailed information about a specific taxonomy cluster.

    Returns cluster metadata, optionally including the papers and claims assigned to it.
    Use this to drill down into a specific research territory.
    """
    try:
        db = _get_supabase_client()

        # Get cluster metadata
        clusters = db.get_taxonomy_clusters()
        cluster = next((c for c in clusters if c["cluster_id"] == params.cluster_id), None)

        if not cluster:
            return {"error": f"Cluster {params.cluster_id} not found"}

        result = {"cluster": cluster}

        if params.include_papers:
            papers = db.get_cluster_papers(
                cluster_id=params.cluster_id,
                limit=params.limit,
                include_paper_details=True
            )
            result["papers"] = papers

        if params.include_claims:
            # Get claims via the claim_cluster_assignments table
            response = db.client.table("claim_cluster_assignments")\
                .select("*, claims!inner(id, claim_text, distilled_claim, podcast_id, timestamp)")\
                .eq("cluster_id", params.cluster_id)\
                .order("confidence", desc=True)\
                .limit(params.limit)\
                .execute()
            result["claims"] = response.data

        return result

    except Exception as e:
        return {"error": f"Error getting cluster details: {str(e)}"}


@mcp.tool()
async def get_episode_cluster_coverage(params: GetEpisodeClusterCoverageInput) -> ClusterCoverageResponse:
    """
    Get which taxonomy clusters are covered by claims in a specific episode.

    Shows the research territories touched by this episode, useful for
    displaying "Topics covered in this episode" with cluster context.
    """
    try:
        db = _get_supabase_client()
        coverage = db.get_episode_cluster_coverage(params.podcast_id)

        return {
            "podcast_id": params.podcast_id,
            "clusters": coverage,
            "cluster_count": len(coverage)
        }

    except Exception as e:
        return {"error": f"Error getting episode coverage: {str(e)}", "clusters": []}


@mcp.tool()
async def get_notebook_cluster_distribution(params: GetNotebookClusterDistributionInput) -> ClusterDistributionResponse:
    """
    Get the distribution of saved notebook items across taxonomy clusters.

    Shows which research territories the user has been exploring based on
    their bookmarked claims and papers. Use this to display cluster coverage
    in the notebook overview.
    """
    try:
        db = _get_supabase_client()
        distribution = db.get_notebook_cluster_distribution(
            user_id="default_user",
            episode_id=params.episode_id
        )

        # Calculate totals
        total_bookmarks = sum(c.get("bookmark_count", 0) for c in distribution)
        explored_clusters = [c for c in distribution if c.get("bookmark_count", 0) > 0]

        return {
            "distribution": distribution,
            "total_bookmarks": total_bookmarks,
            "explored_cluster_count": len(explored_clusters),
            "total_cluster_count": len(distribution),
            "episode_id": params.episode_id
        }

    except Exception as e:
        return {"error": f"Error getting distribution: {str(e)}", "distribution": []}


@mcp.tool()
async def compare_episode_to_notebook(params: CompareEpisodeToNotebookInput) -> ClusterComparisonResponse:
    """
    Compare clusters covered by an episode vs what's in the user's notebook.

    This is the key insight tool for knowledge cartography:
    - Shows clusters in episode that are NEW (not yet explored in notebook)
    - Shows clusters in episode that OVERLAP with existing notebook items
    - Helps users see "This episode explores X, Y, Z - you've touched X but not Y, Z"
    """
    try:
        db = _get_supabase_client()
        all_clusters = db.compare_episode_to_notebook(
            podcast_id=params.podcast_id,
            user_id="default_user"
        )

        # Categorize clusters
        new_clusters = [c for c in all_clusters if c.get("in_episode") and not c.get("in_notebook")]
        overlapping = [c for c in all_clusters if c.get("in_episode") and c.get("in_notebook")]
        existing_only = [c for c in all_clusters if not c.get("in_episode") and c.get("in_notebook")]
        unexplored = [c for c in all_clusters if not c.get("in_episode") and not c.get("in_notebook")]

        return {
            "podcast_id": params.podcast_id,
            "new_clusters": new_clusters,
            "overlapping_clusters": overlapping,
            "existing_only_clusters": existing_only,
            "unexplored_clusters": unexplored,
            "summary": {
                "episode_cluster_count": len([c for c in all_clusters if c.get("in_episode")]),
                "notebook_cluster_count": len([c for c in all_clusters if c.get("in_notebook")]),
                "new_territory_count": len(new_clusters),
                "overlap_count": len(overlapping),
                "total_clusters": len(all_clusters)
            }
        }

    except Exception as e:
        return {"error": f"Error comparing: {str(e)}", "summary": {}}


@mcp.tool()
async def get_cluster_bubble_map_data(params: dict) -> BubbleMapResponse:
    """
    Get all data needed to render the cluster bubble map visualization.

    Returns cluster positions, sizes, labels, and statistics needed for
    the D3-based bubble map component. Positions are normalized 0-1 from UMAP.
    """
    try:
        db = _get_supabase_client()
        clusters = db.get_taxonomy_overview()

        nodes = [
            {
                "id": f"cluster-{c['cluster_id']}",
                "cluster_id": c["cluster_id"],
                "type": "cluster",
                "label": c["label"],
                "description": c["description"],
                "keywords": c.get("keywords", []),
                "x": c["position_x"],
                "y": c["position_y"],
                "size": c["paper_count"],
                "primaryCount": c.get("primary_paper_count", 0)
            }
            for c in clusters
        ]

        return {
            "nodes": nodes,
            "bounds": {"minX": 0, "maxX": 1, "minY": 0, "maxY": 1},
            "cluster_count": len(nodes)
        }

    except Exception as e:
        return {"error": f"Error getting map data: {str(e)}", "nodes": []}
