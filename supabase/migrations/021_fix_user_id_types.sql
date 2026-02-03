-- Migration: Fix user_id column types from TEXT to UUID
-- Date: 2026-02-03
--
-- This migration:
-- 1. Drops existing RLS policies on affected tables
-- 2. Alters user_id columns from TEXT to UUID with foreign key to auth.users
-- 3. Recreates RLS policies using auth.uid() = user_id
-- 4. Deletes orphaned 'default_user' rows
--
-- Tables affected:
-- - bookmarks
-- - notebook_synthesis
-- - quiz_sessions
-- - chat_sessions
-- - user_interests

-- ============================================================================
-- BOOKMARKS TABLE
-- ============================================================================

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can update own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON bookmarks;

-- Delete orphaned default_user rows (cannot be migrated to UUID)
DELETE FROM bookmarks WHERE user_id = 'default_user';

-- Drop default constraint and indexes
DROP INDEX IF EXISTS idx_bookmarks_user_id;
DROP INDEX IF EXISTS idx_bookmarks_quiz_enabled;
DROP INDEX IF EXISTS idx_bookmarks_episode;

-- Alter column type to UUID
ALTER TABLE bookmarks
    ALTER COLUMN user_id DROP DEFAULT,
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid,
    ADD CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make user_id NOT NULL (required for authenticated users)
ALTER TABLE bookmarks ALTER COLUMN user_id SET NOT NULL;

-- Recreate indexes
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_quiz_enabled ON bookmarks(user_id, quiz_enabled) WHERE quiz_enabled = true;
CREATE INDEX idx_bookmarks_episode ON bookmarks(user_id, episode_id) WHERE episode_id IS NOT NULL;

-- Recreate RLS policies
CREATE POLICY "Users can view own bookmarks"
    ON bookmarks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
    ON bookmarks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks"
    ON bookmarks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
    ON bookmarks FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- NOTEBOOK_SYNTHESIS TABLE
-- ============================================================================

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own notebook synthesis" ON notebook_synthesis;
DROP POLICY IF EXISTS "Users can insert own notebook synthesis" ON notebook_synthesis;
DROP POLICY IF EXISTS "Users can update own notebook synthesis" ON notebook_synthesis;
DROP POLICY IF EXISTS "Users can delete own notebook synthesis" ON notebook_synthesis;

-- Delete orphaned default_user rows
DELETE FROM notebook_synthesis WHERE user_id = 'default_user';

-- Drop indexes
DROP INDEX IF EXISTS idx_notebook_synthesis_user_id;
DROP INDEX IF EXISTS idx_notebook_synthesis_episode;

-- Drop unique constraint that references user_id
ALTER TABLE notebook_synthesis DROP CONSTRAINT IF EXISTS notebook_synthesis_user_id_episode_id_key;

-- Alter column type to UUID
ALTER TABLE notebook_synthesis
    ALTER COLUMN user_id DROP DEFAULT,
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid,
    ADD CONSTRAINT fk_notebook_synthesis_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make user_id NOT NULL
ALTER TABLE notebook_synthesis ALTER COLUMN user_id SET NOT NULL;

-- Recreate unique constraint
ALTER TABLE notebook_synthesis ADD CONSTRAINT notebook_synthesis_user_id_episode_id_key UNIQUE (user_id, episode_id);

-- Recreate indexes
CREATE INDEX idx_notebook_synthesis_user_id ON notebook_synthesis(user_id);
CREATE INDEX idx_notebook_synthesis_episode ON notebook_synthesis(user_id, episode_id);

-- Recreate RLS policies
CREATE POLICY "Users can view own notebook synthesis"
    ON notebook_synthesis FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notebook synthesis"
    ON notebook_synthesis FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notebook synthesis"
    ON notebook_synthesis FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notebook synthesis"
    ON notebook_synthesis FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- QUIZ_SESSIONS TABLE
