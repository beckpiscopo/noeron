-- Migration: Fix Bookmarks Foreign Key Constraint
-- The claim_id FK constraint causes issues when bookmarking frontend claims
-- that may not exist in the database (e.g., fallback claims, MCP tool results)

-- Drop the foreign key constraint on claim_id
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_claim_id_fkey;

-- The claim_id column remains as BIGINT but without FK constraint
-- This allows bookmarking claims that exist only in frontend state

-- Verify the constraint is removed
-- SELECT conname FROM pg_constraint WHERE conrelid = 'bookmarks'::regclass;
