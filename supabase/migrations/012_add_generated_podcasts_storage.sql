-- ============================================================================
-- GENERATED PODCASTS STORAGE BUCKET (PUBLIC)
-- ============================================================================
-- Storage for AI-generated mini podcasts from deep dive pages
-- Uses public URLs for easy audio playback in the browser.
--
-- NOTE: The bucket must be created manually in Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create bucket named "generated-podcasts"
-- 3. Enable "Public bucket" (for audio playback)
-- 4. Set file size limit to 50MB (audio files can be large)
-- 5. Allow MIME types: audio/wav, audio/mpeg
--
-- This migration sets up the RLS policies for the bucket.
-- Access is via public URLs since audio needs to stream directly.

-- Allow public read for generated podcasts (for audio playback)
CREATE POLICY "Public read for generated podcasts"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-podcasts');

-- Service role can insert podcasts (backend uploads)
CREATE POLICY "Service role insert for generated podcasts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generated-podcasts');

-- Service role can update podcasts
CREATE POLICY "Service role update for generated podcasts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'generated-podcasts');

-- Service role can delete old podcasts (cleanup)
CREATE POLICY "Service role delete for generated podcasts"
ON storage.objects FOR DELETE
USING (bucket_id = 'generated-podcasts');
