-- Migration: Upgrade to Gemini text-embedding-004 (768 dimensions)
-- Run this in Supabase SQL Editor BEFORE re-embedding data
--
-- Changes:
-- 1. Drops old embedding index
-- 2. Alters embedding column from vector(384) to vector(768)
-- 3. Updates match_papers functions to use vector(768)
-- 4. Recreates embedding index

-- ============================================================================
-- STEP 1: DROP OLD INDEX
-- ============================================================================
DROP INDEX IF EXISTS idx_paper_chunks_embedding;

-- ============================================================================
-- STEP 2: ALTER EMBEDDING COLUMN TO 768 DIMENSIONS
-- ============================================================================
-- This will clear existing embeddings (they're incompatible anyway)
ALTER TABLE paper_chunks
ALTER COLUMN embedding TYPE vector(768);

-- ============================================================================
-- STEP 3: UPDATE MATCH_PAPERS FUNCTION
-- ============================================================================
DROP FUNCTION IF EXISTS match_papers(vector(384), float, int);

CREATE OR REPLACE FUNCTION match_papers(
    query_embedding vector(768),
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
    WHERE pc.embedding IS NOT NULL
        AND 1 - (pc.embedding <=> query_embedding) > match_threshold
    ORDER BY pc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- STEP 4: UPDATE MATCH_PAPERS_WITH_FILTERS FUNCTION
-- ============================================================================
DROP FUNCTION IF EXISTS match_papers_with_filters(vector(384), float, int, int, int, text[]);

CREATE OR REPLACE FUNCTION match_papers_with_filters(
    query_embedding vector(768),
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
    WHERE pc.embedding IS NOT NULL
        AND 1 - (pc.embedding <=> query_embedding) > match_threshold
        AND (filter_year_min IS NULL OR p.year >= filter_year_min)
        AND (filter_year_max IS NULL OR p.year <= filter_year_max)
        AND (filter_sections IS NULL OR pc.section_heading = ANY(filter_sections))
    ORDER BY pc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- STEP 5: RECREATE EMBEDDING INDEX (after data is re-embedded)
-- ============================================================================
-- Run this AFTER you've re-embedded all chunks with the migration script:
--
-- CREATE INDEX idx_paper_chunks_embedding ON paper_chunks
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--
-- Note: Index creation requires data in the table, so run it after re-embedding

-- ============================================================================
-- DONE!
-- ============================================================================
-- After running this migration:
-- 1. Run the Python re-embedding script: python scripts/reembed_with_gemini.py
-- 2. Then run the index creation SQL above
