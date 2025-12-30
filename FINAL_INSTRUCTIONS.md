# 🎯 Final Instructions - Start MCP Server

## ✅ I Just Killed the Old Server

The old broken server (PID 62535) has been killed. Port 8000 is now free.

## 🚀 Start Fresh Server

**In Terminal 6 (or any terminal):**

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2

# Install package (if not already)
uv pip install -e .

# Start server with HTTP transport
FASTMCP_HOST=127.0.0.1 FASTMCP_PORT=8000 uv run bioelectricity-research
```

**OR use the script I created:**

```bash
./START_SERVER_COMMAND.sh
```

## ✅ Verify It's Working

### 1. Check the startup message

You MUST see:
```
📦 Transport:   HTTP  ← MUST say HTTP!
🔗 Server URL:  http://127.0.0.1:8000/mcp
```

If it says "STDIO", stop and try again with the command above.

### 2. Test the tools endpoint

In Terminal 13 (or another terminal):
```bash
curl -X POST http://localhost:8000/tools/list_episodes/execute \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** JSON array with 4 episodes  
**Not:** "Not Found"

### 3. Test claims endpoint

```bash
curl -X POST http://localhost:8000/tools/get_episode_claims/execute \
  -H "Content-Type: application/json" \
  -d '{"episode_id": "lex_325", "limit": 3}'
```

**Expected:** JSON array with 3 claim objects  
**Not:** "Not Found"

## 🎉 Once Tools Are Working

**Refresh your browser** at http://localhost:3000

Navigate: Landing → Library → Select "lex_325"

**You should see:**
- ✅ Audio plays
- ✅ Claims feed populates with ~45 real claims
- ✅ First claim about planarians (not mitochondria!)
- ✅ Timestamps sync with audio
- ✅ No errors in console

---

## 📝 Summary of All Fixes

| Issue | Status |
|-------|--------|
| CORS errors | ✅ Fixed (`.env.local` → `/api/mcp`) |
| Next.js 15 params | ✅ Fixed (`await params`) |
| MCP body forwarding | ✅ Fixed (`duplex: 'half'`) |
| Audio file path | ✅ Fixed (5 levels up) |
| Audio playing | ✅ Working |
| Old MCP server | ✅ Killed |
| MCP HTTP transport | ⚠️ **Start new server now!** |

**Start the server and test it!** 🚀

