# Figure Browsing UX Enhancement

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the figure viewing experience by showing figures immediately without requiring an API key, and adding visual indicators for papers that have figures.

**Current State:**
- Figures are uploaded to Supabase Storage (408 figures across 79 papers)
- Clicking a paper in evidence threads triggers Gemini analysis (requires API key)
- No visual indicator of which papers have figures
- Users must have API key before seeing any figures

**Desired State:**
- Visual indicator (image icon) on papers that have figures
- Click paper → immediately see figure thumbnails + captions (no API key needed)
- Optional "Analyze with AI" button for Gemini vision analysis (requires API key)

---

## Phase 1: Backend - Add Figure Metadata Endpoint

### Task 1.1: Create get_paper_figures endpoint

**Files:**
- Modify: `src/bioelectricity_research/server.py`
- Modify: `src/bioelectricity_research/http_server.py`

**Step 1: Add implementation function in server.py**

After `_get_figures_for_paper` helper (~line 75), the endpoint already has access to figure metadata. Create a simple function that returns figures without AI analysis:

```python
async def _get_paper_figures_impl(paper_id: str) -> dict[str, Any]:
    """Get figure metadata for a paper (no AI analysis)."""
    figures = _get_figures_for_paper(paper_id)

    if not figures:
        return {"paper_id": paper_id, "figures": [], "total_figures": 0}

    # Filter to figures with images and return metadata only
    result_figures = []
    for fig in figures:
        if fig.get("image_path") or fig.get("image_url"):
            result_figures.append({
                "figure_id": fig["figure_id"],
                "paper_id": fig["paper_id"],
                "image_path": fig.get("image_path"),
                "image_url": fig.get("image_url"),
                "caption": fig.get("caption"),
                "title": fig.get("title"),
                "label": fig.get("label"),
            })

    return {
        "paper_id": paper_id,
        "figures": result_figures,
        "total_figures": len(result_figures),
    }
```

**Step 2: Add HTTP endpoint in http_server.py**

```python
@app.post("/tools/get_paper_figures/execute")
async def http_get_paper_figures(request: Request):
    """Get figures for a paper without AI analysis."""
    try:
        body = await request.json()
        from .server import _get_paper_figures_impl

        paper_id = body.get("paper_id")
        if not paper_id:
            return JSONResponse({"error": "paper_id required"}, status_code=400)

        result = await _get_paper_figures_impl(paper_id)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)
```

**Step 3: Test endpoint**

```bash
curl -X POST http://localhost:8000/tools/get_paper_figures/execute \
  -H "Content-Type: application/json" \
  -d '{"paper_id": "0028c54efdf7f0f8e4d747e087944c07421978ac"}'
```

**Step 4: Commit**

```bash
git add src/bioelectricity_research/server.py src/bioelectricity_research/http_server.py
git commit -m "feat: add get_paper_figures endpoint for browsing without AI"
```

---

### Task 1.2: Create papers_with_figures index endpoint

**Files:**
- Modify: `src/bioelectricity_research/server.py`
- Modify: `src/bioelectricity_research/http_server.py`

Create an endpoint that returns a Set/list of paper_ids that have figures. This allows the frontend to check figure availability without fetching all figure data.

**Step 1: Add helper in server.py**

```python
def _get_papers_with_figures() -> set[str]:
    """Return set of paper IDs that have at least one figure with an image."""
    index = _load_figures_index()
    papers_with_figures = set()

    for paper_id, figures in index.get("figures_by_paper", {}).items():
        if any(f.get("image_path") or f.get("image_url") for f in figures):
            papers_with_figures.add(paper_id)

    return papers_with_figures
```

**Step 2: Add HTTP endpoint**

```python
@app.get("/tools/papers_with_figures")
async def http_papers_with_figures():
    """Get list of paper IDs that have figures."""
    from .server import _get_papers_with_figures
    return {"paper_ids": list(_get_papers_with_figures())}
```

**Step 3: Commit**

```bash
git add src/bioelectricity_research/server.py src/bioelectricity_research/http_server.py
git commit -m "feat: add papers_with_figures index endpoint"
```

---

## Phase 2: Frontend - Add Figure Indicators

### Task 2.1: Add API functions

**Files:**
- Modify: `frontend/lib/api.ts`

**Step 1: Add types and functions**

```typescript
export interface FigureMetadata {
  figure_id: string
  paper_id: string
  image_path: string | null
  image_url: string | null
  caption: string | null
  title: string | null
  label: string | null
}

export interface GetFiguresResponse {
  paper_id: string
  figures: FigureMetadata[]
  total_figures: number
}

export async function getPaperFigures(paperId: string): Promise<GetFiguresResponse> {
  return callMcpTool<GetFiguresResponse>("get_paper_figures", { paper_id: paperId })
}

export async function getPapersWithFigures(): Promise<string[]> {
  const response = await fetch(`${fastmcpUrl}/tools/papers_with_figures`)
  const data = await response.json()
  return data.paper_ids || []
}
```

**Step 2: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add getPaperFigures and getPapersWithFigures API functions"
```

---

### Task 2.2: Add figure indicator to evidence thread milestones

**Files:**
- Modify: `frontend/components/deep-exploration-view.tsx`

**Step 1: Fetch papers with figures on mount**

Add state and effect near other state declarations:

```typescript
const [papersWithFigures, setPapersWithFigures] = useState<Set<string>>(new Set())

