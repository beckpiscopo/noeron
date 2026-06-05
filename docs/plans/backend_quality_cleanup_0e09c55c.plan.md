---
name: Backend Quality Cleanup
overview: Assess backend quality and outline focused refactors to improve maintainability, configuration, and test reliability without deleting files yet.
todos:
  - id: deps-align
    content: Align pyproject/requirements dependencies
    status: completed
  - id: config-unify
    content: Centralize env/config handling
    status: completed
    dependencies:
      - deps-align
  - id: vectorstore-fix
    content: Use vector_store factory in server
    status: completed
    dependencies:
      - config-unify
  - id: server-split
    content: Decompose server module + logging
    status: completed
    dependencies:
      - vectorstore-fix
  - id: response-schemas
    content: Define Pydantic response models for tool outputs
    status: pending
    dependencies:
      - server-split
  - id: tests-fix
    content: Rebuild backend test suite
    status: pending
    dependencies:
      - response-schemas
  - id: cleanup-recs
    content: Produce cleanup recommendations list
    status: pending
    dependencies:
      - tests-fix
---

# Backend Quality Optimization Plan

## Goals

- Improve backend maintainability and reliability while keeping behavior stable.
- Align dependencies and configuration so local/dev/prod installs behave consistently.
- Produce a clear cleanup recommendation list (no deletions executed).

## Current State Assessment

### Dependency Management — CRITICAL
- **pyproject.toml**: 11 core dependencies
- **requirements.txt**: 25 dependencies with significant divergence
- Key production packages missing from pyproject.toml: `google-genai`, `supabase`, `python-dotenv`, `tiktoken`, `numpy`
- `chromadb` and `sentence-transformers` commented out in requirements.txt but still imported unconditionally in `vector_store.py:68-69`

### Server Complexity — HIGH
- **server.py**: 4,278 lines with 27 MCP tools and 21 Pydantic input classes
- ~50+ helper functions mixed throughout with no separation of concerns
- Large prompt templates inline (500+ lines total)
- Global state: `vectorstore` (line 40), `_GENAI_CLIENT` (line 26)

### Configuration Handling — HIGH
- `USE_SUPABASE` defined in both `vector_store.py:17` and `context_builder.py:38` (duplicate)
- Port conflict: `__main__.py` uses `FASTMCP_PORT`, `http_server.py` uses `PORT`
- Inconsistent dotenv loading: `http_server.py` loads at import, `__main__.py` conditionally, `server.py` relies on others
- No validation of required env vars at startup

### Test Coverage — CRITICAL
- **Estimated coverage**: <5%
- `tests/test_mcp_server.py` imports from `src.bioelectricity_research.api` which **does not exist** — will fail immediately
- No tests for any of the 27 MCP tools
- No async test infrastructure
- No integration tests

### Type Safety — MEDIUM
- Good: 21 Pydantic input models
- Bad: All tools return `dict[str, Any]` or `str` with no structured response schemas

## Scope (Backend)

Primary files: [`/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/server.py`](/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/server.py)( /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/server.py ), [`/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/http_server.py`](/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/http_server.py)( /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/http_server.py ), [`/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/vector_store.py`](/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/vector_store.py)( /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/vector_store.py ), [`/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/context_builder.py`](/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/context_builder.py)( /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/context_builder.py ), [`/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/storage.py`](/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/storage.py)( /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/src/bioelectricity_research/storage.py ), [`/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/pyproject.toml`](/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/pyproject.toml)( /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/pyproject.toml ), [`/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/requirements.txt`](/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/requirements.txt)( /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/requirements.txt ), tests in [`/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/tests`](/Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/tests)( /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/tests ).

## Plan

1. **Dependency & packaging alignment**

**Decision:** `pyproject.toml` is the single source of truth. `requirements.txt` will be kept only as a pip-installable convenience (generated from pyproject or manually synced), not authoritative.

