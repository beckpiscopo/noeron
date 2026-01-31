# Deep Exploration Page Tabbed Redesign

**Goal:** Transform the deep exploration page from a cramped multi-column layout to a clean single-column tabbed interface that gives each content section room to breathe.

**Current Problems:**
- Too much content crammed onto one page
- Figures, knowledge graph, and evidence threads compete for space
- Users must click paper titles to see figures (hidden behind interaction)
- No clear hierarchy or progressive disclosure

---

## Design Decisions

### Layout
- **Single column** layout (max-width container, centered)
- **Segmented control tabs** (boxed style, equal-width segments with subtle dividers)
- **Variable height** content per tab, page scrolls naturally
- **Sticky tab bar** - tabs stick to header when scrolled past claim card
- **Chat sidebar** remains, slides in from right on large screens

### Tab Structure
1. **Overview** - Synthesis and confidence metrics
2. **Evidence Threads** - Research narrative timelines
3. **Paper Figures** - Visual evidence with relevance analysis
4. **Knowledge Graph** - Interactive concept map
5. **Create with AI** - Generation tools (audio, notes, quiz, etc.)

### Figure Display (Key Change)
- Show **top 3-5 most relevant figures** prominently (pre-computed analysis)
- Each figure shows: image, caption, relevance to claim, paper link
- **Progressive disclosure**: "Show all figures" expands to remaining figures
- No API key needed to browse; relevance pre-computed during evidence thread generation

---

## Page Structure

```
┌──────────────────────────────────────────────────┐
│  Header: Back to Podcast | Episode Title | Time  │  (sticky)
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─ Claim Card ───────────────────────────────┐  │
│  │  [Claim Type]  @ 12:34                     │  │
│  │                                            │  │
│  │  "Bioelectricity controls morphogenesis"   │  │
│  │                                            │  │
│  │  👤 Michael Levin • assertion              │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────┬──────────┬─────────┬───────┬───────┐ │
│  │Overview│ Evidence │ Figures │ Graph │Create │ │  (sticky on scroll)
│  └────────┴──────────┴─────────┴───────┴───────┘ │
│                                                  │
│  ┌─ Tab Content ──────────────────────────────┐  │
│  │                                            │  │
│  │  (variable height, page scrolls)           │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Tab Contents

### Overview Tab
- Synthesis section with simplified/technical toggle
- Confidence metrics (score, consensus percentage, evidence counts)
- Sources retrieved list (papers used in synthesis)
- Existing functionality, reorganized

### Evidence Threads Tab
- AI-generated narrative research arcs
- Timeline milestones grouped by thread type:
  - Experimental validation
  - Theoretical framework
  - Mechanism discovery
  - Cross-domain
- Clickable paper titles open paper viewer

### Paper Figures Tab
**Top Relevant Figures (3-5):**
- Large figure image
- Caption from paper
- Pre-computed relevance explanation
- Link to source paper

**Expanded View:**
- "Show all figures from evidence papers"
- Grid of additional figures (image + caption only)
- Lighter weight, for exploration

### Knowledge Graph Tab
- Full-width interactive ConceptExpansionGraph
- Entity nodes with descriptions
- Relationship edges with evidence
- Click nodes to explore connections
- Finally has room to be useful

### Create with AI Tab
Grid of creation option cards:
- 🎧 **Audio Overview** - Mini podcast explaining the claim
- 📝 **Study Notes** - Structured notes for learning
- ❓ **Quiz** - Test understanding of the claim
- 📊 **Slides** - Presentation slides (future)

Click a card to generate. Output appears below the grid.

---

## Component Architecture

```
deep-exploration-view.tsx (refactored)
├── ClaimCard (extracted component)
│   └── Claim title, quote, speaker, timestamp, type badge
│
├── DeepExplorationTabs (new container)
│   ├── SegmentedTabBar (new)
│   │   └── Sticky behavior, active state styling
│   │
│   ├── OverviewTab
│   │   ├── SynthesisSection (existing logic)
│   │   ├── ConfidenceMetrics (existing)
│   │   └── SourcesList (existing)
│   │
│   ├── EvidenceTab
│   │   └── EvidenceThreadsSection (existing logic)
│   │
│   ├── FiguresTab (new)
│   │   ├── RelevantFigureCard (new)
│   │   │   └── Image, caption, relevance, paper link
│   │   ├── ShowAllFiguresButton
│   │   └── AllFiguresGrid (expandable)
│   │
│   ├── GraphTab
│   │   └── ConceptExpansionGraph (existing, now full-width)
│   │
│   └── CreateTab (new)
│       └── CreateWithAIGrid
│           ├── CreationCard (reusable)
│           └── GeneratedOutput (conditional)
│
└── AIChatSidebar (unchanged)
```

---

## Backend Changes

### New Endpoint: Get Relevant Figures for Claim
```
POST /tools/get_claim_figures/execute
{
  "claim_id": "episode_id|timestamp-idx",
  "limit": 5
}

Response:
{
  "claim_id": "...",
  "figures": [
    {
      "figure_id": "fig_1",
      "paper_id": "abc123",
      "paper_title": "...",
      "image_url": "https://...",
      "caption": "...",
      "relevance": "This figure shows voltage patterns that directly demonstrate the claim about bioelectric signaling...",
      "relevance_score": 0.92
    }
  ],
  "total_available": 12
}
```

### Pre-computation Job
- When evidence threads are generated, also analyze figures from those papers
- Store `relevance` and `relevance_score` in figures metadata
- Can batch-process existing evidence threads

---

## Tab Bar Styling

Segmented control style (per Dribbble reference):

```css
.tab-bar {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 0; /* Sharp corners for Noeron aesthetic */
  overflow: hidden;
}

.tab {
  flex: 1;
  padding: 12px 16px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  border-right: 1px solid var(--border);
  background: transparent;
  transition: background 0.2s;
}

.tab:last-child {
  border-right: none;
}

.tab.active {
  background: var(--golden-chestnut-10);
  color: var(--golden-chestnut);
}

.tab-bar.sticky {
  position: sticky;
  top: 56px; /* Below header */
  z-index: 30;
  background: var(--background);
}
```

---

## Migration Path

1. **Phase 1: Layout refactor**
   - Extract ClaimCard component
   - Create tab container with placeholder content
   - Move existing sections into their tabs
   - Verify nothing breaks

2. **Phase 2: Figures tab**
   - Create new endpoint for claim-relevant figures
   - Build FiguresTab with top figures display
   - Add progressive disclosure (show all)

3. **Phase 3: Create tab**
   - Build creation cards grid
   - Move mini podcast into Audio Overview card
   - Add placeholders for future creation types

4. **Phase 4: Polish**
   - Sticky tab behavior
   - Transitions between tabs
   - Mobile responsiveness (tabs may need horizontal scroll or dropdown)

---

## Success Criteria

- [ ] Single column layout with segmented tabs
- [ ] Claim card visible at top, tabs become sticky on scroll
- [ ] Each tab content has room to breathe
- [ ] Figures tab shows top 3-5 relevant figures with pre-computed analysis
- [ ] "Show all figures" expands to remaining figures
- [ ] Knowledge graph is full-width and interactive
- [ ] Create tab shows grid of generation options
- [ ] Chat sidebar still works (slides in from right)
- [ ] Mobile responsive (tabs accessible on small screens)
