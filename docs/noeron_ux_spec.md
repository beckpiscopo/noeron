# Noeron: UX/UI Specification
## Research Companion for Podcast Learning

**Version:** 1.0  
**Date:** December 22, 2025  
**Project:** Gemini 3 Hackathon Demo

---

## Executive Summary

Noeron transforms passive podcast listening into active learning by providing real-time contextualization of scientific claims using RAG-powered research synthesis. The system bridges "Podcast Levin" (accessible explanations) with "Paper Levin" (technical research) through ambient augmentation and guided exploration.

**Core Value Proposition:** Reduce cognitive load for deep scientific understanding by curating progressive paths through complex research, synchronized with podcast content.

---

## Product Vision

### The Problem
Scientific podcasts make research accessible but lack depth. Listeners encounter undercontextualized claims and must choose between:
- Accepting claims at face value (incomplete understanding)
- Manual research (high friction, duplicated work)

### The Solution
An AI companion that:
1. Detects undercontextualized statements in real-time
2. Provides contextual synthesis from research papers
3. Enables guided exploration at user-controlled depth
4. Maintains connection to primary sources

### Success Metrics
- User can explain a concept more deeply after exploration
- Exploration history reveals learning patterns
- Users choose to dive deeper (engagement with exploration mode)

---

## User Journey

### Primary Persona
**The Curious Learner**
- Listens to scientific podcasts for intellectual enrichment
- Wants deeper understanding but lacks time for full paper reading
- Comfortable with technology, expects mobile-first experiences
- Values learning efficiency and cognitive accessibility

### Core User Flow
1. **Discovery:** User starts podcast episode (pre-integrated with Noeron)
2. **Ambient Augmentation:** Feed builds with contextualized insights as episode plays
3. **Curiosity Trigger:** User encounters interesting claim, wants to know more
4. **Active Exploration:** Pauses podcast, enters exploration mode
5. **Guided Learning:** Navigates through curated understanding layers
6. **Return:** Resumes podcast from exact point, enriched with new knowledge
7. **Trace:** Feed shows exploration history, creating learning map

---

## System Architecture

### Four Interaction Layers

#### Layer 1: Passive Listening
**State:** Podcast playing, user not actively interacting  
**Behavior:**
- Audio plays continuously
- Feed populates with timestamp-synced insights
- No user input required
- Visual design minimizes distraction

#### Layer 2: Active Questioning
**State:** User initiates chat interaction  
**Trigger:** User taps chat input or feed item  
**Behavior:**
- Podcast pauses automatically
- Chat interface becomes primary focus
- Gemini responds to free-form questions
- Context maintained from current podcast position

#### Layer 3: Curated Exploration
**State:** User navigates structured understanding layers  
**Trigger:** User taps "Dive Deeper" on feed item or chat response  
**Behavior:**
- Transitions to full exploration screen
- Progressive disclosure of complexity
- Concept cards reveal key dimensions
- Guided question prompts suggest paths
- Evidence threads enable branching navigation

#### Layer 4: Primary Sources
**State:** User accesses full research papers  
**Trigger:** User explicitly requests "View Source Paper"  
**Behavior:**
- Paper viewer opens (PDF or formatted text)
- Not emphasized in UI - available when needed
- Clear path back to exploration or podcast

---

## Screen Specifications

### Screen 1: Podcast + Feed (Main View)

**Layout:**
```
┌─────────────────────────┐
│   Podcast Controls      │ ← Top section (fixed)
│   [Play/Pause] [Scrub]  │
│   Episode Title         │
│   Timestamp: 12:34      │
├─────────────────────────┤
│                         │
│   Contextual Feed       │ ← Scrollable feed
│                         │
│   [12:15] Insight card  │ ← Timestamp-synced
│   "Levin mentions..."   │
│   [Dive Deeper]         │
│                         │
│   [14:32] Insight card  │ ← Future insights
│   [Not yet reached]     │ ← Grayed out
│                         │
│   [10:45] Insight card  │ ← Explored item
│   ✓ Explored            │ ← Visual indicator
│                         │
├─────────────────────────┤
│   [Chat input...]       │ ← Bottom fixed
└─────────────────────────┘
```

