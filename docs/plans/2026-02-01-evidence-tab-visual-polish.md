# Evidence Tab Visual Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the deep exploration view to match the Stitch mockup - darker background, underline tabs, remove container wrappers, tighter spacing.

**Architecture:** Update CSS variables for darker background, replace SegmentedTabBar with UnderlineTabBar, remove CornerBrackets wrappers from tab content, reduce padding/margins throughout.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## Task 1: Darken Background Color

**Files:**
- Modify: `frontend/app/globals.css:61`

**Step 1: Update dark mode background to richer black**

Find line 61 in globals.css:
```css
--background: #1D1E20;
```

Replace with:
```css
--background: #0d0d0d;
```

Also update `--carbon-black` on line 53:
```css
--carbon-black: #0d0d0d;
```

And update `--card` on line 63 to be slightly elevated:
```css
--card: #1a1a1a;
```

And `--dark-gray` on line 55:
```css
--dark-gray: #1a1a1a;
```

**Step 2: Verify the app loads**

Run: `cd frontend && npm run dev`
Expected: Page loads with darker background

**Step 3: Commit**

```bash
git add frontend/app/globals.css
git commit -m "style: darken background for richer contrast"
```

---

## Task 2: Create UnderlineTabBar Component

**Files:**
- Create: `frontend/components/deep-exploration/underline-tab-bar.tsx`

**Step 1: Create the new tab bar component**

```tsx
"use client"

export type TabId = "overview" | "evidence" | "figures" | "graph" | "create"

interface Tab {
  id: TabId
  label: string
}

const TABS: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "figures", label: "Figures" },
  { id: "graph", label: "Graph" },
  { id: "create", label: "Create" },
]

interface UnderlineTabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  className?: string
}

export function UnderlineTabBar({ activeTab, onTabChange, className = "" }: UnderlineTabBarProps) {
  return (
    <div
      className={`flex gap-0 border-b border-border ${className}`}
      role="tablist"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            relative px-6 py-3 text-sm font-medium transition-colors
            ${activeTab === tab.id
              ? "text-[var(--golden-chestnut)]"
              : "text-foreground/50 hover:text-foreground/80"
            }
          `}
        >
          {tab.label}
          {/* Active underline */}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--golden-chestnut)]" />
          )}
        </button>
      ))}
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors in the new file

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration/underline-tab-bar.tsx
git commit -m "feat: add UnderlineTabBar component"
```

---

## Task 3: Replace Tab Bar in Deep Exploration View

**Files:**
- Modify: `frontend/components/deep-exploration-view.tsx`

**Step 1: Update import**

Find line ~21:
```tsx
import { SegmentedTabBar, type TabId } from "./deep-exploration/segmented-tab-bar"
```

Replace with:
```tsx
import { UnderlineTabBar, type TabId } from "./deep-exploration/underline-tab-bar"
```

**Step 2: Replace component usage**

Find the SegmentedTabBar usage (around line 578):
```tsx
<SegmentedTabBar
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

