-- Migration: Add Cluster Drill-Down RPC
-- Enables fetching claims for an episode filtered by cluster
-- Run this in Supabase SQL Editor after 008_add_taxonomy_clusters.sql

-- ============================================================================
-- GET EPISODE CLAIMS BY CLUSTER
-- ============================================================================
-- Returns claims from a specific episode that belong to a specific cluster
-- Used for the cluster drill-down view in episode overview

CREATE OR REPLACE FUNCTION get_episode_claims_by_cluster(
    p_podcast_id text,
    p_cluster_id integer,
    p_limit integer DEFAULT 20
)
RETURNS TABLE (
    claim_id bigint,
    claim_text text,
    distilled_claim text,
    claim_timestamp text,
    start_ms integer,
    paper_id text,
    paper_title text,
    confidence float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as claim_id,
        c.claim_text,
        c.distilled_claim,
        c."timestamp" as claim_timestamp,
        c.start_ms,
        c.paper_id,
        c.paper_title,
        cca.confidence
    FROM claims c
    JOIN claim_cluster_assignments cca ON c.id = cca.claim_id
    WHERE c.podcast_id = p_podcast_id
    AND cca.cluster_id = p_cluster_id
    AND c.duplicate_of IS NULL  -- Exclude duplicates
    ORDER BY c.start_ms ASC, cca.confidence DESC
    LIMIT p_limit;
END;
$$;


-- ============================================================================
-- GET BOOKMARKS BY CLUSTER
-- ============================================================================
-- Returns bookmarks that belong to a specific cluster (via claim or paper)
-- Used for filtering saved items in notebook view

CREATE OR REPLACE FUNCTION get_bookmarks_by_cluster(
    p_user_id text DEFAULT 'default_user',
    p_cluster_id integer DEFAULT NULL,
    p_episode_id text DEFAULT NULL
)
RETURNS TABLE (
    bookmark_id text,
    bookmark_type text,
    claim_id bigint,
    paper_id text,
    episode_id text,
    title text,
    context_preview text,
    start_ms integer,
    notes text,
    created_at timestamptz,
    cluster_id integer,
    cluster_label text,
    cluster_confidence float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Claims with cluster assignments
    SELECT
        b.id as bookmark_id,
        b.bookmark_type::text,
        b.claim_id,
        b.paper_id,
        b.episode_id,
        b.title,
        b.context_preview,
        b.start_ms,
        b.notes,
        b.created_at,
        cca.cluster_id,
        tc.label as cluster_label,
        cca.confidence as cluster_confidence
    FROM bookmarks b
    JOIN claim_cluster_assignments cca ON b.claim_id = cca.claim_id
    JOIN taxonomy_clusters tc ON cca.cluster_id = tc.cluster_id
    WHERE b.user_id = p_user_id
    AND b.bookmark_type = 'claim'
    AND (p_cluster_id IS NULL OR cca.cluster_id = p_cluster_id)
    AND (p_episode_id IS NULL OR b.episode_id = p_episode_id)

    UNION ALL

    -- Papers with cluster assignments
    SELECT
        b.id as bookmark_id,
        b.bookmark_type::text,
        b.claim_id,
        b.paper_id,
        b.episode_id,
        b.title,
        b.context_preview,
        b.start_ms,
        b.notes,
        b.created_at,
        pca.cluster_id,
        tc.label as cluster_label,
        pca.confidence as cluster_confidence
    FROM bookmarks b
    JOIN paper_cluster_assignments pca ON b.paper_id = pca.paper_id
    JOIN taxonomy_clusters tc ON pca.cluster_id = tc.cluster_id
    WHERE b.user_id = p_user_id
    AND b.bookmark_type = 'paper'
    AND (p_cluster_id IS NULL OR pca.cluster_id = p_cluster_id)
    AND (p_episode_id IS NULL OR b.episode_id = p_episode_id)

    ORDER BY created_at DESC;
END;
$$;


-- ============================================================================
-- GET BOOKMARK CLUSTER MAPPINGS
-- ============================================================================
-- Returns which clusters each bookmark belongs to (for showing badges)

CREATE OR REPLACE FUNCTION get_bookmark_cluster_mappings(
    p_bookmark_ids text[]
)
RETURNS TABLE (
    bookmark_id text,
    cluster_id integer,
    cluster_label text,
    confidence float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Claims to clusters
    SELECT
        b.id as bookmark_id,
        cca.cluster_id,
        tc.label as cluster_label,
        cca.confidence
    FROM bookmarks b
    JOIN claim_cluster_assignments cca ON b.claim_id = cca.claim_id
    JOIN taxonomy_clusters tc ON cca.cluster_id = tc.cluster_id
    WHERE b.id = ANY(p_bookmark_ids)
    AND b.bookmark_type = 'claim'

    UNION ALL

    -- Papers to clusters
    SELECT
        b.id as bookmark_id,
        pca.cluster_id,
        tc.label as cluster_label,
        pca.confidence
    FROM bookmarks b
    JOIN paper_cluster_assignments pca ON b.paper_id = pca.paper_id
    JOIN taxonomy_clusters tc ON pca.cluster_id = tc.cluster_id
    WHERE b.id = ANY(p_bookmark_ids)
    AND b.bookmark_type = 'paper'

    ORDER BY confidence DESC;
END;
$$;
