# Fix MCP Server - Final Steps

## 🔍 Current Problem

- **Terminal 12**: Old server (PID 62535) running, returning 404 for tools
- **Terminal 6**: New server running with **STDIO** transport (not HTTP!)

## ✅ Solution

### Step 1: Stop Old Server in Terminal 12

**Go to Terminal 12** and press `Ctrl + C` to stop the old server

### Step 2: Stop Server in Terminal 6

**Go to Terminal 6** and press `Ctrl + C` (it's running with wrong transport anyway)

### Step 3: Start Fresh in Terminal 6

**In Terminal 6**, run:

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2

# This command forces HTTP transport
uv run fastmcp run src/bioelectricity_research/__main__.py --transport http --host 127.0.0.1 --port 8000
```

OR install the package first:

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2

# Install in editable mode
uv pip install -e .

# Then run with HTTP transport
FASTMCP_HOST=127.0.0.1 FASTMCP_PORT=8000 uv run bioelectricity-research
```

### Step 4: Verify HTTP Transport

You should see:
```
📦 Transport:   HTTP  ← Must say HTTP, not STDIO!
🔗 Server URL:  http://127.0.0.1:8000/mcp
```

### Step 5: Test

```bash
curl -X POST http://localhost:8000/tools/list_episodes/execute \
  -H "Content-Type: application/json" \
  -d '{}'
```

Should return JSON with episodes (not "Not Found")

### Step 6: Refresh Browser

Once tools are working, refresh browser and claims should load!

---

## Why This Happened

The `uv run bioelectricity-research` command defaults to STDIO transport. You need to either:
1. Use `uv run fastmcp run ... --transport http` 
2. Or install the package first with `uv pip install -e .`

The key is making sure it says **"Transport: HTTP"** when it starts!

