# Landing Page Redesign

## Overview

Redesign the Noeron landing page from the current 8-section pitch deck style to a cinematic, product-forward experience optimized for hackathon judges. The new design leads with a stunning product visualization and tells a focused story: what we built → why Gemini 3 makes it possible → how it works → see it in action.

## Goals

- **Impress hackathon judges** with both product vision and technical substance
- **Cinematic aesthetic** - dark mode first, premium feel, copper accents
- **Leaner narrative** - 4 sections instead of 8
- **Highlight Gemini 3** prominently as the enabling technology

## Design Principles

- Dark mode first, light mode supported
- Cohesive aesthetic throughout (no contrasting section styles)
- Product visualization as the hero moment
- Scannable technical content for judges reviewing quickly

## Color Palette

```
Primary accent:     #C48B60 (copper/bronze)
Secondary accent:   #be5a38 (vermillion)
Background dark:    #121212
Surface dark:       #1E1E1E
Text dark:          #E0E0E0
Text muted:         #A0A0A0
Border dark:        #333333
```

---

## Section 1: Hero

**Purpose:** "Here's what we built" - lead with the product

### Layout
- Full viewport height
- Centered content with 3D app mockup below headline
- Bio-texture background (subtle grid + radial copper glow)

### Content

**Badge:**
```
● EPISTEMOLOGICAL INFRASTRUCTURE // V 3.0
```
Pulsing copper dot, monospace text, pill-shaped border

