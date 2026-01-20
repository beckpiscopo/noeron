# Authorization Flow and Gemini API Key Design

**Date:** 2025-01-20
**Status:** Approved

## Overview

Add user authentication, access control, and bring-your-own Gemini API key support to Noeron.

## Goals

1. **Multi-user data isolation** - Users only see their own notebooks, bookmarks, notes
2. **Cost control (BYOK)** - Users provide their own Gemini API key
3. **Access control** - Invite-only now, open registration later

## Authentication

### Method
Magic link via Supabase Auth. User enters email, clicks link in inbox, authenticated.

### Access Control Model
- **Now:** Invite-only via email allowlist
- **Later:** Open registration (remove allowlist check)

### Access Request Flow
1. Visitor sees "Sign In" and "Request Access" buttons
2. Request Access → modal collects email, optional name/reason
3. Saved to `access_requests` table with status `pending`
4. Admin approves via script → email added to `allowed_emails`
5. User can now sign in with magic link

## Tiered Access

| Level | Can Do | Requires |
|-------|--------|----------|
| **Visitor** | Browse landing, explore 1-2 preview episodes (read-only) | Nothing |
| **Signed In** | Full episode library, bookmarks, notes, highlights | Magic link auth |
| **AI Enabled** | Chat, reasoning, paper search, image generation | Signed in + Gemini API key |

## Gemini API Key Handling

### Storage
- Client-side only (browser localStorage)
- Never stored server-side
- Passed per-request to backend via `X-Gemini-Key` header

### Setup Flow
1. User tries AI feature without key
2. Modal appears:
   - Explains need for key
   - Links to Google AI Studio
   - Input field for key
   - Trust note: "Your key is stored locally in your browser. We never see or store it on our servers."
3. On save: validate with test call, store in localStorage
4. Settings page allows viewing (masked), updating, or removing key

### Backend Changes
- Read `X-Gemini-Key` header instead of env var for user requests
- Use key for that request only, never persist
- Existing env var remains for server-side operations (scripts, etc.)

## Data Model

### Existing (No Changes Needed)
- `episodes`, `claims`, `papers` - Shared content, public read
- `bookmarks` - Already has `user_id`, supports snippets (highlights)
- `notebook_synthesis` - Already has `user_id`
- `quiz_sessions`, `quiz_responses` - Already has `user_id`

### New Tables

```sql
-- Access request queue
CREATE TABLE access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allowlist for invite-only phase
CREATE TABLE allowed_emails (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Migration Required
```sql
-- Change user_id from TEXT to UUID referencing auth.users
ALTER TABLE bookmarks
    ALTER COLUMN user_id TYPE UUID USING NULL,
    ADD CONSTRAINT fk_bookmarks_user REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS (policies already exist in comments)
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_synthesis ENABLE ROW LEVEL SECURITY;
```

## Frontend Architecture

### New Files
```
frontend/
├── lib/
│   └── auth.ts              # Supabase auth client, session helpers
├── contexts/
│   └── auth-context.tsx     # Auth provider, useAuth hook
├── components/
│   ├── auth-modal.tsx       # Sign in / Request access modal
│   └── api-key-modal.tsx    # Gemini key setup modal
└── app/
    ├── (public)/            # Unprotected routes
    │   ├── page.tsx         # Landing page
    │   └── preview/[id]/    # Preview episode route
    └── (protected)/         # Auth-required routes
        ├── layout.tsx       # Auth check wrapper
        ├── episode/[id]/    # Full episode access
        ├── notebooks/       # User notebooks
        └── settings/        # API key management
```

### Auth Context
- Wraps app with auth provider
- Exposes `useAuth()` hook: `{ user, signIn, signOut, isLoading }`
- Also exposes `geminiApiKey` from localStorage
- Protected layout redirects to landing if no session

## Implementation Phases

### Phase 1: Supabase Auth Setup
1. Enable Email auth in Supabase dashboard (magic link)
2. Create `access_requests` and `allowed_emails` tables
3. Add admin email to `allowed_emails` for testing

### Phase 2: Frontend Auth
4. Add Supabase auth client (`lib/auth.ts`)
5. Create auth context and provider
6. Build auth modal (sign in + request access)
7. Add route protection (`(protected)` layout)
8. Update landing page with auth CTAs

### Phase 3: Preview Mode
9. Mark 1-2 episodes as `preview: true` in database
10. Create public preview route
11. Lock AI features with "Sign in to chat" prompt

### Phase 4: Gemini API Key
12. Build API key modal with validation
13. Add localStorage key management
14. Update MCP calls to include `X-Gemini-Key` header
15. Update FastAPI to read key from header

### Phase 5: Enable Multi-User
16. Migrate `user_id` columns to UUID
17. Enable RLS on user tables
18. Test data isolation between users

### Phase 6: Admin Tools
19. Create `scripts/approve_user.py`
20. Optional: Admin page for request management

## Security Notes

- Magic link tokens expire (Supabase default: 1 hour)
- API keys never logged or persisted server-side
- RLS ensures users can only access their own data
- Allowlist check happens before magic link is sent
- Preview episodes are read-only, no user data created