useEffect(() => {
  getPapersWithFigures().then(ids => setPapersWithFigures(new Set(ids)))
}, [])
```

**Step 2: Add image icon to milestone paper titles**

Update the paper title button in evidence thread milestones to show an icon when figures exist:

```tsx
<button
  onClick={() => milestone.paper_id && handlePaperClick(milestone.paper_id)}
  className="..."
>
  {papersWithFigures.has(milestone.paper_id) && (
    <ImageIcon className="w-3 h-3 inline mr-1 text-[var(--golden-chestnut)]" />
  )}
  {milestone.paper_title.length > 50 ? ... : milestone.paper_title}
</button>
```

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration-view.tsx
git commit -m "feat: show image icon on papers with figures in evidence threads"
```

---

## Phase 3: Frontend - Two-Step Figure Viewing

### Task 3.1: Refactor figure section to show figures first

**Files:**
- Modify: `frontend/components/deep-exploration-view.tsx`

**Step 1: Add state for figure browsing vs analysis**

```typescript
const [browsingFigures, setBrowsingFigures] = useState<GetFiguresResponse | null>(null)
const [figureAnalysis, setFigureAnalysis] = useState<AnalyzeFiguresResponse | null>(null)
// Keep isLoadingFigures for browsing, add isAnalyzing for AI
const [isAnalyzing, setIsAnalyzing] = useState(false)
```

**Step 2: Create handlePaperClick function**

```typescript
const handlePaperClick = async (paperId: string) => {
  setIsLoadingFigures(true)
  setFiguresError(null)
  setBrowsingFigures(null)
  setFigureAnalysis(null)

  try {
    // First, just get the figures (no AI)
    const data = await getPaperFigures(paperId)
    setBrowsingFigures(data)
    if (data.figures.length > 0) {
      setSelectedFigure(data.figures[0])
    }
  } catch (err) {
    setFiguresError(err instanceof Error ? err.message : "Failed to load figures")
  } finally {
    setIsLoadingFigures(false)
  }
}
```

**Step 3: Create analyzeCurrentFigures function**

```typescript
const analyzeCurrentFigures = async () => {
  if (!browsingFigures || !hasGeminiKey) {
    if (!hasGeminiKey) setApiKeyModalOpen(true)
    return
  }

  setIsAnalyzing(true)
  try {
    const data = await analyzePaperFigures(
      browsingFigures.paper_id,
      synthesis?.claim_text || claim.title
    )
    setFigureAnalysis(data)
    // Update selected figure with analysis
    if (data.figures.length > 0 && selectedFigure) {
      const analyzed = data.figures.find(f => f.figure_id === selectedFigure.figure_id)
      if (analyzed) setSelectedFigure(analyzed)
    }
  } catch (err) {
    setFiguresError(err instanceof Error ? err.message : "Analysis failed")
  } finally {
    setIsAnalyzing(false)
  }
}
```

**Step 4: Update UI to show figures first, then optional analysis**

The figure section should:
1. Show figure thumbnails immediately after clicking paper
2. Display caption below selected figure
3. Show "Analyze with AI" button (requires API key)
4. If analyzed, show AI analysis below caption

```tsx
{browsingFigures && !isLoadingFigures && (
  <CornerBrackets className="bg-card/30 p-6">
    {/* Thumbnails */}
    <div className="flex gap-2 mb-4 overflow-x-auto">
      {browsingFigures.figures.map((fig) => (
        <button key={fig.figure_id} onClick={() => setSelectedFigure(fig)} ...>
          <img src={fig.image_url || `/api/figures/${fig.image_path}`} ... />
        </button>
      ))}
    </div>

    {/* Selected figure */}
    {selectedFigure && (
      <div className="space-y-4">
        <img src={selectedFigure.image_url || ...} />

        {selectedFigure.caption && (
          <p className="text-xs italic">{selectedFigure.caption}</p>
        )}

        {/* AI Analysis section */}
        {figureAnalysis ? (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[var(--golden-chestnut)]" />
              <span className="font-medium">AI Analysis</span>
            </div>
            <MarkdownContent content={
              figureAnalysis.figures.find(f => f.figure_id === selectedFigure.figure_id)?.analysis || ""
            } />
          </div>
        ) : (
          <button
            onClick={analyzeCurrentFigures}
            disabled={isAnalyzing}
            className="flex items-center gap-2 text-sm text-[var(--golden-chestnut)] hover:underline"
          >
            {isAnalyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Analyze with AI</>
            )}
          </button>
        )}
      </div>
    )}
  </CornerBrackets>
)}
```

**Step 5: Commit**

```bash
git add frontend/components/deep-exploration-view.tsx
git commit -m "feat: show figures immediately, add optional AI analysis button"
```

---

## Success Criteria

- [ ] Papers with figures show image icon in evidence thread milestones
- [ ] Clicking paper immediately shows figure thumbnails (no API key needed)
- [ ] Figure captions display below selected figure
- [ ] "Analyze with AI" button appears below figures
- [ ] AI analysis only triggers when button clicked (requires API key)
- [ ] Smooth transition between browsing and analyzed states

## Notes

- The figures are already on Supabase CDN, so loading should be fast
- Captions come from GROBID extraction - quality varies by paper
- Some papers have 10+ figures, consider pagination or "show more" for those
