import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const imagePath = path.join("/")

  // Security: only allow paths within data/figure_images
  if (!imagePath.startsWith("data/figure_images/")) {
    return new NextResponse("Not found", { status: 404 })
  }

  // Prevent path traversal
  if (imagePath.includes("..")) {
    return new NextResponse("Invalid path", { status: 400 })
  }

  try {
    // Go up from frontend directory to project root
    const fullPath = join(process.cwd(), "..", imagePath)
    const data = await readFile(fullPath)

    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
