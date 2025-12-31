# Testing Guide: Deep Exploration View Integration

## Prerequisites

Before testing, ensure you have:
- ✅ MCP server code updated with `get_claim_context` tool
- ✅ Frontend code updated with data fetching logic
- ✅ Data files in place:
  - `cache/podcast_lex_325_claims_with_timing.json`
  - `data/papers_collection.json`
  - `data/context_card_registry.json`
  - `data/vectorstore/` (built with `python scripts/build_vector_store.py`)

## Step 1: Restart MCP Server

The MCP server needs to be restarted to register the new `get_claim_context` tool.

### Terminal 6 (or wherever MCP server is running):

1. Stop the current server (Ctrl+C)
2. Restart it:
```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
FASTMCP_HOST=127.0.0.1 FASTMCP_PORT=8000 uv run bioelectricity-research
```

3. Verify the server started:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

## Step 2: Verify Tool Registration

Check that the new tool is available:

```bash
curl http://127.0.0.1:8000/tools/get_claim_context/execute -X POST \
  -H "Content-Type: application/json" \
  -d '{"claim_id": "lex_325|00:00:00.160|1-0", "episode_id": "lex_325"}'
```

Expected: JSON response with claim context data (not a 404 error)

## Step 3: Test Frontend

### Terminal 12 (or wherever frontend is running):

If not already running:
```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2/frontend
pnpm dev
```

### Browser Testing

1. Open http://localhost:3000

2. Navigate through the app:
   - Click "Get Started" on landing page
   - Select "Lex Fridman #325 - Michael Levin" from Episode Library
   - You should see the Listening View with claims

3. Test Deep Exploration:
   - Click "Dive Deeper" on any claim
   - **Expected behavior:**
     - Loading spinner appears briefly
     - Deep Exploration View loads with real data
     - Evidence threads show actual papers from your corpus
     - Related concepts appear (if vector store is built)
     - Confidence metrics are calculated
     - Synthesis section shows claim details

4. Verify the data:
   - Check that evidence threads have real paper titles
   - Click on evidence threads to open Semantic Scholar links
   - Switch between synthesis modes (Simplified/Technical/Raw)
   - Verify confidence level and consensus percentage
   - Check that related concepts show relevant research

## Step 4: Browser Console Testing

Open browser DevTools (F12) and check:

### Network Tab
- Look for request to `/api/mcp/tools/get_claim_context/execute`
- Status should be 200 OK
- Response should contain claim context data

### Console Tab
- No errors should appear
- You might see debug logs from the MCP proxy

## Step 5: Test Different Claims

Try "Dive Deeper" on multiple claims to verify:

1. **First claim** (planarian memory):
   - Should have evidence threads about planarian regeneration
   - Related concepts about memory and regeneration

2. **Claims with many papers**:
   - Should show multiple evidence threads
   - High confidence and consensus scores

3. **Claims with few/no papers**:
   - Should show "No evidence threads available"
   - Lower confidence scores
   - May still show related concepts from vector search

## Expected Results

### Success Indicators ✅

- [ ] No 404 errors in browser console
- [ ] Loading spinner appears and disappears
- [ ] Evidence threads show real paper titles and authors
- [ ] Citation counts are displayed
- [ ] Confidence level shows (High/Medium/Low)
- [ ] Consensus percentage is calculated
- [ ] Related concepts appear (if vector store built)
- [ ] Synthesis section shows claim text and rationale
- [ ] Context tags are displayed (if available)
- [ ] Raw data mode shows complete JSON structure
- [ ] Back button returns to Listening View

### Common Issues and Solutions

#### Issue: "Segment not found" error
**Solution:** The claim ID format might be incorrect. Check that claims from `get_episode_claims` have the right format.

#### Issue: No evidence threads
**Possible causes:**
- The claim doesn't have RAG results in the claims cache
- Papers aren't in papers_collection.json
- The segment doesn't have associated papers yet

**Solution:** This is expected for some claims. The UI should gracefully show "No evidence threads available."

#### Issue: No related concepts
**Possible causes:**
- Vector store not built
- Claim text is too short or generic

**Solution:** Build vector store: `python scripts/build_vector_store.py`

#### Issue: 404 error for get_claim_context
**Solution:** Restart the MCP server to register the new tool.

#### Issue: Frontend not updating
**Solution:** 
1. Clear Next.js cache: `rm -rf frontend/.next`
2. Restart frontend: `pnpm dev`

## Manual API Testing

You can test the MCP tool directly via curl:

```bash
# Test with the first claim
curl -X POST http://127.0.0.1:8000/tools/get_claim_context/execute \
  -H "Content-Type: application/json" \
  -d '{
    "claim_id": "lex_325|00:00:00.160|1-0",
    "episode_id": "lex_325",
    "include_related_concepts": true,
    "related_concepts_limit": 3
  }' | python3 -m json.tool

# Test with a different claim
curl -X POST http://127.0.0.1:8000/tools/get_claim_context/execute \
  -H "Content-Type: application/json" \
  -d '{
    "claim_id": "lex_325|00:48:00.160|window-25-0",
    "episode_id": "lex_325"
  }' | python3 -m json.tool
```

## Test Checklist

Use this checklist when testing:

### MCP Server
- [ ] Server starts without errors
- [ ] `get_claim_context` tool is registered
- [ ] Tool responds to HTTP requests
- [ ] Returns valid JSON with expected structure

### Frontend
- [ ] No TypeScript errors
- [ ] No linter errors
- [ ] Deep Exploration View loads
- [ ] Loading state appears
- [ ] Data fetches successfully
- [ ] Evidence threads render
- [ ] Related concepts render
- [ ] Confidence metrics display
- [ ] Synthesis modes work
- [ ] Back button works

### Data Quality
- [ ] Evidence threads have real paper data
- [ ] Citation counts are reasonable
- [ ] Confidence scores make sense
- [ ] Related concepts are relevant
- [ ] Context tags are meaningful

### Edge Cases
- [ ] Claims with no evidence threads
- [ ] Claims with many evidence threads
- [ ] Claims with counter-evidence
- [ ] Claims with missing data
- [ ] Network errors are handled gracefully

## Performance Testing

Monitor performance:
- Initial load time: Should be < 2 seconds
- Data fetch time: Should be < 1 second
- UI responsiveness: Should be smooth

Check browser DevTools Performance tab if issues occur.

## Next Steps After Testing

Once testing is complete:

1. **Document any issues** found
2. **Take screenshots** of working features
3. **Note any data quality improvements** needed
4. **Consider enhancements** like:
   - Caching claim context data
   - Pre-loading related claims
   - Adding paper preview modals
   - Implementing citation graph visualization

## Success Criteria

The integration is successful when:

✅ Users can click "Dive Deeper" on any claim
✅ Real research papers appear as evidence threads
✅ Related concepts are discovered from the corpus
✅ Confidence and consensus metrics are meaningful
✅ The experience is smooth and responsive
✅ Error states are handled gracefully
✅ Users can navigate back to listening view

---

**Note:** If you encounter issues not covered in this guide, check:
- MCP server logs (Terminal 6)
- Frontend logs (Terminal 12)
- Browser console
- Network tab in DevTools

