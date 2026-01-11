-- Migration: Add Taxonomy Clusters for Knowledge Cartography
-- Run this in Supabase SQL Editor
-- Adds: taxonomy_clusters, paper_cluster_assignments, claim_cluster_assignments
-- Enables clustering of papers into concept territories with soft assignments

-- ============================================================================
-- TAXONOMY_CLUSTERS TABLE
-- ============================================================================
-- Cluster definitions with LLM-generated labels and 2D positions for visualization

CREATE TABLE IF NOT EXISTS taxonomy_clusters (
    id SERIAL PRIMARY KEY,
    cluster_id INTEGER UNIQUE NOT NULL,       -- 0 to n_clusters-1 from GMM

    -- LLM-generated metadata
    label TEXT NOT NULL,                       -- "Bioelectric Morphogenesis"
    description TEXT,                          -- 1-sentence description (max 25 words)
    keywords TEXT[],                           -- 3-5 characterizing keywords

    -- Spatial positioning for bubble map (normalized 0-1 from UMAP)
    position_x FLOAT NOT NULL,
    position_y FLOAT NOT NULL,

    -- Cluster centroid embedding for nearest-cluster lookup
    centroid_embedding vector(384),

    -- Statistics
    paper_count INTEGER DEFAULT 0,
    primary_paper_count INTEGER DEFAULT 0,     -- Papers with confidence > 0.5

    -- Generation metadata
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    model_used TEXT,                           -- e.g., "gemini-3-pro-preview"

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for cluster lookup
CREATE INDEX IF NOT EXISTS idx_taxonomy_clusters_id ON taxonomy_clusters(cluster_id);

-- Index for nearest cluster search via centroid
CREATE INDEX IF NOT EXISTS idx_taxonomy_clusters_centroid ON taxonomy_clusters
    USING ivfflat (centroid_embedding vector_cosine_ops) WITH (lists = 10);


-- ============================================================================
-- PAPER_CLUSTER_ASSIGNMENTS TABLE
-- ============================================================================
-- Soft assignments of papers to clusters (many-to-many with confidence scores)

CREATE TABLE IF NOT EXISTS paper_cluster_assignments (
    id BIGSERIAL PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL REFERENCES taxonomy_clusters(cluster_id) ON DELETE CASCADE,

    -- Soft assignment from GMM
    confidence FLOAT NOT NULL,                 -- 0.0 to 1.0 (GMM probability)
    is_primary BOOLEAN DEFAULT FALSE,          -- True if highest-confidence cluster for this paper

    -- Precomputed 2D position for this paper (from UMAP)
    position_x FLOAT,
    position_y FLOAT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(paper_id, cluster_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_paper_clusters_paper ON paper_cluster_assignments(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_clusters_cluster ON paper_cluster_assignments(cluster_id);
CREATE INDEX IF NOT EXISTS idx_paper_clusters_confidence ON paper_cluster_assignments(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_paper_clusters_primary ON paper_cluster_assignments(cluster_id) WHERE is_primary = TRUE;


-- ============================================================================
-- CLAIM_CLUSTER_ASSIGNMENTS TABLE
-- ============================================================================
-- Claims inherit cluster assignments from their linked papers

CREATE TABLE IF NOT EXISTS claim_cluster_assignments (
    id BIGSERIAL PRIMARY KEY,
    claim_id BIGINT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    cluster_id INTEGER NOT NULL REFERENCES taxonomy_clusters(cluster_id) ON DELETE CASCADE,

    -- Source tracking
    source_paper_id TEXT REFERENCES papers(paper_id) ON DELETE SET NULL,
    confidence FLOAT NOT NULL,                 -- Inherited from paper assignment

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(claim_id, cluster_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_claim_clusters_claim ON claim_cluster_assignments(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_clusters_cluster ON claim_cluster_assignments(cluster_id);


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger for taxonomy_clusters
CREATE TRIGGER update_taxonomy_clusters_updated_at
    BEFORE UPDATE ON taxonomy_clusters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Get clusters for a set of paper IDs
CREATE OR REPLACE FUNCTION get_clusters_for_papers(paper_ids text[])
RETURNS TABLE (
    cluster_id integer,
    label text,
    description text,
    keywords text[],
    paper_count bigint,
    total_confidence float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tc.cluster_id,
        tc.label,
        tc.description,
        tc.keywords,
        COUNT(DISTINCT pca.paper_id) as paper_count,
        SUM(pca.confidence) as total_confidence
    FROM taxonomy_clusters tc
    JOIN paper_cluster_assignments pca ON tc.cluster_id = pca.cluster_id
    WHERE pca.paper_id = ANY(paper_ids)
    GROUP BY tc.cluster_id, tc.label, tc.description, tc.keywords
    ORDER BY total_confidence DESC;
END;
$$;


-- Get clusters for an episode (via claims -> papers)
CREATE OR REPLACE FUNCTION get_episode_cluster_coverage(p_podcast_id text)
RETURNS TABLE (
    cluster_id integer,
    label text,
    description text,
    keywords text[],
    position_x float,
    position_y float,
    claim_count bigint,
    unique_papers bigint,
    avg_confidence float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tc.cluster_id,
        tc.label,
        tc.description,
        tc.keywords,
        tc.position_x,
        tc.position_y,
        COUNT(DISTINCT cca.claim_id) as claim_count,
        COUNT(DISTINCT cca.source_paper_id) as unique_papers,
        AVG(cca.confidence)::float as avg_confidence
    FROM taxonomy_clusters tc
    JOIN claim_cluster_assignments cca ON tc.cluster_id = cca.cluster_id
    JOIN claims c ON cca.claim_id = c.id
    WHERE c.podcast_id = p_podcast_id
    GROUP BY tc.cluster_id, tc.label, tc.description, tc.keywords, tc.position_x, tc.position_y
    ORDER BY claim_count DESC;
END;
$$;


-- Get user notebook cluster distribution
-- NOTE: Uses aliased column names to avoid PL/pgSQL ambiguity with RETURNS TABLE columns
CREATE OR REPLACE FUNCTION get_notebook_cluster_distribution(
    p_user_id text DEFAULT 'default_user',
    p_episode_id text DEFAULT NULL
)
RETURNS TABLE (
    cluster_id integer,
    label text,
    description text,
    position_x float,
    position_y float,
    bookmark_count bigint,
    claim_bookmarks bigint,
    paper_bookmarks bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH bookmark_clusters AS (
        -- Claims to clusters via claim_cluster_assignments
        SELECT DISTINCT
            cca.cluster_id AS bc_cluster_id,
            b.id as bookmark_id,
            b.bookmark_type
        FROM bookmarks b
        JOIN claim_cluster_assignments cca ON b.claim_id = cca.claim_id
        WHERE b.user_id = p_user_id
        AND b.bookmark_type = 'claim'
        AND (p_episode_id IS NULL OR b.episode_id = p_episode_id)

        UNION

        -- Papers to clusters via paper_cluster_assignments
        SELECT DISTINCT
            pca.cluster_id AS bc_cluster_id,
            b.id as bookmark_id,
            b.bookmark_type
        FROM bookmarks b
        JOIN paper_cluster_assignments pca ON b.paper_id = pca.paper_id
        WHERE b.user_id = p_user_id
        AND b.bookmark_type = 'paper'
        AND (p_episode_id IS NULL OR b.episode_id = p_episode_id)
    )
    SELECT
        tc.cluster_id AS cluster_id,
        tc.label AS label,
        tc.description AS description,
        tc.position_x AS position_x,
        tc.position_y AS position_y,
        COUNT(DISTINCT bc.bookmark_id)::bigint AS bookmark_count,
        COUNT(DISTINCT bc.bookmark_id) FILTER (WHERE bc.bookmark_type = 'claim')::bigint AS claim_bookmarks,
        COUNT(DISTINCT bc.bookmark_id) FILTER (WHERE bc.bookmark_type = 'paper')::bigint AS paper_bookmarks
    FROM taxonomy_clusters tc
    LEFT JOIN bookmark_clusters bc ON tc.cluster_id = bc.bc_cluster_id
    GROUP BY tc.cluster_id, tc.label, tc.description, tc.position_x, tc.position_y
    ORDER BY COUNT(DISTINCT bc.bookmark_id) DESC;
END;
$$;


-- Compare episode clusters to notebook clusters
-- Returns all clusters showing which are in episode, which are in notebook, and overlap
-- NOTE: Uses aliased column names (out_*) internally to avoid PL/pgSQL ambiguity with RETURNS TABLE columns
CREATE OR REPLACE FUNCTION compare_episode_to_notebook(
    p_podcast_id text,
    p_user_id text DEFAULT 'default_user'
)
RETURNS TABLE (
    cluster_id integer,
    label text,
    description text,
    keywords text[],
    position_x float,
    position_y float,
    in_episode boolean,
    episode_claim_count bigint,
    in_notebook boolean,
    notebook_item_count bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH episode_clusters AS (
        SELECT
            cca.cluster_id AS ec_cluster_id,
            COUNT(DISTINCT cca.claim_id) as claim_count
        FROM claim_cluster_assignments cca
        JOIN claims c ON cca.claim_id = c.id
        WHERE c.podcast_id = p_podcast_id
        GROUP BY cca.cluster_id
    ),
    notebook_clusters AS (
        SELECT
            cca.cluster_id AS nc_cluster_id,
            COUNT(DISTINCT b.id) as item_count
        FROM bookmarks b
        JOIN claim_cluster_assignments cca ON b.claim_id = cca.claim_id
        WHERE b.user_id = p_user_id
        AND b.bookmark_type = 'claim'
        GROUP BY cca.cluster_id

        UNION

        SELECT
            pca.cluster_id AS nc_cluster_id,
            COUNT(DISTINCT b.id) as item_count
        FROM bookmarks b
        JOIN paper_cluster_assignments pca ON b.paper_id = pca.paper_id
        WHERE b.user_id = p_user_id
        AND b.bookmark_type = 'paper'
        GROUP BY pca.cluster_id
    ),
    notebook_totals AS (
        SELECT
            nc_cluster_id AS nt_cluster_id,
            SUM(item_count) as total_items
        FROM notebook_clusters
        GROUP BY nc_cluster_id
    )
    SELECT
        tc.cluster_id AS cluster_id,
        tc.label AS label,
        tc.description AS description,
        tc.keywords AS keywords,
        tc.position_x AS position_x,
        tc.position_y AS position_y,
        COALESCE(ec.claim_count > 0, FALSE) AS in_episode,
        COALESCE(ec.claim_count, 0)::bigint AS episode_claim_count,
        COALESCE(nt.total_items > 0, FALSE) AS in_notebook,
        COALESCE(nt.total_items, 0)::bigint AS notebook_item_count
    FROM taxonomy_clusters tc
    LEFT JOIN episode_clusters ec ON tc.cluster_id = ec.ec_cluster_id
    LEFT JOIN notebook_totals nt ON tc.cluster_id = nt.nt_cluster_id
    ORDER BY tc.cluster_id;
END;
$$;


-- Get all clusters with stats for bubble map rendering
CREATE OR REPLACE FUNCTION get_taxonomy_overview()
RETURNS TABLE (
    cluster_id integer,
    label text,
    description text,
    keywords text[],
    position_x float,
    position_y float,
    paper_count integer,
    primary_paper_count integer
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tc.cluster_id,
        tc.label,
        tc.description,
        tc.keywords,
        tc.position_x,
        tc.position_y,
        tc.paper_count,
        tc.primary_paper_count
    FROM taxonomy_clusters tc
    ORDER BY tc.cluster_id;
END;
$$;


-- Find nearest cluster for a new embedding (useful for classifying new papers)
CREATE OR REPLACE FUNCTION match_nearest_cluster(
    query_embedding vector(384),
    match_count int DEFAULT 3
)
RETURNS TABLE (
    cluster_id integer,
    label text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tc.cluster_id,
        tc.label,
        1 - (tc.centroid_embedding <=> query_embedding) AS similarity
    FROM taxonomy_clusters tc
    WHERE tc.centroid_embedding IS NOT NULL
    ORDER BY tc.centroid_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- ============================================================================
-- GRANTS (adjust for your Supabase setup)
-- ============================================================================

-- Grant access to authenticated users if needed
-- GRANT SELECT ON taxonomy_clusters TO authenticated;
-- GRANT SELECT ON paper_cluster_assignments TO authenticated;
-- GRANT SELECT ON claim_cluster_assignments TO authenticated;
