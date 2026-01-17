# URL Routing Restructure Design

## Problem

The app uses state-based view switching — all 9 views render on `/` based on a `useState` variable. This means:
- URLs don't change when navigating
- Refreshing loses state (returns to landing)
- No way to share links to specific episodes or views

## Solution

Convert to Next.js file-based routing with episode-centric URLs.

## Route Structure

```
app/
├── page.tsx                    # Landing page (simplified)
├── layout.tsx                  # Root layout (unchanged)
├── library/
│   └── page.tsx               # Episode library
├── episode/
│   └── [id]/
│       └── page.tsx           # Episode hub (overview, listening, exploration, quiz)
├── notebooks/
│   └── page.tsx               # Notebook library
├── notebook/
│   └── [id]/
│       └── page.tsx           # Individual notebook
├── graph/
│   └── page.tsx               # Knowledge graph (already exists)
└── api/                        # API routes (unchanged)
```

## URL Examples

| URL | View |
|-----|------|
| `/` | Landing page |
| `/library` | Browse all episodes |
| `/episode/episode-1` | Episode overview (default) |
| `/episode/episode-1?view=listening&t=145` | Listening at 2:25 |
| `/episode/episode-1?view=exploration&claim=123` | Exploring a claim |
| `/episode/episode-1?view=quiz` | Quiz mode |
| `/episode/episode-1?view=paper&paperId=xyz` | Viewing a paper |
| `/notebooks` | All notebooks |
| `/notebook/abc123` | Specific notebook |
| `/graph?concept=bioelectricity` | Knowledge graph |

## State Management

**Moves to URL:**
- Current view → route path + `?view=` param
- Selected episode → route param (`/episode/[id]`)
- Playback timestamp → `?t=` param
- Selected claim → `?claim=` param
- Selected paper → `?paperId=` param

**Stays in React state:**
- UI state (modals, expanded sections)
- Loaded data (episode details, claims, summaries)
- Transient state (current audio position during playback)

**Uses localStorage (unchanged):**
- Playback position persistence

## Episode Page Component

```typescript
export default function EpisodePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const view = searchParams.get("view") || "overview"

  const [episode, setEpisode] = useState<EpisodeMetadata | null>(null)
  const [claims, setClaims] = useState<Claim[]>([])

  useEffect(() => {
    // Load episode metadata, claims, summaries
  }, [params.id])

  switch (view) {
    case "overview":
      return <EpisodeOverview episode={episode} onStartListening={...} />
    case "listening":
      return <ListeningView episode={episode} initialTime={searchParams.get("t")} />
    case "exploration":
      return <DeepExplorationView claimId={searchParams.get("claim")} />
    case "paper":
      return <PaperViewer paperId={searchParams.get("paperId")} />
    case "quiz":
      return <QuizMode episode={episode} />
    default:
      return <EpisodeOverview episode={episode} />
  }
}
```

## Navigation Updates

```typescript
// Landing → Library
onGetStarted={() => router.push("/library")}

// Library → Episode
onSelectEpisode={(ep) => router.push(`/episode/${ep.id}`)}

// Within episode
onStartListening={() => router.push(`/episode/${id}?view=listening`)}
onDiveDeeper={(claimId) => router.push(`/episode/${id}?view=exploration&claim=${claimId}`)}

// Shareable timestamp link
const shareUrl = `${window.location.origin}/episode/${id}?view=listening&t=${currentTime}`
```

## Other Pages

**Landing (`app/page.tsx`):** Renders `<LandingPage />` with router navigation. All state management removed.

**Library (`app/library/page.tsx`):** Fetches episodes, renders `<EpisodeLibrary />`.

**Notebooks (`app/notebooks/page.tsx`):** Fetches notebooks, renders `<NotebookLibrary />`.

**Notebook (`app/notebook/[id]/page.tsx`):** Fetches notebook by ID, renders `<NotebookView />`.

## Implementation Order

1. Create route files with placeholder pages
2. Migrate landing page — simplify to just LandingPage component
3. Create library page — move episode fetching, update navigation
4. Create episode page — move episode state and view switching, use query params
5. Create notebook pages — similar pattern
6. Update all components — change callbacks to use router
7. Clean up — remove unused state and dead code

## Testing Checkpoints

- After step 2: Landing → Library navigation works
- After step 4: Full episode flow works (overview → listening → exploration → quiz)
- After step 6: All navigation works, URLs shareable, refresh preserves state
