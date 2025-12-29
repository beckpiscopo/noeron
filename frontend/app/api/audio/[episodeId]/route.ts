import { NextResponse } from "next/server"
import { createReadStream } from "fs"
import { stat } from "fs/promises"
import path from "path"
import { Readable } from "stream"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// From frontend/app/api/audio/[episodeId]/, go up 5 levels to get to repo root
const REPO_ROOT = path.resolve(__dirname, "../../../../../")
const AUDIO_DIR = path.join(REPO_ROOT, "data", "podcasts", "raw")

const AUDIO_FILES: Record<string, string> = {
  lex_325: "p3lsYlod5OU.mp3",
  // Add more episodes here as audio files become available
  // theories_of_everything: "filename.mp3",
  // mlst: "filename.mp3",
  // essentia_foundation: "filename.mp3",
}

function toWebStream(stream: NodeJS.ReadableStream) {
  return Readable.toWeb(stream)
}

function parseRange(rangeHeader: string | null, fileSize: number) {
  if (!rangeHeader) return null
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
  if (!match) {
    return null
  }
  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : fileSize - 1
  if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || start > end) {
    return null
  }
  return { start, end }
}

export async function GET(_request: Request, { params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params
  console.log("[Audio API] Request for episodeId:", episodeId)
  console.log("[Audio API] AUDIO_DIR:", AUDIO_DIR)
  console.log("[Audio API] Available files:", AUDIO_FILES)
  
  const fileName = AUDIO_FILES[episodeId]
  if (!fileName) {
    console.error("[Audio API] No mapping found for episodeId:", episodeId)
    return NextResponse.json({ error: "Audio not found" }, { status: 404 })
  }

  const filePath = path.join(AUDIO_DIR, fileName)
  console.log("[Audio API] Full file path:", filePath)
  let fileStat
  try {
    fileStat = await stat(filePath)
    console.log("[Audio API] File found! Size:", fileStat.size, "bytes")
  } catch (error) {
    console.error("[Audio API] File not found at path:", filePath, "Error:", error)
    return NextResponse.json({ error: "Audio file missing", path: filePath }, { status: 404 })
  }

  const rangeHeader = _request.headers.get("range")
  const range = parseRange(rangeHeader, fileStat.size)

  if (!range) {
    const stream = createReadStream(filePath)
    return new NextResponse(toWebStream(stream), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(fileStat.size),
        "Accept-Ranges": "bytes",
      },
    })
  }

  const { start, end } = range
  const chunkSize = end - start + 1
  const stream = createReadStream(filePath, { start, end })
  return new NextResponse(toWebStream(stream), {
    status: 206,
    headers: {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
    },
  })
}

