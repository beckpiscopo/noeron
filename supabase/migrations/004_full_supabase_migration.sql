-- Migration: Full Supabase Migration with pgvector
-- Run this in Supabase SQL Editor
-- Adds: temporal_windows, evidence_cards, paper_chunks (pgvector), chat_sessions, chat_messages, user_interests

-- ============================================================================
-- ENABLE PGVECTOR EXTENSION
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- ENHANCE EPISODES TABLE
-- ============================================================================
-- Add new columns for episode summaries and narrative context
-- (podcast_id is already the unique identifier)

ALTER TABLE episodes ADD COLUMN IF NOT EXISTS host TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS papers_linked INTEGER DEFAULT 0;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS key_topics TEXT[];
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS narrative_arc TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS major_themes JSONB;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS key_moments JSONB;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS guest_thesis JSONB;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS conversation_dynamics JSONB;

-- Add GIN index for key_topics array search
CREATE INDEX IF NOT EXISTS idx_episodes_key_topics ON episodes USING GIN (key_topics);


-- ============================================================================
-- TEMPORAL_WINDOWS TABLE
-- ============================================================================
-- 3-minute transcript windows for episode playback context

CREATE TABLE IF NOT EXISTS temporal_windows (
    id BIGSERIAL PRIMARY KEY,
    podcast_id TEXT NOT NULL REFERENCES episodes(podcast_id) ON DELETE CASCADE,
    window_id INTEGER NOT NULL,
    start_timestamp TEXT NOT NULL,           -- "00:00:00.160"
    end_timestamp TEXT NOT NULL,             -- "00:03:00.160"
    start_ms BIGINT NOT NULL,
    end_ms BIGINT NOT NULL,
    text TEXT NOT NULL,                      -- Full window transcript
    utterances JSONB NOT NULL DEFAULT '[]',  -- [{speaker, start_ms, end_ms, text}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(podcast_id, window_id)
);

-- Index for finding window containing a timestamp
CREATE INDEX IF NOT EXISTS idx_temporal_windows_podcast ON temporal_windows(podcast_id);
CREATE INDEX IF NOT EXISTS idx_temporal_windows_time_range ON temporal_windows(podcast_id, start_ms, end_ms);


-- ============================================================================
-- EVIDENCE_CARDS TABLE
-- ============================================================================
-- Paper-backed claims extracted from podcast segments with RAG results

CREATE TABLE IF NOT EXISTS evidence_cards (
    id BIGSERIAL PRIMARY KEY,

    -- Segment identification (replaces compound key "podcast_id|timestamp|window_id")
    podcast_id TEXT NOT NULL REFERENCES episodes(podcast_id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,                  -- "00:48:00.160"
    timestamp_ms BIGINT NOT NULL,             -- Parsed milliseconds for queries
    window_id TEXT NOT NULL,                  -- "window-25" or "1"

    -- Segment metadata
    speaker TEXT,
    transcript_text TEXT,
    note TEXT,

    -- Extracted claims (array of claim objects)
    claims JSONB NOT NULL DEFAULT '[]',
    research_queries TEXT[],

    -- RAG results (paper matches for claims)
    rag_results JSONB NOT NULL DEFAULT '[]',
    card_count INTEGER DEFAULT 0,

    -- Context and processing metadata
    context_tags JSONB,
    gemini_metadata JSONB,
    last_processed TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint (replaces compound segment key)
    UNIQUE(podcast_id, timestamp, window_id)
);

-- Indexes for evidence card queries
CREATE INDEX IF NOT EXISTS idx_evidence_cards_podcast ON evidence_cards(podcast_id);
CREATE INDEX IF NOT EXISTS idx_evidence_cards_timestamp ON evidence_cards(podcast_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_evidence_cards_lookback ON evidence_cards(podcast_id, timestamp_ms DESC);

-- Trigger for updated_at
CREATE TRIGGER update_evidence_cards_updated_at
    BEFORE UPDATE ON evidence_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- ENHANCE PAPERS TABLE
-- ============================================================================
-- Add additional columns for full paper metadata

ALTER TABLE papers ADD COLUMN IF NOT EXISTS journal TEXT;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS full_text_available BOOLEAN DEFAULT FALSE;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS sections JSONB;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS content_source TEXT;


-- ============================================================================
-- PAPER_CHUNKS TABLE (pgvector embeddings)
-- ============================================================================
-- Individual text chunks with vector embeddings for RAG search

CREATE TABLE IF NOT EXISTS paper_chunks (
    id BIGSERIAL PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,

    -- Chunk metadata
    chunk_index INTEGER NOT NULL,
    section_heading TEXT,
    token_count INTEGER,

    -- Content
    text TEXT NOT NULL,

    -- Vector embedding (384 dimensions for all-MiniLM-L6-v2)
    embedding vector(384),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint
    UNIQUE(paper_id, chunk_index)
);

-- Index for paper lookup
CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper ON paper_chunks(paper_id);

-- IVFFlat index for fast approximate nearest neighbor search
-- lists = 100 is good for ~500-5000 chunks, adjust to sqrt(n_rows) for larger datasets
CREATE INDEX IF NOT EXISTS idx_paper_chunks_embedding ON paper_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


-- ============================================================================
-- CHAT_SESSIONS TABLE
-- ============================================================================
-- User chat sessions linked to episodes

CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'default_user',

    -- Context
    podcast_id TEXT REFERENCES episodes(podcast_id) ON DELETE SET NULL,
    claim_id TEXT,                           -- Optional: focused claim (segment_claim_id)

    -- Session metadata
    title TEXT,                              -- Auto-generated or user-set
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- State
    is_active BOOLEAN DEFAULT TRUE,
    context_snapshot JSONB,                  -- Snapshot of layered context at session start

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for chat session queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_podcast ON chat_sessions(podcast_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chat_sessions(user_id) WHERE is_active = TRUE;


-- ============================================================================
-- CHAT_MESSAGES TABLE
-- ============================================================================
-- Messages within a chat session

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,

    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,

    -- Timestamp context (what the user was watching when they sent this)
    playback_timestamp TEXT,                 -- "48:00"
    playback_timestamp_ms BIGINT,

    -- Sources used for this response (assistant messages only)
    sources JSONB,                           -- [{paper_id, paper_title, year, section, relevance_snippet}]
    rag_query TEXT,                          -- Query used for RAG search

    -- Model info (assistant messages only)
    model TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for retrieving session messages in order
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(session_id, playback_timestamp_ms);


-- ============================================================================
-- USER_INTERESTS TABLE
-- ============================================================================
-- Track user interests for personalized recommendations

CREATE TABLE IF NOT EXISTS user_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'default_user',

    -- Interest type and value
    interest_type TEXT NOT NULL CHECK (interest_type IN ('topic', 'organism', 'phenomenon', 'researcher', 'paper')),
    interest_value TEXT NOT NULL,            -- "bioelectricity", "planaria", "Michael Levin"

    -- Engagement metrics
    interaction_count INTEGER DEFAULT 1,
    last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    explicit_interest BOOLEAN DEFAULT FALSE, -- User explicitly added vs. inferred

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique per user + type + value
    UNIQUE(user_id, interest_type, interest_value)
);

-- Index for user interest queries
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_type ON user_interests(interest_type, interaction_count DESC);


-- ============================================================================
-- MATCH_PAPERS FUNCTION (Vector Similarity Search)
-- ============================================================================

CREATE OR REPLACE FUNCTION match_papers(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    paper_id text,
    paper_title text,
    section_heading text,
    chunk_index int,
    chunk_text text,
    year int,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pc.paper_id,
        p.title AS paper_title,
        pc.section_heading,
        pc.chunk_index,
        pc.text AS chunk_text,
        p.year,
        1 - (pc.embedding <=> query_embedding) AS similarity
    FROM paper_chunks pc
    JOIN papers p ON pc.paper_id = p.paper_id
    WHERE 1 - (pc.embedding <=> query_embedding) > match_threshold
    ORDER BY pc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- ============================================================================
-- MATCH_PAPERS_WITH_FILTERS FUNCTION (Enhanced search with filters)
-- ============================================================================

CREATE OR REPLACE FUNCTION match_papers_with_filters(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5,
    filter_year_min int DEFAULT NULL,
    filter_year_max int DEFAULT NULL,
    filter_sections text[] DEFAULT NULL
)
RETURNS TABLE (
    paper_id text,
    paper_title text,
    section_heading text,
    chunk_index int,
    chunk_text text,
    year int,
    citation_count int,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pc.paper_id,
        p.title AS paper_title,
        pc.section_heading,
        pc.chunk_index,
        pc.text AS chunk_text,
        p.year,
        p.citation_count,
        1 - (pc.embedding <=> query_embedding) AS similarity
    FROM paper_chunks pc
    JOIN papers p ON pc.paper_id = p.paper_id
    WHERE 1 - (pc.embedding <=> query_embedding) > match_threshold
        AND (filter_year_min IS NULL OR p.year >= filter_year_min)
        AND (filter_year_max IS NULL OR p.year <= filter_year_max)
        AND (filter_sections IS NULL OR pc.section_heading = ANY(filter_sections))
    ORDER BY pc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- ============================================================================
-- HELPER FUNCTION: Get temporal window for timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION get_temporal_window(
    p_podcast_id text,
    p_timestamp_ms bigint
)
RETURNS SETOF temporal_windows
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM temporal_windows
    WHERE podcast_id = p_podcast_id
        AND start_ms <= p_timestamp_ms
        AND end_ms >= p_timestamp_ms
    LIMIT 1;
END;
$$;


-- ============================================================================
-- HELPER FUNCTION: Get evidence cards in lookback window
-- ============================================================================

CREATE OR REPLACE FUNCTION get_evidence_cards_in_range(
    p_podcast_id text,
    p_current_timestamp_ms bigint,
    p_lookback_ms bigint DEFAULT 300000  -- 5 minutes
)
RETURNS SETOF evidence_cards
LANGUAGE plpgsql
AS $$
DECLARE
    range_start bigint;
BEGIN
    range_start := GREATEST(0, p_current_timestamp_ms - p_lookback_ms);

    RETURN QUERY
    SELECT *
    FROM evidence_cards
    WHERE podcast_id = p_podcast_id
        AND timestamp_ms >= range_start
        AND timestamp_ms <= p_current_timestamp_ms
    ORDER BY timestamp_ms DESC;
END;
$$;


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Disable for development, enable for production multi-user

ALTER TABLE temporal_windows DISABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE paper_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests DISABLE ROW LEVEL SECURITY;


-- ============================================================================
-- VIEWS
-- ============================================================================

-- Evidence cards with episode info
CREATE OR REPLACE VIEW evidence_cards_with_episode AS
SELECT
    ec.*,
    e.title as episode_title,
    e.guest_name,
    e.podcast_series
FROM evidence_cards ec
JOIN episodes e ON ec.podcast_id = e.podcast_id;

-- Paper chunks with paper info (useful for debugging)
CREATE OR REPLACE VIEW paper_chunks_with_info AS
SELECT
    pc.id,
    pc.paper_id,
    p.title as paper_title,
    p.year,
    pc.section_heading,
    pc.chunk_index,
    pc.token_count,
    LEFT(pc.text, 200) as text_preview
FROM paper_chunks pc
JOIN papers p ON pc.paper_id = p.paper_id;

-- Chat session summary
CREATE OR REPLACE VIEW chat_session_stats AS
SELECT
    cs.id as session_id,
    cs.user_id,
    cs.podcast_id,
    e.title as episode_title,
    cs.started_at,
    cs.last_activity_at,
    cs.is_active,
    COUNT(cm.id) as message_count
FROM chat_sessions cs
LEFT JOIN episodes e ON cs.podcast_id = e.podcast_id
LEFT JOIN chat_messages cm ON cs.id = cm.session_id
GROUP BY cs.id, e.title;


-- ============================================================================
-- DONE!
-- ============================================================================
-- After running this migration:
-- 1. Verify pgvector: SELECT * FROM pg_extension WHERE extname = 'vector';
-- 2. Check tables: \dt
-- 3. Test match_papers (after data migration):
--    SELECT * FROM match_papers('[0.1, 0.2, ...]'::vector(384), 0.3, 5);
