---
name: Server Split Sub-Plan
overview: Incremental decomposition of server.py (5,379 lines) into focused modules + logging, with verification after each phase.
---

# Server Module Decomposition Sub-Plan

Companion to step 4 of `backend_quality_cleanup_0e09c55c.plan.md`.

## Current State (verified 2026-06-05)

`server.py` is **5,379 lines** (not 4,278 as originally estimated). Contains:

- 27 `@mcp.tool()` entrypoints
- 50+ helper functions
- 21 Pydantic input models
- 3 large prompt templates (~350 lines total)
- 13 cache load/save function pairs
- `mcp = FastMCP(...)` instance + Gemini client state

**Known bugs to fix during extraction:**
- `EpisodeMetadata` is defined twice (lines 800 and 916 — second shadows first). Fix: single definition in `episodes.py`.

**Items not in the original plan's mapping (discovered in actual code):**
- `analyze_paper_figures` tool → `tools/figures.py`
- Figure helpers: `_load_figures_index`, `_get_figures_for_paper`, `_get_paper_figures_impl`, `_get_papers_with_figures`, `_get_claim_figures_impl`, `_analyze_paper_figures_impl` → `figure_utils.py`
- `_load_figure_analysis_cache`, `_save_figure_analysis_cache` → `cache_store.py`
- `generate_slide_deck`, `get_community_slides`, `update_slide_sharing`, `get_user_slides` → `tools/slides.py`
- Slide helpers: `_plan_slides`, `_render_slide`, `_assemble_pdf`, `_generate_slide_deck_impl`, `_get_supabase_client` → `slide_utils.py`
- `EVIDENCE_THREAD_PROMPT` template → `prompts.py`
- Evidence thread helpers: `_should_generate_threads`, `_format_papers_for_thread_prompt`, `_validate_threads`, `_call_gemini_for_threads` → `evidence_thread_utils.py`
- `_call_gemini_for_deep_dive` → `deep_dive_utils.py`

## Target Structure

```
src/bioelectricity_research/
├── server.py            ← SLIM: just imports tools/ to register with mcp
├── mcp_app.py           ← NEW: mcp instance, Gemini client, get_vectorstore()
├── prompts.py           ← NEW: all prompt templates + parse helpers
├── cache_store.py       ← NEW: all _load_*_cache / _save_*_cache functions
├── episodes.py          ← NEW: EpisodeMetadata model, load_episode_catalog, etc.
├── rag_utils.py         ← NEW: _build_research_query, _format_rag_results_*
├── chat_utils.py        ← NEW: _format_conversation_history
├── knowledge_graph_utils.py ← NEW: _normalize_for_matching, _find_matching_entities, etc.
├── expansion_utils.py   ← NEW: _call_gemini_for_expansion, _validate_expansion_result
├── evidence_thread_utils.py ← NEW: _should_generate_threads, etc.
├── deep_dive_utils.py   ← NEW: _call_gemini_for_deep_dive
├── figure_utils.py      ← NEW: figure metadata helpers
├── media_utils.py       ← NEW: _generate_image_impl, _generate_mini_podcast_impl, _text_to_speech_impl
├── slide_utils.py       ← NEW: _plan_slides, _render_slide, _assemble_pdf, etc.
└── tools/
    ├── __init__.py
    ├── papers.py         ← bioelectricity_search_papers, get_paper_details, etc.
    ├── episodes.py       ← list_episodes, get_episode_claims
    ├── rag.py            ← rag_search, rag_stats
    ├── claims.py         ← get_claim_context
    ├── deep_dive.py      ← generate_deep_dive_summary
    ├── figures.py        ← analyze_paper_figures
    ├── evidence_threads.py ← generate_evidence_threads
    ├── knowledge_graph.py ← get_relevant_kg_subgraph
    ├── expansion.py      ← expand_concept_grounded
    ├── quiz.py           ← generate_quiz_questions
    ├── chat.py           ← chat_with_context
    ├── image.py          ← generate_image_with_context
    ├── podcast.py        ← generate_mini_podcast
    ├── tts.py            ← text_to_speech
    ├── taxonomy.py       ← list_taxonomy_clusters, get_cluster_details, etc.
    └── slides.py         ← generate_slide_deck, get_community_slides, etc.
```

