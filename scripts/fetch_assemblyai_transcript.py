"""CLI for fetching a diarized transcript via AssemblyAI."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from transcript_helpers import (
    assemblyai_transcript_to_paper,
    convert_to_mp3,
    download_youtube_video,
)


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download a speaker-diarized transcript from AssemblyAI."
    )
    parser.add_argument(
        "--youtube-url",
        "-u",
        help="Full YouTube URL pointing to the interview or podcast.",
    )
    parser.add_argument(
        "--local-path",
        "-p",
        type=Path,
        help="Reuse an already downloaded media file instead of fetching from YouTube.",
    )
    parser.add_argument(
        "--paper-id",
        "-i",
        required=True,
        help="Identifier for the cleaned transcript JSON (used as filename).",
    )
    parser.add_argument(
        "--title",
        "-t",
        default="AssemblyAI transcript",
        help="Title stored with the cleaned transcript.",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        type=Path,
        default=Path("data/cleaned_papers"),
        help="Directory to save the cleaned JSON (defaults to data/cleaned_papers).",
    )
    parser.add_argument(
        "--speakers-expected",
        "-s",
        type=int,
        default=2,
        help="Hint for AssemblyAI about how many speakers to diarize (default: 2).",
    )
    parser.add_argument(
        "--download-video",
        "-d",
        action="store_true",
        help="Download the YouTube video via yt-dlp before uploading to AssemblyAI.",
    )
    parser.add_argument(
        "--transcode",
        "-c",
        action="store_true",
        help="Convert the local media file to MP3 via ffmpeg before sending it to AssemblyAI.",
    )
    parser.add_argument(
        "--download-dir",
        type=Path,
        default=Path("data/podcasts/raw"),
        help="Directory where yt-dlp should store the downloaded media.",
    )

    args = parser.parse_args()

    if not args.youtube_url and not args.local_path and not args.download_video:
        parser.error("Provide --youtube-url, --local-path, or --download-video (with --youtube-url).")
    if args.download_video and not args.youtube_url:
        parser.error("--download-video requires --youtube-url.")

    logging.info(
        "Starting AssemblyAI transcript download for %s",
        args.youtube_url or args.local_path,
    )

    local_path: Optional[Path] = None
    if args.local_path:
        local_path = args.local_path
        logging.info("Using existing media file %s", local_path)
    if args.download_video:
        logging.info("Downloading video to %s", args.download_dir)
        local_path = download_youtube_video(args.youtube_url, output_dir=args.download_dir)
        logging.info("Downloaded media to %s", local_path)
    if args.transcode and local_path:
        logging.info("Converting %s to mp3", local_path)
        local_path = convert_to_mp3(local_path)
        logging.info("Converted media to %s", local_path)

    cleaned = assemblyai_transcript_to_paper(
        youtube_url=None if local_path else args.youtube_url,
        paper_id=args.paper_id,
        title=args.title,
        output_dir=args.output_dir,
        speakers_expected=args.speakers_expected,
        local_path=local_path,
    )

    logging.info(
        "Saved cleaned transcript to %s",
        Path(cleaned["source_path"] if cleaned.get("source_path") else args.output_dir)
        / f"{args.paper_id}.json",
    )


if __name__ == "__main__":
    main()

