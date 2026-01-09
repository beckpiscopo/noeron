"""
Episode Summary Generator

Generates rich narrative summaries for podcast episodes using Gemini.
Produces structured summaries containing:
- Narrative arc (3-5 paragraphs describing the conversation flow)
- Major themes and how they evolve
- Key moments with timestamps
- Guest's main arguments and thesis

This enables the Noeron chat to understand "what this episode is about"
beyond just metadata, and connect current discussion to the broader narrative.
"""

import json
import os
import argparse
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from pathlib import Path

try:
    from google import genai  # type: ignore[import]
except ImportError:
    genai = None


# =============================================================================
# Configuration
# =============================================================================

DATA_DIR = Path(__file__).parent.parent / "data"
EPISODES_FILE = DATA_DIR / "episodes.json"
SUMMARIES_FILE = DATA_DIR / "episode_summaries.json"

# Gemini model - use flash for cost efficiency on long transcripts
DEFAULT_MODEL = "gemini-2.0-flash"


# =============================================================================
# Prompt Template
# =============================================================================

EPISODE_SUMMARY_PROMPT = """You are analyzing a podcast episode transcript to create a rich narrative summary for a research companion app.

The app helps users explore Michael Levin's bioelectricity research while listening to podcasts. Users need to understand:
1. What this episode is about (narrative arc)
2. How themes evolve through the conversation
3. Key moments worth referencing
4. The guest's main arguments and thesis

===EPISODE METADATA===
Podcast: {podcast}
Title: {title}
Guest: {guest}
Host: {host}
Duration: {duration}
Date: {date}

===FULL TRANSCRIPT===
{transcript}

===YOUR TASK===

Generate a structured summary with the following sections:

## 1. NARRATIVE_ARC (3-5 paragraphs)
Write a flowing narrative that describes the conversation arc. Include:
- How the conversation opens and what sets the tone
- Major topic transitions and how ideas build on each other
- The intellectual journey from start to finish
- How the conversation concludes

## 2. MAJOR_THEMES (list of 4-6 themes)
For each theme, provide:
- theme_name: Short name (2-4 words)
- description: What this theme is about (1-2 sentences)
- evolution: How this theme develops through the episode
- timestamps: Approximate time ranges where this theme is discussed (e.g., "10:00-25:00, 1:45:00-2:00:00")

## 3. KEY_MOMENTS (list of 5-8 moments)
Identify pivotal moments in the conversation. For each:
- timestamp: Approximate timestamp (e.g., "23:45")
- description: What happens at this moment (1-2 sentences)
- significance: Why this moment matters
- quote: A brief representative quote (if applicable)

## 4. GUEST_THESIS
Summarize the guest's main arguments and worldview as expressed in this episode:
- core_thesis: The central argument or perspective (2-3 sentences)
- key_claims: List of 3-5 major claims or positions
- argumentation_style: How does the guest build their case? (e.g., through examples, analogies, research findings)
- intellectual_influences: Any referenced thinkers, fields, or frameworks

## 5. CONVERSATION_DYNAMICS
Brief analysis of how the conversation flows:
- host_approach: How does the host engage with the material?
- memorable_exchanges: 1-2 notable back-and-forth moments
- tone: Overall tone of the conversation

===OUTPUT FORMAT===

Return a valid JSON object with this exact structure:
{{
  "narrative_arc": "Multi-paragraph text...",
  "major_themes": [
    {{
      "theme_name": "...",
      "description": "...",
      "evolution": "...",
      "timestamps": "..."
    }}
  ],
  "key_moments": [
    {{
      "timestamp": "...",
      "description": "...",
      "significance": "...",
      "quote": "..."
    }}
  ],
  "guest_thesis": {{
    "core_thesis": "...",
    "key_claims": ["...", "..."],
    "argumentation_style": "...",
    "intellectual_influences": "..."
  }},
  "conversation_dynamics": {{
    "host_approach": "...",
    "memorable_exchanges": "...",
    "tone": "..."
  }}
}}

IMPORTANT: Return ONLY valid JSON. No markdown code blocks, no explanation text."""


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class Theme:
    """A major theme in the episode."""
    theme_name: str
    description: str
    evolution: str
    timestamps: str


@dataclass
class KeyMoment:
    """A key moment in the episode."""
    timestamp: str
    description: str
    significance: str
    quote: Optional[str] = None


@dataclass
class GuestThesis:
    """The guest's main arguments and worldview."""
    core_thesis: str
    key_claims: List[str]
    argumentation_style: str
    intellectual_influences: str


@dataclass
class ConversationDynamics:
    """Analysis of how the conversation flows."""
    host_approach: str
    memorable_exchanges: str
    tone: str


