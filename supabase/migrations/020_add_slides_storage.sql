-- ============================================================================
-- GENERATED SLIDES STORAGE BUCKET
-- ============================================================================
-- Storage for AI-generated slide deck PDFs and thumbnails.
-- Uses public URLs for easy PDF viewing/downloading.
--
-- NOTE: The bucket must be created manually in Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create bucket named "generated-slides"
-- 3. Enable "Public bucket" (for PDF access)
-- 4. Set file size limit to 20MB
-- 5. Allow MIME types: application/pdf, image/png, image/jpeg
--
-- This migration sets up the RLS policies for the bucket.

-- Allow public read for generated slides (for PDF viewing)
CREATE POLICY "Public read for generated slides"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-slides');

-- Service role can insert slides (backend uploads)
CREATE POLICY "Service role insert for generated slides"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generated-slides');

-- Service role can update slides
CREATE POLICY "Service role update for generated slides"
ON storage.objects FOR UPDATE
USING (bucket_id = 'generated-slides');

-- Service role can delete slides (cleanup)
CREATE POLICY "Service role delete for generated slides"
ON storage.objects FOR DELETE
USING (bucket_id = 'generated-slides');
