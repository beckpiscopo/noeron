"""
Context Builder for Noeron Chat

Builds layered context for Gemini chat that provides:
1. Episode awareness (metadata, summary, key topics)
2. Temporal synchronization (current playback position, transcript window)
3. Evidence cards integration (papers shown at current timestamp)
4. RAG retrieval context (query-triggered paper retrieval)

This enables the chat to be deeply aware of what the user is listening to
and what evidence cards are currently visible.
"""

import json
from pathlib import Path
from typing import Optional, Any
from dataclasses import dataclass, field
from datetime import timedelta

# ============================================================================
# Configuration
# ============================================================================

DATA_DIR = Path(__file__).parent.parent.parent / "data"
EPISODES_FILE = DATA_DIR / "episodes.json"
WINDOW_SEGMENTS_FILE = DATA_DIR / "window_segments.json"
CONTEXT_CARD_REGISTRY_FILE = DATA_DIR / "context_card_registry.json"

# Window configuration
TEMPORAL_WINDOW_SIZE_MS = 180_000  # 3 minutes in milliseconds
EVIDENCE_CARD_LOOKBACK_MS = 300_000  # 5 minutes lookback for active cards


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class EpisodeContext:
    """Layer 1: Episode metadata and narrative context."""
    episode_id: str
    title: str
    podcast: str
    guest: str
    host: str
    duration: str
    date: str
    description: str
    key_topics: list[str] = field(default_factory=list)
    episode_summary: Optional[str] = None  # Extended summary if available


@dataclass
class TemporalWindow:
    """Layer 2: Current temporal window context."""
    current_timestamp_ms: int
    current_timestamp_str: str
    window_start_ms: int
    window_end_ms: int
    window_start_str: str
    window_end_str: str
    transcript_excerpt: str
    speakers: list[str] = field(default_factory=list)
    context_tags: list[str] = field(default_factory=list)


@dataclass
class EvidenceCard:
    """A single evidence card with paper information."""
    card_id: str
    timestamp_ms: int
    timestamp_str: str
    claim_text: str
    distilled_claim: Optional[str]
    paper_title: str
    paper_id: str
    source_link: str
    section: str
    rationale: str
    confidence_score: float
    context_tags: dict[str, str] = field(default_factory=dict)
    claim_type: Optional[str] = None


@dataclass
class ActiveEvidenceCards:
    """Layer 3: Evidence cards active in the current time range."""
    cards: list[EvidenceCard] = field(default_factory=list)
    time_range_start_str: str = ""
    time_range_end_str: str = ""


@dataclass
class ChatContextLayers:
    """Complete layered context for chat."""
    episode: EpisodeContext
    temporal_window: Optional[TemporalWindow]
    evidence_cards: ActiveEvidenceCards
    rag_context: Optional[str] = None  # Added by RAG query if triggered


# ============================================================================
# Utility Functions
# ============================================================================

def ms_to_timestamp_str(ms: int) -> str:
    """Convert milliseconds to HH:MM:SS format."""
    total_seconds = ms // 1000
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60

    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"


def timestamp_str_to_ms(timestamp: str) -> int:
    """Convert timestamp string to milliseconds.

    Handles formats:
    - "HH:MM:SS.mmm" (e.g., "00:48:00.160")
    - "MM:SS" (e.g., "23:45")
    - "HH:MM:SS" (e.g., "1:23:45")
    """
    # Remove any subsecond parts first
    if "." in timestamp:
        timestamp = timestamp.split(".")[0]

    parts = timestamp.split(":")

    if len(parts) == 2:
        # MM:SS format
        minutes, seconds = int(parts[0]), int(parts[1])
        return (minutes * 60 + seconds) * 1000
    elif len(parts) == 3:
        # HH:MM:SS format
        hours, minutes, seconds = int(parts[0]), int(parts[1]), int(parts[2])
        return (hours * 3600 + minutes * 60 + seconds) * 1000
    else:
        return 0


def parse_window_timestamp(timestamp_str: str) -> int:
    """Parse window segment timestamp to milliseconds.

    Handles format: "00:00:00.160"
    """
    if not timestamp_str:
        return 0

    # Split on period for subseconds
    parts = timestamp_str.split(".")
    time_part = parts[0]
    subseconds_ms = int(parts[1]) if len(parts) > 1 else 0

    # Parse HH:MM:SS
    time_parts = time_part.split(":")
    if len(time_parts) == 3:
        hours, minutes, seconds = int(time_parts[0]), int(time_parts[1]), int(time_parts[2])
        return (hours * 3600 + minutes * 60 + seconds) * 1000 + subseconds_ms

    return 0


# ============================================================================
# Data Loaders
# ============================================================================

def load_episodes() -> list[dict]:
    """Load episode metadata from JSON file."""
    if not EPISODES_FILE.exists():
        return []

    with EPISODES_FILE.open() as f:
        return json.load(f)