**Components:**

1. **Podcast Player** (Fixed top)
   - Play/pause button (primary action)
   - Scrubber with timestamp markers for insights
   - Current time / total duration
   - Episode title and metadata
   - Mini waveform visualization (optional enhancement)

2. **Contextual Feed** (Scrollable middle)
   - Reverse chronological (newest at bottom)
   - Each insight card contains:
     - Timestamp badge
     - Gemini-generated context (2-3 sentences)
     - "Dive Deeper" button
     - Visual state indicator (unexplored/explored/current)
   - Cards appear as podcast reaches their timestamp
   - Future insights visible but muted/grayed

3. **Chat Input** (Fixed bottom)
   - Text input field: "Ask about what you're hearing..."
   - Send button
   - Tapping focuses input and pauses podcast

**Interaction Behaviors:**

- **Scrubbing podcast:**
  - Feed scrolls/filters to show only insights up to current timestamp
  - Smooth animation as feed adjusts
  - User can scrub backwards to "rewind" understanding

- **Tapping insight card:**
  - Podcast pauses
  - Transition to Screen 2 (Exploration)
  - Card content becomes exploration anchor

- **Typing in chat:**
  - Podcast pauses automatically
  - Chat expands to show conversation history
  - Gemini responds with synthesis
  - Option to "Dive Deeper" appears after response

- **Exploration history:**
  - Explored items marked with checkmark
  - Color change (e.g., blue → gray)
  - Could show depth indicator (dots/progress bar)

**Visual Design Notes:**
- Mobile-first: optimized for one-handed use
- Feed cards: generous padding, clear typography
- Timestamp badges: high contrast, easy to scan
- "Dive Deeper" button: secondary style (not overwhelming)
- Exploration indicator: subtle but clear

---

### Screen 2: Deep Exploration

**Layout:**
```
┌─────────────────────────┐
│ ← Back to Podcast       │ ← Always visible
│ [Mini player: Paused]   │ ← Context reminder
├─────────────────────────┤
│   Anchor Claim          │ ← What triggered this
│   "At 12:15, Levin said │
│   bioelectric patterns  │
│   control morphogenesis"│
├─────────────────────────┤
│                         │
│   Understanding Layers  │ ← Progressive disclosure
│   [Currently: ELI5]     │
│                         │
│   Gemini Synthesis:     │
│   [Explanation at       │
│    current level]       │
│                         │
│   ▼ More Technical      │ ← Depth control
│   ▼ Show Me The Data    │
│                         │
├─────────────────────────┤
│   Concept Cards         │ ← Swipeable carousel
│   ┌───────┐ ┌───────┐  │
│   │ Key   │ │ Time  │  │
│   │ Exps  │ │ line  │  │
│   └───────┘ └───────┘  │
├─────────────────────────┤
│   Evidence Threads      │ ← Branching navigation
│   → Original experiment │
│   → Evolution over time │
│   → Related discoveries │
├─────────────────────────┤
│   Guided Prompts        │ ← Contextual questions
│   • "How was this      │
│     discovered?"        │
│   • "What are the      │
│     implications?"      │
├─────────────────────────┤
│   [View Source Paper]   │ ← Escape hatch
└─────────────────────────┘
```

**Components:**

1. **Navigation Header** (Fixed top)
   - Back button: "← Back to Podcast"
   - Mini player showing paused state and timestamp
   - Provides context: "You're exploring 12:15"

2. **Anchor Section**
   - The specific claim from podcast
   - Timestamp reference
   - Gemini's initial contextualization
   - Sets scope for entire exploration

3. **Progressive Disclosure Panel** (Main content)
   - Current depth level indicator
   - Gemini synthesis at current complexity
   - Depth control buttons (expand downward):
     - "More Technical Detail"
     - "Show Me The Data"
     - "Read The Paper"
   - Each level builds on previous
   - Collapsible sections (can hide previous levels)

4. **Concept Cards** (Horizontal scroll/swipe)
   - Multiple dimensions of understanding:
     - **Key Experiments:** Major studies that established this
     - **Timeline:** How understanding evolved (1993 → 2025)
     - **Related Concepts:** Connected ideas in Levin's work
     - **Model Systems:** Organisms where this was studied
     - **Mechanisms:** How it actually works
   - Each card tappable to expand into sub-exploration
   - Visual icons for each category

