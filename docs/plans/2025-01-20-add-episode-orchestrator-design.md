# Add Episode Orchestrator Script Design

## Overview

A single CLI script that automates the entire episode ingestion pipeline, from audio file to fully indexed episode with claims, summaries, and database sync.

## Invocation

```bash
# Standard usage
python scripts/add_episode.py --audio /path/to/episode.mp3 --id lex_450

# Resume a failed run
python scripts/add_episode.py --resume lex_450

# Skip expensive steps
python scripts/add_episode.py --audio ep.mp3 --id lex_450 --skip-claims --skip-vectors
```

## Pipeline Steps

| Step | Description | Output |
|------|-------------|--------|
| 1. `transcribe_audio` | Call AssemblyAI API, poll until complete | `/data/transcripts/{id}.txt` |
| 2. `extract_metadata` | Use Gemini to extract title, guest, description from transcript | Metadata dict |
| 3. `update_episodes_json` | Add episode entry to `/data/episodes.json` | Modified JSON |
| 4. `map_audio_file` | Copy audio to standard location, update route mapping | Audio file + TS edit |
| 5. `generate_summaries` | Generate narrative arc, chapters, themes via Gemini | `episode_summaries.json` |
| 6. `extract_claims` | Identify scientific claims with timestamps, link to papers | Claims cache |
| 7. `build_clusters` | Group claims into thematic clusters | Cluster embeddings |
| 8. `migrate_to_supabase` | Sync episode and claims to database | DB records |
| 9. `update_vector_store` | Add claim embeddings for semantic search | Vector index |

## Checkpoint System

Checkpoint file: `.checkpoints/{episode_id}.json`

```json
{
  "episode_id": "lex_450",
  "audio_path": "/path/to/episode.mp3",
  "started_at": "2025-01-20T10:30:00Z",
  "completed_steps": ["transcribe", "extract_metadata", "update_episodes_json"],
  "current_step": "generate_summaries",
  "data": {
    "transcript_path": "/data/transcripts/lex_450.txt",
    "metadata": { "title": "...", "guest": "...", "..." }
  },
  "errors": []
}
```

**Resume behavior:**
- `--resume {id}` loads existing checkpoint
- Skips steps in `completed_steps`
- Resumes from `current_step` with accumulated `data`
- Steps re-run from scratch if partially complete (simpler than partial tracking)

## Error Handling

- **On failure:** Save checkpoint, print resume command, exit
- **AssemblyAI:** Retry with exponential backoff (3 attempts), save `transcript_id` for resume
- **Gemini:** Retry with backoff, wait on rate limits
- **Supabase:** Upsert operations for idempotency
- **On success:** Delete checkpoint, print summary

## File Structure

```
scripts/
  add_episode.py          # Main orchestrator
  lib/
    checkpoint.py         # Checkpoint save/load/resume logic
    assemblyai_client.py  # AssemblyAI transcription wrapper
    metadata_extractor.py # Gemini-based metadata extraction

.checkpoints/             # Checkpoint files (gitignored)
```

## Integration with Existing Code

Reuse existing script logic by importing:

```python
from generate_episode_summaries import generate_summary_for_episode
from context_card_builder import extract_claims_from_transcript
from build_taxonomy_clusters import build_clusters_for_episode
from migrate_to_supabase import sync_episode_to_supabase
```

Existing scripts may need refactoring to expose importable functions while maintaining CLI behavior.

## Data Flow Strategy

**JSON as source of truth.** Write to JSON files first, then sync to Supabase. This:
- Matches existing architecture
- Enables offline work
- Keeps files version-controllable
- Orchestrator ensures sync happens automatically

## Output Example

```
$ python scripts/add_episode.py --audio ~/Downloads/podcast.mp3 --id lex_450

[1/9] Transcribing audio via AssemblyAI...
      ✓ Saved transcript to /data/transcripts/lex_450.txt (2h 34m)

[2/9] Extracting metadata from transcript...
      ✓ Title: "Michael Levin: Biology, Cognition, and AI"
      ✓ Guest: Michael Levin
      ✓ Podcast: Lex Fridman Podcast

[3/9] Updating episodes.json...
      ✓ Added episode entry

[4/9] Mapping audio file...
      ✓ Copied to /data/podcasts/raw/lex_450.mp3
      ✓ Updated audio route mapping

[5/9] Generating AI summaries...
      ✓ Created narrative arc, chapters, themes

[6/9] Extracting claims from transcript...
      ✓ Found 47 claims, linked to 12 papers

[7/9] Building taxonomy clusters...
      ✓ Grouped into 8 thematic clusters

[8/9] Syncing to Supabase...
      ✓ Episode record created
      ✓ 47 claims synced

[9/9] Updating vector store...
      ✓ Added 47 claim embeddings

✅ Episode 'lex_450' added successfully!
```

## Files Created/Modified Per Run

- `/data/transcripts/{id}.txt` (new)
- `/data/episodes.json` (modified)
- `/data/episode_summaries.json` (modified)
- `/data/podcasts/raw/{id}.mp3` (new)
- `frontend/app/api/audio/[episodeId]/route.ts` (modified)
- Supabase `episodes` and `claims` tables (modified)
- Vector store index (modified)
