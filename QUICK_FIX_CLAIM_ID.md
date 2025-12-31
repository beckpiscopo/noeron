# Quick Fix: Claim ID Error

## Error Message
```
{"error":"Invalid claim_id format: 91. Expected format: segment_key-index"}
```

## Prerequisites

Make sure you have a `.env` file in the project root with:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

## Quick Fix (3 Steps)

### 1️⃣ Add Column to Supabase

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
ALTER TABLE claims ADD COLUMN IF NOT EXISTS segment_claim_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_claims_segment_id ON claims(segment_claim_id);
```

### 2️⃣ Populate the Field

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2
python scripts/populate_segment_claim_ids.py
```

### 3️⃣ Restart Frontend

```bash
cd frontend
pnpm dev
```

## Done! 🎉

Try the Deep Exploration View again. It should work now.

---

📖 For detailed troubleshooting, see: [FIX_SEGMENT_CLAIM_ID.md](./FIX_SEGMENT_CLAIM_ID.md)

