# Evidence Tab Visual Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Evidence tab with a left sidebar for thread context, semantic color-coded evidence badges, and improved visual hierarchy based on Stitch mockup feedback.

**Architecture:** Add a ThreadContextSidebar component alongside the existing evidence threads. Implement a semantic color system for evidence types (foundational=blue, supporting=teal, direct=amber). Add relevance factor filter chips. Include a CTA for generating synthesis reports.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons

---

## Task 1: Create Semantic Evidence Color System

**Files:**
- Modify: `frontend/app/noeron.css:10-15`

**Step 1: Add semantic evidence colors to CSS variables**

Add these CSS variables inside the existing `:root` block in `noeron.css`:

```css
:root {
  /* ... existing variables ... */

  /* Evidence Type Colors - Semantic */
  --evidence-foundational: #6366f1; /* indigo - base layer */
  --evidence-foundational-bg: rgba(99, 102, 241, 0.15);
  --evidence-supporting: #0d9488; /* teal - building up */
  --evidence-supporting-bg: rgba(13, 148, 136, 0.15);
  --evidence-direct: #f59e0b; /* amber - the payoff */
  --evidence-direct-bg: rgba(245, 158, 11, 0.15);
  --evidence-speculative: #6b7280; /* gray - uncertain */
  --evidence-speculative-bg: rgba(107, 114, 128, 0.15);
}
```

**Step 2: Verify CSS loads correctly**

Run: `cd frontend && npm run dev`
Expected: Dev server starts without CSS errors

**Step 3: Commit**

```bash
git add frontend/app/noeron.css
git commit -m "feat(evidence): add semantic color system for evidence types"
```

---

## Task 2: Create ThreadContextSidebar Component

**Files:**
- Create: `frontend/components/deep-exploration/thread-context-sidebar.tsx`

**Step 1: Create the sidebar component file**

