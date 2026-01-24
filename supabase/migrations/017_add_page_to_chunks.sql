-- Migration: Add page column to paper_chunks for section-level citations
-- This enables users to see exactly which page of a paper supports a claim

-- ============================================================================
-- ADD PAGE COLUMN TO PAPER_CHUNKS
-- ============================================================================

ALTER TABLE paper_chunks ADD COLUMN IF NOT EXISTS page TEXT;

-- ============================================================================
-- DROP EXISTING FUNCTIONS (required to change return type)
-- ============================================================================

DROP FUNCTION IF EXISTS match_papers(vector(768), float, int);
DROP FUNCTION IF EXISTS match_papers_with_filters(vector(768), float, int, int, int, text[]);

-- ============================================================================
-- UPDATE match_papers FUNCTION TO RETURN PAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION match_papers(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    paper_id text,
    paper_title text,
    section_heading text,
    page text,
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
        pc.page,
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
-- UPDATE match_papers_with_filters FUNCTION TO RETURN PAGE
-- ============================================================================

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
    page text,
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
        pc.page,
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
