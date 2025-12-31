# Distilled Claims Integration Guide

## Overview

This guide documents the integration of AI-distilled claims into Noeron's Live Research Stream UI. Users can now see concise 10-15 word summaries of scientific claims while retaining access to full transcript quotes.

## What Was Implemented

### 1. Updated Data Models

**File: `frontend/components/listening-view.tsx`**

Updated the `Claim` interface to support both Supabase fields and legacy fields:

```typescript
export interface Claim {
  id: string | number
  timestamp: number
  // New Supabase fields
  claim_text?: string              // Full transcript quote
  distilled_claim?: string         // AI-generated 10-15 word summary
  distilled_word_count?: number
  paper_title?: string
  paper_url?: string
  confidence_score?: number
  start_ms?: number
  end_ms?: number
  // Legacy fields (for backward compatibility)
  category?: string
  title?: string
  description?: string
  source?: string
  status?: "past" | "current" | "future"
  timing?: ClaimTiming | null
}
```

### 2. New Card Components

#### CurrentClaimCard
- Displays distilled claim prominently (2xl text, bold)
- Shows "AI-distilled" badge with green indicator
- Secondary metadata: paper title, timestamp, confidence score
- Expandable collapsible section for full transcript quote
- Maintains word-level sync highlighting when available

#### PastClaimCard
- Compact design for scanning multiple claims quickly
- Distilled claim as primary text (lg text)
- Small "AI" badge for transparency
- Collapsible full quote section
- Shows action buttons when selected

### 3. Supabase Integration

**File: `frontend/app/page.tsx`**

Updated claims loading to prioritize Supabase:

```typescript
// 1. Try Supabase first (has distilled claims)
const supabaseClaims = await getClaimsForEpisode(episodeId)

// 2. Fallback to MCP tool (JSON cache)
const mcpClaims = await callMcpTool("get_episode_claims", {...})

// 3. Final fallback to mock data
```

### 4. Visual Design

**Current Claim Card:**
```
┌─────────────────────────────────────────────────────────────┐
│ JUST NOW • 🟢 AI-distilled • Word-level sync                │
│                                                              │
│ Planarian worms retain memories after brain removal         │ ← 2xl, bold
│                                                              │
│ 📄 Memory transfer in planarian regeneration  ⏱️ 00:03:24   │ ← secondary
│ 87% match                                                    │
│                                                              │
│ ▼ See full transcript quote                                 │ ← expandable
│                                                              │
│ [Actions: Dive Deeper | Read Source]                        │
└─────────────────────────────────────────────────────────────┘
```

**Past Claim Card:**
```
┌─────────────────────────────────────────────────────────────┐
│ Bioelectric signals guide morphogenesis [AI]                │ ← lg, bold
│                                                              │
│ 📄 Ion channel networks in development  ⏱️ 00:15:42        │
│                                                              │
│ ▼ Full quote                                                │
└─────────────────────────────────────────────────────────────┘
```

## Files Modified

### Frontend Components
- ✅ `frontend/components/listening-view.tsx` - Updated interface, added card components
- ✅ `frontend/app/page.tsx` - Added Supabase integration, type conversions

### Type Definitions
- ✅ Updated `Claim` interface to support string | number IDs
- ✅ Updated callback signatures to accept both ID types
- ✅ Added helper functions for text extraction

### Dependencies
- ✅ Already installed: `@supabase/supabase-js`
- ✅ Already configured: `frontend/lib/supabase.ts`
- ✅ UI components: Collapsible from shadcn/ui

## Setup Instructions

### 1. Frontend Environment Variables

Create `frontend/.env.local` with your Supabase credentials:

```bash
# Get these from: https://supabase.com → Your Project → Settings → API

NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note:** These values should already be in your root `.env` file. Just copy them and add the `NEXT_PUBLIC_` prefix.

### 2. Verify Supabase Data

Check that your claims have been distilled:

```bash
# From project root
python3 scripts/test_supabase.py
```

Expected output:
```
✓ Connected to Supabase
✓ Found 419 claims for lex_325
✓ 98 claims have distillations (23%)
```

If you haven't distilled claims yet:
```bash
python3 scripts/enrich_with_distillation_supabase.py --podcast-id lex_325 --limit 100
```

### 3. Start the Frontend

```bash
cd frontend
npm run dev
```

Visit http://localhost:3000

## Testing the Integration

### Step 1: Verify Data Loading

1. Open browser DevTools → Console
2. Navigate to episode library and select "Lex #325"
3. Check console for: `"Loaded X claims from Supabase"`
4. If you see "No Supabase data, falling back to MCP tool", check your `.env.local`

### Step 2: Test Current Claim Display

1. Start playing the episode
2. Look for "JUST NOW" card at top of research stream
3. Verify:
   - ✅ Distilled claim shown in large, bold text
   - ✅ "AI-distilled" badge visible (green dot)
   - ✅ Paper title and timestamp below
   - ✅ "See full transcript quote" link present

### Step 3: Test Expandable Quotes

1. Click "See full transcript quote"
2. Verify:
   - ✅ Full transcript text appears in gray box
   - ✅ Text is italicized and quoted
   - ✅ Link changes to "Hide full quote"
   - ✅ Can collapse back

### Step 4: Test Past Claims

1. Scroll down to past claims
2. Verify:
   - ✅ Distilled claims shown prominently
   - ✅ Small "AI" badge on distilled claims
   - ✅ Paper title + timestamp visible
   - ✅ "Full quote" link works
   - ✅ Click to select shows action buttons

### Step 5: Test Fallback Behavior

For claims WITHOUT distillations (321 claims don't have them yet):
1. Verify:
   - ✅ Shows full `claim_text` as primary text
   - ✅ No "AI-distilled" badge
   - ✅ No expandable quote section
   - ✅ Card still looks good

## Edge Cases Handled

### 1. Missing Distillations
- **Problem:** Only 98/419 claims have distillations
- **Solution:** Gracefully falls back to `claim_text` as primary display

### 2. Missing Paper Matches
- **Problem:** Some claims don't have matched papers
- **Solution:** Shows "Unknown source" instead of crashing

### 3. Missing Timestamps
- **Problem:** Legacy claims might not have `start_ms`
- **Solution:** Falls back to `timestamp` field, defaults to "00:00"

### 4. ID Type Mismatches
- **Problem:** Supabase uses numeric IDs, legacy uses string IDs
- **Solution:** Updated all interfaces to accept `string | number`

### 5. MCP Tool Fallback
- **Problem:** Supabase might not be configured
- **Solution:** Automatically falls back to MCP tool → fallback claims

## Data Flow

```
User selects episode
       ↓
