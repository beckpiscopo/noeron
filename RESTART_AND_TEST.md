# Restart and Test Instructions

I've added debug logging to both API routes. Now let's restart and see what's happening.

## Step 1: Stop the Dev Server

In Terminal 11 (where `pnpm dev` is running):
1. Press `Ctrl + C`
2. Wait for it to fully stop

## Step 2: Clean Cache and Restart

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/frontend
rm -rf .next
pnpm dev
```

## Step 3: Check MCP Server

In Terminal 12, verify the MCP server is running. You should see:
```
Started server on port 8000
```

If not, restart it:
```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
fastmcp run src/bioelectricity_research/__main__.py --transport http --host 127.0.0.1 --port 8000
```

## Step 4: Test in Browser

1. Open http://localhost:3000
2. Open DevTools (F12)
3. Go to Console tab
4. Click "Get Started" → Select lex_325 episode

## Step 5: Watch the Logs

### In Terminal 11 (Next.js), you should see:

**When audio is requested:**
```
[Audio API] Request for episodeId: lex_325
[Audio API] AUDIO_DIR: /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/data/podcasts/raw
[Audio API] Available files: { lex_325: 'p3lsYlod5OU.mp3' }
[Audio API] Full file path: /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/data/podcasts/raw/p3lsYlod5OU.mp3
[Audio API] File found! Size: 260046848 bytes
```

**When claims are requested:**
```
[MCP Proxy] Forwarding request to path: [ 'tools', 'get_episode_claims', 'execute' ]
[MCP Proxy] Target URL: http://127.0.0.1:8000/tools/get_episode_claims/execute
[MCP Proxy] MCP server response status: 200
[MCP Proxy] Response status: 200
```

### In Browser Console, you should see:

```
No errors!
```

## Step 6: If Still Getting 404

### Check the Terminal 11 logs:

**If you see:**
```
[Audio API] No mapping found for episodeId: lex_325
```
→ The episodeId isn't being passed correctly

**If you see:**
```
[Audio API] File not found at path: ...
```
→ The path calculation is wrong

**If you DON'T see any [Audio API] logs:**
→ The old cached version is still running (need harder cache clear)

### Check Terminal 12 (MCP Server):

Should show incoming requests. If not, the MCP server isn't running or isn't accessible.

## Step 7: Nuclear Option - Full Clean

If nothing works, do this:

```bash
# Stop both servers (Ctrl + C in both terminals)

# Terminal 11:
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/frontend
rm -rf .next node_modules/.cache
pnpm dev

# Terminal 12:
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
fastmcp run src/bioelectricity_research/__main__.py --transport http --host 127.0.0.1 --port 8000
```

## What the Logs Will Tell Us

1. **Is the route handler being called?** (Do we see [Audio API] logs?)
2. **Is episodeId being passed correctly?** (What value does it have?)
3. **Is the file path correct?** (Does it match the actual file location?)
4. **Can the file be found?** (Does stat() succeed?)
5. **Is MCP server reachable?** (Do we see [MCP Proxy] logs?)

Once you restart with these logs, we'll know exactly where the problem is!

