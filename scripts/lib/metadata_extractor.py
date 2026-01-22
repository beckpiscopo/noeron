"""Extract episode metadata from transcript using Gemini.

Uses Gemini to analyze a transcript and extract structured metadata
including title, guest name, host name, podcast series, and description.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

try:
    from google import genai
except ImportError:
    genai = None


# Load environment variables
load_dotenv()


@dataclass
class EpisodeMetadata:
    """Extracted metadata for a podcast episode."""

    title: str
    guest: str
    host: str
    podcast: str
    description: str
    date: Optional[str] = None
    duration: Optional[str] = None
    topics: List[str] = None

    def __post_init__(self):
        if self.topics is None:
            self.topics = []

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


METADATA_EXTRACTION_PROMPT = '''You are analyzing a podcast transcript to extract metadata about the episode.

## TRANSCRIPT (first 20,000 characters)
{transcript_preview}

## TASK
Extract the following metadata from the transcript:

1. **title**: A descriptive episode title (should mention guest name and main topic)
2. **guest**: The guest's full name
3. **host**: The host's name (if identifiable)
4. **podcast**: The podcast series name (if mentioned)
5. **description**: A 2-3 sentence description of what the episode covers
6. **topics**: List of 3-5 main topics discussed

## HINTS
- Look for introductions at the beginning where the host typically introduces themselves and the guest
- Podcast names are often mentioned in intros ("Welcome to X podcast")
- Guest credentials and affiliations can help identify them
- If the host says "I'm [name]" or "This is [name]", that's their name

## OUTPUT FORMAT
Return ONLY valid JSON with this structure:
{{
  "title": "Guest Name: Main Topic Discussion",
  "guest": "Full Name",
  "host": "Host Name",
  "podcast": "Podcast Series Name",
  "description": "2-3 sentence description...",
  "topics": ["topic1", "topic2", "topic3"]
}}

Return ONLY the JSON object, no markdown code blocks or explanation.'''


class MetadataExtractor:
    """Extract episode metadata from transcript using Gemini."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "gemini-2.0-flash",
    ):
        """Initialize the metadata extractor.

        Args:
            api_key: Gemini API key. Defaults to GEMINI_API_KEY env var.
            model_name: Gemini model to use.
        """
        if genai is None:
            raise ImportError(
                "google-genai package required. Install with: pip install google-genai"
            )

        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")

        self.model_name = model_name
        self.client = genai.Client(api_key=self.api_key)

    def extract_from_transcript(
        self,
        transcript_text: str,
        duration_ms: Optional[int] = None,
        fallback_title: Optional[str] = None,
    ) -> EpisodeMetadata:
        """Extract metadata from a transcript.

        Args:
            transcript_text: Full transcript text or first portion.
            duration_ms: Duration in milliseconds (if known).
            fallback_title: Default title if extraction fails.

        Returns:
            EpisodeMetadata with extracted fields.
        """
        # Use first 20,000 chars for analysis (enough for intro + context)
        preview = transcript_text[:20000]

        prompt = METADATA_EXTRACTION_PROMPT.format(transcript_preview=preview)

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=0.1,  # Low temperature for consistent extraction
                    max_output_tokens=1024,
                ),
            )

            if not response.text:
                return self._create_fallback(fallback_title, duration_ms)

            # Parse JSON response
            text = response.text.strip()
            # Remove markdown code blocks if present
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                text = text.strip()

            data = json.loads(text)

            # Format duration if provided
            duration_str = None
            if duration_ms:
                total_minutes = duration_ms // 60000
                hours = total_minutes // 60
                minutes = total_minutes % 60
                duration_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"

            return EpisodeMetadata(
                title=data.get("title", fallback_title or "Untitled Episode"),
                guest=data.get("guest", "Unknown Guest"),
                host=data.get("host", "Unknown Host"),
                podcast=data.get("podcast", "Unknown Podcast"),
                description=data.get("description", ""),
                duration=duration_str,
                topics=data.get("topics", []),
            )

        except (json.JSONDecodeError, KeyError) as e:
            print(f"Warning: Failed to parse Gemini response: {e}")
            return self._create_fallback(fallback_title, duration_ms)
        except Exception as e:
            print(f"Warning: Gemini metadata extraction failed: {e}")
            return self._create_fallback(fallback_title, duration_ms)

    def _create_fallback(
        self, fallback_title: Optional[str], duration_ms: Optional[int]
    ) -> EpisodeMetadata:
        """Create a fallback metadata object when extraction fails."""
        duration_str = None
        if duration_ms:
            total_minutes = duration_ms // 60000
            hours = total_minutes // 60
            minutes = total_minutes % 60
            duration_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"

        return EpisodeMetadata(
            title=fallback_title or "Untitled Episode",
            guest="Unknown Guest",
            host="Unknown Host",
            podcast="Unknown Podcast",
            description="Metadata extraction failed. Please update manually.",
            duration=duration_str,
            topics=[],
        )

    def extract_from_utterances(
        self,
        utterances: List[Dict[str, Any]],
        duration_ms: Optional[int] = None,
        fallback_title: Optional[str] = None,
    ) -> EpisodeMetadata:
        """Extract metadata from a list of utterances.

        Args:
            utterances: List of utterance dicts with 'text' and 'speaker' keys.
            duration_ms: Duration in milliseconds.
            fallback_title: Default title if extraction fails.

        Returns:
            EpisodeMetadata with extracted fields.
        """
        # Build transcript text from utterances
        lines = []
        for u in utterances:
            speaker = u.get("speaker", "?")
            text = u.get("text", "")
            lines.append(f"Speaker {speaker}: {text}")

        transcript_text = "\n".join(lines)
        return self.extract_from_transcript(transcript_text, duration_ms, fallback_title)
