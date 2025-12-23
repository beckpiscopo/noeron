"""Retrieve an existing transcript from AssemblyAI by its transcript ID."""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict
from urllib import error, request

from dotenv import load_dotenv

from transcript_helpers import build_cleaned_paper_from_utterances


def fetch_transcript(transcript_id: str, api_key: str, api_host: str) -> Dict[str, Any]:
    """Fetch the full transcript resource from AssemblyAI."""

    url = f"https://{api_host.rstrip('/')}/v2/transcript/{transcript_id}"
    headers = {
        "authorization": api_key,
        "accept": "application/json",
    }
    request_obj = request.Request(url, headers=headers)

    try:
        with request.urlopen(request_obj) as response:
            return json.load(response)
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        logging.error("AssemblyAI responded with %s: %s", exc.code, body)
        raise SystemExit(
            f"Failed to fetch transcript {transcript_id}: {exc.reason} (status {exc.code})"
        )
    except error.URLError as exc:
        raise SystemExit(f"Could not reach AssemblyAI: {exc.reason}")


def save_json(path: Path, payload: Dict[str, Any]) -> None:
    """Persist JSON data with stable formatting."""

    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    load_dotenv()
    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    if not api_key:
        raise SystemExit("Set ASSEMBLYAI_API_KEY in your environment or .env file.")

    parser = argparse.ArgumentParser(
        description="Retrieve an AssemblyAI transcript resource by ID."
    )
    parser.add_argument(
        "--transcript-id",
        help="AssemblyAI transcript ID to fetch.",
        required=True,
    )
    parser.add_argument(
        "--paper-id",
        "-p",
        help="Paper ID to save cleaned JSON (writes to data/cleaned_papers).",
    )
    parser.add_argument(
        "--title",
        "-t",
        default="AssemblyAI retrieved transcript",
        help="Title used when writing cleaned JSON.",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        type=Path,
        default=Path("data/cleaned_papers"),
        help="Directory to save transcripts and cleaned papers.",
    )
    parser.add_argument(
        "--api-host",
        "-a",
        default="api.assemblyai.com",
        help="AssemblyAI API host (e.g., api.eu.assemblyai.com for the EU server).",
    )
    parser.add_argument(
        "--no-print",
        action="store_true",
        help="Suppress printing the transcript text to stdout.",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    logging.info("Fetching transcript %s from %s", args.transcript_id, args.api_host)
    transcript = fetch_transcript(
        args.transcript_id, api_key=api_key, api_host=args.api_host
    )

    if not args.no_print:
        print("\n===== Transcript =====")
        print(transcript.get("text", "").strip())
        print("======================")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    raw_output_path = args.output_dir / f"{args.transcript_id}.raw.json"
    save_json(raw_output_path, transcript)
    logging.info("Saved raw transcript JSON to %s", raw_output_path)

    if args.paper_id:
        utterances = transcript.get("utterances") or []
        if not utterances:
            logging.warning("No utterances returned; skipping cleaned paper generation.")
        else:
            cleaned = build_cleaned_paper_from_utterances(
                paper_id=args.paper_id,
                title=args.title,
                utterances=list(utterances),
                source_url=transcript.get("audio_url"),
            )
            cleaned_path = args.output_dir / f"{args.paper_id}.json"
            save_json(cleaned_path, cleaned)
            logging.info("Saved cleaned transcript to %s", cleaned_path)


if __name__ == "__main__":
    main()