Sub-tasks:
- [ ] Add missing runtime deps to `pyproject.toml` `[project.dependencies]`:
  - `python-dotenv>=1.0.0` (used in `__main__.py`, `http_server.py`)
  - `supabase>=2.0.0` (used in `vector_store.py`, `context_builder.py`, `http_server.py`)
  - `tiktoken>=0.5.0` (imported in server code)
  - `numpy>=2.0` (used in vector ops)
- [ ] Mark optional/local-only deps explicitly. `chromadb` and `sentence-transformers` are commented out in `requirements.txt` with the note that production uses Supabase pgvector and Gemini embeddings — add them under `[project.optional-dependencies] local = [...]` in `pyproject.toml` with the same explanation.
- [ ] Confirm `pdf2image`, `pillow`, `reportlab` (in `pyproject.toml` but not `requirements.txt`) are genuinely needed at runtime; if so, add to `requirements.txt`.
- [ ] Fix version mismatch: `requirements.txt` has `google-genai>=0.6.0`, `pyproject.toml` has `>=1.60.0` — standardize to `>=1.60.0` in both.
- [ ] Add a comment at the top of `requirements.txt` that `pyproject.toml` is authoritative and this file is a convenience copy.
- [ ] Check `docs/DEPLOYMENT.md` exists and update any dep references to match.

2. **Configuration & environment consistency**

**All env vars found across the codebase:**

| Variable | Current location(s) | Default |
|---|---|---|
| `GEMINI_API_KEY` | `server.py:249`, `vector_store.py:31` | (required) |
| `GEMINI_MODEL` | `server.py:26`, `server.py:2910` | `"gemini-3-pro-preview"` |
| `USE_SUPABASE` | `vector_store.py:17`, `context_builder.py:38` | `"true"` |
| `FASTMCP_HOST` | `__main__.py:21` | `"127.0.0.1"` |
| `FASTMCP_PORT` | `__main__.py:22` | `"8000"` |
| `UNPAYWALL_EMAIL` | `storage.py:188` | `"your.email@example.com"` |

**Current dotenv loading problems:**
- `http_server.py:4`: bare `load_dotenv()` — no path, loads from CWD (implicit, fragile)
- `__main__.py:8-16`: explicit path to `project_root / ".env"` with try/except on import

Sub-tasks:
- [ ] Create `src/bioelectricity_research/config.py` that:
  - Calls `load_dotenv()` with an explicit path to project root `.env` once at import
  - Exposes typed constants for all 6 env vars above
  - Raises `RuntimeError` at startup if `GEMINI_API_KEY` is missing (it has no safe default)
  - All other vars have documented defaults in the constants
- [ ] Remove `load_dotenv()` call from `http_server.py:4` (now handled by `config.py`)
- [ ] Remove the try/except dotenv block from `__main__.py:8-16` (now handled by `config.py`)
- [ ] Replace all raw `os.getenv` / `os.environ.get` calls in `server.py`, `vector_store.py`, `context_builder.py`, `storage.py`, `__main__.py` with imports from `config.py`
- [ ] Verify server still starts correctly with `.env` present and with env vars set directly (no `.env` file)

3. **Vector store selection correctness**

**Problem:** `server.py:55-63` defines its own `get_vectorstore()` that unconditionally creates `VectorStore()` (ChromaDB), ignoring `USE_SUPABASE`. The factory in `vector_store.py:274` correctly handles both backends but is never used by the server. This means in production (where `USE_SUPABASE=true`), the server silently falls back to ChromaDB instead of Supabase pgvector.

**Call sites in `server.py`:** lines 1384, 1440, 1600, 1773, 2115, 2830, 3297, 3996 (8 total).

