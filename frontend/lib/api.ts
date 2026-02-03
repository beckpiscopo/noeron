const fastmcpUrl = process.env.NEXT_PUBLIC_FASTMCP_URL ?? "/api/mcp"

type ToolRequestBody = Record<string, unknown>

export function getGeminiKeyHeader(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const key = localStorage.getItem("noeron_gemini_api_key")
  return key ? { "X-Gemini-Key": key } : {}
}

export async function callMcpTool<T = unknown>(tool: string, body: ToolRequestBody) {
  const response = await fetch(`${fastmcpUrl}/tools/${tool}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getGeminiKeyHeader(),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `FastMCP tool '${tool}' failed`)
  }

  return (await response.json()) as T
}

// Figure Analysis types (Agentic Vision)
export interface FigureAnalysis {
  figure_id: string
  paper_id: string
  image_path: string
  image_url: string | null  // Supabase public URL (preferred)
  caption: string | null
  title: string | null
  analysis: string
  code_executed: boolean
}

export interface AnalyzeFiguresResponse {
  paper_id: string
  figures: FigureAnalysis[]
  total_figures: number
  error?: string
}

export async function analyzePaperFigures(
  paperId: string,
  claimContext?: string,
  figureId?: string
): Promise<AnalyzeFiguresResponse> {
  return callMcpTool<AnalyzeFiguresResponse>("analyze_paper_figures", {
    paper_id: paperId,
    claim_context: claimContext,
    figure_id: figureId,
  })
}

// Figure browsing types (no AI analysis required)
export interface FigureMetadata {
  figure_id: string
  paper_id: string
  image_path: string | null
  image_url: string | null
  caption: string | null
  title: string | null
  label: string | null
}

export interface GetFiguresResponse {
  paper_id: string
  figures: FigureMetadata[]
  total_figures: number
}

export async function getPaperFigures(paperId: string): Promise<GetFiguresResponse> {
  return callMcpTool<GetFiguresResponse>("get_paper_figures", { paper_id: paperId })
}

export async function getPapersWithFigures(): Promise<string[]> {
  const response = await fetch(`${fastmcpUrl}/tools/papers_with_figures`)
  const data = await response.json()
  return data.paper_ids || []
}

// Claim figures types (figures from evidence papers)
export interface ClaimFigure extends FigureMetadata {
  paper_title: string
}

export interface ClaimFiguresResponse {
  claim_id: string
  figures: ClaimFigure[]
  total_available: number
  papers_with_figures?: number
  papers_checked?: number
  message?: string
  error?: string
}

export async function getClaimFigures(
  claimId: string,
  episodeId: string,
  limit?: number
): Promise<ClaimFiguresResponse> {
  return callMcpTool<ClaimFiguresResponse>("get_claim_figures", {
    claim_id: claimId,
    episode_id: episodeId,
    limit: limit ?? 10,
  })
}

// Slide Deck Generation types
export interface SlideSpec {
  type: "title" | "content" | "evidence" | "summary"
  title?: string
  headline?: string
  subtitle?: string
  bullets?: string[]
  key_takeaways?: string[]
  visual_prompt?: string
  paper_citation?: string
}

export interface GeneratedSlides {
  pdf_url: string
  thumbnail_urls: string[]
  slide_count: number
  slide_specs: SlideSpec[]
  cached: boolean
  generated_at: string
  generation_time_ms?: number
  error?: string
  error_code?: string
}

export interface CommunitySlide {
  id: string
  style: "presenter" | "detailed"
  slide_count: number
  pdf_url: string
  thumbnail_urls: string[]
  created_at: string
  creator_name: string
}

export async function generateSlideDeck(
  claimId: string,
  episodeId: string,
  style: "presenter" | "detailed",
  userId?: string,
  forceRegenerate = false
): Promise<GeneratedSlides> {
  return callMcpTool<GeneratedSlides>("generate_slide_deck", {
    claim_id: claimId,
    episode_id: episodeId,
    style,
    user_id: userId,
    force_regenerate: forceRegenerate,
  })
}

export async function getCommunitySlides(claimId: string): Promise<{ slides: CommunitySlide[]; count: number }> {
  return callMcpTool<{ slides: CommunitySlide[]; count: number }>("get_community_slides", {
    claim_id: claimId,
  })
}

export async function updateSlideSharing(
  slideId: string,
  isPublic: boolean,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  return callMcpTool<{ success: boolean; error?: string }>("update_slide_sharing", {
    slide_id: slideId,
    is_public: isPublic,
    user_id: userId,
  })
}

// User's own slides for a claim
export interface UserSlide {
  id: string
  style: "presenter" | "detailed"
  slide_count: number
  pdf_url: string
  thumbnail_urls: string[]
  slide_specs: SlideSpec[]
  is_public: boolean
  created_at: string
}

export interface UserSlidesResponse {
  slides: Record<string, UserSlide>
  styles_created: ("presenter" | "detailed")[]
  error?: string
}

export async function getUserSlides(
  claimId: string,
  userId: string
): Promise<UserSlidesResponse> {
  return callMcpTool<UserSlidesResponse>("get_user_slides", {
    claim_id: claimId,
    user_id: userId,
  })
}
