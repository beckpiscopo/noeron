---
name: Backend Quality Cleanup
overview: Assess backend quality and outline focused refactors to improve maintainability, configuration, and test reliability without deleting files yet.
todos:
  - id: deps-align
    content: Align pyproject/requirements dependencies
    status: pending
  - id: config-unify
    content: Centralize env/config handling
    status: pending
    dependencies:
      - deps-align
  - id: vectorstore-fix
    content: Use vector_store factory in server
    status: pending
    dependencies:
      - config-unify
  - id: server-split
    content: Decompose server module + logging
    status: pending
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

- Decide a single source of truth (`pyproject.toml` or `requirements.txt`) for runtime deps.
- Update `pyproject.toml` to include packages referenced by backend code (e.g., `google-genai`, `supabase`, `tiktoken`, `chromadb`, `sentence-transformers`, `python-dotenv`), or document why they remain optional.
- Reconcile `docs/DEPLOYMENT.md` notes with actual dependency lists.

2. **Configuration & environment consistency**

- Introduce a small config module (e.g., `src/bioelectricity_research/config.py`) to centralize env var handling and defaults.
- Standardize `.env` loading to avoid duplicate/implicit behavior between `__main__.py` and `http_server.py`.

3. **Vector store selection correctness**

- Replace the local `get_vectorstore()` in `server.py` with the factory in `vector_store.py` to respect `USE_SUPABASE`.
- Add safe fallbacks and explicit error messaging when required deps are missing (e.g., Chroma + sentence-transformers).

4. **Server module decomposition & logging**

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

- Define Pydantic response models for all 27 tool outputs (currently all return `dict[str, Any]` or `str`)
- Create `src/bioelectricity_research/schemas/` directory with response models organized by domain
- This enables proper API documentation and client type safety
- Consider generating OpenAPI schemas for HTTP endpoints

6. **Test suite rebuild**

> **Note:** This is closer to a rebuild than a fix. The current test infrastructure is minimal and partially broken.

- **Delete or rewrite** `tests/test_mcp_server.py` — imports from non-existent `src.bioelectricity_research.api` module
- Set up pytest-asyncio for async tool testing
- Add unit tests for:
  - Configuration loading and validation
  - Vector store factory selection logic
  - Cache load/save operations
  - Response schema validation
- Add integration tests for key tool workflows
- Target: meaningful coverage of critical paths, not 100% coverage

7. **Cleanup recommendations (no deletions yet)**

- Provide a list of candidate cleanup items such as empty/orphan files (e.g., `src/embeddings.py`) and generated caches (`cache/`, `data/`) with regeneration notes.

## Risks & Considerations

1. **Sequential dependency chain** — Each step depends on the previous one. This is logical but means progress is strictly sequential. If blocked on one step, all downstream work stalls.

2. **Server split complexity** — Decomposing a 4k-line file with tight coupling is high-risk for introducing regressions. Recommend incremental extraction with tests verifying behavior after each module extraction.

3. **Test rebuild scope** — The plan may underestimate test work. Current state is <5% coverage with broken imports. Budget accordingly.

4. **Runtime behavior validation** — After config centralization and vector store factory changes, need manual verification that production behavior is unchanged (USE_SUPABASE flag, Gemini client initialization, etc.)

5. **Prompt template changes** — Moving prompts to a separate module is low-risk but any accidental whitespace/formatting changes could affect Gemini responses. Preserve exact strings.