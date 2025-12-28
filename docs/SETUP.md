# Setup Guide

## Installation Complete! ✓

Your bioelectricity research MCP server is now installed at:
`/root/projects/bioelectricity-research-mcp`

## Next Steps

### 1. Configure Claude Desktop

Add this to your Claude Desktop config file:

**Config File Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Configuration:**
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

**Important:** Replace `/root/projects/bioelectricity-research-mcp` with your actual project path!

### 2. Restart Claude Desktop

After updating the config file, restart Claude Desktop to load the MCP server.

### 3. Test the Tools

Try these commands in Claude Desktop:

```
# Search for papers
Search for papers on "bioelectric patterns morphogenesis"

# Get paper details
Get details for paper ID: [paper_id_from_search]

# Find Michael Levin's papers
Find papers by Michael Levin

# Save a paper (Phase 1.5)
Save paper [paper_id] to my collection

# List saved papers
Show me my saved papers with full text
```

## Available Tools

### Phase 1: Search (Ready to use)
- `bioelectricity_search_papers` - Search with filters
- `bioelectricity_get_paper_details` - Get comprehensive paper info
- `bioelectricity_get_author_papers` - Find papers by author

### Phase 1.5: Storage (Ready to use)
- `save_paper` - Save paper with full text extraction
- `save_author_papers` - Bulk save author's work
- `list_saved_papers` - Query your collection
- `get_saved_paper` - Retrieve stored paper data

## Data Storage

Papers are saved to:
`/root/projects/bioelectricity-research-mcp/data/papers_collection.json`

PDFs are cached in:
`/root/projects/bioelectricity-research-mcp/data/pdfs/`

## Troubleshooting

### MCP Server Not Appearing in Claude Desktop

1. Check config file syntax (valid JSON)
2. Verify absolute path to project directory
3. Make sure `uv` is in your PATH
4. Restart Claude Desktop completely

### Import Errors

Run from project directory:
```bash
cd /root/projects/bioelectricity-research-mcp
.venv/bin/python -c "import bioelectricity_research; print('OK')"
```

Should print "OK". If not, reinstall:
```bash
uv pip install -e .
```

## What's Next?

Once you've tested the basic functionality:

1. **Build your corpus** - Start saving papers on key topics
2. **Test full text extraction** - See what % get full text vs. abstract only
3. **Identify gaps** - Note which papers/sources need manual handling
4. **Phase 2** - Concept extraction using Claude
5. **Phase 3** - Citation networks
6. **Phase 4** - Notion/Obsidian integration

## Development

To work on the server code:
```bash
cd /root/projects/bioelectricity-research-mcp
.venv/bin/python src/bioelectricity_research/server.py
```

## Support

Check the README.md for detailed documentation on each tool and usage examples.
