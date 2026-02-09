import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { resolve } from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const imagePath = path.join("/")

  // Resolve canonical paths to prevent traversal via encoded sequences
  const allowedDir = resolve(process.cwd(), "..", "data", "figure_images")
  const fullPath = resolve(process.cwd(), "..", imagePath)

  if (!fullPath.startsWith(allowedDir + "/")) {
    return new NextResponse("Invalid path", { status: 400 })
  }

  try {
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
