-- Migration: Add keywords column to claims table
-- Keywords are 2-4 key terms extracted from each claim for visualization

ALTER TABLE claims ADD COLUMN IF NOT EXISTS keywords TEXT[];

-- Index for potential keyword searches
CREATE INDEX IF NOT EXISTS idx_claims_keywords ON claims USING GIN (keywords);

COMMENT ON COLUMN claims.keywords IS 'Array of 2-4 key terms extracted from the claim for visualization and search';