```tsx
"use client"

import { useState } from "react"
import { Info, Filter } from "lucide-react"

interface RelevanceFactor {
  id: string
  label: string
  active: boolean
}

interface ThreadContextSidebarProps {
  threadCount: number
  papersAnalyzed: number
  contextSummary: string
  onFilterChange?: (activeFilters: string[]) => void
}

const DEFAULT_FACTORS: RelevanceFactor[] = [
  { id: "experimental", label: "Experimental", active: true },
  { id: "morphogenesis", label: "Morphogenesis", active: true },
  { id: "theoretical", label: "Theoretical", active: true },
]

export function ThreadContextSidebar({
  threadCount,
  papersAnalyzed,
  contextSummary,
  onFilterChange,
}: ThreadContextSidebarProps) {
  const [factors, setFactors] = useState<RelevanceFactor[]>(DEFAULT_FACTORS)

  const toggleFactor = (id: string) => {
    const updated = factors.map((f) =>
      f.id === id ? { ...f, active: !f.active } : f
    )
    setFactors(updated)
    onFilterChange?.(updated.filter((f) => f.active).map((f) => f.id))
  }

  return (
    <div className="w-64 shrink-0 space-y-6">
      {/* Thread Context Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-foreground/50" />
          <h4 className="text-sm font-semibold text-foreground/80">Thread Context</h4>
        </div>
        <p className="text-xs text-foreground/60 leading-relaxed">
          {contextSummary}
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-foreground/50">
        <span>{threadCount} threads</span>
        <span>•</span>
        <span>{papersAnalyzed} papers</span>
      </div>

      {/* Relevance Factors */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-foreground/50" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Relevance Factors
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {factors.map((factor) => (
            <button
              key={factor.id}
              onClick={() => toggleFactor(factor.id)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                factor.active
                  ? "border-[var(--golden-chestnut)] bg-[var(--golden-chestnut)]/10 text-[var(--golden-chestnut)]"
                  : "border-border bg-transparent text-foreground/40 hover:border-foreground/30"
              }`}
            >
              {factor.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration/thread-context-sidebar.tsx
git commit -m "feat(evidence): add ThreadContextSidebar component with filter chips"
```

---

## Task 3: Create EvidenceCard Component with Semantic Colors

**Files:**
- Create: `frontend/components/deep-exploration/evidence-card.tsx`

**Step 1: Create the evidence card component**

```tsx
"use client"

import { ExternalLink, Bookmark, Copy } from "lucide-react"

type EvidenceType = "foundational" | "supporting" | "direct" | "speculative"

interface EvidenceCardProps {
  type: EvidenceType
  year: number
  journal?: string
  title: string
  description: string
  citationCount?: number
  topics?: string[]
  paperId?: string
  onViewPaper?: (paperId: string) => void
  onBookmark?: () => void
  onCopy?: () => void
}

const TYPE_STYLES: Record<EvidenceType, { label: string; className: string }> = {
  foundational: {
    label: "FOUNDATIONAL",
    className: "bg-[var(--evidence-foundational-bg)] text-[var(--evidence-foundational)] border-[var(--evidence-foundational)]/30",
  },
  supporting: {
    label: "SUPPORTING",
    className: "bg-[var(--evidence-supporting-bg)] text-[var(--evidence-supporting)] border-[var(--evidence-supporting)]/30",
  },
  direct: {
    label: "DIRECT EVIDENCE",
    className: "bg-[var(--evidence-direct-bg)] text-[var(--evidence-direct)] border-[var(--evidence-direct)]/30",
  },
  speculative: {
    label: "SPECULATIVE",
    className: "bg-[var(--evidence-speculative-bg)] text-[var(--evidence-speculative)] border-[var(--evidence-speculative)]/30",
  },
}

export function EvidenceCard({
  type,
  year,
  journal,
  title,
  description,
  citationCount,
  topics = [],
  paperId,
  onViewPaper,
  onBookmark,
  onCopy,
}: EvidenceCardProps) {
  const typeStyle = TYPE_STYLES[type]

  return (
    <div className="group bg-card/50 hover:bg-card/80 border border-border/50 rounded-lg p-4 transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Evidence Type Badge */}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${typeStyle.className}`}>
            {typeStyle.label}
          </span>
          {/* Year */}
          <span className="text-xs font-mono text-foreground/50">{year}</span>
          {/* Journal */}
          {journal && (
            <>
              <span className="text-foreground/30">•</span>
              <span className="text-xs text-foreground/50 uppercase tracking-wide">{journal}</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onBookmark && (
            <button
              onClick={onBookmark}
              className="p-1.5 text-foreground/40 hover:text-[var(--golden-chestnut)] transition-colors"
              title="Bookmark"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}
          {onCopy && (
            <button
              onClick={onCopy}
              className="p-1.5 text-foreground/40 hover:text-[var(--golden-chestnut)] transition-colors"
              title="Copy citation"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm text-foreground leading-snug mb-2">
        {title}
      </h4>

      {/* Description */}
      <p className="text-xs text-foreground/60 leading-relaxed mb-3">
        {description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-foreground/40">
          {citationCount !== undefined && (
            <span>• {citationCount} Citations</span>
          )}
          {topics.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-[var(--golden-chestnut)]">◆</span>
              {topics.slice(0, 2).join(", ")}
            </span>
          )}
        </div>

        {paperId && onViewPaper && (
          <button
            onClick={() => onViewPaper(paperId)}
            className="text-xs text-[var(--golden-chestnut)] hover:underline flex items-center gap-1"
          >
            View Paper
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration/evidence-card.tsx
git commit -m "feat(evidence): add EvidenceCard component with semantic color badges"
```

---

## Task 4: Create SynthesisReportCTA Component

**Files:**
- Create: `frontend/components/deep-exploration/synthesis-report-cta.tsx`

**Step 1: Create the CTA component**

```tsx
"use client"

import { FileText, Loader2 } from "lucide-react"

interface SynthesisReportCTAProps {
  papersCount: number
  onGenerate: () => void
  isLoading?: boolean
}

export function SynthesisReportCTA({
  papersCount,
  onGenerate,
  isLoading = false,
}: SynthesisReportCTAProps) {
  return (
    <div className="mt-8 pt-6 border-t border-border">
      <div className="text-center">
        <h4 className="text-sm font-medium text-foreground/80 mb-1">
          Want more structured evidence?
        </h4>
        <p className="text-xs text-foreground/50 mb-4">
          Generate a comprehensive summary of all {papersCount} papers in this thread.
        </p>
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--golden-chestnut)] hover:bg-[var(--golden-chestnut)]/90 text-[var(--carbon-black)] font-medium text-sm rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Generate Synthesis Report
            </>
          )}
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration/synthesis-report-cta.tsx
git commit -m "feat(evidence): add SynthesisReportCTA component"
```

---

## Task 5: Update Evidence Tab with New Layout

**Files:**
- Modify: `frontend/components/deep-exploration/tabs/evidence-tab.tsx`

**Step 1: Update imports at top of file**

Add these imports after the existing lucide imports (around line 13):

```tsx
import { ThreadContextSidebar } from "../thread-context-sidebar"
import { EvidenceCard } from "../evidence-card"
import { SynthesisReportCTA } from "../synthesis-report-cta"
```

**Step 2: Add helper function to map thread type to evidence type**

Add this function before the `EvidenceTab` component (around line 68):

```tsx
function mapStrengthToEvidenceType(strength: string): "foundational" | "supporting" | "direct" | "speculative" {
  switch (strength) {
    case "foundational":
      return "foundational"
    case "developing":
      return "supporting"
    case "speculative":
      return "speculative"
    default:
      return "direct"
  }
}

function generateContextSummary(threads: AIEvidenceThread[]): string {
  if (threads.length === 0) return "No evidence threads available."

  const types = [...new Set(threads.map(t => t.type.replace(/_/g, " ")))]
  return `This thread tracks the ${types.join(" and ")} of the research. It synthesizes findings across multiple papers to show how the evidence has developed over time.`
}
```

**Step 3: Replace the main return statement**

Replace the entire `return` block (starting around line 85) with the new two-column layout:

```tsx
return (
  <CornerBrackets className="bg-card/30 p-6 md:p-8">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <GitBranch className="w-5 h-5 text-[var(--golden-chestnut)]" />
        <h3 className="font-bold text-xl">Evidence Threads</h3>
      </div>
      <div className="flex items-center gap-3 text-xs text-foreground/50">
        {aiEvidenceThreads && (
          <span>{aiEvidenceThreads.papers_analyzed} papers analyzed</span>
        )}
        {aiEvidenceThreads && (
          <button
            onClick={() => onFetchThreads(true)}
            className="text-[var(--golden-chestnut)] hover:underline flex items-center gap-1"
          >
            <ArrowUp className="w-3 h-3 rotate-45" />
            Regenerate
          </button>
        )}
      </div>
    </div>

    {/* Loading State */}
    {isLoadingThreads && (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin mb-3" />
        <p className="text-foreground/60 text-sm">Analyzing research patterns...</p>
        <p className="text-foreground/50 text-xs mt-1">Identifying narrative threads</p>
      </div>
    )}

    {/* Error State */}
    {threadsError && !isLoadingThreads && (
      <div className="bg-red-500/10 border border-red-500/30 rounded-none p-4">
        <p className="text-red-400 text-sm">{threadsError}</p>
        <button
          onClick={() => onFetchThreads(true)}
          className="mt-2 text-sm text-[var(--golden-chestnut)] hover:underline"
        >
          Try again
        </button>
      </div>
    )}

    {/* Main Content - Two Column Layout */}
    {aiEvidenceThreads && !isLoadingThreads && !threadsError && aiEvidenceThreads.threads.length > 0 && (
      <div className="flex gap-8">
        {/* Left Sidebar */}
        <ThreadContextSidebar
          threadCount={aiEvidenceThreads.threads.length}
          papersAnalyzed={aiEvidenceThreads.papers_analyzed}
          contextSummary={generateContextSummary(aiEvidenceThreads.threads)}
        />

        {/* Right Content - Evidence Cards */}
        <div className="flex-1 space-y-6">
          {aiEvidenceThreads.threads.map((thread, threadIndex) => (
            <div key={threadIndex} className="space-y-4">
              {/* Thread Header */}
              <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                <div className={`size-6 rounded flex items-center justify-center shrink-0 ${
                  thread.type === "experimental_validation" ? "bg-green-500/20 text-green-400" :
                  thread.type === "mechanism_discovery" ? "bg-blue-500/20 text-blue-400" :
                  thread.type === "theoretical_framework" ? "bg-purple-500/20 text-purple-400" :
                  "bg-orange-500/20 text-orange-400"
                }`}>
                  {thread.type === "experimental_validation" ? (
                    <FlaskConical className="w-3.5 h-3.5" />
                  ) : thread.type === "mechanism_discovery" ? (
                    <GitBranch className="w-3.5 h-3.5" />
                  ) : thread.type === "theoretical_framework" ? (
                    <Sparkles className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5" />
                  )}
                </div>
                <h4 className="font-medium text-sm text-foreground">{thread.name}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  thread.strength === "foundational" ? "bg-[var(--evidence-foundational-bg)] text-[var(--evidence-foundational)]" :
                  thread.strength === "developing" ? "bg-[var(--evidence-supporting-bg)] text-[var(--evidence-supporting)]" :
                  "bg-[var(--evidence-speculative-bg)] text-[var(--evidence-speculative)]"
                }`}>
                  {thread.strength}
                </span>
              </div>

              {/* Milestone Cards */}
              <div className="space-y-3 pl-4 border-l-2 border-border/30">
                {thread.milestones.map((milestone, milestoneIndex) => (
                  <EvidenceCard
                    key={milestoneIndex}
                    type={mapStrengthToEvidenceType(thread.strength)}
                    year={milestone.year}
                    title={milestone.paper_title}
                    description={milestone.finding}
                    paperId={milestone.paper_id}
                    onViewPaper={(id) => onFetchFigureAnalysis(id)}
                  />
                ))}
              </div>

              {/* Thread Narrative */}
              <p className="text-sm text-foreground/50 italic pl-4">
                {thread.narrative}
              </p>
            </div>
          ))}

          {/* Synthesis Report CTA */}
          <SynthesisReportCTA
            papersCount={aiEvidenceThreads.papers_analyzed}
            onGenerate={() => {
              // This will navigate to overview or trigger report generation
              console.log("Generate synthesis report")
            }}
          />
        </div>
      </div>
    )}

    {/* Empty/Ineligible State - keep existing fallback logic */}
    {aiEvidenceThreads && !isLoadingThreads && !threadsError && aiEvidenceThreads.threads.length === 0 && (
      uniqueFallbackPapers.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground/80 font-medium">Timeline view unavailable</p>
              <p className="text-xs text-foreground/60 mt-1">
                {aiEvidenceThreads.eligibility_reason.includes("insufficient_papers")
                  ? "Need 4+ papers to show evolution of evidence over time."
                  : aiEvidenceThreads.eligibility_reason.includes("insufficient_year")
                    ? "The available research spans too few years to show temporal progression."
                    : "Insufficient temporal data for narrative analysis."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--golden-chestnut)]" />
            <h4 className="font-medium text-sm">Related Research ({uniqueFallbackPapers.length} papers)</h4>
          </div>

          <div className="space-y-3">
            {uniqueFallbackPapers.map((paper, index) => (
              <EvidenceCard
                key={paper.paper_id || index}
                type="supporting"
                year={parseInt(String(paper.year)) || new Date().getFullYear()}
                title={paper.title}
                description={paper.key_finding || "No key finding available."}
                paperId={paper.paper_id}
                onViewPaper={(id) => onFetchFigureAnalysis(id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <GitBranch className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
          <p className="text-foreground/50 text-sm">
            {!aiEvidenceThreads.eligible ? (
              <>
                <span className="block mb-1 font-medium">Unable to generate threads</span>
                <span className="text-xs text-foreground/40">
                  {aiEvidenceThreads.eligibility_reason.includes("insufficient_papers")
                    ? "Need 4+ papers to identify patterns"
                    : aiEvidenceThreads.eligibility_reason.includes("insufficient_year")
                      ? "Need papers spanning 3+ years"
                      : "Insufficient data for narrative analysis"}
                </span>
              </>
            ) : (
              "No distinct evidence threads identified"
            )}
          </p>
        </div>
      )
    )}

    {/* Initial loading state */}
    {!aiEvidenceThreads && !isLoadingThreads && !threadsError && (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[var(--golden-chestnut)] animate-spin mb-3" />
        <p className="text-foreground/60 text-sm">Loading evidence threads...</p>
      </div>
    )}
  </CornerBrackets>
)
```

**Step 4: Verify the component compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 5: Test the page loads**

Run: `cd frontend && npm run dev`
Navigate to: http://localhost:3000/episode/lex_325?view=exploration&claim=28
Click: Evidence tab
Expected: Two-column layout with sidebar on left, evidence cards on right

**Step 6: Commit**

```bash
git add frontend/components/deep-exploration/tabs/evidence-tab.tsx
git commit -m "feat(evidence): implement two-column layout with sidebar and evidence cards"
```

---

## Task 6: Export New Components from Index

**Files:**
- Modify: `frontend/components/deep-exploration/tabs/index.ts` (or create if doesn't exist)

**Step 1: Check if index file exists and update exports**

If the file exists, add the new component exports. If not, create it:

```tsx
export { OverviewTab } from "./overview-tab"
export { EvidenceTab } from "./evidence-tab"
export { FiguresTab } from "./figures-tab"
export { GraphTab } from "./graph-tab"
export { CreateTab } from "./create-tab"
```

Also create/update `frontend/components/deep-exploration/index.ts`:

```tsx
export { ClaimCard } from "./claim-card"
export { SegmentedTabBar } from "./segmented-tab-bar"
export { ThreadContextSidebar } from "./thread-context-sidebar"
export { EvidenceCard } from "./evidence-card"
export { SynthesisReportCTA } from "./synthesis-report-cta"
export type { TabId } from "./segmented-tab-bar"
```

**Step 2: Verify exports work**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration/index.ts frontend/components/deep-exploration/tabs/index.ts
git commit -m "chore: export new evidence tab components"
```

---

## Task 7: Visual Polish - Add Responsive Breakpoints

**Files:**
- Modify: `frontend/components/deep-exploration/tabs/evidence-tab.tsx`

**Step 1: Update the two-column layout for mobile**

Find the flex container with `gap-8` and update it:

```tsx
{/* Main Content - Two Column Layout */}
{aiEvidenceThreads && !isLoadingThreads && !threadsError && aiEvidenceThreads.threads.length > 0 && (
  <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
    {/* Left Sidebar - hidden on mobile, shown on lg+ */}
    <div className="hidden lg:block">
      <ThreadContextSidebar
        threadCount={aiEvidenceThreads.threads.length}
        papersAnalyzed={aiEvidenceThreads.papers_analyzed}
        contextSummary={generateContextSummary(aiEvidenceThreads.threads)}
      />
    </div>

    {/* Mobile stats bar - shown only on mobile */}
    <div className="lg:hidden flex items-center gap-4 text-xs text-foreground/50 pb-4 border-b border-border">
      <span>{aiEvidenceThreads.threads.length} threads</span>
      <span>•</span>
      <span>{aiEvidenceThreads.papers_analyzed} papers</span>
    </div>

    {/* Right Content - Evidence Cards */}
    <div className="flex-1 space-y-6">
      {/* ... rest of content ... */}
    </div>
  </div>
)}
```

**Step 2: Test responsive behavior**

Run: `cd frontend && npm run dev`
Resize browser window
Expected: Sidebar hides on mobile, shows stats bar instead

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration/tabs/evidence-tab.tsx
git commit -m "feat(evidence): add responsive breakpoints for mobile"
```

---

## Summary

After completing all tasks, you will have:

1. ✅ Semantic color system for evidence types (foundational=indigo, supporting=teal, direct=amber)
2. ✅ ThreadContextSidebar component with relevance filter chips
3. ✅ EvidenceCard component with color-coded badges, hover states, and actions
4. ✅ SynthesisReportCTA component
5. ✅ Two-column layout for Evidence tab
6. ✅ Responsive design for mobile
7. ✅ All components properly exported

The Evidence tab will now match the Stitch mockup with improved visual hierarchy and semantic color coding.
