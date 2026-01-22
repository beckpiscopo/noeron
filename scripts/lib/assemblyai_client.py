"""AssemblyAI transcription wrapper with retry logic.

Provides a clean interface for transcribing audio files via AssemblyAI,
with exponential backoff retries and checkpoint-friendly transcript ID tracking.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

try:
    import assemblyai as aai
except ImportError:
    aai = None


# Load environment variables
load_dotenv()


@dataclass
class TranscriptionResult:
    """Result of a transcription job."""

    transcript_id: str
    text: str
    utterances: List[Dict[str, Any]]
    duration_ms: int
    status: str

    @property
    def duration_formatted(self) -> str:
        """Return human-readable duration (e.g., '2h 34m')."""
        total_seconds = self.duration_ms // 1000
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "transcript_id": self.transcript_id,
            "text": self.text,
            "utterances": self.utterances,
            "duration_ms": self.duration_ms,
            "status": self.status,
        }


class AssemblyAIClient:
    """Wrapper for AssemblyAI transcription with retry logic."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        max_retries: int = 3,
        initial_backoff: float = 5.0,
        poll_interval: int = 10,
        timeout_seconds: int = 3600,  # 1 hour default timeout
    ):
        """Initialize the AssemblyAI client.

        Args:
            api_key: AssemblyAI API key. Defaults to ASSEMBLYAI_API_KEY env var.
            max_retries: Maximum number of retry attempts for failed operations.
            initial_backoff: Initial backoff delay in seconds for retries.
            poll_interval: Seconds between status polls while waiting.
            timeout_seconds: Maximum time to wait for transcription completion.
        """
        if aai is None:
            raise ImportError(
                "assemblyai package required. Install with: pip install assemblyai"
            )

        self.api_key = api_key or os.getenv("ASSEMBLYAI_API_KEY")
        if not self.api_key:
            raise ValueError("ASSEMBLYAI_API_KEY environment variable is required")

        aai.settings.api_key = self.api_key
        self.max_retries = max_retries
        self.initial_backoff = initial_backoff
        self.poll_interval = poll_interval
        self.timeout_seconds = timeout_seconds
        self._transcriber = aai.Transcriber()

    def transcribe(
        self,
        audio_path: Path,
        speakers_expected: int = 2,
        language_code: str = "en",
    ) -> TranscriptionResult:
        """Transcribe an audio file with speaker diarization.

        Args:
            audio_path: Path to the audio file (MP3, WAV, etc.)
            speakers_expected: Expected number of speakers for diarization.
            language_code: Language code (default: 'en' for English).

        Returns:
            TranscriptionResult with transcript text and utterances.

        Raises:
            RuntimeError: If transcription fails after all retries.
            TimeoutError: If transcription takes too long.
        """
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        config = aai.TranscriptionConfig(
            speaker_labels=True,
            speakers_expected=speakers_expected,
            language_code=language_code,
        )

        # Submit with retries
        transcript = self._submit_with_retry(str(audio_path), config)

        # Poll until complete
        return self._wait_for_completion(transcript)

    def resume_transcription(self, transcript_id: str) -> TranscriptionResult:
        """Resume polling for an existing transcription job.

        Useful for recovering from a crash during the polling phase.

        Args:
            transcript_id: ID of the existing transcription job.

        Returns:
            TranscriptionResult when complete.
        """
        transcript = aai.Transcript.get_by_id(transcript_id)
        return self._wait_for_completion(transcript)

    def _submit_with_retry(
        self, audio_path: str, config: aai.TranscriptionConfig
    ) -> aai.Transcript:
        """Submit transcription with exponential backoff retry."""
        last_error = None
        backoff = self.initial_backoff

        for attempt in range(1, self.max_retries + 1):
            try:
                transcript = self._transcriber.submit(audio_path, config=config)
                return transcript
            except Exception as e:
                last_error = e
                if attempt < self.max_retries:
                    print(f"  Attempt {attempt} failed: {e}")
                    print(f"  Retrying in {backoff:.1f}s...")
                    time.sleep(backoff)
                    backoff *= 2  # Exponential backoff

        raise RuntimeError(
            f"Failed to submit transcription after {self.max_retries} attempts: {last_error}"
        )

    def _wait_for_completion(self, transcript: aai.Transcript) -> TranscriptionResult:
        """Poll until transcription completes or times out."""
        start_time = time.monotonic()
        transcript_id = transcript.id

        while transcript.status not in {"completed", "error"}:
            elapsed = time.monotonic() - start_time
            if elapsed > self.timeout_seconds:
                raise TimeoutError(
                    f"Transcription {transcript_id} timed out after {self.timeout_seconds}s"
                )

            time.sleep(self.poll_interval)
            transcript = aai.Transcript.get_by_id(transcript_id)

        if transcript.status == "error":
            raise RuntimeError(f"Transcription failed: {transcript.error}")

        # Extract utterances
        utterances = []
        if transcript.utterances:
            for u in transcript.utterances:
                utterances.append({
                    "speaker": u.speaker,
                    "text": u.text,
                    "start": u.start,
                    "end": u.end,
                    "confidence": getattr(u, "confidence", None),
                })

        # Calculate duration from last utterance end time
        duration_ms = 0
        if utterances:
            duration_ms = max(u.get("end", 0) for u in utterances)

        return TranscriptionResult(
            transcript_id=transcript_id,
            text=transcript.text or "",
            utterances=utterances,
            duration_ms=duration_ms,
            status="completed",
        )

    def save_transcript(
        self,
        result: TranscriptionResult,
        output_path: Path,
        format: str = "json",
    ) -> Path:
        """Save transcript to a file.

        Args:
            result: Transcription result to save.
            output_path: Path to save the transcript.
            format: Output format ('json' or 'txt').

        Returns:
            Path to the saved file.
        """
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if format == "txt":
            # Plain text with speaker labels
            lines = []
            for u in result.utterances:
                speaker = u.get("speaker", "?")
                text = u.get("text", "")
                start_ms = u.get("start", 0)
                # Format timestamp as HH:MM:SS
                hours = start_ms // 3600000
                minutes = (start_ms % 3600000) // 60000
                seconds = (start_ms % 60000) // 1000
                timestamp = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                lines.append(f"[{timestamp}] Speaker {speaker}: {text}")

            output_path.write_text("\n".join(lines), encoding="utf-8")
        else:
            # JSON format with full data
            output_path.write_text(
                json.dumps(result.to_dict(), indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

        return output_path
