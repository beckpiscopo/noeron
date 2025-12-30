# Data Connection Status Report

## ✅ Issues Fixed

### 1. Audio API Route (`/api/audio/[episodeId]/route.ts`)
**Problem:** Next.js 15+ requires `params` to be awaited as a Promise
**Solution:** Updated route handler:
```typescript
// Before
export async function GET(_request: Request, { params }: { params: { episodeId: string } })

// After
export async function GET(_request: Request, { params }: { params: Promise<{ episodeId: string }> })
```

### 2. MCP API Route (`/api/mcp/[...path]/route.ts`)
**Problem:** Same params Promise issue
**Solution:** Updated route handler to await params before use

## 📊 Current Data Connections

### Episodes Data
- **Source:** `data/episodes.json`
- **Available Episodes:** 4 total
  - `lex_325` - Lex Fridman Podcast #325 (Michael Levin) ✅ Audio Available
  - `theories_of_everything` - Theories of Everything (Michael Levin) ⚠️ No audio yet
  - `mlst` - Machine Learning Street Talk (Michael Levin) ⚠️ No audio yet
  - `essentia_foundation` - Essentia Foundation (Michael Levin) ⚠️ No audio yet

### Audio Files
- **Location:** `data/podcasts/raw/`
- **Available:**
  - `p3lsYlod5OU.mp3` (mapped to `lex_325`)
  - `p3lsYlod5OU.webm` (backup format)
- **API Endpoint:** `/api/audio/[episodeId]`
- **Supports:** Range requests for audio seeking

### Claims Data
- **Source:** `cache/podcast_lex_325_claims.json`
- **Structure:** Segments with timestamp-aligned claims
- **MCP Tool:** `get_episode_claims(episode_id, limit)`
- **Format:** Each claim includes:
  - `id` - Unique identifier
  - `timestamp` - Seconds into episode
  - `category` - Claim type (scientific_finding, evidence, etc.)
  - `title` - Main claim text
  - `description` - Context and rationale
  - `source` - Citation or reference
  - `status` - past/current/future (relative to playback)

## 🔄 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Episode Library Component                                    │
│     ↓                                                            │
│     Calls: callMcpTool("list_episodes", {})                     │
│     ↓                                                            │
│     → /api/mcp/tools/list_episodes/execute                      │
│       ↓                                                          │
│       → MCP Server (Python): src/bioelectricity_research/       │
│         server.py::list_episodes()                              │
│         ↓                                                        │
│         Returns: Array of EpisodeMetadata from episodes.json    │
│                                                                  │
│  2. User Selects Episode → Listening View                       │
│     ↓                                                            │
│     A. Load Audio:                                              │
│        audioUrl = `/api/audio/${episode.id}`                    │
│        → Audio API Route (Node.js)                              │
│        → Streams file from data/podcasts/raw/                   │
│                                                                  │
│     B. Load Claims:                                             │
│        callMcpTool("get_episode_claims", {                     │
│          episode_id: "lex_325",                                 │
│          limit: 45                                              │
│        })                                                       │
│        → MCP Server::get_episode_claims()                       │
│        → Parses cache/podcast_lex_325_claims.json              │
│        → Returns timestamp-sorted claims                         │
│                                                                  │
│  3. Real-time Synchronization                                   │
│     - Audio player reports currentTime via onTimeUpdate         │
│     - Claims marked as past/current/future based on timestamp   │
│     - Feed auto-scrolls to show relevant claims                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 What's Working Now

1. ✅ **Episode Library**
   - Loads all 4 episodes from `episodes.json` via MCP
   - Displays metadata (title, host, guest, duration, papers linked)
   - Click to select episode → navigates to Listening View

2. ✅ **Audio Playback** (for `lex_325`)
   - Streams MP3 from `/api/audio/lex_325`
   - Supports seeking via range requests
   - HTML5 audio controls work properly

3. ✅ **Claims Feed** (for `lex_325`)
   - Loads claims from MCP server
   - Displays timestamp-aligned insights
   - Shows claim metadata (category, source, description)

4. ✅ **Timestamp Synchronization**
   - Audio currentTime updates in real-time
   - Claims status updates (past/current/future)
   - User can scrub audio and feed updates accordingly

## 📝 To Add More Episodes

### Step 1: Add Audio Files
```bash
# Place audio file in data/podcasts/raw/
cp your_audio.mp3 data/podcasts/raw/

# Update audio mapping in frontend/app/api/audio/[episodeId]/route.ts
const AUDIO_FILES: Record<string, string> = {
  lex_325: "p3lsYlod5OU.mp3",
  theories_of_everything: "your_audio.mp3", // Add here
}
```

### Step 2: Generate Claims Data
```bash
# Your existing pipeline should generate:
# cache/podcast_[episode_id]_claims.json

# Make sure the MCP server's _load_claims_cache() can find it
# Current location: cache/podcast_lex_325_claims.json
```

### Step 3: Update Episodes Metadata
Episodes are already defined in `data/episodes.json` - just need audio + claims!

## 🔍 Debugging Tips

### Check if MCP Server is Running
```bash
# Terminal should show:
# Started server on port 8000
```

### Test MCP Endpoints Directly
```bash
# List episodes
curl -X POST http://localhost:8000/tools/list_episodes/execute \
  -H "Content-Type: application/json" \
  -d '{}'

# Get claims for lex_325
curl -X POST http://localhost:8000/tools/get_episode_claims/execute \
  -H "Content-Type: application/json" \
  -d '{"episode_id": "lex_325", "limit": 10}'
```

### Test Audio Endpoint
```bash
# Should return MP3 audio
curl http://localhost:3000/api/audio/lex_325 --head
```

### Check Browser Console
Open DevTools → Console to see:
- MCP API calls
- Audio loading status
- Claims loading status
- Any connection errors

## 🚀 Current State Summary

**WORKING:**
- ✅ Episode library loads 4 episodes from data
- ✅ lex_325 audio plays from local file
- ✅ lex_325 claims load from cache
- ✅ Timestamp sync between audio and claims
- ✅ All Next.js API routes fixed for Next.js 15+

**PENDING:**
- ⚠️ Audio files for other 3 episodes
- ⚠️ Claims generation for other 3 episodes
- ℹ️ Deep exploration view integration (UI exists, needs data)
- ℹ️ Paper viewer integration (UI exists, needs data)
- ℹ️ RAG search integration (backend exists, needs frontend)

## 📖 Key Files Reference

### Backend (Python MCP Server)
- `src/bioelectricity_research/server.py` - Main MCP server
  - `list_episodes()` - Returns episode catalog
  - `get_episode_claims()` - Returns claims for episode
  - `rag_search()` - Semantic search over papers (not yet used in frontend)

### Frontend (Next.js)
- `frontend/app/page.tsx` - Main app orchestrator
  - Manages view state (landing/library/listening/exploration)
  - Loads claims via MCP when episode selected
  - Handles time synchronization

- `frontend/components/episode-library.tsx` - Episode selection
  - Calls `list_episodes` MCP tool
  - Displays all available episodes

- `frontend/components/listening-view.tsx` - Audio + claims
  - Manages audio playback
  - Displays synchronized claims feed
  - Handles dive deeper / view source actions

### API Routes
- `frontend/app/api/audio/[episodeId]/route.ts` - Audio streaming
- `frontend/app/api/mcp/[...path]/route.ts` - MCP proxy

### Data Files
- `data/episodes.json` - Episode metadata
- `data/podcasts/raw/*.mp3` - Audio files
- `cache/podcast_lex_325_claims.json` - Claims for lex_325