Sub-tasks:
- [ ] Import the factory function from `vector_store.py` at the top of `server.py` (name TBD — check exact function name at line 274)
- [ ] Delete `server.py:55-63` (the local `get_vectorstore` definition and `vectorstore` global)
- [ ] Update the `vectorstore` global type annotation from `Optional[VectorStore]` to match the factory's return type (the factory returns a union of both backend types — use the shared base class or `Any` temporarily until step 5 schemas are in place)
- [ ] Confirm `USE_SUPABASE` is now sourced from `config.py` (depends on step 2 being done first)
- [ ] Add an explicit error log if ChromaDB is selected but `chromadb` is not installed (currently fails silently with an import error deep in the call stack)
- [ ] Manual smoke test: start server with `USE_SUPABASE=true` and verify RAG search hits Supabase, then with `USE_SUPABASE=false` and verify it hits ChromaDB (or fails gracefully if chromadb is not installed)

4. **Server module decomposition & logging**

> **Note:** This step requires its own dedicated sub-plan file before any code is touched. Create it when ready to begin this step.

- Split `server.py` into smaller modules (prompts/templates, cache IO, claim/evidence utilities, endpoints) to reduce the 4k‑line file.
- Replace `print`/broad exception handling with structured `logging` and consistent error responses.

**Logging strategy:**
- Use Python stdlib `logging` module
- Configure JSON-formatted logs for production (structured logging)
- Log levels: DEBUG for cache hits/misses, INFO for tool invocations, WARNING for fallbacks, ERROR for failures
- Add request correlation IDs where possible

### Proposed `server.py` split (exact mapping)

> **Note:** Treat this mapping as a guide, not a contract. Discoveries during implementation may suggest different groupings. The goal is separation of concerns, not strict adherence to this list.

Core wiring:
- `src/bioelectricity_research/mcp_app.py`: `mcp = FastMCP(...)`, Gemini client init (`_ensure_gemini_client_ready`), shared config for model/env.
- `src/bioelectricity_research/server.py`: imports tool modules to register them; no business logic.

Shared helpers:
- `src/bioelectricity_research/prompts.py`: `DEEP_DIVE_PROMPT_TEMPLATE_*`, `DEEP_DIVE_PROMPT_TEMPLATE`, `_parse_paper_key_findings`, `_extract_summary_without_findings`.
- `src/bioelectricity_research/cache_store.py`: `_load_deep_dive_cache`, `_save_deep_dive_cache`, `_load_evidence_threads_cache`, `_save_evidence_threads_cache`, `_load_claims_cache`, `_load_context_card_registry`, `_load_papers_collection`, `_load_knowledge_graph`, `_load_claim_relevance_cache`, `_load_expansion_cache`, `_save_expansion_cache`, `_load_podcast_cache`, `_save_podcast_cache`.
- `src/bioelectricity_research/episodes.py`: `load_episode_catalog`, `_load_episodes`, `_parse_timestamp_seconds`.
- `src/bioelectricity_research/rag_utils.py`: `_build_research_query`, `_format_rag_results_for_prompt`, `_format_rag_results_for_chat`.
- `src/bioelectricity_research/chat_utils.py`: `_format_conversation_history`.
- `src/bioelectricity_research/knowledge_graph_utils.py`: `_normalize_for_matching`, `_find_matching_entities`, `_extract_subgraph`, `_extract_entities_with_gemini`.
- `src/bioelectricity_research/expansion_utils.py`: `_call_gemini_for_expansion`, `_validate_expansion_result`.
- `src/bioelectricity_research/media_utils.py`: `_generate_image_impl`, `_generate_mini_podcast_impl`, `_text_to_speech_impl`.

