import { NextRequest, NextResponse } from "next/server"

const FASTMCP_PROXY_TARGET = process.env.MCP_PROXY_TARGET ?? "http://127.0.0.1:8000"
const isDev = process.env.NODE_ENV === "development"

// Long-running operations need extended timeouts
const LONG_RUNNING_TOOLS = ["generate_slide_deck", "generate_mini_podcast"]
const LONG_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes (max on Vercel hobby plan)
const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes

// Next.js route segment config - extend max duration (max 300s on hobby plan)
export const maxDuration = 300 // 5 minutes

function buildTargetUrl(pathSegments: string[] = []) {
  const path = pathSegments.join("/")
  return `${FASTMCP_PROXY_TARGET}/${path}`
}

function isLongRunningRequest(pathSegments: string[]): boolean {
  return pathSegments.some(segment =>
    LONG_RUNNING_TOOLS.some(tool => segment.includes(tool))
  )
}

async function forwardRequest(request: NextRequest, pathSegments: string[]) {
  const targetUrl = buildTargetUrl(pathSegments)
  const isLongRunning = isLongRunningRequest(pathSegments)
  const timeoutMs = isLongRunning ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS

  if (isDev) {
    console.log("[MCP Proxy] Target URL:", targetUrl)
    if (isLongRunning) {
      console.log("[MCP Proxy] Long-running request, timeout:", timeoutMs / 1000, "seconds")
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: 'half',
      signal: controller.signal,
    } as RequestInit)

    clearTimeout(timeoutId)
    if (isDev) console.log("[MCP Proxy] MCP server response status:", response.status)

    const headers = new Headers(response.headers)
    headers.delete("content-encoding")

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    clearTimeout(timeoutId)

    // Check if it was a timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("[MCP Proxy] Request timed out after", timeoutMs / 1000, "seconds")
      return NextResponse.json(
        { error: "Request timed out", details: `Operation exceeded ${timeoutMs / 1000} second limit` },
        { status: 504 }
      )
    }

    console.error("[MCP Proxy] Failed to connect to MCP server:", error)
    return NextResponse.json(
      { error: "Failed to connect to MCP server", details: String(error) },
      { status: 503 }
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  if (isDev) console.log("[MCP Proxy] Forwarding request to path:", path)
  const result = await forwardRequest(request, path)
  if (isDev) console.log("[MCP Proxy] Response status:", result.status)
  return result
}

export async function OPTIONS() {
  return NextResponse.json(null, {
    headers: {
      Allow: "POST,OPTIONS",
    },
  })
}