5. **Evidence Threads** (Vertical list)
   - Branching paths through research:
     - "Original Experiment" → Takes to foundational study
     - "How This Evolved" → Timeline view
     - "Related Work" → Connected discoveries
     - "Contradictory Findings" → Challenges/debates
   - Each thread opens new exploration context
   - Breadcrumb shows path taken

6. **Guided Prompts** (Contextual suggestions)
   - 3-5 suggested questions based on:
     - Current depth level
     - User's exploration history
     - Content of current insight
   - Changes as user goes deeper:
     - Surface: "How was this discovered?"
     - Mid: "What are the experimental methods?"
     - Deep: "What are the limitations?"
   - Tapping prompt → Gemini responds → Can spawn new exploration

7. **Source Access** (Bottom)
   - "View Source Paper" button
   - Not visually emphasized
   - Opens paper viewer (Layer 4)

**Interaction Behaviors:**

- **Depth progression:**
  - Start at ELI5 by default
  - Each "More X" click reveals next level
  - Previous levels stay visible but collapsed
  - Can jump between levels
  - Content regenerates based on depth

- **Concept card interaction:**
  - Swipe to browse cards
  - Tap to expand in-place or full-screen
  - Expanded card shows detailed synthesis
  - Can dive into any concept (becomes new anchor)

- **Evidence thread navigation:**
  - Tapping thread loads new exploration view
  - Breadcrumb trail: "Morphogenesis > Original Experiment > Nuccitelli 1977"
  - Can backtrack through breadcrumbs
  - History preserved (can return to any point)

- **Guided prompt interaction:**
  - Tap prompt → Inline Gemini response
  - Response appears in context
  - New prompts suggested based on response
  - Can lead to opening new threads

**State Management:**
- Exploration creates a **session tree**
- Each dive creates a node
- User can navigate tree structure
- History preserved for return visits
- Could visualize as mind map (future enhancement)

**Visual Design Notes:**
- Clear visual hierarchy: anchor > synthesis > exploration tools
- Progressive disclosure prevents overwhelming
- Generous whitespace between sections
- Depth indicator shows "how deep you are"
- Consistent color coding: primary source = one color, synthesis = another

---

### Screen 3: Paper Viewer (Primary Sources)

**Layout:**
```
┌─────────────────────────┐
│ ← Back to Exploration   │
│ Paper Title             │
│ Authors, Year, Journal  │
├─────────────────────────┤
│                         │
│   [PDF Viewer]          │
│   or                    │
│   [Formatted Text]      │
│                         │
│   Scrollable content    │
│                         │
├─────────────────────────┤
│ Highlight relevant      │
│ sections based on       │
│ exploration context     │
└─────────────────────────┘
```

**Purpose:**
- Escape hatch for users who want full source
- Not the primary path
- Provides academic credibility

**Features:**
- Paper rendered from GROBID-processed content
- Sections highlighted based on exploration context
- Jump to specific sections referenced
- Download/share options
- Citation information

**Interaction:**
- Always clear path back to exploration
- Can annotate/save (future feature)
- Deep link to specific sections

---

## Key Interaction Patterns

### Timestamp Synchronization

**Behavior:**
The feed maintains strict synchronization with podcast playback:

1. **Forward playback:**
   - New insights appear as podcast reaches their timestamp
   - Smooth fade-in animation
   - Feed auto-scrolls to show latest

2. **Scrubbing backwards:**
   - Feed filters to only show insights ≤ current timestamp
   - Future insights gray out/hide
   - Smooth transition, not jarring

3. **Scrubbing forward:**
   - Previously hidden insights reappear
   - Maintains explored/unexplored state
   - No loss of history

**Technical consideration:**
- Insights pre-generated with precise timestamps
- Client-side filtering based on playback position
- ~100ms update frequency for smoothness

---

### Exploration State Tracking

**What gets tracked:**
- Which insights were explored
- Depth reached in each exploration
- Which concept cards were opened
- Which evidence threads were followed
- Time spent in each exploration

