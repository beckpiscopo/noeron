-- Migration: Add segment_claim_id field to claims table
-- Date: 2025-12-31
-- Purpose: Add segment-based claim ID for MCP server compatibility

-- Add the segment_claim_id column if it doesn't exist
ALTER TABLE claims 
ADD COLUMN IF NOT EXISTS segment_claim_id TEXT UNIQUE;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_claims_segment_id 
ON claims(segment_claim_id) 
WHERE segment_claim_id IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN claims.segment_claim_id IS 
'Segment-based claim identifier in format "segment_key-index" (e.g., "lex_325|00:00:00.160|1-0"). Required for MCP server get_claim_context tool.';








