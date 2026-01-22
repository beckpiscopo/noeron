-- Migration: Enable authentication and Row Level Security
-- Date: 2025-01-21
--
-- This migration:
-- 1. Adds is_preview column to episodes table
-- 2. Enables RLS on user-specific tables
-- 3. Creates policies allowing both auth.uid()::text AND 'default_user' for backward compatibility
-- 4. Adds helper function current_user_id()

-- ============================================================================
-- Helper function: Get current user ID
-- Returns auth.uid()::text if authenticated, otherwise 'default_user'
-- ============================================================================
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(auth.uid()::text, 'default_user')
$$;

-- ============================================================================
-- Episodes: Add is_preview column
-- ============================================================================
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT false;
COMMENT ON COLUMN episodes.is_preview IS 'Preview episodes visible to all users, full episodes require auth';

-- ============================================================================
-- Bookmarks: Enable RLS
-- ============================================================================
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own bookmarks OR default_user bookmarks (for migration)
CREATE POLICY "Users can view own bookmarks"
    ON bookmarks FOR SELECT
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

-- Policy: Users can insert bookmarks as themselves
CREATE POLICY "Users can insert own bookmarks"
    ON bookmarks FOR INSERT
    WITH CHECK (
        user_id = auth.uid()::text
        OR (auth.uid() IS NULL AND user_id = 'default_user')
    );

-- Policy: Users can update their own bookmarks
CREATE POLICY "Users can update own bookmarks"
    ON bookmarks FOR UPDATE
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    )
    WITH CHECK (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

-- Policy: Users can delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks"
    ON bookmarks FOR DELETE
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

-- ============================================================================
-- Quiz Sessions: Enable RLS
-- ============================================================================
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz sessions"
    ON quiz_sessions FOR SELECT
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

CREATE POLICY "Users can insert own quiz sessions"
    ON quiz_sessions FOR INSERT
    WITH CHECK (
        user_id = auth.uid()::text
        OR (auth.uid() IS NULL AND user_id = 'default_user')
    );

CREATE POLICY "Users can update own quiz sessions"
    ON quiz_sessions FOR UPDATE
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

CREATE POLICY "Users can delete own quiz sessions"
    ON quiz_sessions FOR DELETE
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

-- ============================================================================
-- Quiz Responses: Enable RLS
-- ============================================================================
ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;

-- Quiz responses are linked via quiz_sessions, so check the session's user_id
CREATE POLICY "Users can view own quiz responses"
    ON quiz_responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM quiz_sessions qs
            WHERE qs.id = quiz_responses.session_id
            AND (qs.user_id = auth.uid()::text OR qs.user_id = 'default_user')
        )
    );

CREATE POLICY "Users can insert own quiz responses"
    ON quiz_responses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM quiz_sessions qs
            WHERE qs.id = quiz_responses.session_id
            AND (qs.user_id = auth.uid()::text OR qs.user_id = 'default_user')
        )
    );

-- ============================================================================
-- Notebook Synthesis: Enable RLS
-- ============================================================================
ALTER TABLE notebook_synthesis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notebook synthesis"
    ON notebook_synthesis FOR SELECT
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

CREATE POLICY "Users can insert own notebook synthesis"
    ON notebook_synthesis FOR INSERT
    WITH CHECK (
        user_id = auth.uid()::text
        OR (auth.uid() IS NULL AND user_id = 'default_user')
    );

CREATE POLICY "Users can update own notebook synthesis"
    ON notebook_synthesis FOR UPDATE
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    )
    WITH CHECK (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

CREATE POLICY "Users can delete own notebook synthesis"
    ON notebook_synthesis FOR DELETE
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

-- ============================================================================
-- Chat Sessions: Enable RLS
-- ============================================================================
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat sessions"
    ON chat_sessions FOR SELECT
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

CREATE POLICY "Users can insert own chat sessions"
    ON chat_sessions FOR INSERT
    WITH CHECK (
        user_id = auth.uid()::text
        OR (auth.uid() IS NULL AND user_id = 'default_user')
    );

CREATE POLICY "Users can update own chat sessions"
    ON chat_sessions FOR UPDATE
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    )
    WITH CHECK (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

CREATE POLICY "Users can delete own chat sessions"
    ON chat_sessions FOR DELETE
    USING (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );

-- ============================================================================
-- Chat Messages: Enable RLS
-- ============================================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat messages are linked via chat_sessions, so check the session's user_id
CREATE POLICY "Users can view own chat messages"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_sessions cs
            WHERE cs.id = chat_messages.session_id
            AND (cs.user_id = auth.uid()::text OR cs.user_id = 'default_user')
        )
    );

CREATE POLICY "Users can insert own chat messages"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions cs
            WHERE cs.id = chat_messages.session_id
            AND (cs.user_id = auth.uid()::text OR cs.user_id = 'default_user')
        )
    );

-- ============================================================================
-- Access Requests: Enable RLS (public insert, admin-only read)
-- ============================================================================
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an access request
CREATE POLICY "Anyone can submit access request"
    ON access_requests FOR INSERT
    WITH CHECK (true);

-- Users can view their own access request status by email
CREATE POLICY "Users can view own access request"
    ON access_requests FOR SELECT
    USING (
        -- Admin users (implement via custom claim later)
        -- For now, allow reading own requests by matching email
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- ============================================================================
-- Allowed Emails: Admin-only table (no public access)
-- ============================================================================
ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- No public policies - only accessed via service role key in backend

-- ============================================================================
-- Update episode_notebook_stats view to use current_user_id()
-- ============================================================================
-- Note: The view already filters by user_id, RLS on bookmarks handles access control

-- ============================================================================
-- Index for faster RLS policy evaluation
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_synthesis_user_id ON notebook_synthesis(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