**Visual indicators:**
- ✓ Explored (binary: yes/no)
- Depth meter: ⚫⚫⚫⚪⚪ (how deep they went)
- Topic tags: colored badges for categories explored

**Purpose:**
- Learning trace: shows user's intellectual journey
- Adaptive suggestions: system learns interests
- Resume capability: can return to deep explorations
- Analytics: understand engagement patterns

---

### Pause/Resume Flow

**Critical requirement:** Seamless return to listening

**Pause triggers:**
1. User taps chat input
2. User taps "Dive Deeper"
3. User manually pauses player

**During pause:**
- Podcast state frozen at exact timestamp
- Mini player shows paused state
- Visual reminder of "where you are"

**Resume options:**
1. Tap "Back to Podcast" → returns to Screen 1, auto-resumes
2. Tap mini player → same behavior
3. Close exploration → same behavior

**Edge cases:**
- If user explores for >X minutes, prompt: "Resume from 12:15 or current position?"
- If podcast ends during exploration, offer restart or related episodes

---

### Progressive Disclosure Strategy

**Depth Levels:**

1. **ELI5 (Default start)**
   - Accessible language
   - Conceptual understanding
   - Analogies and metaphors
   - ~2-3 paragraphs

2. **More Technical**
   - Scientific terminology introduced
   - Mechanism explanation
   - Key researchers and dates
   - ~4-5 paragraphs

3. **Show Me The Data**
   - Experimental methods
   - Specific results and figures
   - Statistical significance
   - ~6-8 paragraphs

4. **Read The Paper**
   - Links to full source
   - Relevant sections highlighted
   - Full academic context

**Principles:**
- Each level assumes understanding of previous
- Can skip levels (advanced users)
- Content regenerated, not just expanded
- Always maintain connection to original claim

---

## Content Generation Strategy

### Feed Insights (Pre-processed)

**Input:** Podcast transcript with timestamps

**Process:**
1. Segment transcript into semantic chunks
2. For each chunk, Gemini identifies:
   - Undercontextualized claims
   - Technical terms needing explanation
   - References to research/experiments
3. Generate 2-3 sentence contextualization
4. Attach timestamp and metadata
5. Store as structured JSON

**Example insight:**
```json
{
  "timestamp": "12:15",
  "trigger_phrase": "bioelectric patterns control morphogenesis",
  "context": "Levin is referencing 30+ years of research showing that electrical signals between cells guide body plan development. This challenges the gene-centric view of how organisms form.",
  "paper_ids": ["levin_2003_bioelectric", "levin_2021_review"],
  "exploration_seeds": {
    "key_experiments": ["planarian_regeneration", "frog_eye_relocation"],
    "concepts": ["morphogenetic_fields", "bioelectric_code"],
    "timeline": [1993, 2003, 2014, 2021]
  }
}
```

### Exploration Content (On-demand)

**Input:** 
- Selected insight
- User's requested depth level
- Exploration history (for personalization)

**Process:**
1. Retrieve relevant paper chunks from RAG
2. Gemini synthesizes based on:
   - Current depth level
   - User's background (inferred from history)
   - Connection to original podcast claim
3. Generate concept cards, evidence threads, guided prompts
4. Return structured response

**Caching strategy:**
- Common paths pre-generated
- Novel questions generated on-demand
- User-specific adaptations cached per session

---

## Technical Specifications

### Data Models

**Podcast Episode:**
```typescript
interface PodcastEpisode {
  id: string;
  title: string;
  duration: number; // seconds
  audioUrl: string;
  transcript: TranscriptSegment[];
  insights: FeedInsight[];
}
```

**Feed Insight:**
```typescript
interface FeedInsight {
  id: string;
  timestamp: number; // seconds
  triggerPhrase: string;
  contextSummary: string;
  paperIds: string[];
  explorationSeeds: ExplorationSeeds;
  explored: boolean;
  explorationDepth?: number; // 1-4
}
```

**Exploration Session:**
```typescript
interface ExplorationSession {
  insightId: string;
  startTime: Date;
  currentDepth: number;
  breadcrumbs: BreadcrumbNode[];
  openedCards: string[];
  followedThreads: string[];
  chatHistory: ChatMessage[];
}
```

