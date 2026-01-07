# Supabase Setup Guide for Noeron

## Step 1: Create Supabase Project (5 minutes)

1. Go to https://supabase.com
2. Sign up / Sign in with GitHub
3. Click "New Project"
   - Name: `noeron`
   - Database Password: (save this!)
   - Region: Choose closest to you
   - Plan: Free tier (500MB is plenty)

4. Wait ~2 minutes for project to provision

## Step 2: Get Your Credentials

Once your project is ready:

1. Go to **Settings** (gear icon) → **API**
2. Copy these values:

```bash
# Add to your .env file:
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANT:** 
- `ANON_KEY` = For frontend (safe to expose)
- `SERVICE_KEY` = For backend scripts (KEEP SECRET!)

## Step 3: Run Database Migration

Open Supabase SQL Editor (Database → SQL Editor):

1. Click "New Query"
2. Copy/paste the SQL from `supabase/schema.sql`
3. Click "Run" (or press Cmd/Ctrl + Enter)

You should see: "Success. No rows returned"

## Step 4: Verify Schema

Go to **Database** → **Tables**

You should see:
- `episodes` (metadata about podcasts)
- `claims` (all the claims with distilled versions)
- `papers` (cached paper data)

## Step 5: Test Connection

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
python3 scripts/test_supabase.py
```

Should output:
```
✓ Connected to Supabase
✓ Database ready
Tables: episodes, claims, papers
```

## Step 6: Migrate Existing Data

```bash
python3 scripts/migrate_to_supabase.py
```

This will:
- ✓ Import episode metadata
- ✓ Import all 300+ claims from context_card_registry.json
- ✓ Import timing data from claims_with_timing.json
- ✓ Merge and deduplicate

Expected output:
```
Migrating episode: Lex #325 - Michael Levin
✓ Created episode record
✓ Imported 310 claims
✓ Applied timing data to 305 claims
✓ Migration complete
```

## Next Steps

Once migration is done:

1. **Run distillation on all claims:**
   ```bash
   python3 scripts/enrich_with_distillation_supabase.py
   ```

2. **Update frontend to use Supabase:**
   - See `frontend/lib/supabase.ts`
   - Replace old API calls with Supabase queries

3. **Add new episodes:**
   ```bash
   python3 scripts/add_episode.py --audio new_podcast.mp3
   ```
   This will automatically: extract claims → match papers → distill → store in Supabase

## Troubleshooting

**"Connection refused"**
- Check your `SUPABASE_URL` is correct
- Make sure project is fully provisioned (can take 2-3 min)

**"Invalid API key"**
- Double-check you copied the ANON_KEY not the PROJECT API KEY
- Make sure no extra spaces in .env file

**"Row level security policy"**
- For now we're disabling RLS for faster development
- Will add proper security before production

## Environment Variables Checklist

Your `.env` should now have:
```bash
GEMINI_API_KEY=...              # For distillation
SUPABASE_URL=...                # Supabase project URL
SUPABASE_ANON_KEY=...          # Public key (frontend)
SUPABASE_SERVICE_KEY=...       # Secret key (backend scripts)
```



