-- ============================================================================
-- GENERATED SLIDES TABLE
-- ============================================================================
-- Stores AI-generated slide deck metadata and Supabase Storage references.
-- Supports community sharing with opt-in public visibility.

CREATE TABLE IF NOT EXISTS generated_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id text NOT NULL,
  episode_id text NOT NULL,

  -- Content
  style text NOT NULL CHECK (style IN ('presenter', 'detailed')),
  slide_count int NOT NULL,
  slide_specs jsonb NOT NULL,

  -- Storage
  pdf_url text NOT NULL,
  thumbnail_urls text[],

  -- Sharing
  is_public boolean DEFAULT false,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  generation_time_ms int,

  -- Prevent duplicate style per user per claim
  CONSTRAINT unique_user_claim_style UNIQUE (user_id, claim_id, style)
);

-- Index for finding community slides by claim
CREATE INDEX idx_slides_public_claim ON generated_slides(claim_id)
  WHERE is_public = true;

-- Index for user's own slides
CREATE INDEX idx_slides_user ON generated_slides(user_id);

-- Enable RLS
ALTER TABLE generated_slides ENABLE ROW LEVEL SECURITY;

-- Users can view their own slides
CREATE POLICY "Users can view own slides" ON generated_slides
  FOR SELECT USING (auth.uid() = user_id);

-- Anyone can view public slides
CREATE POLICY "Anyone can view public slides" ON generated_slides
  FOR SELECT USING (is_public = true);

-- Users can insert their own slides
CREATE POLICY "Users can create slides" ON generated_slides
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own slides (for sharing toggle)
CREATE POLICY "Users can update own slides" ON generated_slides
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own slides
CREATE POLICY "Users can delete own slides" ON generated_slides
  FOR DELETE USING (auth.uid() = user_id);