def load_window_segments(episode_id: str) -> list[dict]:
    """Load temporal window segments for an episode.

    Checks for episode-specific file first, then falls back to default.
    """
    # Try episode-specific file
    episode_specific = DATA_DIR / f"window_segments_{episode_id}.json"
    if episode_specific.exists():
        with episode_specific.open() as f:
            return json.load(f)

    # Fall back to default (lex_325)
    if WINDOW_SEGMENTS_FILE.exists():
        with WINDOW_SEGMENTS_FILE.open() as f:
            return json.load(f)

    return []


def load_context_card_registry() -> dict:
    """Load the context card registry with all evidence cards."""
    if not CONTEXT_CARD_REGISTRY_FILE.exists():
        return {"segments": {}}

    with CONTEXT_CARD_REGISTRY_FILE.open() as f:
        return json.load(f)


# ============================================================================
# Context Builders
# ============================================================================

def build_episode_context(episode_id: str) -> Optional[EpisodeContext]:
    """Build Layer 1: Episode metadata context."""
    episodes = load_episodes()
    episode = next((e for e in episodes if e.get("id") == episode_id), None)

    if not episode:
        return None

    # Extract key topics from description if not provided
    key_topics = episode.get("topics", [])
    if not key_topics and episode.get("description"):
        # Simple topic extraction from description
        desc = episode.get("description", "")
        # These are common research areas in Levin's work
        topic_keywords = [
            "bioelectricity", "morphogenesis", "regeneration", "xenobots",
            "collective intelligence", "planaria", "embryogenesis",
            "voltage gradients", "memory", "cognition", "pattern formation"
        ]
        key_topics = [t for t in topic_keywords if t.lower() in desc.lower()]

    return EpisodeContext(
        episode_id=episode_id,
        title=episode.get("title", ""),
        podcast=episode.get("podcast", ""),
        guest=episode.get("guest", "Unknown Guest"),
        host=episode.get("host", "Unknown Host"),
        duration=episode.get("duration", ""),
        date=episode.get("date", ""),
        description=episode.get("description", ""),
        key_topics=key_topics,
        episode_summary=episode.get("summary")  # None if not available
    )


def build_temporal_window(
    episode_id: str,
    current_timestamp_ms: int
) -> Optional[TemporalWindow]:
    """Build Layer 2: Temporal window context.

    Finds the window segment that contains the current timestamp and returns
    the transcript excerpt and metadata.
    """
    windows = load_window_segments(episode_id)

    if not windows:
        return None

    # Find the window containing the current timestamp
    matching_window = None
    for window in windows:
        start_ms = window.get("start_ms", 0)
        end_ms = window.get("end_ms", 0)

        if start_ms <= current_timestamp_ms <= end_ms:
            matching_window = window
            break

    # If no exact match, find closest previous window
    if not matching_window:
        for window in reversed(windows):
            if window.get("start_ms", 0) <= current_timestamp_ms:
                matching_window = window
                break

    if not matching_window:
        return None

    # Extract speakers from utterances
    speakers = list(set(
        u.get("speaker", "")
        for u in matching_window.get("utterances", [])
        if u.get("speaker")
    ))

    return TemporalWindow(
        current_timestamp_ms=current_timestamp_ms,
        current_timestamp_str=ms_to_timestamp_str(current_timestamp_ms),
        window_start_ms=matching_window.get("start_ms", 0),
        window_end_ms=matching_window.get("end_ms", 0),
        window_start_str=matching_window.get("start_timestamp", ""),
        window_end_str=matching_window.get("end_timestamp", ""),
        transcript_excerpt=matching_window.get("text", ""),
        speakers=speakers,
        context_tags=[]  # Could be derived from claims in this window
    )