## Verification Command

After each phase, run this to confirm nothing broke:

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
python -c "from src.bioelectricity_research.server import mcp; print('OK — tools:', len(mcp._tool_manager._tools))"
```

Expected tool count: **27** (verify exact count at start of implementation).

## Implementation Phases

Each phase: extract → update imports in server.py → verify.

---

### Phase 0: Baseline verification

Before touching anything:
- [ ] Run the verification command, record the tool count.
- [ ] Run `python -m pytest tests/ -x -q 2>&1 | tail -5` and record baseline test output.

---

### Phase A: Create `mcp_app.py`

Extract the application core. This is the module everything else will import from.

Contents to move from `server.py`:
- `mcp = FastMCP("bioelectricity-research")` (line 45)
- `_GENAI_CLIENT = None` (line 27)
- `_request_gemini_key` ContextVar (lines 36-38)
- `_ensure_gemini_client_ready()` (lines 234-252)
- `_get_genai_client()` (lines 255-269)
- `get_vectorstore()` (lines 55-59)
- `_vectorstore` global (line 52)
- `SLIDES_BUCKET`, `NANO_BANANA_MODEL`, `SLIDE_WIDTH`, `SLIDE_HEIGHT` constants (lines 30-33)

`mcp_app.py` imports:
```python
import logging
from contextlib import contextmanager
import contextvars
from typing import Optional
from fastmcp import FastMCP
from .config import GEMINI_API_KEY, GEMINI_MODEL
from .vector_store import VectorStore, SupabaseVectorStore, get_vectorstore as _create_vectorstore