**Headline:**
```
The knowledge layer for podcasts.
```
- "The" and "for podcasts." in bold sans-serif (white)
- "knowledge layer" in italic serif with copper color (#C48B60)

**Subhead:**
```
Real-time synchronization between conversation and research.
Parsing audio streams. Verifying facts. Generating knowledge graphs.
```
Monospace, muted gray, two lines

**CTAs:**
- "Start Researching" - primary copper button
- "Watch Demo" - secondary outline button with play icon

### Product Mockup

3D tilted browser window using CSS transforms:
```css
transform: rotateX(20deg) rotateY(0deg) rotateZ(-4deg) scale(0.95);
```

**Mockup content (three panels):**

1. **Left panel - Podcast Player**
   - Album art / waveform visualization
   - "Biology, Life, Aliens, Evolution & Xenobots"
   - Episode 325
   - Host: Lex Fridman, Guest: Michael Levin
   - Playback controls and progress bar

2. **Center panel - Research Stream**
   - Header: "Research Stream" with "Claims Extracted As You Listen"
   - Primary claim card (pop-out effect):
     - Tag: "MECHANISM"
     - Title: "Evolution reprograms bodies by changing signals, not physical hardware"
     - Quote from transcript
     - Confidence: 80%
     - "Dive Deeper" button
   - Secondary claim card (faded, shows depth)

3. **Right panel - Research Assistant**
   - Header: "RESEARCH ASSISTANT / AI-Powered Analysis"
   - User question bubble
   - AI response with bullet points about bio-electric mechanisms
   - Source citation pill
   - Suggested prompts at bottom

**Pop-out card effect:**
```css
transform: translateZ(80px) scale(1.05) translateX(-20px) translateY(-10px);
box-shadow: -30px 40px 60px rgba(0,0,0,0.8);
```

---

## Section 2: Powered by Gemini 3

**Purpose:** "Here's the AI making it possible"

### Layout
- Full viewport height
- Header with optional "25× COST REDUCTION" badge
- 2x2 capability cards grid
- Two-pass architecture diagram below

### Header
```
POWERED BY GEMINI 3
```
Section label in copper, large bold title

### Capability Cards (2x2 grid)

| Card | Title | Value | Description |
|------|-------|-------|-------------|
| 1 | 1M Token Context | 150+ Papers | Load entire podcast transcripts alongside the full research corpus in a single context window |
| 2 | Context Caching | $2 / 1K queries | Process the paper corpus once, then query thousands of times — making real-time responses economically viable |
| 3 | Thinking Levels | Medium → High | Adaptive reasoning depth: fast claim detection with medium thinking, deep synthesis with high thinking |
| 4 | Structured Outputs | JSON Schema | Generate context cards with proper citations, confidence scores, and provenance tracking automatically |

Each card: icon + title + value + description

### Two-Pass Architecture Diagram

Dark card container with copper accents:

```
┌─────────────────────────────────────────────────────────────────┐
│  TWO-PASS GEMINI ARCHITECTURE                                   │
│                                                                 │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │ 01 Claim Detection  │  →   │ 02 Context Synthesis │          │
│  │                     │      │                      │          │
│  │ gemini-3-flash      │      │ gemini-3-pro + cache │          │
│  │ thinking: 'medium'  │      │ thinking: 'high'     │          │
│  │ input: 60s window   │      │ cached: 150+ papers  │          │
│  │ output: claims+tags │      │ output: cards+cites  │          │
│  └─────────────────────┘      └──────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Section 3: Technical Stack

**Purpose:** "Here's how it all fits together"

### Layout
- Full viewport height
- Two-column: pipeline (left), tech specs (right)
- Header with "MCP PROTOCOL" badge

### Header
```
TECHNICAL STACK                              [MCP PROTOCOL]
```

### Left Column: Data Pipeline

Vertical flow with connected nodes:

```
01 ● INGEST      → Semantic Scholar + ArXiv
   │
02 ● EXTRACT     → GROBID TEI Processing
   │
03 ● TRANSCRIBE  → AssemblyAI + Diarization
   │
04 ● CHUNK       → 400 tokens / 50 overlap
   │
05 ● EMBED       → Gemini text-embedding-004
   │
06 ● INDEX       → Supabase pgvector
   │
07 ● DETECT      → Gemini Claim Extraction
   │
08 ● VERIFY      → RAG + Citation Scoring
```

Alternating copper/vermillion node colors for visual rhythm.

### Right Column: Tech Specs

**Stack Cards (2x2):**
| Label | Value | Description |
|-------|-------|-------------|
| Backend | Python + FastMCP | MCP protocol server with HTTP adapter |
| Frontend | Next.js + React | Real-time sync via API proxy routes |
| Vector Store | Supabase pgvector | Persistent embeddings + metadata |
| AI Engine | Gemini 3 Pro | Claim detection + synthesis |

**Stats Row (3 columns):**
- 500+ Papers Indexed
- < 3s Query Latency
- 768 Embedding Dims

**MCP Tools List:**
- ● rag_search (primary)
- ○ save_paper
- ○ save_author_papers
- ○ get_saved_paper
- ○ list_saved_papers
- ● rag_stats (primary)

---

## Section 4: Demo Video

**Purpose:** "See it in action"

### Layout
- Full viewport height
- Centered, minimal - let the video breathe
- Clean footer with hackathon attribution

### Content

**Headline:**
```
SEE IT IN ACTION
```
Optional subhead: "3 minute walkthrough"

**Video:**
- 16:9 aspect ratio, centered
- Large size (max-width ~900px)
- Clean border treatment
- Play button overlay for thumbnail state

**Timestamp Markers:**
```
00:00 — Podcast begins
00:45 — First claim detected
01:30 — Research surfaces
02:15 — Knowledge graph generates
03:00 — Cross-episode connections
```

**CTAs:**
- "Try Live Demo" (primary copper)
- "View on GitHub →" (secondary outline)

**Footer:**
```
</> Built for Gemini 3 Global Hackathon
```

---

## Implementation Notes

### File Structure

Create new landing page component without touching the original:
```
frontend/components/landing-page-v2.tsx    # New landing page
frontend/components/landing-page.tsx       # Original (untouched)
```

### Navigation

Keep existing nav structure:
- Logo: "Noeron"
- Right side: Theme toggle + "Access Demo →" button
- Remove the middle nav links (Product, Methodology, Pricing, About) for cleaner hackathon version

### Scrolling Behavior

Change from horizontal slider to vertical scroll:
- Remove the dot navigation
- Full viewport sections with smooth scroll-snap
- Standard vertical scrolling experience

### Responsive Considerations

- Hero mockup: Hide right panel on tablet, hide left+right on mobile (show center only)
- Capability cards: 2x2 on desktop, 1 column on mobile
- Tech stack: Stack columns vertically on mobile
- Pipeline: Simplify to vertical list on mobile

### Assets Needed

- Video embed (YouTube/Vimeo or self-hosted)
- Podcast artwork image for mockup (or keep placeholder)

### Starter Code

Reference the provided HTML file for:
- 3D transform values
- Bio-texture background CSS
- Pop-out card effect
- Color values and gradients

Location: `/Users/beckpiscopo/Downloads/stitch_noeron_hero_cinematic_split_layout/code.html`
