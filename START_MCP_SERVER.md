# How to Start the MCP Server

## ✅ Working Method: Use `uv run`

**In Terminal 6 (or any terminal):**

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2

# Set environment variables and run
FASTMCP_HOST=127.0.0.1 FASTMCP_PORT=8000 uv run bioelectricity-research
```

This works because `uv run` automatically handles the environment and module installation.

## Alternative: Install in Editable Mode

If you want to use `fastmcp run` directly:

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2

# Install the module in editable mode
pip install -e .

# Then run
fastmcp run src/bioelectricity_research/__main__.py --transport http --host 127.0.0.1 --port 8000
```

## What Should Happen

After starting, you should see:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│                   FastMCP 2.14.1                           │
│                                                            │  
│   🖥  Server name: bioelectricity-research                 │
│   📦 Transport:   HTTP                                    │
│   🔗 Server URL:  http://127.0.0.1:8000/mcp               │
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Starting MCP server...
Uvicorn running on http://127.0.0.1:8000
```

**No errors!** If you see errors, the module isn't loading correctly.

## Test the Server

In another terminal:
```bash
curl -X POST http://localhost:8000/tools/get_episode_claims/execute \
  -H "Content-Type: application/json" \
  -d '{"episode_id": "lex_325", "limit": 3}'
```

**Expected**: JSON array with claim objects  
**Not**: "Not Found"

## If Still Getting 404

The tools might not be registered. Check that:
1. No errors during server startup
2. The `@mcp.tool()` decorators are present in `src/bioelectricity_research/server.py`
3. The server is actually running on port 8000

You can also try:
```bash
lsof -i :8000
```

Should show the Python/uvicorn process listening on port 8000.

---

**Use the `uv run` method - it's simpler and handles everything automatically!**

