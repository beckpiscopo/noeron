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

