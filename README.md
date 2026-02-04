# Noeron: AI Research Companion for Science Podcasts

**Epistemological Bridging Between Podcasts and Papers**

An AI-powered research companion that uses Google Gemini 3 to connect podcast content with academic literature in real-time. Built for the Gemini 3 Hackathon to demonstrate how AI can make deep science accessible without duplicating cognitive labor across thousands of listeners.

[![Gemini 3](https://img.shields.io/badge/Gemini%203-Pro-blue)](https://ai.google.dev/gemini-api/docs/gemini-3)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## The Problem

Science podcast listeners encounter undercontextualized claims and want deeper understanding, but reading dense academic papers is prohibitively difficult. Current solutions force each listener to duplicate the same research effort independently - a massive waste of cognitive labor.

**Example:** When Michael Levin says "bioelectric patterns control morphogenesis" on Lex Fridman #325, what papers support this? What experiments proved it? Where can I learn more?

## The Solution: Infrastructure for Understanding

Noeron creates **epistemological bridges** - connecting informal podcast explanations with formal scientific literature. One person's deep synthesis becomes reusable infrastructure for thousands of listeners, just like physical infrastructure serves many users.

### What Noeron Does

- **Live Research Stream**: Shows relevant papers in real-time as you listen to podcasts
- **Context Cards**: AI-generated summaries linking specific claims to supporting research
- **Deep Dive Exploration**: Explore claims with evidence threads, supporting papers, and related concepts
- **AI Chat with Thinking Traces**: Chat with an AI that shows its reasoning process in real-time
- **AI Image Generation**: Generate scientific visualizations with `/visualize` or `/image` commands
- **Mini Podcasts**: Generate NotebookLM-style two-host discussions about any claim
- **Slide Deck Generation**: Create AI-generated presentations with visual slides for any claim
- **Research Notebooks**: Save and organize claims, papers, snippets, and AI insights
- **Knowledge Cartography**: Visualize research territories with taxonomy clusters
- **Quiz Mode**: Test your understanding of podcast content
- **Mobile-First Design**: Responsive UI optimized for listening on the go

Think of it as having a research assistant who has already read every paper the podcast guest references.

## Why Gemini 3?

Noeron showcases Gemini 3's unique capabilities for scientific reasoning:

1. **Long Context Window (1M tokens)** 
   - Loads entire podcast transcripts + 150+ bioelectricity papers
   - Maintains context across multi-hour interviews

2. **Context Caching** 
   - Processes paper corpus once, queries thousands of times
   - Enables real-time responses during podcast playback

3. **Enhanced Reasoning with Thinking Levels**
   - Detects nuanced scientific claims in natural speech
   - Synthesizes evidence across contradictory findings
   - Generates accurate context cards without hallucination

4. **Multimodal Understanding**
   - Analyzes experimental figures from papers
   - Processes video timestamps from YouTube interviews
   - Extracts insights from diagrams and visualizations

5. **Structured Output Generation**
   - Creates context cards with proper citations
   - Builds knowledge graphs linking claims to evidence
   - Maintains provenance tracking for all information

## Demo

> **[Demo Video](https://youtu.be/YOUR_VIDEO_ID)** - See Noeron in action

**Key Features Demonstrated:**
- Live Research Stream showing papers as Levin speaks
- Deep dive into "bioelectric patterns" claim with evidence threads
- AI chat with real-time thinking traces
- Mini podcast generation explaining complex concepts
- Knowledge cartography showing research territory coverage
- Mobile-responsive listening experience

**Try it yourself:** [Live Demo](https://noeron.app) (requires Gemini API key)

## Hackathon Submission

**Built for:** [Gemini 3 Global Hackathon](https://gemini3.devpost.com/)  
**Category:** Education & Scientific Literacy  
**Gemini 3 Integration:** Core reasoning engine using context caching, multimodal analysis, and structured outputs with thinking levels

### Impact Potential

**Addressable Market:** 10-30M monthly listeners in deep science podcast ecosystem  
**Problem Solved:** Eliminates duplicated research effort across thousands of learners  
**Scalability:** One synthesis → many users (infrastructure model)

## Key Features

### 1. Live Research Stream
Real-time paper recommendations synchronized with podcast playback.

```python
# As podcast plays, Noeron identifies claims and surfaces papers
process_podcast_segment(
    transcript_window="I think bioelectric patterns...",
    timestamp="00:45:23"
)
# Returns: Relevant papers with specific sections highlighted
```

### 2. AI-Powered Context Cards

Gemini 3 detects claims, retrieves supporting research, and generates scannable summaries.

```python
# Two-pass Gemini approach:
# Pass 1: Detect claims with context tags
claims = detect_claims(transcript_segment, use_gemini=True)
# Example: "Bioelectric patterns control morphogenesis"
#          Tags: [organism: planaria, mechanism: gap_junctions]

# Pass 2: Generate research queries and retrieve papers
for claim in claims:
    papers = rag_search(claim.generate_query())
    context_card = create_context_card(claim, papers)
```

**Context Card Output:**
```json
{
  "claim": "Bioelectric patterns control morphogenesis",
  "timestamp": "00:45:23",
  "supporting_evidence": [
    {
      "paper_id": "levin_2014_bioelectric",
      "relevance": "Primary experimental validation",
      "key_finding": "Ion channel manipulation altered planarian head shape"
    }
  ],
  "summary": "Planarian experiments show bioelectric signals determine body structure",
  "confidence": "high"
}
```

### 3. Research Thread Visualization

Trace how scientific understanding evolved over time.

```python
build_research_thread(
    topic="bioelectric morphogenesis",
    year_range=(1993, 2025)
)
# Shows: Initial observations → Experimental validation → 
#        Molecular mechanisms → Current applications
```

### 4. Cross-Episode Synthesis

Find common themes across multiple podcast appearances.

```python
synthesize_episodes([
    "lex_fridman_325",
    "sean_carroll_203", 
    "jim_rutt_165"
])
# Gemini 3 identifies: recurring themes, evolving ideas, 
#                     contradictions explained over time
```

### 5. Interactive Q&A with Thinking Traces

Chat with an AI that has read the podcast transcript and all referenced papers. See Gemini 3's reasoning process in real-time via SSE streaming.

```python
answer_question(
    question="How do gap junctions enable collective intelligence?",
    context=["transcript", "papers", "figures"]
)
# Uses Gemini 3's enhanced reasoning to synthesize answer
# Shows thinking traces: "Let me consider the bioelectric signaling..."
```

### 6. AI Image Generation

Generate scientific visualizations directly in chat.

```bash
# Explicit commands
/visualize cell membrane voltage gradients
/image planarian regeneration process

# Natural language
"Show me a diagram of bioelectric pattern formation"
```

### 7. Mini Podcast Generation

Generate NotebookLM-style two-host discussions about any claim.

```python
generate_mini_podcast(
    claim_id="claim_123",
    episode_id="lex_325",
    style="educational"
)
# Returns: 3-5 minute audio with ALEX and SAM discussing the claim
# Uses Gemini 3 for script + Gemini 2.5 TTS for multi-speaker audio
```

### 8. Slide Deck Generation

Create presentation slide decks with AI-generated visuals for any claim.

```python
generate_slide_deck(
    claim_id="claim_123",
    episode_id="lex_325",
    style="presenter"  # or "detailed"
)
# Returns: PDF with 5-12 slides, thumbnail previews, shareable link
# Uses Gemini 3 for content + Imagen for slide visuals
```

**Two Styles:**
- **Presenter** (5-7 slides): Clean visuals with key points for live presentation
- **Detailed** (8-12 slides): Comprehensive deck to share without narration

**Features:**
- Progress indicator with 4 stages (Planning → Content → Visuals → Assembly)
- Thumbnail carousel with click-to-expand lightbox
- Community sharing toggle
- Persists across page refreshes

### 9. Research Notebooks

Save and organize your research journey with bookmarks for:
- Claims with evidence threads
- Paper snippets with highlights
- AI-generated insights and images
- Episode moments

### 10. Knowledge Cartography

Visualize the research landscape with taxonomy clusters:
- 8-12 "research territories" from GMM clustering
- See which territories each episode covers
- Track your exploration progress
- Discover new areas to explore

## Architecture

### Data Pipeline

```
Podcasts/Interviews
       ↓
[AssemblyAI Transcription]
       ↓
[Speaker Diarization]
       ↓
[Window Segmentation] (60s chunks with 10s overlap)
       ↓
[Gemini 3: Claim Detection] ← thinking_level='medium'
       ↓
[RAG: Paper Retrieval] ← Supabase pgvector + Gemini embeddings
       ↓
[Gemini 3: Context Synthesis] ← thinking_level='high', context_caching
       ↓
[Context Card Registry]
       ↓
[User Interface]
```

### Gemini 3 Integration Points

```python
# 1. Claim Detection (with thinking)
model = genai.GenerativeModel('gemini-3-flash-preview')
claims = model.generate_content(
    f"Detect scientific claims in: {transcript}",
    generation_config=genai.GenerationConfig(
        thinking_level='medium',
        response_mime_type='application/json'
    )
)

# 2. Context Card Generation (with cached corpus)
cache = genai.caching.CachedContent.create(
    model='gemini-3-pro-preview',
    contents=bioelectricity_papers,  # 150+ papers
    ttl=datetime.timedelta(hours=1)
)

context_card = model.generate_content(
    f"Synthesize evidence for: {claim}",
    cached_content=cache,
    generation_config=genai.GenerationConfig(
        thinking_level='high'
    )
)

# 3. Multimodal Figure Analysis
response = model.generate_content([
    "Extract experimental protocol from this figure:",
    {'mime_type': 'image/jpeg', 'data': figure_bytes}
])
```

### Vector Search Pipeline

```
Papers (150+ on bioelectricity)
       ↓
[GROBID: PDF → Structured JSON]
       ↓
[Section Detection: Methods, Results, Discussion]
       ↓
[Chunking] (400 tokens, 50 token overlap, tiktoken)
       ↓
[Embedding: Gemini text-embedding-004] (768 dimensions)
       ↓
[Supabase pgvector] (production) / [ChromaDB] (local dev)
       ↓
[RAG Search] ← Query from Gemini claim detection
```

## Installation

### Prerequisites
- Python 3.10+
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- Node.js 18+ with pnpm
- Google Gemini API key ([get one free](https://ai.google.dev))
- Supabase project (for production) or local mode for development
- AssemblyAI API key (for transcript generation, optional)
- ffmpeg (for audio processing, optional)

### Quick Start

```bash
# Clone repository
git clone https://github.com/beckpiscopo/bioelectricity_researcher
cd bioelectricity_researcher

# Install Python dependencies with uv
uv sync

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys:
# - GEMINI_API_KEY (required for all AI features)
# - SUPABASE_URL and SUPABASE_SERVICE_KEY (for production)
# - ASSEMBLYAI_API_KEY (for transcript generation)
```

### BYOK (Bring Your Own Key)

Users must provide their own Gemini API key to use AI features. The app redirects to the settings page (`/settings`) on first use where users can enter their API key. Keys are stored securely in the browser's localStorage.

First-time users who sign in via magic link are prompted to set a display name before continuing.

### Build Vector Store

```bash
# Process papers into vector database
python scripts/build_vector_store.py

# Verify corpus
python scripts/validate_corpus.py
```

### Generate Context Cards

```bash
# Process a podcast episode
python scripts/fetch_assemblyai_transcript.py \
  --youtube-url "https://youtube.com/watch?v=..." \
  --paper-id lex_325 \
  --title "Lex Fridman #325"

# Generate context cards for all segments
python scripts/run_context_card_builder_batch.py \
  --podcast-id lex_325 \
  --episode-title "Lex Fridman #325" \
  --use-gemini \
  --redo
```

### Run the Application

```bash
# Start the backend HTTP server
uv run python -m src.bioelectricity_research.http_server

# In another terminal, start the Next.js frontend
cd frontend
pnpm install
pnpm dev
```

Visit `http://localhost:3000`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI features |
| `SUPABASE_URL` | Production | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Production | Supabase service role key |
| `USE_SUPABASE` | No | Set to `false` for local development (default: `true`) |
| `ASSEMBLYAI_API_KEY` | Optional | For generating new transcripts |

## Current Corpus

### Papers
- **150+ papers** on bioelectricity, morphogenesis, regeneration
- **Date range:** 1993-2025 (Michael Levin's complete work)
- **Topics:** Gap junctions, ion channels, pattern formation, xenobots, collective intelligence

### Podcasts/Interviews
- Lex Fridman #325 (Michael Levin) - Full episode with claims
- Theories of Everything (Michael Levin) - Preview episode
- Additional episodes in pipeline

### Processing Stats
- **Total chunks:** ~15,000
- **Average chunk size:** 400 tokens
- **Embedding model:** Gemini text-embedding-004 (768 dimensions)
- **Taxonomy clusters:** 8-12 research territories via GMM clustering
- **Storage:** Supabase pgvector (production) / ChromaDB (local)

## UI/UX Design

### Four Interaction Layers

1. **Passive Listening** 
   - Timestamp-synced context cards appear automatically
   - No interruption to podcast flow

2. **Active Questioning**
   - Chat interface for follow-up questions
   - Gemini 3 reasons over transcript + papers

3. **Curated Exploration**
   - Browse research threads by topic
   - Progressive disclosure of complexity

4. **Primary Sources**
   - Direct links to papers
   - Highlighted relevant sections

### Design Philosophy
- **Mobile-first:** Designed for podcast listening scenarios
- **Progressive disclosure:** Show simple summaries, hide complexity
- **Provenance tracking:** Always cite sources clearly
- **Minimal cognitive load:** 10-15 word scannable summaries

## Project Structure

```
bioelectricity-research-mcp-v2/
├── agents/                         # Gemini-powered reasoning agents
│   └── verification_agent.py       # Claim verification logic
├── data/
│   ├── papers_collection.json      # Metadata for all papers
│   ├── cleaned_papers/             # Processed, chunkable JSON
│   ├── grobid_fulltext/            # Raw GROBID extraction
│   ├── vectorstore/                # ChromaDB persistence (local mode)
│   ├── context_card_registry.json  # Generated context cards
│   ├── episodes.json               # Episode metadata
│   ├── episode_summaries.json      # AI-generated summaries
│   ├── window_segments.json        # Transcript temporal windows
│   └── knowledge_graph/            # Entity-relation extractions
├── scripts/
│   ├── build_vector_store.py       # Chunk and embed papers
│   ├── build_taxonomy_clusters.py  # GMM clustering for knowledge cartography
│   ├── fetch_assemblyai_transcript.py
│   ├── context_card_builder.py     # Gemini claim → RAG → card
│   ├── generate_episode_summaries.py
│   ├── supabase_client.py          # Database client
│   └── migrate_to_supabase_full.py # Data migration
├── src/
│   ├── bioelectricity_research/
│   │   ├── server.py               # FastMCP server + MCP tools
│   │   ├── http_server.py          # REST API adapter
│   │   ├── context_builder.py      # Layered chat context system
│   │   ├── vector_store.py         # ChromaDB/Supabase pgvector
│   │   └── storage.py              # Paper CRUD operations
│   ├── chunking_papers.py          # Tiktoken-based chunking
│   └── embeddings.py               # Gemini embedding utilities
├── frontend/                       # Next.js application
│   ├── app/
│   │   ├── page.tsx                # Landing page
│   │   ├── library/page.tsx        # Episode library
│   │   ├── episode/[id]/page.tsx   # Episode player
│   │   ├── notebook/[id]/page.tsx  # Notebook view
│   │   └── api/                    # API proxy routes
│   ├── components/
│   │   ├── listening-view.tsx      # Podcast player with live research
│   │   ├── deep-exploration-view.tsx # Claim deep dive
│   │   ├── episode-overview.tsx    # Episode summary + clusters
│   │   ├── notebook-view.tsx       # Research notebook
│   │   ├── mini-podcast-player.tsx # AI podcast player
│   │   ├── taxonomy-bubble-map.tsx # Knowledge cartography
│   │   ├── quiz-mode.tsx           # Interactive quizzes
│   │   ├── ai-chat/                # AI chat components
│   │   └── mobile/                 # Mobile-optimized components
│   ├── hooks/
│   │   └── use-ai-chat.ts          # Chat state management
│   └── lib/
│       ├── supabase.ts             # Supabase client + types
│       └── chat-types.ts           # TypeScript interfaces
├── supabase/
│   ├── migrations/                 # Database schema migrations
│   └── schema.sql                  # Full schema reference
├── cache/                          # Runtime caches
│   └── generated_podcasts.json     # Mini podcast cache
├── tests/
└── docs/
    ├── ARCHITECTURE.md             # System architecture
    ├── pipeline.md                 # Data flow documentation
    ├── TAXONOMY_CLUSTERS.md        # Clustering system guide
    └── DEPLOYMENT.md               # Deployment instructions
```

## Testing

```bash
# Run unit tests
pytest tests/

# Validate context card quality
python scripts/validate_context_card_registry.py

# Test RAG search accuracy
python tests/test_rag_accuracy.py
```

## Future Roadmap

### Phase 2 (Post-Hackathon)
- [ ] YouTube video integration (visual timestamps)
- [ ] Expand to other bioelectricity researchers
- [ ] Citation network visualization
- [ ] Notion/Obsidian export

### Phase 3 (Product Vision)
- [ ] Multi-podcast support (Huberman, Carroll, Rutt)
- [ ] Community-contributed context cards
- [ ] Mobile app (iOS/Android)
- [ ] Browser extension for YouTube

### Phase 4 (Scale)
- [ ] Generalize beyond bioelectricity
- [ ] Platform for any science podcast
- [ ] Become "the infrastructure for deep learning"

## Impact Metrics

**For Researchers:**
- Time saved: 2-4 hours per paper lookup → 30 seconds
- Accessibility: Makes cutting-edge research understandable

**For Podcast Listeners:**
- 10-30M monthly listeners in deep science podcasts
- Each context card used by thousands (infrastructure effect)

**For Science Communication:**
- Bridges the gap between accessible and rigorous
- Enables deeper engagement without academic gatekeeping

## Gemini 3 Competitive Advantages

This project demonstrates Gemini 3's superiority for scientific reasoning:

1. **vs. GPT-4**: Better long-context understanding for paper corpus
2. **vs. Claude**: More structured output for context cards
3. **vs. Gemini 2.5**: Enhanced reasoning eliminates hallucinations
4. **Unique to Gemini 3**: Context caching makes this economically viable

**Cost Efficiency:**
- Without caching: $50+ per 1000 queries
- With Gemini 3 caching: $2 per 1000 queries (25x reduction)

## Documentation

- **[Architecture Overview](docs/ARCHITECTURE.md)** - System design and component details
- **[Pipeline Documentation](docs/pipeline.md)** - Complete data flow
- **[Taxonomy Clusters](docs/TAXONOMY_CLUSTERS.md)** - Knowledge cartography implementation
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[LLM Context](docs/LLM_CONTEXT.md)** - Context for AI development assistance

## Contributing

This project is currently in hackathon mode, but contributions welcome after Feb 9, 2026!

## License

MIT License - See [LICENSE](LICENSE) for details

## Acknowledgments

- **Michael Levin** - For pioneering bioelectricity research
- **Google DeepMind** - For Gemini 3 API
- **AssemblyAI** - For podcast transcription
- **Semantic Scholar** - For paper metadata

## Contact

**Beck Piscopo**
- Website: [beckpiscopo.xyz](https://beckpiscopo.xyz)
- X: [@beckpiscopo](https://x.com/beckpiscopo)
- Project Link: [github.com/beckpiscopo/bioelectricity_researcher](https://github.com/beckpiscopo/bioelectricity_researcher)

---

**Built with care for the Gemini 3 Global Hackathon**

> "Epistemological infrastructure: Where one person's deep understanding becomes reusable knowledge for thousands."