logger = logging.getLogger(__name__)
mcp = FastMCP("bioelectricity-research")
```

Update `server.py` to: `from .mcp_app import mcp, get_vectorstore, _get_genai_client, _ensure_gemini_client_ready, _request_gemini_key`

- [ ] Create `mcp_app.py`
- [ ] Update `server.py` imports
- [ ] Run verification command — must still show same tool count

---

### Phase B: Extract `prompts.py`

Contents to move:
- `DEEP_DIVE_PROMPT_TEMPLATE_TECHNICAL` (line 272)
- `DEEP_DIVE_PROMPT_TEMPLATE_SIMPLIFIED` (line 317)
- `DEEP_DIVE_PROMPT_TEMPLATE` (line 360)
- `EVIDENCE_THREAD_PROMPT` (line 542)
- `_parse_paper_key_findings()` (line 363)
- `_extract_summary_without_findings()` (line 399)

No external deps except stdlib. Clean module with no side-effects.

- [ ] Create `prompts.py`
- [ ] Update `server.py` imports
- [ ] Run verification command

---

### Phase C: Extract `cache_store.py`

All cache load/save pairs. No AI calls, pure file I/O.

Contents to move (with their PATH constants):
- `DEEP_DIVE_CACHE_PATH` (line 64)
- `EVIDENCE_THREADS_CACHE_PATH` (line 65)
- `KNOWLEDGE_GRAPH_PATH` (line 66)
- `CLAIM_RELEVANCE_CACHE_PATH` (line 67)
- `FIGURES_INDEX_PATH` (line 68)
- `FIGURE_ANALYSIS_CACHE_PATH` (line 69)
- `_load_deep_dive_cache()` / `_save_deep_dive_cache()` (lines 407-423)
- `_load_figure_analysis_cache()` / `_save_figure_analysis_cache()` (lines 425-442)
- `_load_evidence_threads_cache()` / `_save_evidence_threads_cache()` (lines 598-614)
- `_load_claims_cache()` (line 862)
- `_load_context_card_registry()` (line 1457)
- `_load_papers_collection()` (line 1468)
- `_load_knowledge_graph()` (line 2215)
- `_load_claim_relevance_cache()` (line 2226)
- `_load_expansion_cache()` / `_save_expansion_cache()` (lines 2663-2682)
- `_load_podcast_cache()` / `_save_podcast_cache()` (lines 3861-3876)

Also: `ROOT_DIR` and other `*_PATH` constants defined at top of server.py should be centralized here or in `mcp_app.py`.

- [ ] Create `cache_store.py`
- [ ] Update `server.py` imports
- [ ] Run verification command

---

### Phase D: Extract `episodes.py`

Contents to move:
- `EPISODES_FILE_PATH` constant (line 62)
- `EpisodeMetadata` model — use the line 800 definition, **delete the duplicate at line 916**
- `load_episode_catalog()` (line 812)
- `_parse_timestamp_seconds()` (line 832)
- `_load_episodes()` (line 3163)

- [ ] Create `episodes.py`
- [ ] Remove duplicate `EpisodeMetadata` at line 916
- [ ] Update `server.py` imports
- [ ] Run verification command

---

### Phase E: Extract `rag_utils.py` and `chat_utils.py`

**`rag_utils.py`** contents:
- `_build_research_query()` (line 443)
- `_format_rag_results_for_prompt()` (line 486)
- `_format_rag_results_for_chat()` (line 3191)

**`chat_utils.py`** contents:
- `_format_conversation_history()` (line 3174)

- [ ] Create `rag_utils.py`
- [ ] Create `chat_utils.py`
- [ ] Update `server.py` imports
- [ ] Run verification command

---

### Phase F: Extract utility modules for AI-heavy sections

**`deep_dive_utils.py`** contents:
- `_call_gemini_for_deep_dive()` (line 521)

**`evidence_thread_utils.py`** contents:
- `_should_generate_threads()` (line 616)
- `_format_papers_for_thread_prompt()` (line 646)
- `_validate_threads()` (line 687)
- `_call_gemini_for_threads()` (line 760)

**`knowledge_graph_utils.py`** contents:
- `_normalize_for_matching()` (line 2237)
- `_find_matching_entities()` (line 2246)
- `_extract_subgraph()` (line 2288)
- `_extract_entities_with_gemini()` (line 2360)

**`expansion_utils.py`** contents:
- `_call_gemini_for_expansion()` (line 2684)
- `_validate_expansion_result()` (line 2731)

- [ ] Create `deep_dive_utils.py`
- [ ] Create `evidence_thread_utils.py`
- [ ] Create `knowledge_graph_utils.py`
- [ ] Create `expansion_utils.py`
- [ ] Update `server.py` imports
- [ ] Run verification command

---

### Phase G: Extract `figure_utils.py`

Contents to move:
- `_load_figures_index()` (line 73)
- `_get_figures_for_paper()` (line 80)
- `_get_paper_figures_impl()` (line 86)
- `_get_papers_with_figures()` (line 114)
- `_get_claim_figures_impl()` (line 126)
- `_analyze_paper_figures_impl()` (line 1868)

- [ ] Create `figure_utils.py`
- [ ] Update `server.py` imports
- [ ] Run verification command

---

### Phase H: Extract `media_utils.py`

Contents to move:
- `_generate_image_impl()` (line 3585)
- `_generate_mini_podcast_impl()` (line 3896)
- `_text_to_speech_impl()` (line 4298)

These are the largest impl functions. Move body, keep thin wrappers in tools/ that call them.

- [ ] Create `media_utils.py`
- [ ] Update `server.py` imports
- [ ] Run verification command

---

### Phase I: Extract `slide_utils.py`

Contents to move:
- `_plan_slides()` (line 4712)
- `_render_slide()` (line 4861)
- `_assemble_pdf()` (line 4981)
- `_generate_slide_deck_impl()` (line 5025)
- `_get_supabase_client()` (line 4482)
- `GenerateSlideDeckInput`, `GetCommunitySlidesInput`, `UpdateSlideShareInput`, `GetUserSlidesInput` models (lines 3543-3583)

- [ ] Create `slide_utils.py`
- [ ] Update `server.py` imports
- [ ] Run verification command

---

### Phase J: Create `tools/` directory and move tool entrypoints

Each tool file:
1. Imports `mcp` from `mcp_app`
2. Imports needed helpers from utility modules
3. Defines the Pydantic input model (or imports shared ones)
4. Defines the `@mcp.tool()` function

Move tools one file at a time, run verification after each file.

Order (simplest to most complex):

1. **`tools/__init__.py`** — empty
2. **`tools/papers.py`** — `bioelectricity_search_papers`, `bioelectricity_get_paper_details`, `bioelectricity_get_author_papers`, `save_paper`, `save_author_papers`, `list_saved_papers`, `get_saved_paper` (with input models)
3. **`tools/episodes.py`** — `list_episodes`, `get_episode_claims`
4. **`tools/rag.py`** — `rag_search`, `rag_stats`
5. **`tools/claims.py`** — `get_claim_context` (with `GetClaimContextInput`)
6. **`tools/figures.py`** — `analyze_paper_figures` (with `AnalyzeFigureInput`)
7. **`tools/deep_dive.py`** — `generate_deep_dive_summary` (with `GenerateDeepDiveSummaryInput`)
8. **`tools/evidence_threads.py`** — `generate_evidence_threads` (with `GenerateEvidenceThreadsInput`)
9. **`tools/knowledge_graph.py`** — `get_relevant_kg_subgraph` (with `GetRelevantKGSubgraphInput`)
10. **`tools/expansion.py`** — `expand_concept_grounded` (with `ExpandConceptGroundedInput`)
11. **`tools/quiz.py`** — `generate_quiz_questions` (with `GenerateQuizQuestionsInput`)
12. **`tools/chat.py`** — `chat_with_context` (with `ChatWithContextInput`, `ChatMessage`)
13. **`tools/image.py`** — `generate_image_with_context` (with `GenerateImageInput`)
14. **`tools/podcast.py`** — `generate_mini_podcast` (with `GenerateMiniPodcastInput`)
15. **`tools/tts.py`** — `text_to_speech` (with `TextToSpeechInput`)
16. **`tools/taxonomy.py`** — all 6 taxonomy tools (with input models)
17. **`tools/slides.py`** — `generate_slide_deck`, `get_community_slides`, `update_slide_sharing`, `get_user_slides`

After each tool file: run verification command and confirm tool count increases by the correct number.

- [ ] Create all tool files
- [ ] Run full verification after each file
- [ ] Final count should match baseline

---

### Phase K: Slim down `server.py`

Once all tools are in `tools/`, `server.py` becomes:

```python
"""Bioelectricity Research MCP Server — registers all tool modules."""