-- ============================================================================

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own quiz sessions" ON quiz_sessions;
DROP POLICY IF EXISTS "Users can insert own quiz sessions" ON quiz_sessions;
DROP POLICY IF EXISTS "Users can update own quiz sessions" ON quiz_sessions;
DROP POLICY IF EXISTS "Users can delete own quiz sessions" ON quiz_sessions;

-- Delete orphaned default_user rows
DELETE FROM quiz_sessions WHERE user_id = 'default_user';

-- Drop indexes
DROP INDEX IF EXISTS idx_quiz_sessions_user_id;

-- Alter column type to UUID
ALTER TABLE quiz_sessions
    ALTER COLUMN user_id DROP DEFAULT,
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid,
    ADD CONSTRAINT fk_quiz_sessions_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make user_id NOT NULL
ALTER TABLE quiz_sessions ALTER COLUMN user_id SET NOT NULL;

-- Recreate indexes
CREATE INDEX idx_quiz_sessions_user_id ON quiz_sessions(user_id);

-- Recreate RLS policies
CREATE POLICY "Users can view own quiz sessions"
    ON quiz_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz sessions"
    ON quiz_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quiz sessions"
    ON quiz_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quiz sessions"
    ON quiz_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- CHAT_SESSIONS TABLE
-- ============================================================================

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON chat_sessions;

-- Delete orphaned default_user rows
DELETE FROM chat_sessions WHERE user_id = 'default_user';

-- Drop indexes
DROP INDEX IF EXISTS idx_chat_sessions_user_id;

-- Alter column type to UUID
ALTER TABLE chat_sessions
    ALTER COLUMN user_id DROP DEFAULT,
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid,
    ADD CONSTRAINT fk_chat_sessions_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make user_id NOT NULL
ALTER TABLE chat_sessions ALTER COLUMN user_id SET NOT NULL;

-- Recreate indexes
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);

-- Recreate RLS policies
CREATE POLICY "Users can view own chat sessions"
    ON chat_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions"
    ON chat_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
    ON chat_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions"
    ON chat_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- USER_INTERESTS TABLE
-- ============================================================================

-- Drop existing RLS policies (if any)
DROP POLICY IF EXISTS "Users can view own interests" ON user_interests;
DROP POLICY IF EXISTS "Users can insert own interests" ON user_interests;
DROP POLICY IF EXISTS "Users can update own interests" ON user_interests;
DROP POLICY IF EXISTS "Users can delete own interests" ON user_interests;

-- Delete orphaned default_user rows
DELETE FROM user_interests WHERE user_id = 'default_user';

-- Alter column type to UUID
ALTER TABLE user_interests
    ALTER COLUMN user_id DROP DEFAULT,
    ALTER COLUMN user_id TYPE UUID USING user_id::uuid,
    ADD CONSTRAINT fk_user_interests_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make user_id NOT NULL
ALTER TABLE user_interests ALTER COLUMN user_id SET NOT NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON user_interests(user_id);

-- Enable RLS and create policies
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interests"
    ON user_interests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interests"
    ON user_interests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interests"
    ON user_interests FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own interests"
    ON user_interests FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATE VIEWS TO REFLECT NEW COLUMN TYPE
-- ============================================================================

-- Update bookmark_stats view
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

-- Update episode_notebook_stats view
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
-- DROP DEPRECATED HELPER FUNCTION
-- ============================================================================
-- current_user_id() was used for backward compatibility with 'default_user'
-- Now we use auth.uid() directly
DROP FUNCTION IF EXISTS current_user_id();

-- ============================================================================
-- DONE!
-- ============================================================================
-- After running this migration:
-- 1. All user_id columns are now UUID type with foreign key to auth.users
-- 2. All 'default_user' data has been deleted (cannot be migrated)
-- 3. RLS policies now use auth.uid() = user_id directly
-- 4. Users must be authenticated to access their content
