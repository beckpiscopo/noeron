# Bioelectricity Research MCP Server

An MCP (Model Context Protocol) server for exploring bioelectricity research literature with comprehensive paper storage and full-text extraction.

## Pipeline

The pipeline spans metadata ingestion, full-text extraction, cleaning, chunking, embedding, and RAG-serving. `save_paper` / `save_author_papers` seed the metadata + PDF cache, `scripts/grobid_extract.py` (plus `scripts/grobid_quality_check.py`) produces structured JSON, `scripts/prepare_texts.py` and the AssemblyAI transcript helpers normalize every document, and `src/chunking_papers.py` + `scripts/build_vector_store.py` create the persistent `data/vectorstore` used by `rag_search`. See [`docs/pipeline.md`](docs/pipeline.md) for the full workflow, data locations, and command list.

## Features

### Phase 1: Core Search (Complete)
- **Semantic paper search** with year, citation, and open access filters
- **Detailed paper information** including citations and references
- **Author-focused search** to explore researchers' work
- **Gemini question answering prototype** that will pair top vector-search hits with the Gemini API (`google-generativeai`) for more conversational reasoning

### Phase 1.5: Paper Storage (In Progress)
- **Full paper collection** with comprehensive text extraction
- **PDF parsing** for open access papers
- **ArXiv integration** for preprints and better full text
- **Section detection** (Methods, Results, Discussion, Conclusions)
- **JSON storage** for ML-ready data export
- **Transcript ingestion** for interviews and talks (e.g., the Lex Fridman #325 conversation with Michael Levin) that can be chunked and added to the vector store

### Coming Soon
- Phase 2: Concept extraction using Claude
- Phase 3: Citation network visualization
- Phase 4: Notion/Obsidian integration

## Installation

```bash
# Clone or navigate to the project directory
cd /root/projects/bioelectricity-research-mcp

# Create virtual environment
uv venv

# Activate virtual environment
source .venv/bin/activate  # On Unix/macOS

# Install dependencies
uv pip install -e .
```

## Running the MCP server

The `bioelectricity-research` script defined in `pyproject.toml` launches the FastMCP server (`bioelectricity_research.__main__.py`). Use `uv run bioelectricity-research` or `python -m bioelectricity_research` to expose all tools, and keep `data/vectorstore` current (see Vector corpus) before invoking the RAG helpers.

## Configuration

Add to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bioelectricity-research": {
      "command": "uv",
      "args": [
        "--directory",
        "/root/projects/bioelectricity-research-mcp",
        "run",
        "bioelectricity-research"
      ]
    }
  }
}
```

## Vector corpus

The semantic corpus lives under `data/vectorstore`. Run `python scripts/build_vector_store.py` to:

1. (Re)load every cleaned paper (`data/cleaned_papers/`, including AssemblyAI transcripts)
2. Chunk via `src/chunking_papers.py` (`chunk_size=400`, `overlap=50`, `tiktoken`/`cl100k_base`)
3. Embed every chunk with `SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")`
4. Persist embeddings/documents/metadata in a ChromaDB collection that `rag_search` and `rag_stats` query

Rerun the script whenever you add new papers, transcripts, or adjust chunk settings so the RAG search results stay in sync.

## Usage

### Search Papers
```python
# Search for papers on specific topics
bioelectricity_search_papers(
    query="bioelectric patterns morphogenesis",
    limit=10,
    year_from=2020,
    min_citations=10
)
```

### Save Papers to Collection
```python
# Save a specific paper with full text extraction
save_paper(paper_id="abc123...")

# Save all papers by an author
save_author_papers(
    author_name="Michael Levin",
    limit=50
)
```

### Query Your Collection
```python
# List saved papers with filters
list_saved_papers(
    min_citations=20,
    year_from=2020,
    has_full_text=True
)

# Get complete paper data
get_saved_paper(paper_id="abc123...")
```

### RAG search

Build the vector corpus (see Vector corpus) before running `rag_search`. Once `data/vectorstore` exists, call the tool to retrieve chunks with context:

```python
# Ask the vector store for context on a topic
await rag_search(
    query="bioelectric patterns control morphogenesis",
    n_results=3
)
```

Use `rag_stats()` to check how many chunks are indexed and where the store is persisted.

## Data Storage

Papers and transcripts drive everything downstream. The metadata-rich collection lives in `data/papers_collection.json` (authors, citations, DOI/ArXiv IDs, etc.), while cleaned, chunkable JSON lives under `data/cleaned_papers/` after `scripts/prepare_texts.py` and the AssemblyAI helpers run. Every cleaned file records the original `source_path`, sections, and `full_text`, so the chunking + embedding scripts can trace the provenance of each chunk.

The generated vector store lives in `data/vectorstore/`. Run `scripts/build_vector_store.py` after regenerating or adding cleaned documents so `rag_search` works against the latest corpus. For the end-to-end flow, see [`docs/pipeline.md`](docs/pipeline.md), which covers PDF caching (`data/pdfs/`), GROBID extraction (`data/grobid_fulltext/`), transcripts, chunking, and embedding persistence.

## Project Structure

```
bioelectricity-research-mcp/
├── src/
│   └── bioelectricity_research/
│       ├── __init__.py
│       ├── server.py        # Main MCP server
│       └── storage.py       # Paper storage & retrieval
├── data/
│   └── papers_collection.json
├── tests/
├── docs/
├── pyproject.toml
└── README.md
```

## Future Enhancements

- YouTube transcript integration for interviews/talks
- Custom LLM training data export
- Citation network visualization
- Concept extraction and clustering
- Integration with Notion/Obsidian workflows

## Gemini Assistant (prototype)

The Gemini assistant will listen to the vector store (`scripts/build_vector_store.py` → `data/vectorstore`) and stitch the highest-scoring chunks into a single prompt that is fed to Gemini via `google-generativeai`. Before invoking Gemini-powered tools (for example `scripts/context_card_builder.py --use-gemini`), export a Gemini API key such as `export GEMINI_API_KEY=...` and optionally override the endpoint via `export GEMINI_MODEL=gemini-1.5-flash`. When the assistant is ready, it will reason over both the curated papers and interview transcripts to answer complex bioelectricity questions.

## AssemblyAI Transcripts

Generate a fresh, speaker-diarized version of a podcast/interview by running:

```
ASSEMBLYAI_API_KEY=... python scripts/fetch_assemblyai_transcript.py \
  --youtube-url <url> \
  --paper-id my_transcript \
  --title "My Interview" \
  --output-dir data/cleaned_papers
```

If AssemblyAI rejects a YouTube URL, use `--download-video` so the CLI stores the media via `yt-dlp` into `data/podcasts/raw` before uploading it. Alternatively, point the CLI at an already-downloaded file with `--local-path data/podcasts/raw/<file>` (no `--youtube-url` needed in that case). Add `--transcode` to convert that local media to MP3 via `ffmpeg` before uploading (make sure `ffmpeg` is installed). The helper still guesses which label belongs to Michael Levin and writes the cleaned JSON under `data/cleaned_papers/my_transcript.json`. Once the file exists, rebuild the vector store as usual (`python scripts/build_vector_store.py`).

See [`docs/pipeline.md`](docs/pipeline.md) for how transcripts flow into cleaning, chunking, and embedding.

## Tests

Run the suite that exercises the MCP tools and storage helpers:

```bash
pytest tests/
```

## License

MIT
