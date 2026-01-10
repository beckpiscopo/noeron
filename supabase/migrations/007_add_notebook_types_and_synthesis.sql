-- Migration: Add Notebook Types and Synthesis Cache
-- Run this in Supabase SQL Editor
-- Adds ai_insight and image bookmark types, plus notebook_synthesis cache table

-- ============================================================================
-- 1. EXPAND BOOKMARK_TYPE CONSTRAINT
-- ============================================================================
-- Drop the old inline CHECK constraint and add expanded version
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_bookmark_type_check;
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_bookmark_type_check
    CHECK (bookmark_type IN ('claim', 'paper', 'snippet', 'ai_insight', 'image'));


-- ============================================================================
-- 2. ADD COLUMNS FOR NEW BOOKMARK TYPES
-- ============================================================================
-- For ai_insight type: track where the insight came from
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS insight_source TEXT;

-- For image type: store URL and optional caption
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS image_caption TEXT;


-- ============================================================================
-- 3. ADD CONSTRAINTS FOR NEW TYPES
-- ============================================================================
-- AI insights must have context_preview (the insight text)
ALTER TABLE bookmarks ADD CONSTRAINT valid_ai_insight CHECK (
    (bookmark_type = 'ai_insight' AND context_preview IS NOT NULL AND episode_id IS NOT NULL) OR
    bookmark_type != 'ai_insight'
);

-- Images must have image_url
ALTER TABLE bookmarks ADD CONSTRAINT valid_image CHECK (
    (bookmark_type = 'image' AND image_url IS NOT NULL AND episode_id IS NOT NULL) OR
    bookmark_type != 'image'
);


-- ============================================================================
-- 4. ADD INDEX FOR PER-EPISODE QUERIES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_bookmarks_episode
    ON bookmarks(user_id, episode_id)
    WHERE episode_id IS NOT NULL;


-- ============================================================================
-- 5. CREATE NOTEBOOK_SYNTHESIS TABLE (Cache for AI-generated overviews)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notebook_synthesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'default_user',
    episode_id TEXT NOT NULL,

    -- Synthesis content
    synthesis_text TEXT NOT NULL,
    themes JSONB,  -- Array of { name: string, description: string }
    connections JSONB,  -- Cross-episode connections (stub for v1)

    -- Generation metadata
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    bookmark_count_at_generation INTEGER,
    model_used TEXT,

    -- Cache invalidation flag
    is_stale BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One synthesis per user per episode
    UNIQUE(user_id, episode_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notebook_synthesis_episode
    ON notebook_synthesis(user_id, episode_id);


-- ============================================================================
-- 6. AUTO-INVALIDATE SYNTHESIS WHEN BOOKMARKS CHANGE
-- ============================================================================
CREATE OR REPLACE FUNCTION invalidate_notebook_synthesis()
RETURNS TRIGGER AS $$
DECLARE
    target_episode_id TEXT;
    target_user_id TEXT;
BEGIN
    -- Get the episode_id based on operation type
    IF TG_OP = 'INSERT' THEN
        target_episode_id := NEW.episode_id;
        target_user_id := NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        target_episode_id := OLD.episode_id;
        target_user_id := OLD.user_id;
    END IF;

    -- Only update if we have a valid episode_id
    IF target_episode_id IS NOT NULL THEN
        UPDATE notebook_synthesis
        SET is_stale = true, updated_at = NOW()
        WHERE episode_id = target_episode_id
        AND user_id = target_user_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create separate triggers for INSERT and DELETE
DROP TRIGGER IF EXISTS trigger_invalidate_synthesis ON bookmarks;
DROP TRIGGER IF EXISTS trigger_invalidate_synthesis_insert ON bookmarks;
DROP TRIGGER IF EXISTS trigger_invalidate_synthesis_delete ON bookmarks;

CREATE TRIGGER trigger_invalidate_synthesis_insert
    AFTER INSERT ON bookmarks
    FOR EACH ROW
    WHEN (NEW.episode_id IS NOT NULL)
    EXECUTE FUNCTION invalidate_notebook_synthesis();

CREATE TRIGGER trigger_invalidate_synthesis_delete
    AFTER DELETE ON bookmarks
    FOR EACH ROW
    WHEN (OLD.episode_id IS NOT NULL)
    EXECUTE FUNCTION invalidate_notebook_synthesis();


-- ============================================================================
-- 7. AUTO-UPDATE TIMESTAMP FOR NOTEBOOK_SYNTHESIS
-- ============================================================================
CREATE TRIGGER update_notebook_synthesis_updated_at
    BEFORE UPDATE ON notebook_synthesis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 8. ROW LEVEL SECURITY (Disabled for now, single-user mode)
-- ============================================================================
ALTER TABLE notebook_synthesis DISABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 9. UPDATE BOOKMARK_STATS VIEW TO INCLUDE NEW TYPES
-- ============================================================================
DROP VIEW IF EXISTS bookmark_stats;
CREATE VIEW bookmark_stats AS
SELECT
    user_id,
    COUNT(*) as total_bookmarks,
    COUNT(*) FILTER (WHERE bookmark_type = 'claim') as claim_count,
    COUNT(*) FILTER (WHERE bookmark_type = 'paper') as paper_count,
    COUNT(*) FILTER (WHERE bookmark_type = 'snippet') as snippet_count,
    COUNT(*) FILTER (WHERE bookmark_type = 'ai_insight') as ai_insight_count,
    COUNT(*) FILTER (WHERE bookmark_type = 'image') as image_count,
    COUNT(*) FILTER (WHERE quiz_enabled = true) as quiz_ready_count,
    AVG(quiz_score) FILTER (WHERE quiz_count > 0) as avg_quiz_score
FROM bookmarks
GROUP BY user_id;


-- ============================================================================
-- 10. CREATE VIEW FOR EPISODE NOTEBOOK STATS
-- ============================================================================
DROP VIEW IF EXISTS episode_notebook_stats;
CREATE VIEW episode_notebook_stats AS
SELECT
    user_id,
    episode_id,
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE bookmark_type = 'claim') as claim_count,
    COUNT(*) FILTER (WHERE bookmark_type = 'paper') as paper_count,
    COUNT(*) FILTER (WHERE bookmark_type = 'snippet') as snippet_count,
    COUNT(*) FILTER (WHERE bookmark_type = 'ai_insight') as ai_insight_count,
    COUNT(*) FILTER (WHERE bookmark_type = 'image') as image_count,
    MAX(created_at) as last_updated
FROM bookmarks
WHERE episode_id IS NOT NULL
GROUP BY user_id, episode_id;


-- ============================================================================
-- DONE!
-- ============================================================================
-- After running this migration:
-- 1. Verify new columns: SELECT insight_source, image_url, image_caption FROM bookmarks LIMIT 1;
-- 2. Verify new table: SELECT * FROM notebook_synthesis LIMIT 1;
-- 3. Test new type: INSERT INTO bookmarks (bookmark_type, title, context_preview, episode_id)
--    VALUES ('ai_insight', 'Test AI Insight', 'This is an AI-generated insight', 'lex_325');
-- 4. Verify view: SELECT * FROM episode_notebook_stats;
