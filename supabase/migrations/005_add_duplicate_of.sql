-- Add duplicate_of column for soft-delete deduplication
-- Allows marking claims as duplicates while preserving data lineage

ALTER TABLE claims ADD COLUMN IF NOT EXISTS duplicate_of BIGINT REFERENCES claims(id);

-- Index for fast duplicate lookups
CREATE INDEX IF NOT EXISTS idx_claims_duplicate_of ON claims(duplicate_of) WHERE duplicate_of IS NOT NULL;

-- View for active (non-duplicate) claims
CREATE OR REPLACE VIEW active_claims AS
SELECT * FROM claims WHERE duplicate_of IS NULL;

COMMENT ON COLUMN claims.duplicate_of IS 'If set, this claim is a duplicate of the referenced claim ID (soft delete)';
