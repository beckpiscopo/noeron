-- Noeron Database Schema for Supabase
-- Run this in Supabase SQL Editor after creating your project

-- ============================================================================
-- EPISODES TABLE
-- ============================================================================
-- Metadata about podcast episodes
CREATE TABLE IF NOT EXISTS episodes (
    id BIGSERIAL PRIMARY KEY,
    podcast_id TEXT UNIQUE NOT NULL,  -- e.g. "lex_325"
    title TEXT NOT NULL,               -- e.g. "Lex Fridman #325 - Michael Levin"
    guest_name TEXT,                   -- e.g. "Michael Levin"
    podcast_series TEXT,               -- e.g. "Lex Fridman Podcast"
    duration_ms BIGINT,                -- Total duration in milliseconds
    published_date DATE,               -- When episode was published
    audio_url TEXT,                    -- URL to audio file (if hosted)
    transcript_url TEXT,               -- URL to transcript (if available)
    description TEXT,                  -- Episode description
    topics TEXT[],                     -- Array of topics covered
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_episodes_podcast_id ON episodes(podcast_id);
CREATE INDEX IF NOT EXISTS idx_episodes_published ON episodes(published_date DESC);


-- ============================================================================
-- CLAIMS TABLE
-- ============================================================================
-- Scientific claims extracted from episodes, matched to papers, and distilled
CREATE TABLE IF NOT EXISTS claims (
    id BIGSERIAL PRIMARY KEY,
    
    -- Episode reference
    podcast_id TEXT NOT NULL REFERENCES episodes(podcast_id) ON DELETE CASCADE,
    
    -- Timing information
    timestamp TEXT,                    -- Human readable: "00:15:23"
    start_ms BIGINT,                   -- Start time in milliseconds
    end_ms BIGINT,                     -- End time in milliseconds
    
    -- Claim content
    claim_text TEXT NOT NULL,          -- Original transcript quote
    distilled_claim TEXT,              -- AI-generated 10-15 word summary
    distilled_word_count INTEGER,     -- Word count of distilled claim
    
    -- Paper match (from RAG)
    paper_id TEXT,                     -- Semantic Scholar ID or hash
    paper_title TEXT,                  -- Title of matched paper
    paper_url TEXT,                    -- URL to paper (semantic scholar, arxiv, etc)
    section TEXT,                      -- Which section of paper matched
    rationale TEXT,                    -- Why this paper matched (includes excerpt)
    
    -- Metadata
    confidence_score REAL,             -- Match confidence (0.0-1.0)
    claim_type TEXT,                   -- e.g. "scientific_finding", "hypothesis"
    speaker_stance TEXT,               -- e.g. "assertion", "critique", "prediction"
    needs_backing_because TEXT,        -- Why this claim needs a source
    
    -- Context tags (JSONB for flexibility)
    context_tags JSONB,                -- e.g. {"organism": "planaria", "phenomenon": "memory"}
    
    -- Verification (if run)
    verified BOOLEAN,                  -- Has this been verified?
    verification_details JSONB,        -- Results from verification agent
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_claims_podcast ON claims(podcast_id);
CREATE INDEX IF NOT EXISTS idx_claims_timestamp ON claims(start_ms) WHERE start_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claims_paper ON claims(paper_id) WHERE paper_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claims_distilled ON claims(podcast_id) WHERE distilled_claim IS NOT NULL;

-- GIN index for JSONB context_tags (fast tag queries)
CREATE INDEX IF NOT EXISTS idx_claims_context_tags ON claims USING GIN (context_tags);


-- ============================================================================
-- PAPERS TABLE (Optional - Cache for paper metadata)
-- ============================================================================
-- Cached paper metadata to avoid re-fetching from Semantic Scholar
CREATE TABLE IF NOT EXISTS papers (
    id BIGSERIAL PRIMARY KEY,
    paper_id TEXT UNIQUE NOT NULL,     -- Semantic Scholar ID or hash
    title TEXT NOT NULL,
    abstract TEXT,
    authors TEXT[],                    -- Array of author names
    year INTEGER,
    venue TEXT,                        -- Journal/Conference
    citation_count INTEGER,
    url TEXT,                          -- Semantic Scholar URL
    arxiv_id TEXT,                     -- ArXiv ID if available
    doi TEXT,                          -- DOI if available
    
    -- Full text (if we have it)
    full_text TEXT,                    -- From GROBID extraction
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_papers_paper_id ON papers(paper_id);
CREATE INDEX IF NOT EXISTS idx_papers_title ON papers USING GIN (to_tsvector('english', title));


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- For now, disable RLS for easier development
-- Enable and configure before production!

ALTER TABLE episodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE claims DISABLE ROW LEVEL SECURITY;
ALTER TABLE papers DISABLE ROW LEVEL SECURITY;

-- Future: Enable RLS and add policies for multi-user access
-- ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public read access" ON claims FOR SELECT USING (true);


-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_episodes_updated_at
    BEFORE UPDATE ON episodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at
    BEFORE UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_papers_updated_at
    BEFORE UPDATE ON papers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- VIEWS (Useful queries as views)
-- ============================================================================

-- Claims with episode info (common join)
CREATE OR REPLACE VIEW claims_with_episode AS
SELECT 
    c.*,
    e.title as episode_title,
    e.guest_name,
    e.published_date
FROM claims c
JOIN episodes e ON c.podcast_id = e.podcast_id;

-- Claims that need distillation
CREATE OR REPLACE VIEW claims_needing_distillation AS
SELECT *
FROM claims
WHERE distilled_claim IS NULL
AND paper_title IS NOT NULL;  -- Only distill if we have a paper match

-- Episode statistics
CREATE OR REPLACE VIEW episode_stats AS
SELECT 
    e.podcast_id,
    e.title,
    COUNT(c.id) as total_claims,
    COUNT(c.distilled_claim) as distilled_count,
    COUNT(c.paper_id) as matched_count,
    AVG(c.confidence_score) as avg_confidence
FROM episodes e
LEFT JOIN claims c ON e.podcast_id = c.podcast_id
GROUP BY e.podcast_id, e.title;


-- ============================================================================
-- SAMPLE QUERIES (For testing)
-- ============================================================================

-- Get all claims for an episode, ordered by time
-- SELECT * FROM claims WHERE podcast_id = 'lex_325' ORDER BY start_ms;

-- Get claims that mention specific organisms
-- SELECT * FROM claims WHERE context_tags @> '{"organism": "planaria"}';

-- Get most confident matches
-- SELECT claim_text, paper_title, confidence_score 
-- FROM claims 
-- WHERE confidence_score > 0.8 
-- ORDER BY confidence_score DESC;

-- Claims without distilled versions
-- SELECT COUNT(*) FROM claims WHERE distilled_claim IS NULL;


-- ============================================================================
-- DONE!
-- ============================================================================
-- Your database is now ready for Noeron data
-- Next: Run migration script to import existing claims