### API Endpoints

**GET /api/episode/:id**
- Returns full episode data including transcript and pre-generated insights

**GET /api/insights/:insightId/explore**
- Query params: `depth` (1-4), `session_id`
- Returns exploration content at requested depth

**POST /api/chat**
- Body: `{ insightId, message, sessionId }`
- Returns Gemini response with optional exploration suggestions

**GET /api/papers/:paperId**
- Returns formatted paper content from GROBID JSON

**POST /api/exploration/track**
- Body: exploration event data
- Updates user's learning trace

### Component Architecture

**React component tree:**
```
<App>
  <PodcastProvider>
    <ExplorationProvider>
      <Router>
        <PodcastFeedView>
          <PodcastPlayer />
          <InsightFeed>
            <InsightCard />
          </InsightFeed>
          <ChatInput />
        </PodcastFeedView>
        
        <ExplorationView>
          <ExplorationHeader />
          <AnchorClaim />
          <ProgressiveDisclosure>
            <DepthLevel />
          </ProgressiveDisclosure>
          <ConceptCards>
            <ConceptCard />
          </ConceptCards>
          <EvidenceThreads>
            <Thread />
          </EvidenceThreads>
          <GuidedPrompts />
        </ExplorationView>
        
        <PaperView>
          <PaperHeader />
          <PaperContent />
        </PaperView>
      </Router>
    </ExplorationProvider>
  </PodcastProvider>
</App>
```

---

## Open Questions & Future Considerations

### For Hackathon Scope

**Must decide:**
1. Which podcast episode to use?
   - Lex Fridman interview with Levin?
   - Shorter format for demo (10-15 min segment)?
2. How many insights to pre-generate?
   - Full episode or selected highlights?
3. Demo format:
   - Live interaction or scripted walkthrough?
   - Judge-driven or presenter-driven?

**Can defer:**
- Multi-episode support
- User accounts and persistence
- Mobile app deployment (web app sufficient)
- Advanced analytics

### Beyond Hackathon

**Enhancements:**
- Multi-modal: include figures/diagrams from papers
- Social: share exploration paths
- Personalization: adapt to user's expertise level
- Expanded corpus: beyond Levin to broader bioelectricity
- YouTube integration: work with any video content
- Citation network visualization
- Collaborative exploration: multiple users on same episode

**Open research questions:**
- Optimal depth progression (3 levels vs 5?)
- Best visual metaphor for exploration history
- How to handle contradictory claims across papers
- Measuring learning outcomes

---

## Success Criteria

### Demo Success
- Judges understand the vision
- System responds to 3+ different exploration paths
- No critical bugs during demo
- Clear differentiation from "just a chatbot"

### Product Success
- Users spend more time in exploration than just listening
- Explored insights correlated with better comprehension (quiz)
- Users return to continue exploring
- Positive feedback on cognitive load reduction

### Technical Success
- Response time <2s for exploration requests
- RAG retrieval precision >0.8
- Gemini synthesis quality rated >4/5 by domain experts
- System handles edge cases gracefully

---

## Implementation Priorities

### P0 (Must have for demo)
- Podcast player with basic controls
- Feed with 5-10 pre-generated insights
- Timestamp synchronization (basic)
- One complete exploration path
- Progressive disclosure (2-3 levels)
- Gemini synthesis working

### P1 (Should have for compelling demo)
- Concept cards (2-3 per insight)
- Evidence threads (2-3 per insight)
- Exploration state tracking
- Chat functionality
- Smooth transitions between screens

### P2 (Nice to have)
- Guided prompts
- Advanced timestamp sync
- Paper viewer
- Exploration history visualization
- Polish and animations

---

## Appendix: Design Principles

1. **Ambient Intelligence:** Enrich, don't interrupt
2. **Progressive Depth:** User controls complexity
3. **Cognitive Efficiency:** Reduce load, don't add it
4. **Preserve Context:** Never lose your place
5. **Curated Discovery:** Guide, don't just answer
6. **Primary Sources:** Always available, never forced
7. **Learning Traces:** Make growth visible
8. **Mobile First:** One-handed operation default

---

**End of Specification**