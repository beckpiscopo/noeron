# Fix Podcast Claim Timing Synchronization

## Problem

The claim cards in Noeron's Live Research Stream are not syncing properly with the podcast playback. Claims appear at the wrong times, and it seems timestamps are being rounded to the nearest minute instead of showing at precise second/millisecond timing.

## Current State

### Data Available
- **Supabase Database**: Claims table with `start_ms` and `end_ms` fields (millisecond precision)
- **Transcript**: Full transcript with timestamps for every utterance
- **Frontend**: React component (`frontend/components/listening-view.tsx`) that displays claims synchronized to audio playback

### Current Timing Logic Location
File: `frontend/components/listening-view.tsx`

Around lines 405-450, the current synchronization code:
```typescript
// Filter out claims with invalid timestamps (0:00 or missing)
const validClaims = claims.filter(claim => {
  const claimStartMs = claim.start_ms || claim.timing?.start_ms || claim.timestamp * 1000
  return claimStartMs > 0
})

// Sort claims by start time
const sortedClaims = [...validClaims].sort((a, b) => {
  const aTime = a.start_ms || a.timing?.start_ms || a.timestamp * 1000
  const bTime = b.start_ms || b.timing?.start_ms || b.timestamp * 1000
  return aTime - bTime
})

const currentTimeMs = episode.currentTime * 1000

// Find the current claim: the most recent claim that has started
let currentClaimIndex = -1

for (let i = sortedClaims.length - 1; i >= 0; i--) {
  const claim = sortedClaims[i]
  const claimStartMs = claim.start_ms || claim.timing?.start_ms || claim.timestamp * 1000
  
  if (currentTimeMs >= claimStartMs) {
    currentClaimIndex = i
    break
  }
}
```

### Data Structure

**Claim from Supabase:**
```typescript
interface Claim {
  id: number
  podcast_id: string
  start_ms: number           // Precise millisecond timestamp
  end_ms: number             // End of claim in milliseconds
  claim_text: string         // Full transcript quote
  distilled_claim?: string   // AI-generated summary
  timestamp?: string         // Human readable (e.g., "00:15:23")
}
```

**Episode playback state:**
```typescript
episode.currentTime  // Current playback time in SECONDS (not milliseconds)
```

## Goal

Make claim cards appear **precisely** when they're mentioned in the podcast audio, using the millisecond-accurate `start_ms` timestamps from the database.

## Expected Behavior

1. **Precise Timing**: When podcast plays at 2:34.5 (154500ms), the claim with `start_ms: 154500` should appear as "JUST NOW"
2. **No Rounding**: Claims should not be rounded to nearest minute
3. **Past Claims Order**: As playback continues, older claims move down in reverse chronological order
4. **Real-time Updates**: Claims should update smoothly as the audio plays (every second or so)

## Files to Check/Modify

### Primary File
- `frontend/components/listening-view.tsx` (lines 400-520)
  - Current timing synchronization logic
  - Claim filtering and sorting
  - "Current claim" detection

### Data Loading
- `frontend/app/page.tsx` (lines 190-280)
  - Where claims are loaded from Supabase
  - Type conversion: `convertSupabaseClaim()` function

### Database
- Supabase `claims` table has correct `start_ms` values
- Check with: `python3 scripts/test_supabase.py`

## Debugging Steps

### 1. Verify Database Timestamps
```bash
python3 -c "
from scripts.supabase_client import get_db
db = get_db(use_service_key=True)
claims = db.get_claims_for_episode('lex_325')
for c in claims[:5]:
    start = c.get('start_ms', 0)
    print(f'ID {c[\"id\"]}: {start}ms ({start/1000:.1f}s) - {c.get(\"distilled_claim\", \"\")[:60]}')
"
```

### 2. Check Browser Console
Open DevTools and look for:
```
[Sync Debug] Time: 142.5s, Claim at: 142.0s, "Mind emerges from physics...", Past: 0
```

### 3. Verify currentTime Units
In `listening-view.tsx`, check:
- `episode.currentTime` is in **seconds**
- `claim.start_ms` is in **milliseconds**
- Conversion: `currentTimeMs = episode.currentTime * 1000`

## Potential Issues

### Issue 1: Unit Conversion
**Problem**: Mixing seconds and milliseconds
**Fix**: Ensure consistent conversion:
```typescript
const currentTimeMs = episode.currentTime * 1000  // Convert to ms
const claimStartMs = claim.start_ms              // Already in ms
```

### Issue 2: Timestamp Fallback Chain
**Problem**: Multiple fallback sources causing confusion
```typescript
// Current (complex):
const claimStartMs = claim.start_ms || claim.timing?.start_ms || claim.timestamp * 1000

// Should be (simple):
const claimStartMs = claim.start_ms  // Supabase always has this
```

### Issue 3: Relative Time Display
**Problem**: `getRelativeTime()` function might be using wrong timestamp
Check around line 477:
```typescript
const getRelativeTime = (claim: Claim) => {
  const claimStartMs = claim.start_ms || claim.timing?.start_ms || claim.timestamp * 1000
  const claimTimeSeconds = claimStartMs / 1000
  const diff = episode.currentTime - claimTimeSeconds
  
  if (diff < 60) return "JUST NOW"
  const mins = Math.floor(diff / 60)
  return `${mins} MIN AGO`
}
```

### Issue 4: Audio Offset
**Problem**: There might be an offset between audio file and claim timestamps
**Check**: Line 354 has `TIMING_OFFSET = -20` - is this still being used?

## Testing

### Test Case 1: Start of Episode
1. Play episode from 0:00
2. First claim should appear at its exact `start_ms` time
3. Check console: "Time: X.Xs, Claim at: Y.Ys" should match closely

### Test Case 2: Mid-Episode
1. Scrub to 5:00 (300 seconds)
2. Claims from 0:00-5:00 should be in "Past Claims"
3. Current claim should be the most recent one before 5:00

### Test Case 3: Claim Transitions
1. Watch as podcast plays through a claim timestamp
2. When `currentTime >= claim.start_ms`, it should become current
3. Previous current claim should move to past claims

## Success Criteria

✅ Claims appear within 1 second of their actual mention in audio  
✅ "JUST NOW" label shows the correct current claim  
✅ Past claims show accurate "X MIN AGO" relative times  
✅ Timestamps display as "MM:SS" not rounded to minutes  
✅ Smooth transitions as playback continues  

## Additional Context

- We recently removed deduplication logic from the UI
- Claims are loaded from Supabase with `start_ms` field
- Total claims: ~388 (after removing duplicates)
- Distilled claims: ~182
- The timing was working before but may have broken during refactoring

## Quick Fix Checklist

1. ✅ Verify `start_ms` exists in database
2. ✅ Ensure `episode.currentTime` is in seconds
3. ✅ Simplify timestamp extraction (remove fallback chain)
4. ✅ Test conversion: `currentTimeMs = episode.currentTime * 1000`
5. ✅ Check if `TIMING_OFFSET` is interfering
6. ✅ Verify claims are sorted by `start_ms` correctly
7. ✅ Test with console logging at key points

---

**Please fix the timing synchronization so claims appear precisely when mentioned in the audio.**