Tool modules (all `@mcp.tool` entrypoints):
- `src/bioelectricity_research/tools/papers.py`: `bioelectricity_search_papers`, `bioelectricity_get_paper_details`, `bioelectricity_get_author_papers`, `save_paper`, `save_author_papers`, `list_saved_papers`, `get_saved_paper`.
- `src/bioelectricity_research/tools/episodes.py`: `list_episodes`, `get_episode_claims`.
- `src/bioelectricity_research/tools/rag.py`: `rag_search`, `rag_stats`.
- `src/bioelectricity_research/tools/claims.py`: `get_claim_context`.
- `src/bioelectricity_research/tools/deep_dive.py`: `generate_deep_dive_summary`.
- `src/bioelectricity_research/tools/evidence_threads.py`: `generate_evidence_threads`.
- `src/bioelectricity_research/tools/knowledge_graph.py`: `get_relevant_kg_subgraph`.
- `src/bioelectricity_research/tools/expansion.py`: `expand_concept_grounded`.
- `src/bioelectricity_research/tools/quiz.py`: `generate_quiz_questions`.
- `src/bioelectricity_research/tools/chat.py`: `chat_with_context`.
- `src/bioelectricity_research/tools/image.py`: `generate_image_with_context`.
- `src/bioelectricity_research/tools/podcast.py`: `generate_mini_podcast`.
- `src/bioelectricity_research/tools/tts.py`: `text_to_speech`.
- `src/bioelectricity_research/tools/taxonomy.py`: `list_taxonomy_clusters`, `get_cluster_details`, `get_episode_cluster_coverage`, `get_notebook_cluster_distribution`, `compare_episode_to_notebook`, `get_cluster_bubble_map_data`.

5. **Response schema standardization**

**Tools returning `str` (formatted text, keep as `str` — no schema needed):**
`bioelectricity_search_papers`, `bioelectricity_get_paper_details`, `bioelectricity_get_author_papers`, `save_paper`, `save_author_papers`, `list_saved_papers`, `get_saved_paper`, `rag_stats`

