#!/usr/bin/env python3
"""
Upload podcast audio files to Supabase storage.

Prerequisites:
1. Create "podcast-audio" bucket in Supabase Dashboard
2. Enable "Public bucket" setting
3. Set file size limit to 500MB
4. Run migration 014_add_podcast_audio_storage.sql

Usage:
    python scripts/upload_podcast_audio.py
"""

import os
import sys
from pathlib import Path

# Add repo root to path for imports
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.supabase_client import get_db

BUCKET_NAME = "podcast-audio"
AUDIO_DIR = REPO_ROOT / "data" / "podcasts" / "raw"

# Map episode IDs to their audio files
EPISODE_AUDIO = {
    "lex_325": "p3lsYlod5OU.mp3",
}


def upload_audio_file(db, episode_id: str, filename: str) -> str | None:
    """Upload an audio file to Supabase storage and return the public URL."""
    filepath = AUDIO_DIR / filename

    if not filepath.exists():
        print(f"  [ERROR] File not found: {filepath}")
        return None

    file_size_mb = filepath.stat().st_size / (1024 * 1024)
    print(f"  File size: {file_size_mb:.1f} MB")

    # Storage path: episode_id/filename
    storage_path = f"{episode_id}/{filename}"

    print(f"  Uploading to: {BUCKET_NAME}/{storage_path}")

    try:
        # Read file bytes
        with open(filepath, "rb") as f:
            file_bytes = f.read()

        # Upload to Supabase
        result = db.client.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "audio/mpeg"}
        )

        # Get public URL
        public_url = db.client.storage.from_(BUCKET_NAME).get_public_url(storage_path)

        print(f"  [OK] Uploaded successfully!")
        print(f"  Public URL: {public_url}")

        return public_url

    except Exception as e:
        error_msg = str(e)
        if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
            # File already uploaded, just get the URL
            public_url = db.client.storage.from_(BUCKET_NAME).get_public_url(storage_path)
            print(f"  [OK] File already exists in storage")
            print(f"  Public URL: {public_url}")
            return public_url
        else:
            print(f"  [ERROR] Upload failed: {e}")
            return None


def main():
    print("=" * 60)
    print("PODCAST AUDIO UPLOAD TO SUPABASE")
    print("=" * 60)
    print()

    # Connect to Supabase with service key
    print("Connecting to Supabase...")
    try:
        db = get_db(use_service_key=True)
        print("[OK] Connected\n")
    except Exception as e:
        print(f"[ERROR] Failed to connect: {e}")
        print("\nMake sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env")
        return 1

    # Upload each episode's audio
    results = {}
    for episode_id, filename in EPISODE_AUDIO.items():
        print(f"\n[{episode_id}] {filename}")
        url = upload_audio_file(db, episode_id, filename)
        if url:
            results[episode_id] = url

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    if results:
        print("\nSuccessfully uploaded:")
        for episode_id, url in results.items():
            print(f"  {episode_id}: {url}")

        print("\n\nAdd these URLs to frontend/data/episodes.json:")
        print('  "audioUrl": "<url>"')
    else:
        print("\nNo files were uploaded. Check errors above.")

    return 0 if results else 1


if __name__ == "__main__":
    sys.exit(main())
