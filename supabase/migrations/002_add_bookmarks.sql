-- Migration: Add Bookmarks Feature
-- Run this in Supabase SQL Editor

-- ============================================================================
-- BOOKMARKS TABLE (Polymorphic design for claims/papers/snippets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- For now, use a simple user identifier (email or device ID)
    -- Later: user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
    user_id TEXT NOT NULL DEFAULT 'default_user',

    -- Bookmark type discriminator
    bookmark_type TEXT NOT NULL CHECK (bookmark_type IN ('claim', 'paper', 'snippet')),

    -- Polymorphic references (one populated based on type)
    claim_id BIGINT REFERENCES claims(id) ON DELETE CASCADE,
    paper_id TEXT,  -- Semantic Scholar ID or hash

    -- For snippets (transcript highlights)
    episode_id TEXT,
    snippet_text TEXT,
    start_ms BIGINT,
    end_ms BIGINT,

    -- Denormalized fields for quick display
    title TEXT NOT NULL,
    context_preview TEXT,

    -- User organization
    tags TEXT[],
    notes TEXT,

    -- Quiz tracking
    quiz_enabled BOOLEAN DEFAULT true,
    last_quizzed_at TIMESTAMP WITH TIME ZONE,
    quiz_score REAL DEFAULT 0,  -- Running average 0-1
    quiz_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints to ensure proper data based on type
    CONSTRAINT valid_claim CHECK (
        (bookmark_type = 'claim' AND claim_id IS NOT NULL) OR
        bookmark_type != 'claim'
    ),
    CONSTRAINT valid_paper CHECK (
        (bookmark_type = 'paper' AND paper_id IS NOT NULL) OR
        bookmark_type != 'paper'
    ),
    CONSTRAINT valid_snippet CHECK (
        (bookmark_type = 'snippet' AND snippet_text IS NOT NULL AND episode_id IS NOT NULL) OR
        bookmark_type != 'snippet'
    )
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_type ON bookmarks(bookmark_type);
CREATE INDEX IF NOT EXISTS idx_bookmarks_claim_id ON bookmarks(claim_id) WHERE claim_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookmarks_paper_id ON bookmarks(paper_id) WHERE paper_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookmarks_quiz_enabled ON bookmarks(user_id, quiz_enabled) WHERE quiz_enabled = true;
CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at DESC);


-- ============================================================================
-- QUIZ_SESSIONS TABLE (Track quiz attempts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'default_user',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    bookmarks_included UUID[],  -- Array of bookmark IDs used in this session
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_started ON quiz_sessions(started_at DESC);


-- ============================================================================
-- QUIZ_RESPONSES TABLE (Individual question responses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quiz_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('recall', 'concept', 'application')),
    answer_text TEXT NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN,
    confidence_rating INTEGER CHECK (confidence_rating >= 1 AND confidence_rating <= 5),
    time_spent_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_responses_session_id ON quiz_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_bookmark_id ON quiz_responses(bookmark_id);


-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp for bookmarks
CREATE TRIGGER update_bookmarks_updated_at
    BEFORE UPDATE ON bookmarks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Disable for now (single-user mode), enable for production multi-user

ALTER TABLE bookmarks DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses DISABLE ROW LEVEL SECURITY;

-- Future: Enable RLS policies for authenticated users
-- ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own bookmarks" ON bookmarks
--   FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'default_user');
-- CREATE POLICY "Users can insert own bookmarks" ON bookmarks
--   FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'default_user');
-- CREATE POLICY "Users can update own bookmarks" ON bookmarks
--   FOR UPDATE USING (auth.uid()::text = user_id OR user_id = 'default_user');
-- CREATE POLICY "Users can delete own bookmarks" ON bookmarks
--   FOR DELETE USING (auth.uid()::text = user_id OR user_id = 'default_user');


-- ============================================================================
-- VIEWS
-- ============================================================================

-- Bookmarks with claim details
CREATE OR REPLACE VIEW bookmarks_with_claims AS
SELECT
    b.*,
    c.claim_text,
    c.distilled_claim,
    c.paper_title as claim_paper_title,
    c.confidence_score as claim_confidence,
    c.start_ms as claim_start_ms,
    c.end_ms as claim_end_ms
FROM bookmarks b
LEFT JOIN claims c ON b.claim_id = c.id AND b.bookmark_type = 'claim';

-- Bookmark statistics per user
CREATE OR REPLACE VIEW bookmark_stats AS
SELECT
    user_id,
    COUNT(*) as total_bookmarks,
    COUNT(*) FILTER (WHERE bookmark_type = 'claim') as claim_count,
    COUNT(*) FILTER (WHERE bookmark_type = 'paper') as paper_count,
    COUNT(*) FILTER (WHERE bookmark_type = 'snippet') as snippet_count,
    COUNT(*) FILTER (WHERE quiz_enabled = true) as quiz_ready_count,
    AVG(quiz_score) FILTER (WHERE quiz_count > 0) as avg_quiz_score
FROM bookmarks
GROUP BY user_id;


-- ============================================================================
-- DONE!
-- ============================================================================
-- After running this migration:
-- 1. Verify tables exist: SELECT * FROM bookmarks LIMIT 1;
-- 2. Test insert: INSERT INTO bookmarks (bookmark_type, title, snippet_text, episode_id)
--    VALUES ('snippet', 'Test', 'Test text', 'lex_325');