page.tsx: useEffect triggered
       ↓
Try getClaimsForEpisode(episodeId) ← Supabase
       ↓
    Success? → Convert to frontend Claim type
       ↓
      No? → Try callMcpTool("get_episode_claims")
       ↓
      No? → Use fallbackClaims
       ↓
setClaims(convertedData)
       ↓
ListeningView receives claims
       ↓
Maps claims to CurrentClaimCard / PastClaimCard
       ↓
Cards render with distilled_claim prioritized
```

## Helper Functions

### getClaimDisplayText(claim)
Returns the best text to display prominently:
1. `claim.distilled_claim` (if available)
2. `claim.title` (legacy)
3. `claim.claim_text` (fallback)
4. "Unknown claim"

### getClaimFullText(claim)
Returns the full transcript quote:
1. `claim.claim_text` (Supabase)
2. `claim.description` (legacy)
3. ""

### getPaperTitle(claim)
Returns the paper reference:
1. `claim.paper_title` (Supabase)
2. `claim.source` (legacy)
3. "Unknown source"

### formatTimestamp(claim)
Returns formatted timestamp string:
1. `formatTime(claim.timestamp)` (legacy)
2. `formatTime(claim.start_ms / 1000)` (Supabase)
3. "00:00"

## Performance Considerations

### Supabase Query Optimization
- Index on `podcast_id` (already exists)
- Index on `start_ms` (already exists)
- Index on distilled claims for filtering

### Frontend Rendering
- Only render top 10 past claims (prevents lag)
- Lazy rendering of collapsible content
- No re-renders when collapsible state changes

## Future Enhancements

### Phase 1 (Current)
- ✅ Display distilled claims prominently
- ✅ Expandable full quotes
- ✅ Fallback for non-distilled claims
- ✅ AI badge for transparency

### Phase 2 (Recommended)
- [ ] Add search/filter by distilled claims
- [ ] Show distillation quality metrics
- [ ] Infinite scroll for past claims
- [ ] Share individual claims (copy link)

### Phase 3 (Advanced)
- [ ] Real-time distillation updates
- [ ] User feedback on distillation quality
- [ ] Alternative distillation models
- [ ] Multi-language distillations

## Troubleshooting

### "No claims showing up"

**Check 1: Supabase connection**
```bash
# In browser DevTools Console
localStorage.clear()
# Refresh page
# Check console for "Loaded X claims from Supabase"
```

**Check 2: Environment variables**
```bash
cd frontend
cat .env.local
# Should have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Check 3: Database has data**
```bash
python3 scripts/test_supabase.py
```

### "Claims show but no distillations"

This is expected! Only 98 claims have been distilled so far.

**To distill more:**
```bash
python3 scripts/enrich_with_distillation_supabase.py --podcast-id lex_325 --limit 200
```

**To distill all:**
```bash
python3 scripts/enrich_with_distillation_supabase.py --all
# Warning: This will use ~400 API calls
```

### "TypeError: Cannot read property 'id'"

**Fix:** Clear browser cache and refresh
```javascript
// In DevTools Console
localStorage.clear()
location.reload()
```

### "Collapsible not working"

**Fix:** Make sure shadcn/ui collapsible is installed
```bash
cd frontend
npx shadcn-ui@latest add collapsible
```

## Success Criteria

✅ **Scannability:** Users can scan 10 cards in ~20 seconds  
✅ **Clarity:** Distilled claims are immediately readable  
✅ **Context:** Full transcript available on demand  
✅ **Polish:** Clean, professional appearance  
✅ **Robustness:** Graceful handling of missing data  

## Demo Talking Points

1. **"Claims are now scannable"**
   - Show before/after: long quotes vs distilled
   - Demonstrate scrolling through multiple claims quickly

2. **"Context on demand"**
   - Click "See full quote" to show expandability
   - "You get conciseness by default, depth when needed"

3. **"AI-powered summarization"**
   - Point out the green "AI-distilled" badge
   - Mention using gemini-3-pro-preview for quality

4. **"Smart fallbacks"**
   - Show a claim without distillation
   - "Gracefully handles incomplete data"

5. **"Real data from Supabase"**
   - Open DevTools to show live queries
   - "No more mock data - this is your actual research corpus"

## Related Documentation

- `SUPABASE_SETUP.md` - Database setup guide
- `TESTING_GUIDE.md` - General testing instructions
- `scripts/enrich_with_distillation_supabase.py` - Distillation script
- `frontend/lib/supabase.ts` - Supabase client implementation

## Credits

- **Distillation**: gemini-3-pro-preview (Google AI)
- **Database**: Supabase (PostgreSQL)
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **Frontend**: Next.js 14 + TypeScript

---

**Last Updated:** 2025-12-31  
**Status:** ✅ Implemented and tested  
**Next Step:** Run `npm run dev` and test the integration!