**Tools returning `dict[str, Any]` (need Pydantic models — read each tool's actual return dict to derive fields before writing the model):**
`get_claim_context`, `generate_deep_dive_summary`, `analyze_paper_figures`, `generate_evidence_threads`, `get_relevant_kg_subgraph`, `expand_concept_grounded`, `generate_quiz_questions`, `chat_with_context`, `generate_image_with_context`, `generate_mini_podcast`, `text_to_speech`, `list_taxonomy_clusters`, `get_cluster_details`, `get_episode_cluster_coverage`, `get_notebook_cluster_distribution`, `compare_episode_to_notebook`, `get_cluster_bubble_map_data`, `generate_slide_deck`, `get_community_slides`, `update_slide_sharing`, `get_user_slides`

**Already typed (improve but not urgent):**
`list_episodes` → `Sequence[EpisodeMetadata]` ✓, `get_episode_claims` → `Sequence[dict[str, Any]]` (replace inner dict with `EpisodeClaim` model)

Sub-tasks:
- [ ] Create `src/bioelectricity_research/schemas/` directory with `__init__.py`
- [ ] Create schema files organized by domain:
  - `schemas/episodes.py` — `EpisodeClaim`
  - `schemas/claims.py` — `ClaimContextResponse`
  - `schemas/deep_dive.py` — `DeepDiveSummaryResponse`
  - `schemas/evidence.py` — `EvidenceThreadsResponse`
  - `schemas/knowledge_graph.py` — `KGSubgraphResponse`
  - `schemas/expansion.py` — `ConceptExpansionResponse`
  - `schemas/quiz.py` — `QuizQuestionsResponse`
  - `schemas/chat.py` — `ChatResponse`
  - `schemas/media.py` — `ImageResponse`, `PodcastResponse`, `TTSResponse`
  - `schemas/taxonomy.py` — `TaxonomyClusterListResponse`, `ClusterDetailsResponse`, `ClusterCoverageResponse`, `ClusterDistributionResponse`, `ClusterComparisonResponse`, `BubbleMapResponse`
  - `schemas/slides.py` — `SlideDeckResponse`, `CommunitySlideListResponse`, `SlideShareUpdateResponse`, `UserSlideListResponse`
  - `schemas/figures.py` — `FigureAnalysisResponse`
- [ ] For each model: read the tool's actual return dict (not the type annotation), extract the real keys and value types, then write the Pydantic model
- [ ] Update each tool's return type annotation to use the new model
- [ ] Verify no runtime breakage: Pydantic will raise on construction if the dict shape doesn't match the model — fix any mismatches found

6. **Test suite rebuild**

> **Note:** This is closer to a rebuild than a fix. The current test infrastructure is minimal and partially broken.

**Current state:** `tests/test_mcp_server.py` imports from `src.bioelectricity_research.api` which does not exist — the file will fail immediately on import. `pytest-asyncio` is already in `pyproject.toml` dev dependencies, so no new package is needed.

Sub-tasks:
- [ ] Delete `tests/test_mcp_server.py`
- [ ] Add pytest configuration to `pyproject.toml`:
  ```toml
  [tool.pytest.ini_options]
  asyncio_mode = "auto"
  ```
- [ ] Create `tests/conftest.py` with shared fixtures:
  - `tmp_cache_dir` (tmp_path-based) for cache file tests
  - `mock_env` (monkeypatch) that sets required env vars so config.py doesn't raise on import in tests
- [ ] Create `tests/test_config.py`:
  - Config loads defaults when env vars are absent
  - Config reads env var overrides correctly
  - Missing `GEMINI_API_KEY` raises `RuntimeError` at import/startup
- [ ] Create `tests/test_vector_store.py`:
  - Factory returns `SupabaseVectorStore` when `USE_SUPABASE=true`
  - Factory returns `VectorStore` when `USE_SUPABASE=false`
  - Use `monkeypatch.setenv` — no real DB connections needed for factory selection logic
- [ ] Create `tests/test_cache_store.py`:
  - Each `_load_*_cache()` function returns `{}` when file does not exist
  - Each `_load_*_cache()` returns parsed dict when file contains valid JSON
  - Each `_save_*_cache()` writes and can be round-tripped by its matching load function
- [ ] Create `tests/test_schemas.py`:
  - Each Pydantic response model accepts a valid dict and rejects a dict missing required fields
- [ ] Create `tests/test_tools/` directory with `__init__.py` and one smoke test per tool group:
  - `test_episodes.py` — mock file I/O, verify `list_episodes` returns `EpisodeMetadata` list
  - `test_rag.py` — mock vector store, verify `rag_search` calls store and returns correct schema
- [ ] Target: all unit tests pass with no real external connections (Supabase, Gemini) needed

7. **Cleanup recommendations (no deletions yet)**

Sub-tasks:
- [ ] Audit `src/` for orphan files — the plan previously flagged `src/embeddings.py` as a candidate; verify it is unreferenced before marking for deletion
- [ ] Audit `cache/` directory: list each file, note whether it is regenerable and what script/tool produces it, flag any that are stale or should be `.gitignore`d
- [ ] Audit `data/` directory: distinguish source data (committed, needed) from generated outputs (regenerable, consider ignoring)
- [ ] Evaluate `requirements.txt` — once `pyproject.toml` is the source of truth (step 1), decide whether to delete, auto-generate, or keep as a manually synced convenience file; document the decision
- [ ] Produce a single markdown table: one row per candidate item, columns: path, status (orphan / stale / regenerable), recommended action (delete / gitignore / keep), regeneration command if applicable
- [ ] Do not delete anything during this step — the table is the deliverable; deletions are a separate follow-up task

## Risks & Considerations

1. **Sequential dependency chain** — Each step depends on the previous one. This is logical but means progress is strictly sequential. If blocked on one step, all downstream work stalls.

2. **Server split complexity** — Decomposing a 4k-line file with tight coupling is high-risk for introducing regressions. Recommend incremental extraction with tests verifying behavior after each module extraction.

3. **Test rebuild scope** — The plan may underestimate test work. Current state is <5% coverage with broken imports. Budget accordingly.

4. **Runtime behavior validation** — After config centralization and vector store factory changes, need manual verification that production behavior is unchanged (USE_SUPABASE flag, Gemini client initialization, etc.)

5. **Prompt template changes** — Moving prompts to a separate module is low-risk but any accidental whitespace/formatting changes could affect Gemini responses. Preserve exact strings.