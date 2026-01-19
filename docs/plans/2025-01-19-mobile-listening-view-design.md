# Mobile Listening View Design

## Overview

Redesign the episode listening view (`/episode/[id]?view=listening`) for mobile devices. The current desktop layout uses a three-column design that doesn't translate well to mobile viewports.

**Primary goal:** Active listening with balanced access to research claims and AI chat.

**Breakpoint:** Mobile layout activates below 768px.

---

## Layout Structure

```
┌─────────────────────────┐
│  Header                 │  ~44-48px (fixed)
├─────────────────────────┤
│  Compact Player         │  ~48-56px (sticky)
├─────────────────────────┤
│                         │
│    Claims Content       │  flex-1 (scrollable)
│    (current + strip)    │
│                         │
├─────────────────────────┤
│                    [💬] │  FAB (fixed, bottom-right)
└─────────────────────────┘
```

---

## Component Specifications

### 1. Mobile Header

```
┌─────────────────────────────────────┐
│  [←] Noeron      [🔖]  [•••]       │
└─────────────────────────────────────┘
```

**Left side:**
- Back arrow (returns to episode overview or library)
- "Noeron" logo/wordmark

**Right side:**
- Bookmarks icon (direct access - core to research workflow)
- Overflow menu (•••) containing:
  - Search
  - Settings
  - Help
  - Dark mode toggle

**Specs:**
- Height: 44-48px
- Icons: ~20px with 44px minimum tap targets
- Overflow opens as dropdown popover (not bottom sheet)

---

### 2. Compact Player (Mini Bar)

**Collapsed state (default):**
```
┌─────────────────────────────────────┐
│  [▶]  ════════●══════════  12:45   │
└─────────────────────────────────────┘
```
- Height: ~48px
- Play/pause button (left)
- Progress bar (fills remaining space, tappable to seek)
- Current timestamp (right)
- Tap anywhere except play button to expand

**Expanded state:**
```
┌─────────────────────────────────────┐
│  ← Biology, Life, Aliens, Evol... →│  Marquee scrolling title
│                                     │
│  [⟲15]      [▶]      [15⟳]         │
│                                     │
│  ════════════●══════════════════   │
│  12:45                    3:22:41  │
└─────────────────────────────────────┘
```
- Height: ~140px
- Episode title with marquee animation for long titles
- Centered playback controls: skip -15s, play/pause, skip +15s
- Full progress bar with current time and total duration
- Chevron indicator (∧) hints collapsibility
- Tap outside or swipe down to collapse

**Behavior:**
- Progress bar scrubbable in both states
- Expand/collapse animates ~200ms ease-out
- Remembers expanded state during session

---

### 3. Claims Content Area

**Current Claim Card:**
```
┌─────────────────────────────────────┐
│  SCIENTIFIC CLAIM • 12:45      [🔖]│
│                                     │
│  "Mitochondrial efficiency drops    │
│   by 40% in high-sugar              │
│   environments"                     │
│                                     │
│  "Recent research demonstrates      │
│   that sustained hyperglycemia..."  │
│                                     │
│  Confidence: 87%    [Dive Deeper]  │
└─────────────────────────────────────┘
```
- Full detail: category badge, timestamp, bookmark button
- Distilled claim as hero text (~18-20px)
- Full transcript quote below (muted, ~14px)
- Confidence score + "Dive Deeper" button
- Corner bracket styling preserved from desktop

**Past Claims Strip:**
```
┌─────────────────────────────────────┐
│  ← Past Claims                  12 │
│ ┌───────┐ ┌───────┐ ┌───────┐      │
│ │Glucose│ │Role of│ │Cell...│  →   │
│ │metab..│ │mitoch.│ │       │      │
│ └───────┘ └───────┘ └───────┘      │
└─────────────────────────────────────┘
```
- Section label "Past Claims" with count badge
- Count badge tappable to open full vertical list modal
- Horizontally scrollable row of compact cards
- Each card: ~100px wide, truncated distilled claim (2 lines max)
- Tap any card → opens quick preview bottom sheet

---

### 4. Quick Preview Bottom Sheet

Triggered by tapping a past claim card:

```
┌─────────────────────────────────────┐
│  ─────  (drag handle)              │
│                                     │
│  SCIENTIFIC CLAIM • 8:32       [🔖]│
│                                     │
│  "Glucose metabolism affects        │
│   mitochondrial function"           │
│                                     │
│  "Studies show that glucose levels  │
│   directly influence how            │
│   mitochondria produce energy."     │
│                                     │
│  Confidence: 72%                    │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │ Jump to     │ │ Dive Deeper │   │
│  │ 8:32        │ │             │   │
│  └─────────────┘ └─────────────┘   │
└─────────────────────────────────────┘
```

**Specs:**
- Height: ~50% viewport
- Drag handle at top
- Same content as full claim card

**Actions:**
- **Jump to [timestamp]** - Seeks audio, claim becomes current, sheet dismisses
- **Dive Deeper** - Navigates to deep exploration view

**Behavior:**
- Swipe down or tap backdrop to dismiss
- Backdrop dims content behind

---

### 5. Chat FAB

```
      ┌────┐
      │ 💬 │  56px diameter
      └────┘  16px from edges
```

**Specs:**
- Static chat bubble icon (no state indicator)
- 56px diameter
- Positioned 16px from right and bottom edges
- Tapping opens chat bottom sheet

---

### 6. Chat Bottom Sheet

```
┌─────────────────────────────────────┐
│  ─────  (drag handle)              │
│                                     │
│  AI Research Assistant         [✕] │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Currently discussing:       │   │
│  │ "Mitochondrial efficiency.."│   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🤖 I can help you explore   │   │
│  │    this episode...          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 👤 What papers support the  │   │
│  │    current claim?           │   │
│  └─────────────────────────────┘   │
│                                     │
│         (scrollable area)          │
│                                     │
├─────────────────────────────────────┤
│  [Ask about this episode...]   [→] │
└─────────────────────────────────────┘
```

**Specs:**
- Height: ~85% viewport
- Header: "AI Research Assistant" + close button (✕)
- Context indicator shows current claim (tappable to clear)
- Scrollable message history
- Fixed input bar at bottom

**Behavior:**
- Drag to dismiss or tap ✕
- Input stays above keyboard when focused

---

## Design Patterns

| Pattern | Usage |
|---------|-------|
| **Bottom sheets** | All overlays (claim preview, chat, claims list) |
| **Tap-to-expand** | Progressive disclosure (player, claims list badge) |
| **Fixed positioning** | Header, player, and FAB always accessible |
| **Horizontal scroll** | Past claims strip for space efficiency |

---

## Implementation Notes

1. **Breakpoint detection:** Use Tailwind's `md:` prefix or a React hook to detect viewport width
2. **Bottom sheet component:** Consider using a library like `vaul` or building a custom sheet with Framer Motion
3. **Marquee animation:** CSS animation or a lightweight React marquee component
4. **Gesture handling:** Swipe-to-dismiss for bottom sheets, swipe on past claims strip

---

## Files to Modify

- `frontend/components/listening-view.tsx` - Main component, add mobile layout
- `frontend/components/noeron-header.tsx` - Add mobile variant with overflow menu
- `frontend/components/ai-chat.tsx` - Convert to bottom sheet on mobile
- New: `frontend/components/mobile/compact-player.tsx`
- New: `frontend/components/mobile/past-claims-strip.tsx`
- New: `frontend/components/mobile/claim-preview-sheet.tsx`
- New: `frontend/components/ui/bottom-sheet.tsx` (if not using a library)
