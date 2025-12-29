# MCP Server Issue - Tools Not Accessible

## Problem
The MCP server is running but returning 404 for all tool endpoints:
- `/tools/list_episodes/execute` → 404
- `/mcp/tools/list_episodes/execute` → 404

## Solution: Restart MCP Server

The server needs to be restarted to properly register the tools.

### In Terminal 12 (where MCP server is running):

1. **Stop the server**: Press `Ctrl + C`

2. **Restart it**:
```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
fastmcp run src/bioelectricity_research/__main__.py --transport http --host 127.0.0.1 --port 8000
```

3. **Check for success**: You should see:
```
✓ Starting MCP server 'bioelectricity-research' with transport 'http' on http://127.0.0.1:8000/mcp
✓ Uvicorn running on http://127.0.0.1:8000
```

4. **Verify tools are registered**: Look for a list of tools or no errors during startup

### After Restart, Test:

```bash
curl -X POST http://localhost:8000/tools/list_episodes/execute -H "Content-Type: application/json" -d '{}'
```

Should return episode data (not "Not Found")

### Then Refresh Browser

Once the MCP server is working, refresh your browser and the claims should load!

---

**Note**: The server code looks correct, it just needs a fresh restart to register the tools properly.