def build_active_evidence_cards(
    episode_id: str,
    current_timestamp_ms: int,
    lookback_ms: int = EVIDENCE_CARD_LOOKBACK_MS
) -> ActiveEvidenceCards:
    """Build Layer 3: Active evidence cards in time range.

    Returns evidence cards that appeared within the lookback window
    from the current timestamp.
    """
    registry = load_context_card_registry()
    segments = registry.get("segments", {})

    # Calculate time range
    range_start_ms = max(0, current_timestamp_ms - lookback_ms)
    range_end_ms = current_timestamp_ms

    active_cards: list[EvidenceCard] = []

    # Iterate through all segments looking for cards in our time range
    for segment_key, segment_data in segments.items():
        # Skip segments without RAG results
        rag_results = segment_data.get("rag_results", [])
        if not rag_results:
            continue

        # Check if this segment matches our episode
        if not segment_key.startswith(episode_id):
            continue

        # Parse the segment timestamp
        timestamp_str = segment_data.get("timestamp", "")
        if not timestamp_str:
            continue

        segment_timestamp_ms = parse_window_timestamp(timestamp_str)

        # Check if segment is in our time range
        if not (range_start_ms <= segment_timestamp_ms <= range_end_ms):
            continue

        # Extract claims and their matched papers
        claims = segment_data.get("claims", [])

        for i, rag_result in enumerate(rag_results):
            # Get corresponding claim text if available
            claim_text = rag_result.get("claim_text", "")
            if not claim_text and i < len(claims):
                claim_text = claims[i] if isinstance(claims[i], str) else claims[i].get("claim_text", "")

            card = EvidenceCard(
                card_id=f"{segment_key}-{i}",
                timestamp_ms=segment_timestamp_ms,
                timestamp_str=timestamp_str,
                claim_text=claim_text,
                distilled_claim=rag_result.get("distilled_claim"),
                paper_title=rag_result.get("paper_title", ""),
                paper_id=rag_result.get("paper_id", ""),
                source_link=rag_result.get("source_link", ""),
                section=rag_result.get("section", ""),
                rationale=rag_result.get("rationale", ""),
                confidence_score=rag_result.get("confidence_score", 0.0),
                context_tags=rag_result.get("context_tags", {}),
                claim_type=rag_result.get("claim_type")
            )
            active_cards.append(card)

    # Sort by timestamp (most recent first)
    active_cards.sort(key=lambda c: c.timestamp_ms, reverse=True)

    return ActiveEvidenceCards(
        cards=active_cards,
        time_range_start_str=ms_to_timestamp_str(range_start_ms),
        time_range_end_str=ms_to_timestamp_str(range_end_ms)
    )


# ============================================================================
# Main Context Builder
# ============================================================================

def build_chat_context(
    episode_id: str,
    current_timestamp_ms: Optional[int] = None,
    current_timestamp_str: Optional[str] = None
) -> Optional[ChatContextLayers]:
    """Build complete layered context for chat.

    Args:
        episode_id: The podcast episode ID (e.g., "lex_325")
        current_timestamp_ms: Current playback position in milliseconds
        current_timestamp_str: Alternatively, timestamp as string (e.g., "23:45")

    Returns:
        ChatContextLayers with all context layers, or None if episode not found
    """
    # Convert timestamp if needed
    if current_timestamp_ms is None and current_timestamp_str:
        current_timestamp_ms = timestamp_str_to_ms(current_timestamp_str)

    if current_timestamp_ms is None:
        current_timestamp_ms = 0

    # Build Layer 1: Episode context
    episode = build_episode_context(episode_id)
    if not episode:
        return None

    # Build Layer 2: Temporal window
    temporal_window = build_temporal_window(episode_id, current_timestamp_ms)

    # Build Layer 3: Active evidence cards
    evidence_cards = build_active_evidence_cards(episode_id, current_timestamp_ms)

    return ChatContextLayers(
        episode=episode,
        temporal_window=temporal_window,
        evidence_cards=evidence_cards
    )


# ============================================================================
# System Prompt Generator
# ============================================================================

def format_evidence_cards_for_prompt(cards: list[EvidenceCard], max_cards: int = 5) -> str:
    """Format evidence cards for inclusion in system prompt."""
    if not cards:
        return "No evidence cards currently active in this segment."

    formatted = []
    for card in cards[:max_cards]:
        tags_str = ", ".join(f"{k}: {v}" for k, v in card.context_tags.items()) if card.context_tags else "N/A"

        formatted.append(f"""
📄 Card {card.card_id} (appeared at {card.timestamp_str})
   Paper: {card.paper_title}
   Claim: {card.distilled_claim or card.claim_text[:100] + '...' if len(card.claim_text) > 100 else card.claim_text}
   Section: {card.section}
   Confidence: {card.confidence_score:.0%}
   Context: {tags_str}
   Citation link: [View paper]({card.source_link})
""")

    if len(cards) > max_cards:
        formatted.append(f"\n   ... and {len(cards) - max_cards} more cards in this time range")

    return "\n".join(formatted)


