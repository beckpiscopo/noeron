# User Account Pages Design

## Overview

Build a settings page and user profile system to support multi-user content ownership and community features. Users need their bookmarks, notebooks, slides, and other content tied to their account and accessible across devices.

## Goals

1. **Content ownership** — User-generated content (bookmarks, notebooks, slides) tied to authenticated accounts, not shared via `default_user`
2. **Cross-device access** — Sign in anywhere, see your content
3. **Community attribution** — Display names for shared content in community tab
4. **Minimal friction** — No mandatory onboarding steps, just gentle nudges

## Non-Goals (This Phase)

- Analytics/activity tracking (future)
- Purchases/x402 integration (future)
- Account deletion (future)
- Avatar upload (future)
- Migrating anonymous localStorage content to accounts

---

## Database Schema

### Apply Migration 018 (user_profiles)

Already exists at `supabase/migrations/018_add_user_profiles.sql`. Apply as-is:

- `id` UUID references `auth.users(id)`
- `display_name` TEXT
- `avatar_url` TEXT (future use)
- Auto-creates profile on signup via trigger
- Display name defaults to email username

### New Migration 021: Fix User ID Types

Convert `user_id TEXT DEFAULT 'default_user'` → `user_id UUID REFERENCES auth.users(id)` for:

- `bookmarks`
- `notebook_synthesis`
- `quiz_sessions`
- `chat_sessions`
- `user_interests`

Migration steps:
1. Drop existing RLS policies
2. Drop default constraint
3. Alter column type to UUID with foreign key
4. Recreate RLS policies using `auth.uid() = user_id`
5. Delete orphaned `default_user` rows

### What Stays in localStorage

- **Gemini API key** — Device-specific, user's secret, we don't store it
- **Playback position** — Device-specific preference
- **Theme** — Device-specific preference

---

## Settings Page

### Route

`/settings` — Protected route, redirects to home if unauthenticated.

### Layout

Single page with stacked sections. Matches design system (warm earthy palette, Bodoni Moda headings, Manrope body).

### Sections

#### 1. Profile

| Field | Type | Storage | Notes |
|-------|------|---------|-------|
| Display name | Text input | Database (user_profiles) | Required for community sharing |
| Email | Read-only | From auth.users | Shown for reference |
| Avatar | Future | — | Placeholder or Gravatar |

- Auto-save on blur with toast confirmation
- Inline validation if display name is empty

#### 2. API Key

Reuse UI from `ApiKeyModal`, displayed inline (not as modal):
- Show masked key if set
- Reveal/hide toggle
- Delete button
- Instructions + link to Google AI Studio

Storage: localStorage (unchanged from current behavior)

#### 3. Account

- Sign out button
- "Delete account" — Disabled with "Coming soon" tooltip

#### 4. Activity (Placeholder)

- Disabled/greyed section
- "Coming soon" label
- Will show: episodes explored, bookmarks saved, slides generated

#### 5. Purchases (Placeholder)

- Disabled/greyed section
- "Coming soon" label
- Will show: episode access, x402 transaction history

### User Menu Integration

Update `user-menu.tsx`:
- "Settings" item links to `/settings` (currently disabled)
- Remove API Key modal trigger from menu (it's now in settings)

---

## First-Login Flow

### Auth Callback Behavior

Location: `/auth/callback` (needs to be created)

```
1. User clicks magic link → lands on /auth/callback
2. Supabase processes auth token
3. Fetch user's profile from user_profiles
4. Check if display_name equals auto-generated default (email username)
   - If default → redirect to /settings?welcome=1
   - Otherwise → redirect to / (or stored return URL)
```

### Welcome State

When `/settings?welcome=1`:
- Show dismissible welcome banner at top
- Message: "Welcome to Noeron! Set your display name to get started."
- Banner has X to dismiss, or auto-dismisses after saving display name
- Not a blocker — user can navigate away immediately

---

## Community Sharing Enforcement

### When Display Name Required

Only when sharing content publicly (e.g., slides to community tab).

### Inline Prompt Flow

If user tries to share and display_name is still the default:

1. Share modal/button shows inline prompt
2. Text: "Set a display name to share with the community"
3. Text input for display name
4. Save button
5. On save → continue with sharing action

### No Enforcement For

- Private content creation (bookmarks, notebooks, slides)
- Viewing community content
- Any non-public action

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `frontend/app/settings/page.tsx` | Settings page |
| `frontend/app/auth/callback/route.ts` | Magic link callback handler |
| `supabase/migrations/021_fix_user_id_types.sql` | Schema migration |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/components/user-menu.tsx` | Link Settings to /settings, remove API key modal |
| `frontend/components/deep-exploration/slides/slide-deck-generator.tsx` | Add display name prompt in share flow |

---

## Future Considerations

### Analytics (Later Phase)

- New `user_activity` table to track usage
- Settings page Activity section shows stats
- Consider: what metrics matter? Episodes viewed, time spent, bookmarks created, slides generated

### Purchases / x402 (Later Phase)

- Episode access control (some episodes require purchase)
- x402 payment protocol integration
- New `purchases` or `transactions` table
- Settings page Purchases section shows history

### Account Deletion (Later Phase)

- GDPR compliance consideration
- Cascade delete all user content
- Confirmation flow with email verification

### Avatar Upload (Later Phase)

- Supabase Storage bucket for avatars
- Image cropping/resizing
- Fallback to Gravatar or initials

---

## Design System Reference

From `frontend/app/globals.css`:

```css
--golden-chestnut: #BE7C4D
--rosy-copper: #BE5A38
--warm-taupe: #A67C5B
```

- Headings: Bodoni Moda
- Body: Manrope
- Use existing UI components from `@/components/ui/*`