@dataclass
class EpisodeSummary:
    """Complete structured summary of an episode."""
    episode_id: str
    narrative_arc: str
    major_themes: List[Theme]
    key_moments: List[KeyMoment]
    guest_thesis: GuestThesis
    conversation_dynamics: ConversationDynamics

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "episode_id": self.episode_id,
            "narrative_arc": self.narrative_arc,
            "major_themes": [asdict(t) for t in self.major_themes],
            "key_moments": [asdict(m) for m in self.key_moments],
            "guest_thesis": asdict(self.guest_thesis),
            "conversation_dynamics": asdict(self.conversation_dynamics),
        }

    def to_compact_string(self) -> str:
        """Generate a compact string summary for chat context."""
        # Narrative arc
        output = f"## Episode Overview\n{self.narrative_arc}\n\n"

        # Major themes
        output += "## Major Themes\n"
        for theme in self.major_themes:
            output += f"- **{theme.theme_name}** ({theme.timestamps}): {theme.description}\n"
        output += "\n"

        # Key moments
        output += "## Key Moments\n"
        for moment in self.key_moments:
            output += f"- [{moment.timestamp}] {moment.description}"
            if moment.quote:
                output += f' ("{moment.quote[:80]}...")'
            output += "\n"
        output += "\n"

        # Guest thesis
        output += f"## Guest's Core Thesis\n{self.guest_thesis.core_thesis}\n\n"
        output += "Key claims:\n"
        for claim in self.guest_thesis.key_claims[:4]:
            output += f"- {claim}\n"

        return output


# =============================================================================
# Transcript Loader
# =============================================================================

def load_transcript(episode_id: str) -> Optional[str]:
    """Load and concatenate the full transcript for an episode.

    Args:
        episode_id: Episode ID (e.g., "lex_325")

    Returns:
        Full transcript text, or None if not found
    """
    # Try episode-specific file first
    episode_file = DATA_DIR / f"window_segments_{episode_id}.json"
    if not episode_file.exists():
        # Fall back to default (lex_325)
        if episode_id == "lex_325":
            episode_file = DATA_DIR / "window_segments.json"
        else:
            return None

    if not episode_file.exists():
        return None

    with episode_file.open() as f:
        windows = json.load(f)

    # Build transcript with timestamps
    transcript_parts = []
    seen_text = set()  # Avoid duplicating overlapping windows

    for window in windows:
        timestamp = window.get("start_timestamp", "00:00:00")
        text = window.get("text", "")

        # Skip if we've seen most of this text (due to overlap)
        text_key = text[:200]
        if text_key in seen_text:
            continue
        seen_text.add(text_key)

        # Format with timestamp marker
        transcript_parts.append(f"[{timestamp}]\n{text}\n")

    return "\n".join(transcript_parts)


def load_episode_metadata(episode_id: str) -> Optional[Dict[str, Any]]:
    """Load episode metadata from episodes.json."""
    if not EPISODES_FILE.exists():
        return None

    with EPISODES_FILE.open() as f:
        episodes = json.load(f)

    return next((e for e in episodes if e.get("id") == episode_id), None)


# =============================================================================
# Summary Generator
# =============================================================================

class EpisodeSummaryGenerator:
    """Generate rich narrative summaries for podcast episodes."""

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        """Initialize with Gemini API."""
        if genai is None:
            raise ImportError("google-genai package required. Install with: pip install google-genai")

        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable required")

        self.model_name = model_name or os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
        self.client = genai.Client(api_key=self.api_key)

    def generate_summary(self, episode_id: str) -> Optional[EpisodeSummary]:
        """Generate a structured summary for an episode.

        Args:
            episode_id: Episode ID (e.g., "lex_325")

        Returns:
            EpisodeSummary object, or None if failed
        """
        # Load transcript
        transcript = load_transcript(episode_id)
        if not transcript:
            print(f"Error: Could not load transcript for {episode_id}")
            return None

        # Load metadata
        metadata = load_episode_metadata(episode_id)
        if not metadata:
            print(f"Error: Could not load metadata for {episode_id}")
            return None

        print(f"Loaded transcript: {len(transcript)} characters")
        print(f"Episode: {metadata.get('title')}")

        # Build prompt
        # Truncate transcript if too long (Gemini has ~1M token context)
        max_transcript_chars = 400_000  # Conservative limit
        if len(transcript) > max_transcript_chars:
            print(f"Warning: Truncating transcript from {len(transcript)} to {max_transcript_chars} chars")
            transcript = transcript[:max_transcript_chars]

        prompt = EPISODE_SUMMARY_PROMPT.format(
            podcast=metadata.get("podcast", "Unknown Podcast"),
            title=metadata.get("title", "Unknown Title"),
            guest=metadata.get("guest", "Unknown Guest"),
            host=metadata.get("host", "Unknown Host"),
            duration=metadata.get("duration", "Unknown"),
            date=metadata.get("date", "Unknown"),
            transcript=transcript,
        )

        print(f"Calling Gemini ({self.model_name})...")

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=0.3,  # Low temperature for consistency
                    max_output_tokens=8000,
                )
            )

            if not response.text:
                print("Error: Empty response from Gemini")
                return None

            # Parse JSON response
            response_text = response.text.strip()

            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                response_text = "\n".join(lines[1:-1])

            summary_data = json.loads(response_text)

            # Build structured summary
            themes = [
                Theme(**t) for t in summary_data.get("major_themes", [])
            ]
            moments = [
                KeyMoment(**m) for m in summary_data.get("key_moments", [])
            ]
            thesis_data = summary_data.get("guest_thesis", {})
            thesis = GuestThesis(
                core_thesis=thesis_data.get("core_thesis", ""),
                key_claims=thesis_data.get("key_claims", []),
                argumentation_style=thesis_data.get("argumentation_style", ""),
                intellectual_influences=thesis_data.get("intellectual_influences", ""),
            )
            dynamics_data = summary_data.get("conversation_dynamics", {})
            dynamics = ConversationDynamics(
                host_approach=dynamics_data.get("host_approach", ""),
                memorable_exchanges=dynamics_data.get("memorable_exchanges", ""),
                tone=dynamics_data.get("tone", ""),
            )

            return EpisodeSummary(
                episode_id=episode_id,
                narrative_arc=summary_data.get("narrative_arc", ""),
                major_themes=themes,
                key_moments=moments,
                guest_thesis=thesis,
                conversation_dynamics=dynamics,
            )

        except json.JSONDecodeError as e:
            print(f"Error parsing JSON response: {e}")
            print(f"Response was: {response.text[:500]}...")
            return None
        except Exception as e:
            print(f"Error generating summary: {e}")
            import traceback
            traceback.print_exc()
            return None