def build_system_prompt(context: ChatContextLayers) -> str:
    """Build the complete system prompt with all context layers.

    Token budget estimate:
    - Episode metadata: ~300 tokens
    - Episode summary: ~200 tokens (if available)
    - Temporal window: ~800 tokens
    - Evidence cards: ~600 tokens (5 cards max)
    - Instructions: ~400 tokens
    Total: ~2300 tokens base (leaves room for RAG and conversation)
    """
    # Layer 1: Episode metadata
    episode = context.episode
    episode_section = f"""## Episode Context
Podcast: {episode.podcast}
Episode: {episode.title}
Guest: {episode.guest} (interviewed by {episode.host})
Duration: {episode.duration}
Date: {episode.date}

Description: {episode.description}
"""

    if episode.key_topics:
        episode_section += f"\nKey Topics: {', '.join(episode.key_topics)}"

    if episode.episode_summary:
        episode_section += f"\n\nEpisode Summary:\n{episode.episode_summary}"

    # Layer 2: Temporal window
    temporal_section = ""
    if context.temporal_window:
        tw = context.temporal_window
        temporal_section = f"""
## Current Position in Episode
Timestamp: {tw.current_timestamp_str}
Current window: {tw.window_start_str} - {tw.window_end_str}

Recent discussion (transcript excerpt):
\"\"\"
{tw.transcript_excerpt[:2000]}{'...' if len(tw.transcript_excerpt) > 2000 else ''}
\"\"\"
"""

    # Layer 3: Evidence cards
    cards_section = f"""
## Active Evidence Cards ({context.evidence_cards.time_range_start_str} - {context.evidence_cards.time_range_end_str})
{format_evidence_cards_for_prompt(context.evidence_cards.cards)}
"""

    # Layer 4: RAG context (added separately if query triggers RAG)
    rag_section = ""
    if context.rag_context:
        rag_section = f"""
## Additional Retrieved Papers
{context.rag_context}
"""

    # Instructions
    instructions = """
## Your Role
You are a research assistant for Noeron, helping users explore Michael Levin's bioelectricity research while they listen to podcasts.

## Capabilities
1. **Explain concepts** from the episode using both conversational and academic context
2. **Reference specific papers** from the evidence cards shown above (cite with paper title)
3. **Connect ideas** to the broader research corpus
4. **Surface relevant moments** by referring to timestamps in the transcript
5. **Distinguish** between Levin's conversational explanations and formal research findings

## Guidelines
- When user asks "what paper?" or "source?", reference the active evidence cards shown above
- Use timestamp-aware context: "At {timestamp}, Levin mentioned..."
- Keep responses concise (2-3 paragraphs) unless user asks for depth
- Cite papers by title when referencing specific findings
- Clearly distinguish speculation from published findings

## Response Format
- Lead with direct answer to user's question
- Add relevant context from papers/transcript
- Optionally suggest: related question, deeper exploration, or cross-reference
"""

    return f"""You are an expert research assistant for Noeron, a bioelectricity podcast companion app.

{episode_section}
{temporal_section}
{cards_section}
{rag_section}
{instructions}
"""


# ============================================================================
# Main Entry Point for Chat
# ============================================================================

async def get_chat_context_and_prompt(
    episode_id: str,
    current_timestamp_str: Optional[str] = None,
    current_timestamp_ms: Optional[int] = None
) -> tuple[Optional[ChatContextLayers], str]:
    """Get the chat context and formatted system prompt.

    This is the main entry point for the chat system.

    Returns:
        Tuple of (context_layers, system_prompt)
        If episode not found, returns (None, fallback_prompt)
    """
    context = build_chat_context(
        episode_id=episode_id,
        current_timestamp_ms=current_timestamp_ms,
        current_timestamp_str=current_timestamp_str
    )

    if not context:
        # Fallback for unknown episodes
        fallback_prompt = """You are an expert research assistant for Noeron, a bioelectricity podcast companion app.

The user is exploring content related to Michael Levin's bioelectricity research. Help them understand concepts, find relevant papers, and explore the science.

Guidelines:
- Be concise and informative
- Cite papers when referencing specific findings
- Distinguish speculation from published findings
"""
        return (None, fallback_prompt)

    system_prompt = build_system_prompt(context)
    return (context, system_prompt)


# ============================================================================
# Testing / CLI
# ============================================================================

if __name__ == "__main__":
    import sys

    # Test with default values
    episode_id = sys.argv[1] if len(sys.argv) > 1 else "lex_325"
    timestamp = sys.argv[2] if len(sys.argv) > 2 else "48:00"

    print(f"Building context for {episode_id} at {timestamp}...")
    print("=" * 80)

    context = build_chat_context(
        episode_id=episode_id,
        current_timestamp_str=timestamp
    )

    if context:
        print(f"Episode: {context.episode.title}")
        print(f"Guest: {context.episode.guest}")

        if context.temporal_window:
            print(f"\nTemporal Window: {context.temporal_window.window_start_str} - {context.temporal_window.window_end_str}")
            print(f"Transcript excerpt: {context.temporal_window.transcript_excerpt[:200]}...")

        print(f"\nActive Evidence Cards: {len(context.evidence_cards.cards)}")
        for card in context.evidence_cards.cards[:3]:
            print(f"  - {card.paper_title[:50]}... (at {card.timestamp_str})")

        print("\n" + "=" * 80)
        print("SYSTEM PROMPT:")
        print("=" * 80)
        prompt = build_system_prompt(context)
        print(prompt[:3000] + "..." if len(prompt) > 3000 else prompt)
    else:
        print(f"Episode {episode_id} not found")
