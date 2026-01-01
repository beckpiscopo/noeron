# Fix: Deep Exploration View Claim ID Error

## Problem

When navigating to the Deep Exploration View, you see this error:

```
{"error":"Invalid claim_id format: 91. Expected format: segment_key-index"}
```

## Root Cause

The **frontend** is using numeric database IDs (like `91`) from Supabase, but the **MCP server** expects segment-based IDs in the format `"segment_key-index"` (like `"lex_325|00:00:00.160|1-0"`).

## Solution

You need to:
1. ✅ Add the `segment_claim_id` field to your Supabase database *(done - code updated)*
2. 🔧 Run the SQL migration in Supabase
3. 🔧 Populate the field with correct values
4. ✅ Update frontend to use the new field *(done - code updated)*

---

## Step 1: Apply SQL Migration to Supabase

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the sidebar
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/001_add_segment_claim_id.sql`:

```sql
-- Add the segment_claim_id column
ALTER TABLE claims 
ADD COLUMN IF NOT EXISTS segment_claim_id TEXT UNIQUE;

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_claims_segment_id 
ON claims(segment_claim_id) 
WHERE segment_claim_id IS NOT NULL;
```

5. Click **Run** to execute the migration

### Option B: Via Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push
```

This will apply all migrations in the `supabase/migrations/` folder.

---

## Step 2: Populate the segment_claim_id Field

Now that the column exists, you need to populate it with the correct values from your cached data.

### Run the Migration Script

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2

# First, do a dry run to see what will be updated
python scripts/populate_segment_claim_ids.py --dry-run

# If everything looks good, run it for real
python scripts/populate_segment_claim_ids.py
```

The script will:
- Read the cached claims data from `cache/podcast_lex_325_claims_with_timing.json`
- Match each claim in the cache to a claim in Supabase (by `claim_text` and `start_ms`)
- Update the `segment_claim_id` field with the correct segment-based ID

### Expected Output

```
🚀 Populating segment_claim_id in Supabase
============================================================
📂 Loading claims cache...
✅ Found 147 segments in cache

🔌 Connecting to Supabase...

📍 Processing segment: lex_325|00:00:00.160|1
   Claims in segment: 3
   ✅ Updated claim 91: It turns out that if you train a planarian...
   ✅ Updated claim 92: Planaria hold the answer to pretty much every...
   ✅ Updated claim 93: Planaria are immortal, so they do not age...

... (more segments) ...

============================================================
📊 SUMMARY
============================================================
Total claims processed:  500
Successfully updated:    485
Skipped:                 10
Errors:                  5

✅ Migration complete!
```

---

## Step 3: Verify the Fix

1. **Check the database** to ensure `segment_claim_id` values are populated:

```sql
SELECT id, segment_claim_id, claim_text 
FROM claims 
WHERE segment_claim_id IS NOT NULL 
LIMIT 10;
```

You should see results like:

| id  | segment_claim_id                    | claim_text                                |
|-----|-------------------------------------|-------------------------------------------|
| 91  | lex_325\|00:00:00.160\|1-0         | It turns out that if you train...         |
| 92  | lex_325\|00:00:00.160\|1-1         | Planaria hold the answer to pretty much...    |
| 93  | lex_325\|00:00:00.160\|1-2         | Planaria are immortal, so they do not age... |

2. **Restart your frontend** (if it's running):

```bash
cd frontend
pnpm dev
```

3. **Test the Deep Exploration View**:
   - Navigate to a claim in the Listening View
   - Click "Dive Deeper"
   - The Deep Exploration View should now load successfully!

---

## Troubleshooting

### Issue: "Module 'supabase_client' not found" or "cannot import name"

The migration script needs the Supabase client. Make sure you have your environment set up:

```bash
# Ensure you're in the project root
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2

# Install required Python packages
pip install supabase python-dotenv

# Check your .env file has the correct variables
cat .env
```

Your `.env` file should contain (for backend scripts):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

**Note**: The frontend uses `NEXT_PUBLIC_` prefixed variables in `.env.local`, but backend scripts use the unprefixed versions in `.env`.

### Issue: "Many claims not found in Supabase"

This could mean:
1. The claims cache has different data than what's in Supabase
2. The claims haven't been migrated to Supabase yet

**Solution**: First migrate your claims to Supabase:

```bash
python scripts/migrate_to_supabase.py
```

Then run the segment_claim_id population script.

### Issue: Still seeing the error after migration

1. **Clear your browser cache** and reload
2. **Check that claims in Supabase have `segment_claim_id` values**:
   ```sql
   SELECT COUNT(*) as total, 
          COUNT(segment_claim_id) as with_segment_id 
   FROM claims;
   ```
   
3. **Verify the frontend is using the correct field**:
   - Open browser DevTools (F12)
   - Go to Network tab
   - Trigger the Deep Exploration View
   - Look at the request to `/api/mcp/.../get_claim_context`
   - Check the `claim_id` parameter - it should look like `"lex_325|00:00:00.160|1-0"`, not `"91"`

### Issue: "Invalid claim_id format" with a long string

If you see an error like:

```
{"error":"Invalid claim_id format: lex_325|00:00:00.160|1-0-1. Expected format: segment_key-index"}
```

This means the segment_claim_id has an extra suffix. Check your migration script and ensure it's using the format `{segment_key}-{claim_index}` with only one hyphen.

---

## What Changed

The following files were updated to support `segment_claim_id`:

1. **supabase/schema.sql** - Added `segment_claim_id` column definition
2. **frontend/lib/supabase.ts** - Added `segment_claim_id` to TypeScript `Claim` interface
3. **frontend/components/listening-view.tsx** - Added `segment_claim_id` to local `Claim` interface
4. **frontend/app/page.tsx** - Updated to use `segment_claim_id` when available
5. **frontend/components/deep-exploration-view.tsx** - Added validation for segment_claim_id format

---

## Need Help?

If you're still experiencing issues:

1. Check the browser console for JavaScript errors
2. Check the MCP server logs for Python errors
3. Verify your Supabase connection:
   
   **Frontend** (`.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
   
   **Backend Scripts** (`.env`):
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   ```

Good luck! 🚀

