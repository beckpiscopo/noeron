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