# =============================================================================
# Storage
# =============================================================================

def save_summary(summary: EpisodeSummary, update_episodes: bool = True):
    """Save the episode summary.

    Args:
        summary: The generated summary
        update_episodes: If True, also update episodes.json with compact summary
    """
    # Load or create summaries file
    summaries = {}
    if SUMMARIES_FILE.exists():
        with SUMMARIES_FILE.open() as f:
            summaries = json.load(f)

    # Add/update this summary
    summaries[summary.episode_id] = summary.to_dict()

    # Save to episode_summaries.json
    with SUMMARIES_FILE.open("w") as f:
        json.dump(summaries, f, indent=2)
    print(f"Saved full summary to {SUMMARIES_FILE}")

    # Optionally update episodes.json with compact summary
    if update_episodes and EPISODES_FILE.exists():
        with EPISODES_FILE.open() as f:
            episodes = json.load(f)

        # Find and update the episode
        for episode in episodes:
            if episode.get("id") == summary.episode_id:
                episode["summary"] = summary.to_compact_string()
                break

        with EPISODES_FILE.open("w") as f:
            json.dump(episodes, f, indent=2)
        print(f"Updated {EPISODES_FILE} with compact summary")


def load_summary(episode_id: str) -> Optional[EpisodeSummary]:
    """Load a previously generated summary."""
    if not SUMMARIES_FILE.exists():
        return None

    with SUMMARIES_FILE.open() as f:
        summaries = json.load(f)

    data = summaries.get(episode_id)
    if not data:
        return None

    return EpisodeSummary(
        episode_id=data["episode_id"],
        narrative_arc=data["narrative_arc"],
        major_themes=[Theme(**t) for t in data["major_themes"]],
        key_moments=[KeyMoment(**m) for m in data["key_moments"]],
        guest_thesis=GuestThesis(**data["guest_thesis"]),
        conversation_dynamics=ConversationDynamics(**data["conversation_dynamics"]),
    )


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Generate episode summaries for Noeron chat"
    )
    parser.add_argument(
        "episode_id",
        nargs="?",
        default="lex_325",
        help="Episode ID to process (default: lex_325)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all episodes in episodes.json"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate even if summary exists"
    )
    parser.add_argument(
        "--no-update-episodes",
        action="store_true",
        help="Don't update episodes.json with compact summary"
    )
    parser.add_argument(
        "--print-only",
        action="store_true",
        help="Print existing summary without regenerating"
    )
    parser.add_argument(
        "--model",
        default=None,
        help=f"Gemini model to use (default: {DEFAULT_MODEL})"
    )

    args = parser.parse_args()

    # Print existing summary
    if args.print_only:
        summary = load_summary(args.episode_id)
        if summary:
            print("=" * 80)
            print("EPISODE SUMMARY")
            print("=" * 80)
            print(summary.to_compact_string())
        else:
            print(f"No summary found for {args.episode_id}")
        return

    # Initialize generator
    generator = EpisodeSummaryGenerator(model_name=args.model)

    # Determine which episodes to process
    if args.all:
        with EPISODES_FILE.open() as f:
            episodes = json.load(f)
        episode_ids = [e["id"] for e in episodes]
    else:
        episode_ids = [args.episode_id]

    # Process each episode
    for episode_id in episode_ids:
        print(f"\n{'=' * 80}")
        print(f"Processing: {episode_id}")
        print("=" * 80)

        # Check if summary exists
        existing = load_summary(episode_id)
        if existing and not args.force:
            print(f"Summary already exists for {episode_id}. Use --force to regenerate.")
            continue

        # Generate summary
        summary = generator.generate_summary(episode_id)
        if summary:
            save_summary(summary, update_episodes=not args.no_update_episodes)
            print("\nGenerated summary:")
            print("-" * 40)
            print(summary.to_compact_string()[:2000])
            if len(summary.to_compact_string()) > 2000:
                print("... (truncated)")
        else:
            print(f"Failed to generate summary for {episode_id}")


if __name__ == "__main__":
    main()
