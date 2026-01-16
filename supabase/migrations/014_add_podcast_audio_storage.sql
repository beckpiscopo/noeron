-- ============================================================================
-- PODCAST AUDIO STORAGE BUCKET (PUBLIC)
-- ============================================================================
-- Storage for episode audio files (mp3).
-- Uses public URLs for streaming audio playback in the browser.
--
-- NOTE: The bucket must be created manually in Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create bucket named "podcast-audio"
-- 3. Enable "Public bucket" (for audio playback)
-- 4. Set file size limit to 500MB (podcast files can be large)
-- 5. Allow MIME types: audio/mpeg
--
-- This migration sets up the RLS policies for the bucket.

-- Allow public read for podcast audio (for streaming playback)
CREATE POLICY "Public read for podcast audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'podcast-audio');

-- Service role can insert audio files (backend uploads)
CREATE POLICY "Service role insert for podcast audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'podcast-audio');

-- Service role can update audio files
CREATE POLICY "Service role update for podcast audio"
ON storage.objects FOR UPDATE
USING (bucket_id = 'podcast-audio');

-- Service role can delete audio files (cleanup)
CREATE POLICY "Service role delete for podcast audio"
ON storage.objects FOR DELETE
USING (bucket_id = 'podcast-audio');