from .mcp_app import mcp  # noqa: F401

# Import tool modules to trigger @mcp.tool() registration
from .tools import (  # noqa: F401
    papers, episodes, rag, claims, figures,
    deep_dive, evidence_threads, knowledge_graph,
    expansion, quiz, chat, image, podcast, tts,
    taxonomy, slides,
)
```

- [ ] Reduce `server.py` to the above
- [ ] Run verification command — must still show same tool count

---

### Phase L: Add structured logging

After the split is complete and all tools verified, add logging:

**In `mcp_app.py`:**
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "msg": %(message)s}',
)
```

**Per module** (add at top of each new file):
```python
logger = logging.getLogger(__name__)
```

**Log level guide:**
- `logger.debug(...)` — cache hits/misses, vectorstore lookups
- `logger.info(...)` — tool invocations (log tool name + params at entry)
- `logger.warning(...)` — fallback paths (ChromaDB fallback, missing optional data)
- `logger.error(...)` — caught exceptions before re-raising

**Replace all `print()` calls** in extracted modules with appropriate `logger.*` calls.

**Replace broad `except Exception: pass` / `except Exception: continue`** with:
```python
except Exception:
    logger.exception("Context: what operation was happening")
```

- [ ] Add logging config to `mcp_app.py`
- [ ] Add `logger = logging.getLogger(__name__)` to each new module
- [ ] Replace `print()` calls with `logger.*`
- [ ] Replace silent exception swallowing with `logger.exception()`
- [ ] Run verification command one final time

---

## Risks

1. **Import circularity** — `tools/` imports `mcp` from `mcp_app`; `mcp_app` must not import from `tools/`. Keep this one-directional.
2. **Path constants** — `server.py` uses `Path(__file__).resolve().parent...` to compute paths. When functions move to new files, these paths must be recomputed relative to the new file location, or centralized in `cache_store.py` as absolute paths computed once.
3. **Decorator registration order** — `@mcp.tool()` runs at import time. The final `server.py` must import all tool modules in a deterministic order to avoid any edge cases.
4. **The duplicate EpisodeMetadata** — verify which definition is actually used at runtime before deleting either one. (Both are identical, so it doesn't matter — just delete the second one at line 916.)
