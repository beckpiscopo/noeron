"""Helpers for turning transcripts into cleaned paper JSON for chunking."""

import json
import os
import shutil
import subprocess
import time
from collections import defaultdict
from datetime import timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from dotenv import load_dotenv
from yt_dlp import YoutubeDL

import assemblyai as aai


# Load environment variables from .env, then bind AssemblyAI key.
load_dotenv()
aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY") or ""


def _format_timestamp(ms: int) -> str:
    """Human-friendly timestamp for a millisecond offset."""
    return str(timedelta(milliseconds=ms)).split(".", 1)[0]


def _build_sections_from_utterances(
    utterances: Iterable[Dict[str, Any]], speaker_label: str, max_gap_ms: int = 15_000
) -> List[Dict[str, Optional[str]]]:
    """Group Levin utterances into paragraph-sized sections."""

    sections: List[Dict[str, Optional[str]]] = []
    buffer: List[str] = []
    block_start: Optional[int] = None
    block_end: Optional[int] = None

    def flush():
        nonlocal buffer, block_start, block_end
        if block_start is None or not buffer:
            buffer = []
            block_start = None
            block_end = None
            return
        heading = _format_timestamp(block_start)
        sections.append(
            {
                "heading": f"{heading} — Michael Levin",
                "page": None,
                "text": " ".join(buffer).strip(),
            }
        )
        buffer = []
        block_start = None
        block_end = None

    for utterance in utterances:
        if utterance.get("speaker") != speaker_label:
            continue
        start = utterance.get("start", 0)
        end = utterance.get("end", start)
        if block_end is not None and start - block_end > max_gap_ms:
            flush()
        if block_start is None:
            block_start = start
        buffer.append(utterance.get("text", "").strip())
        block_end = end

    flush()
    return sections


def download_youtube_video(
    youtube_url: str, output_dir: Optional[Path] = None
) -> Path:
    """Download the audio for a YouTube URL via yt-dlp."""

    if not output_dir:
        output_dir = Path("data/podcasts/raw")
    output_dir.mkdir(parents=True, exist_ok=True)
    ydl_opts = {
        "format": "bestaudio/best",
        "noplaylist": True,
        "outtmpl": str(output_dir / "%(id)s.%(ext)s"),
    }
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=True)
        filename = ydl.prepare_filename(info)
    if not filename:
        raise RuntimeError("yt-dlp did not report a downloaded filename.")
    return Path(filename)


def ensure_ffmpeg_available() -> Path:
    """Return the path to ffmpeg or raise if it's missing."""
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise RuntimeError(
            "ffmpeg is required to convert downloaded media to MP3. Install it?"
        )
    return Path(ffmpeg_path)


def convert_to_mp3(source: Path, bitrate: str = "192k") -> Path:
    """Transcode the provided media file to MP3 via ffmpeg."""

    if source.suffix.lower() == ".mp3":
        return source

    ffmpeg_path = ensure_ffmpeg_available()
    target = source.with_suffix(".mp3")
    command = [
        str(ffmpeg_path),
        "-y",
        "-i",
        str(source),
        "-vn",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-b:a",
        bitrate,
        str(target),
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed to convert {source} → {target}:\n{result.stderr}"
        )
    return target


def get_diarized_transcript(
    youtube_url: Optional[str] = None,
    local_path: Optional[Path] = None,
    speakers_expected: int = 2,
    wait_interval: int = 5,
    timeout_seconds: int = 600,
) -> Dict[str, List[Dict[str, Any]]]:
    """Upload a URL or local file to AssemblyAI and wait for a diarized transcript."""

    if not youtube_url and not local_path:
        raise ValueError("Either youtube_url or local_path must be provided.")

    if not aai.settings.api_key:
        raise RuntimeError("ASSEMBLYAI_API_KEY is required to call AssemblyAI.")

    config = aai.TranscriptionConfig(
        speaker_labels=True,
        speakers_expected=speakers_expected,
    )
    transcriber = aai.Transcriber()
    if local_path:
        transcript = transcriber.transcribe(str(local_path), config=config)
    else:
        transcript = transcriber.transcribe(youtube_url, config=config)

    deadline = time.monotonic() + timeout_seconds
    while transcript.status not in {"completed", "error"}:
        if time.monotonic() > deadline:
            raise TimeoutError("AssemblyAI transcription timed out.")
        time.sleep(wait_interval)
        transcript = transcriber.get(transcript.id)

    if transcript.status == "error":
        raise RuntimeError(f"AssemblyAI failed: {transcript.error}")

    return {"utterances": list(transcript.utterances)}


def _extract_text(utterance: Any) -> str:
    if isinstance(utterance, dict):
        return utterance.get("text", "")
    return getattr(utterance, "text", "")


def _extract_speaker_label(utterance: Any) -> Optional[str]:
    if isinstance(utterance, dict):
        return utterance.get("speaker")
    return getattr(utterance, "speaker", None)


def identify_levin_speaker(utterances: List[Any]) -> str:
    """Pick the speaker label that most likely corresponds to Levin."""

    speaker_stats = defaultdict(lambda: {"word_total": 0, "count": 0})
    for utterance in utterances:
        speaker = _extract_speaker_label(utterance)
        text = _extract_text(utterance)
        words = len(text.split())
        speaker_stats[speaker]["word_total"] += words
        speaker_stats[speaker]["count"] += 1

    averages = {
        speaker: stats["word_total"] / stats["count"]
        for speaker, stats in speaker_stats.items()
        if stats["count"]
    }
    if not averages:
        raise RuntimeError("No speaker utterances found to analyze.")
    return max(averages, key=averages.get)


def assemblyai_transcript_to_paper(
    youtube_url: Optional[str],
    paper_id: str,
    title: str,
    output_dir: Optional[Path] = None,
    speakers_expected: int = 2,
    local_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Transcribe a YouTube video or local file with AssemblyAI and store the cleaned result.
    """

    transcript = get_diarized_transcript(
        youtube_url=youtube_url,
        local_path=local_path,
        speakers_expected=speakers_expected,
    )
    utterances = transcript.get("utterances", [])
    levin_label = identify_levin_speaker(utterances)
    sections = _build_sections_from_utterances(utterances, levin_label)

    cleaned = {
        "paper_id": paper_id,
        "title": title,
        "authors": ["Michael Levin (AssemblyAI)"],
        "year": None,
        "full_text": " ".join(section["text"] for section in sections).strip(),
        "sections": sections,
        "source_path": str(local_path) if local_path else f"assemblyai://{youtube_url}",
    }

    if not output_dir:
        output_dir = Path("data/cleaned_papers")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{paper_id}.json"
    output_path.write_text(
        json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return cleaned


def build_cleaned_paper_from_utterances(
    paper_id: str,
    title: str,
    utterances: List[Any],
    source_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Craft the cleaned paper JSON directly from AssemblyAI utterances.
    """

    if not utterances:
        raise ValueError("No utterances provided.")

    levin_label = identify_levin_speaker(utterances)
    sections = _build_sections_from_utterances(utterances, levin_label)

    return {
        "paper_id": paper_id,
        "title": title,
        "authors": ["Michael Levin (AssemblyAI)"],
        "year": None,
        "full_text": " ".join(section["text"] for section in sections).strip(),
        "sections": sections,
        "source_path": str(source_url) if source_url else "assemblyai://retrieved",
    }
