-- Migration: Fix invalidate_notebook_synthesis trigger function
-- Date: 2026-02-05
--
-- The trigger function was using TEXT type for user_id variable,
-- but migration 021 changed user_id columns to UUID type.
-- This fixes the type mismatch that caused "operator does not exist: uuid = text" errors.

CREATE OR REPLACE FUNCTION invalidate_notebook_synthesis()
RETURNS TRIGGER AS $$
DECLARE
    target_episode_id TEXT;
    target_user_id UUID;  -- Changed from TEXT to UUID
BEGIN
    -- Get the episode_id based on operation type
    IF TG_OP = 'INSERT' THEN
        target_episode_id := NEW.episode_id;
        target_user_id := NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        target_episode_id := OLD.episode_id;
        target_user_id := OLD.user_id;
    END IF;

    -- Only update if we have a valid episode_id
    IF target_episode_id IS NOT NULL THEN
        UPDATE notebook_synthesis
        SET is_stale = true, updated_at = NOW()
        WHERE episode_id = target_episode_id
        AND user_id = target_user_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
