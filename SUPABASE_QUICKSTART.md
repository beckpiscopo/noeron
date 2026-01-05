# Supabase Quick Start for Noeron

## What Changed

**Before:** Messy JSON files everywhere  
**After:** Clean Supabase database with proper queries

## Setup (15 minutes)

### 1. Create Supabase Project
```bash
# Go to https://supabase.com
# Sign up → New Project → Name: "noeron"
# Wait 2 minutes for provisioning
```

### 2. Add Credentials to .env
```bash
# Get from Supabase: Settings → API
echo "SUPABASE_URL=https://your-project.supabase.co" >> .env
echo "SUPABASE_ANON_KEY=eyJhbGc..." >> .env
echo "SUPABASE_SERVICE_KEY=eyJhbGc..." >> .env
```

### 3. Run Database Schema
```bash
# Copy SQL from supabase/schema.sql
# Paste into Supabase SQL Editor
# Click "Run"
```

### 4. Install Dependencies
```bash
pip install supabase
cd frontend && npm install @supabase/supabase-js
```

### 5. Migrate Existing Data
```bash
python3 scripts/migrate_to_supabase.py
# Imports all 300+ claims from JSON files
```

### 6. Enrich with Distilled Claims
```bash
# Process all claims (uses gemini-3-pro-preview)
python3 scripts/enrich_with_distillation_supabase.py --all

# Or just test with 10 claims first:
python3 scripts/enrich_with_distillation_supabase.py --limit 10
```

## Usage

### Backend (Python Scripts)

```python
from scripts.supabase_client import get_db

db = get_db(use_service_key=True)

# Get all claims for an episode
claims = db.get_claims_for_episode("lex_325")

# Add a new claim
db.create_claim({
    "podcast_id": "lex_325",
    "claim_text": "Planarian worms are immortal",
    "timestamp": "00:15:23",
    "start_ms": 923000
})

# Update with distilled claim
db.add_distilled_claim(
    claim_id=123,
    distilled_claim="Planarian worms don't age",
    word_count=5
)
```

### Frontend (Next.js/TypeScript)

```typescript
import { getClaimsForEpisode, getClaimsInTimeRange } from '@/lib/supabase'

// Get all claims for episode
const claims = await getClaimsForEpisode('lex_325')

// Get claims near current playback time (for Live Stream)
const visibleClaims = await getClaimsInTimeRange(
  'lex_325',
  currentTimeMs,
  30000  // 30 second window
)

// Render
claims.map(claim => (
  <Card key={claim.id}>
    <h3>{claim.distilled_claim || claim.claim_text}</h3>
    <p>{claim.paper_title}</p>
  </Card>
))
```

## New Clean Pipeline

```
1. Add Episode
   python3 scripts/add_episode.py --audio podcast.mp3
   
2. Extract Claims
   (Your existing claim extraction)
   
3. Match to Papers
   (Your existing RAG pipeline)
   
4. Distill Claims
   python3 scripts/enrich_with_distillation_supabase.py --episode lex_326
   
5. Frontend Auto-Updates
   (Queries Supabase directly, no JSON files)
```

## Benefits

✅ **No more JSON editing** - Database handles everything  
✅ **Fast queries** - Indexed for performance  
✅ **Real-time updates** - Frontend can subscribe to changes  
✅ **Scalable** - Handles 10,000+ claims easily  
✅ **Professional** - Proper database architecture  
✅ **Type-safe** - Auto-generated TypeScript types  

## Cost

**Free tier includes:**
- 500MB database (you'll use ~10MB)
- 2GB bandwidth
- 50,000 monthly active users

**Your usage:**
- 300 claims/episode × 10 episodes = 3000 claims
- ~5MB total
- **Well within free tier** ✓

## Files Created

```
supabase/
  schema.sql                           # Database schema

scripts/
  supabase_client.py                   # Python DB client
  migrate_to_supabase.py              # One-time migration
  enrich_with_distillation_supabase.py # Distill claims in DB

frontend/lib/
  supabase.ts                          # TypeScript DB client

docs/
  SUPABASE_SETUP.md                    # Detailed setup
  SUPABASE_QUICKSTART.md              # This file
```

## Next Steps

1. **Follow SUPABASE_SETUP.md** for detailed instructions
2. **Run migration** to import existing data
3. **Update frontend** to use `frontend/lib/supabase.ts`
4. **Add new episodes** with clean pipeline

## Troubleshooting

**"Connection failed"**
→ Check SUPABASE_URL and keys in .env

**"No claims found"**
→ Run migration script first

**"Module not found: supabase"**
→ Run `pip install supabase`

## Questions?

Check the full setup guide: `SUPABASE_SETUP.md`


