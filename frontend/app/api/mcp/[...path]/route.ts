import { NextRequest, NextResponse } from "next/server"

const FASTMCP_PROXY_TARGET = process.env.MCP_PROXY_TARGET ?? "http://127.0.0.1:8000"

function buildTargetUrl(pathSegments: string[] = []) {
  const path = pathSegments.join("/")
  return `${FASTMCP_PROXY_TARGET}/${path}`
}

async function forwardRequest(request: NextRequest, pathSegments: string[]) {
  const targetUrl = buildTargetUrl(pathSegments)
  console.log("[MCP Proxy] Target URL:", targetUrl)
  
  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: 'half',
    } as RequestInit)

    console.log("[MCP Proxy] MCP server response status:", response.status)
    
    const headers = new Headers(response.headers)
    headers.delete("content-encoding")

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error("[MCP Proxy] Failed to connect to MCP server:", error)
    return NextResponse.json(
      { error: "Failed to connect to MCP server", details: String(error) },
      { status: 503 }
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  console.log("[MCP Proxy] Forwarding request to path:", path)
  const result = await forwardRequest(request, path)
  console.log("[MCP Proxy] Response status:", result.status)
  return result
}

export async function OPTIONS() {
  return NextResponse.json(null, {
    headers: {
      Allow: "POST,OPTIONS",
    },
  })
}

