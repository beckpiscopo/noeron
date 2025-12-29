# Quick Connection Test Guide

## ✅ Fixes Applied

1. **Audio API Route** - Fixed Next.js 15 async params issue
2. **MCP Proxy Route** - Fixed Next.js 15 async params issue

## 🧪 Test Your Setup

### Test 1: Check MCP Server Status
Your MCP server should be running. Check terminal for:
```
Started server on port 8000
```

### Test 2: Verify Frontend is Running
You should see:
```
✓ Ready in XXXms
- Local: http://localhost:3000
```

### Test 3: Test Audio Endpoint in Browser

Open a new browser tab and visit:
```
http://localhost:3000/api/audio/lex_325
```

**Expected:** Browser should start downloading/playing the audio file (or show audio player controls)
**If Error:** Check that the file exists at `data/podcasts/raw/p3lsYlod5OU.mp3`

### Test 4: Test the Full App Flow

1. **Open the app:** http://localhost:3000
2. **Click "Get Started"** → Should show Episode Library
3. **Select "lex_325" episode** → Should navigate to Listening View
4. **Check the audio player:** Should show play button and controls
5. **Click Play:** Audio should start playing
6. **Check the claims feed:** Should populate with claims as audio plays

## 🐛 If Something Still Doesn't Work

### Audio Not Playing

**Check browser console (F12 → Console tab):**
```
GET /api/audio/lex_325
```

- **200 OK** = ✅ Audio endpoint working
- **404 Not Found** = ❌ Check audio file exists and filename matches
- **500 Error** = ❌ Check the error message

### Claims Not Loading

**Check browser console for:**
```
POST /api/mcp/tools/get_episode_claims/execute
```

- **200 OK with data** = ✅ Claims loading
- **Connection refused** = ❌ MCP server not running
- **Empty array** = ⚠️ No claims in cache for this episode

**Verify claims file exists:**
```bash
ls -lh cache/podcast_lex_325_claims.json
```

### MCP Server Not Responding

**Restart the MCP server:**
```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
python -m src.bioelectricity_research
```

**Or with uvx:**
```bash
uvx --from . bioelectricity-research
```

## 📱 What You Should See Now

### Episode Library View
- 4 episodes displayed
- Each with thumbnail, title, metadata
- Click to select → navigates to listening view

### Listening View (lex_325)
- Audio player at top
- Play/pause controls working
- Progress bar scrubbing
- Claims feed on right side
- Claims show timestamps like "0:07", "10:40", etc.
- Claims update status as audio plays

## 🎯 Expected Behavior

1. **Audio plays** for lex_325 episode ✅
2. **Claims load** from cache ✅
3. **Timestamps sync** - as audio plays, claims marked as "past" ✅
4. **Dive Deeper button** - transitions to exploration view (UI ready) ✅
5. **View Source button** - transitions to paper view (UI ready) ✅

## 📊 Current Data Coverage

| Episode ID | Audio | Claims | Status |
|------------|-------|--------|--------|
| lex_325 | ✅ | ✅ | **READY** |
| theories_of_everything | ❌ | ❌ | Need audio + claims |
| mlst | ❌ | ❌ | Need audio + claims |
| essentia_foundation | ❌ | ❌ | Need audio + claims |

## 🔧 Quick Fixes

### If Audio 404 Error
```bash
# Check if file exists
ls -lh data/podcasts/raw/p3lsYlod5OU.mp3

# If missing, check for webm version
ls -lh data/podcasts/raw/p3lsYlod5OU.webm

# Convert webm to mp3 if needed
ffmpeg -i data/podcasts/raw/p3lsYlod5OU.webm data/podcasts/raw/p3lsYlod5OU.mp3
```

### If Claims Not Loading
```bash
# Verify cache file exists and has data
cat cache/podcast_lex_325_claims.json | head -20

# If file is empty or missing, you need to regenerate claims
# (Check your claims generation pipeline)
```

### If MCP Connection Failed
```bash
# Check if MCP server is listening
lsof -i :8000

# If nothing, start the server
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
python -m src.bioelectricity_research
```

## 💡 Pro Tips

1. **Open Browser DevTools** (F12) to see network requests and console logs
2. **Check the Network tab** to see API calls in real-time
3. **Use Console tab** to see any JavaScript errors
4. **The terminal with dev server** will show any server-side errors

## 🎉 Success Criteria

✅ Episode library loads
✅ Can select lex_325 episode
✅ Audio player appears and plays
✅ Claims feed populates with ~45 claims
✅ Timestamps sync as audio plays
✅ Can scrub audio and claims update
✅ No console errors

---

**Note:** The error you saw in the terminal should now be fixed. Refresh the browser page and try playing the audio again!

