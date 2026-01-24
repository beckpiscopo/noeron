// Types for the AI Chat Assistant

export interface ChatSource {
  paper_id: string
  paper_title: string
  year: string
  section: string
  page?: string
  relevance_snippet: string
}

// Generated image metadata
export interface GeneratedImage {
  image_url: string
  caption?: string
  style_used?: string
  storage_path?: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  sources?: ChatSource[]
  isLoading?: boolean
  error?: string
  // Image support for AI-generated visualizations
  image?: GeneratedImage
  // Gemini thinking traces for transparency
  thinking?: string
  // Streaming state for real-time updates
  isThinking?: boolean  // True while receiving thinking chunks
  isStreaming?: boolean  // True while receiving content chunks
}

export interface ChatContext {
  episode_id: string
  episode_title: string
  guest: string
  claim_id?: string
  claim_text?: string
  current_timestamp?: string  // Current playback position (e.g., "23:45")
}

export interface ChatWithContextRequest {
  message: string
  episode_id: string
  claim_id?: string
  current_timestamp?: string  // Current playback position (e.g., "23:45" or "1:23:45")
  conversation_history: Array<{ role: "user" | "assistant"; content: string }>
  n_results?: number
  use_layered_context?: boolean  // Use advanced timestamp-aware context (default: true)
  include_thinking?: boolean  // Include Gemini thinking traces (default: true)
}

export interface ChatWithContextResponse {
  response: string
  sources: ChatSource[]
  query_used: string
  model: string
  error?: string
  thinking?: string  // Gemini's reasoning traces
}

// Response type for image generation
export interface GenerateImageResponse {
  image_url: string | null
  caption: string | null
  style_used?: string
  model?: string
  episode_id?: string
  timestamp?: string
  storage_path?: string
  error?: string
}

// Generated mini podcast metadata
export interface GeneratedPodcast {
  podcast_url: string
  duration_seconds: number
  script: string
  style: "casual" | "academic"
  storage_path?: string
}

// Response type for mini podcast generation
export interface GeneratePodcastResponse {
  podcast_url: string | null
  duration_seconds: number
  script: string
  style: string
  claim_id: string
  episode_id: string
  storage_path?: string
  cached: boolean
  generated_at: string
  model_script?: string
  model_tts?: string
  error?: string
  error_code?: string
}

// Response type for text-to-speech conversion
export interface TextToSpeechResponse {
  audio_url: string | null
  duration_seconds?: number
  voice?: string
  storage_path?: string
  error?: string
  error_code?: string
}
