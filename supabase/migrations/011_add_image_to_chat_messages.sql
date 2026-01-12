-- ============================================================================
-- ADD IMAGE SUPPORT TO CHAT_MESSAGES
-- ============================================================================
-- Allow chat messages to include AI-generated images

-- Add image URL column (points to Supabase Storage)
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add image caption column (AI-generated description)
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS image_caption TEXT;

-- Documentation comments
COMMENT ON COLUMN chat_messages.image_url IS 'URL to AI-generated image in Supabase Storage (generated-images bucket)';
COMMENT ON COLUMN chat_messages.image_caption IS 'AI-generated caption/description for the image';
