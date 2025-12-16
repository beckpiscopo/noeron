# Bioelectricity Research MCP Server

An MCP (Model Context Protocol) server for exploring bioelectricity research literature with comprehensive paper storage and full-text extraction.

## Features

### Phase 1: Core Search (✅ Complete)
- **Semantic paper search** with year, citation, and open access filters
- **Detailed paper information** including citations and references
- **Author-focused search** to explore researchers' work

### Phase 1.5: Paper Storage (🚧 In Progress)
- **Full paper collection** with comprehensive text extraction
- **PDF parsing** for open access papers
- **ArXiv integration** for preprints and better full text
- **Section detection** (Methods, Results, Discussion, Conclusions)
- **JSON storage** for ML-ready data export

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

## Data Storage

Papers are stored in `data/papers_collection.json` with:
- Complete metadata (authors, citations, journal, etc.)
- Full text when available (open access PDFs, ArXiv)
- Extracted sections (Methods, Results, Discussion)
- Source tracking (where the full text came from)

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

## License

MIT
