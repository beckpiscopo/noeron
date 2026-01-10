#!/usr/bin/env python3
"""
Fix NULL start_ms values in claims table by parsing the timestamp string field.

Problem: Some claims have NULL start_ms because the migration script didn't
parse the segment timestamp as a fallback when timing data wasn't available.

Solution: Parse the timestamp string (e.g., "00:15:23.160") and populate start_ms.

Usage:
    python scripts/fix_null_start_ms.py           # Dry run (preview changes)
    python scripts/fix_null_start_ms.py --execute # Apply changes
"""

import argparse
import os
from pathlib import Path
from typing import Optional

# Load environment
REPO_ROOT = Path(__file__).resolve().parent.parent
_env_file = REPO_ROOT / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

from supabase import create_client


def get_supabase_client():
    """Get authenticated Supabase client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


def timestamp_to_ms(timestamp: str) -> Optional[int]:
    """
    Convert timestamp string to milliseconds.

    Handles formats:
    - "00:15:23.160" -> HH:MM:SS.mmm
    - "00:15:23" -> HH:MM:SS
    - "15:23" -> MM:SS
    - "lex_325|00:15:23.160|window-5" -> extract middle part
    """
    if not timestamp:
        return None

    # Handle segment key format (e.g., "lex_325|00:15:23.160|window-5")
    if '|' in timestamp:
        parts = timestamp.split('|')
        if len(parts) >= 2:
            timestamp = parts[1]

    # Remove any trailing info (like "align:start position:0%")
    timestamp = timestamp.split(' ')[0].strip()

    # Handle arrow format "00:15:23.160 --> 00:18:23.160"
    if '-->' in timestamp:
        timestamp = timestamp.split('-->')[0].strip()

    try:
        parts = timestamp.split(':')

        if len(parts) == 3:  # HH:MM:SS or HH:MM:SS.mmm
            h = int(parts[0])
            m = int(parts[1])

            sec_parts = parts[2].split('.')
            s = int(sec_parts[0])
            ms = 0
            if len(sec_parts) > 1:
                ms_str = sec_parts[1][:3]
                ms = int(ms_str.ljust(3, '0'))

            return (h * 3600 + m * 60 + s) * 1000 + ms

        elif len(parts) == 2:  # MM:SS
            m = int(parts[0])
            s = int(parts[1].split('.')[0])
            return (m * 60 + s) * 1000

    except (ValueError, IndexError) as e:
        print(f"  ⚠️  Failed to parse '{timestamp}': {e}")
        return None

    return None


def ms_to_timestamp(ms: int) -> str:
    """Convert milliseconds to HH:MM:SS format."""
    total_seconds = ms // 1000
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def fix_null_start_ms(dry_run: bool = True):
    """Fix NULL start_ms values by parsing timestamp strings."""

    client = get_supabase_client()
    print("Connected to Supabase\n")

    # Get claims with NULL start_ms
    result = client.table("claims").select(
        "id, timestamp, segment_claim_id, start_ms, claim_text"
    ).is_("start_ms", "null").execute()

    claims_to_fix = result.data

    print(f"📊 Found {len(claims_to_fix)} claims with NULL start_ms")

    if not claims_to_fix:
        print("✅ No claims need fixing!")
        return

    # Process each claim
    fixed = 0
    failed = 0
    updates = []

    print("\nProcessing claims:\n")

    for claim in claims_to_fix:
        claim_id = claim['id']
        timestamp = claim.get('timestamp') or ''
        segment_claim_id = claim.get('segment_claim_id') or ''
        claim_text = (claim.get('claim_text') or '')[:60]

        # Try to parse timestamp from the timestamp field
        ms = timestamp_to_ms(timestamp)

        # If that failed, try extracting from segment_claim_id
        if ms is None and segment_claim_id:
            ms = timestamp_to_ms(segment_claim_id)

        if ms is not None:
            print(f"  [{claim_id:4d}] '{timestamp}' -> {ms_to_timestamp(ms)} ({ms} ms)")
            print(f"         {claim_text}...")
            updates.append({"id": claim_id, "start_ms": ms})
            fixed += 1
        else:
            print(f"  [{claim_id:4d}] ⚠️  Cannot parse: '{timestamp}'")
            print(f"         segment_claim_id: '{segment_claim_id}'")
            print(f"         {claim_text}...")
            failed += 1

    # Apply updates
    if not dry_run and updates:
        print(f"\n{'='*60}")
        print("Applying updates...")
        print(f"{'='*60}\n")

        for update in updates:
            try:
                client.table("claims").update(
                    {"start_ms": update["start_ms"]}
                ).eq("id", update["id"]).execute()
            except Exception as e:
                print(f"  ❌ Error updating claim {update['id']}: {e}")
                fixed -= 1
                failed += 1

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")

    if dry_run:
        print(f"  [DRY RUN] Would fix: {fixed} claims")
        print(f"  [DRY RUN] Unable to fix: {failed} claims")
        print(f"\n💡 Run with --execute to apply changes")
    else:
        print(f"  ✅ Fixed: {fixed} claims")
        if failed > 0:
            print(f"  ⚠️  Failed: {failed} claims")


def main():
    parser = argparse.ArgumentParser(
        description="Fix NULL start_ms values in claims table"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually apply fixes (default is dry run)"
    )
    args = parser.parse_args()

    fix_null_start_ms(dry_run=not args.execute)


if __name__ == "__main__":
    main()