Replace with:
```tsx
<UnderlineTabBar
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

**Step 3: Simplify the sticky tab container**

Find the sticky container around line 577:
```tsx
<div className="sticky top-[112px] z-30 bg-background/95 backdrop-blur-sm pt-6 pb-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b border-transparent [&.is-stuck]:border-border transition-colors">
```

Replace with simpler styling:
```tsx
<div className="sticky top-[112px] z-30 bg-background pt-4 pb-0 -mx-4 px-4 md:-mx-8 md:px-8">
```

**Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 5: Test in browser**

Run: `cd frontend && npm run dev`
Navigate to: http://localhost:3000/episode/lex_325?view=exploration&claim=28
Expected: Underline-style tabs instead of segmented buttons

**Step 6: Commit**

```bash
git add frontend/components/deep-exploration-view.tsx
git commit -m "refactor: replace SegmentedTabBar with UnderlineTabBar"
```

---

## Task 4: Remove CornerBrackets from Evidence Tab

**Files:**
- Modify: `frontend/components/deep-exploration/tabs/evidence-tab.tsx`

**Step 1: Remove the CornerBrackets wrapper**

Find the return statement (around line 108) that wraps content in CornerBrackets:
```tsx
return (
  <CornerBrackets className="bg-card/30 p-6 md:p-8">
```

Replace with a simple div:
```tsx
return (
  <div className="space-y-6">
```

**Step 2: Update the closing tag**

Find the closing `</CornerBrackets>` at the end of the component and replace with `</div>`.

**Step 3: Remove the CornerBrackets function definition**

Delete lines 18-28 (the CornerBrackets function) since it's no longer used.

**Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add frontend/components/deep-exploration/tabs/evidence-tab.tsx
git commit -m "refactor: remove CornerBrackets wrapper from Evidence tab"
```

---

## Task 5: Remove CornerBrackets from Overview Tab

**Files:**
- Modify: `frontend/components/deep-exploration/tabs/overview-tab.tsx`

**Step 1: Remove the CornerBrackets wrapper**

Find the return statement (around line 63):
```tsx
return (
  <div className="space-y-6">
    {/* Synthesis Section */}
    <CornerBrackets className="bg-card/30 p-6 md:p-8">
```

Replace with:
```tsx
return (
  <div className="space-y-6">
    {/* Synthesis Section */}
    <div className="space-y-6">
```

**Step 2: Update the closing tag**

Find the closing `</CornerBrackets>` and replace with `</div>`.

**Step 3: Remove the CornerBrackets function definition**

Delete lines 13-23 (the CornerBrackets function) since it's no longer used.

**Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add frontend/components/deep-exploration/tabs/overview-tab.tsx
git commit -m "refactor: remove CornerBrackets wrapper from Overview tab"
```

---

## Task 6: Simplify Claim Card (Remove CornerBrackets)

**Files:**
- Modify: `frontend/components/deep-exploration/claim-card.tsx`

**Step 1: Replace CornerBrackets with simple styling**

Find line 40:
```tsx
<CornerBrackets className="relative overflow-hidden bg-gradient-to-br from-card to-background">
```

Replace with:
```tsx
<div className="relative overflow-hidden bg-card/50 border border-border/30 rounded-lg">
```

**Step 2: Update closing tag**

Replace `</CornerBrackets>` with `</div>`.

**Step 3: Remove CornerBrackets function**

Delete lines 22-36 (the CornerBrackets function definition).

**Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add frontend/components/deep-exploration/claim-card.tsx
git commit -m "refactor: simplify ClaimCard styling, remove CornerBrackets"
```

---

## Task 7: Reduce Padding in Deep Exploration View

**Files:**
- Modify: `frontend/components/deep-exploration-view.tsx`

**Step 1: Reduce main content padding**

Find the main content container (around line 567):
```tsx
<div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
```

Replace with tighter padding:
```tsx
<div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
```

**Step 2: Reduce spacing between ClaimCard and tabs**

Find the tab content container (around line 585):
```tsx
<div className="mt-6">
```

Replace with:
```tsx
<div className="mt-4">
```

**Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add frontend/components/deep-exploration-view.tsx
git commit -m "style: reduce padding for tighter layout"
```

---

## Task 8: Export UnderlineTabBar from Index

**Files:**
- Modify: `frontend/components/deep-exploration/index.ts`

**Step 1: Add export for UnderlineTabBar**

Add this line to the exports:
```tsx
export { UnderlineTabBar } from "./underline-tab-bar"
```

Also re-export the TabId type:
```tsx
export type { TabId } from "./underline-tab-bar"
```

**Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration/index.ts
git commit -m "chore: export UnderlineTabBar from index"
```

---

## Summary

After completing all tasks:

1. ✅ Darker background (#0d0d0d instead of #1D1E20)
2. ✅ Underline-style tabs instead of segmented pills
3. ✅ No CornerBrackets wrappers on any tab content
4. ✅ Simplified ClaimCard with subtle border instead of corner brackets
5. ✅ Tighter padding throughout
6. ✅ All components exported properly

The result should closely match the Stitch mockup with cleaner, more professional styling.
