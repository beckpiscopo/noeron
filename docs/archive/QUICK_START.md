# Quick Start: Testing Deep Exploration Integration

## TL;DR

The Deep Exploration View is now connected to real data. To test it:

### 1. Restart MCP Server (Terminal 6)
```bash
# Press Ctrl+C to stop current server
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
FASTMCP_HOST=127.0.0.1 FASTMCP_PORT=8000 uv run bioelectricity-research
```

### 2. Verify Frontend is Running (Terminal 12)
```bash
# Should already be running at http://localhost:3000
# If not:
cd frontend
pnpm dev
```

### 3. Test in Browser
1. Open http://localhost:3000
2. Click "Get Started"
3. Select "Lex Fridman #325 - Michael Levin"
4. Click "Dive Deeper" on any claim
5. **You should see:**
   - Real research papers as evidence threads
   - Related concepts from your corpus
   - Confidence and consensus metrics
   - Synthesis with claim details

## What Changed

### Backend
- ✅ New MCP tool: `get_claim_context`
- ✅ Evidence thread classification (primary/replication/counter)
- ✅ Confidence metrics calculation
- ✅ Related concepts via vector search

### Frontend
- ✅ Real data fetching from MCP server
- ✅ Loading and error states
- ✅ Evidence threads with paper metadata
- ✅ Related concepts display
- ✅ Dynamic confidence metrics
- ✅ Three synthesis modes

## Files Modified

- `src/bioelectricity_research/server.py` - Added get_claim_context tool
- `frontend/app/page.tsx` - Track selected claim
- `frontend/components/deep-exploration-view.tsx` - Fetch and display real data

## Documentation

- **`IMPLEMENTATION_SUMMARY.md`** - Complete overview
- **`docs/DEEP_EXPLORATION_INTEGRATION.md`** - Technical details
- **`TESTING_GUIDE.md`** - Comprehensive testing steps

## Quick Test

After restarting MCP server, verify the tool works:

```bash
curl -X POST http://127.0.0.1:8000/tools/get_claim_context/execute \
  -H "Content-Type: application/json" \
  -d '{"claim_id": "lex_325|00:00:00.160|1-0", "episode_id": "lex_325"}' \
  | python3 -m json.tool
```

Expected: JSON with evidence_threads, related_concepts, and confidence_metrics.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 error for get_claim_context | Restart MCP server |
| No evidence threads | Expected for some claims - UI shows message |
| No related concepts | Build vector store: `python scripts/build_vector_store.py` |
| Frontend not updating | Clear cache: `rm -rf frontend/.next && pnpm dev` |

## Success Checklist

- [ ] MCP server restarted successfully
- [ ] Frontend is running
- [ ] Can navigate to Deep Exploration View
- [ ] Evidence threads show real papers
- [ ] Related concepts appear
- [ ] Confidence metrics display
- [ ] Can switch synthesis modes
- [ ] Back button works

## Next Steps

Once testing is complete, consider:
- Pre-generating AI summaries for claims
- Adding citation graph visualization
- Implementing paper preview modals
- Adding export functionality

---

**Need help?** Check `TESTING_GUIDE.md` for detailed instructions.

