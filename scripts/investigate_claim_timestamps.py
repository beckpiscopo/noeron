#!/usr/bin/env python3
"""
Investigate claim timestamp data quality issues.

Problem: Density timeline shows massive spike at 00:00 then nothing for last hour.
This suggests either:
1. Claims have missing/null timestamps defaulting to 0
2. Claims have incorrect timestamps (all set to segment start)
3. Claim extraction stopped partway through the episode
4. Timestamp parsing issue in the original extraction
"""

import json
import os
from pathlib import Path
from collections import Counter
from dotenv import load_dotenv

load_dotenv()

# Try Supabase first
try:
    from supabase import create_client
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
except ImportError:
    supabase = None

DATA_DIR = Path(__file__).parent.parent / "data"
EPISODE_ID = "lex_325"  # Change this to investigate other episodes


def investigate_supabase():
    """Query Supabase for claim timestamp distribution."""
    if not supabase:
        print("⚠️  Supabase not configured, skipping...")
        return

    print("\n" + "="*60)
    print("SUPABASE CLAIMS ANALYSIS")
    print("="*60)

    # Get all claims for episode
    result = supabase.table("claims").select("*").eq("podcast_id", EPISODE_ID).execute()
    claims = result.data

    print(f"\n📊 Total claims for {EPISODE_ID}: {len(claims)}")

    if not claims:
        print("❌ No claims found!")
        return

    # Analyze timestamps
    null_start_ms = sum(1 for c in claims if c.get("start_ms") is None)
    zero_start_ms = sum(1 for c in claims if c.get("start_ms") == 0)
    null_timestamp = sum(1 for c in claims if c.get("timestamp") is None)

    print(f"\n🔍 Timestamp Analysis:")
    print(f"   - Claims with NULL start_ms: {null_start_ms}")
    print(f"   - Claims with start_ms = 0: {zero_start_ms}")
    print(f"   - Claims with NULL timestamp string: {null_timestamp}")

    # Get timestamp distribution (bucket into 10-minute windows)
    valid_claims = [c for c in claims if c.get("start_ms") is not None]
    if valid_claims:
        max_ms = max(c["start_ms"] for c in valid_claims)
        min_ms = min(c["start_ms"] for c in valid_claims)

        print(f"\n⏱️  Timestamp Range:")
        print(f"   - Earliest: {min_ms/1000/60:.1f} min ({min_ms} ms)")
        print(f"   - Latest: {max_ms/1000/60:.1f} min ({max_ms} ms)")
        print(f"   - Episode duration: ~222 min (3h 42m)")

        if max_ms < 7200000:  # Less than 2 hours
            print(f"\n⚠️  WARNING: Latest claim is at {max_ms/1000/60:.1f} min!")
            print(f"   Episode is 222 min long - missing claims for last {222 - max_ms/1000/60:.0f} min!")

        # Bucket distribution
        print(f"\n📈 Distribution by 30-minute buckets:")
        buckets = Counter()
        for c in valid_claims:
            bucket = int(c["start_ms"] / 1000 / 60 / 30)  # 30-min buckets
            buckets[bucket] += 1

        for bucket in sorted(buckets.keys()):
            start_min = bucket * 30
            end_min = (bucket + 1) * 30
            bar = "█" * (buckets[bucket] // 2) + "▌" * (buckets[bucket] % 2)
            print(f"   {start_min:3d}-{end_min:3d} min: {buckets[bucket]:3d} claims {bar}")

        # Check for gaps
        all_buckets = set(range(max(buckets.keys()) + 1))
        missing_buckets = all_buckets - set(buckets.keys())
        if missing_buckets:
            print(f"\n⚠️  Missing buckets (no claims): {sorted(missing_buckets)}")

    # Sample some claims to check data quality
    print(f"\n📝 Sample claims (first 5):")
    for c in claims[:5]:
        ts = c.get("start_ms", "NULL")
        ts_str = c.get("timestamp", "NULL")
        text = (c.get("distilled_claim") or c.get("claim_text") or "")[:60]
        print(f"   [{ts_str}] ({ts} ms) {text}...")

    print(f"\n📝 Sample claims (last 5 by timestamp):")
    sorted_claims = sorted(valid_claims, key=lambda c: c.get("start_ms", 0), reverse=True)
    for c in sorted_claims[:5]:
        ts = c.get("start_ms", "NULL")
        ts_str = c.get("timestamp", "NULL")
        text = (c.get("distilled_claim") or c.get("claim_text") or "")[:60]
        print(f"   [{ts_str}] ({ts} ms) {text}...")


def investigate_json_cache():
    """Check the local JSON cache for claim data."""
    print("\n" + "="*60)
    print("LOCAL JSON CACHE ANALYSIS")
    print("="*60)

    # Check context_card_registry.json
    registry_file = DATA_DIR / "context_card_registry.json"
    if registry_file.exists():
        with open(registry_file) as f:
            registry = json.load(f)

        segments = registry.get("segments", {})
        episode_segments = {k: v for k, v in segments.items() if k.startswith(f"{EPISODE_ID}|")}

        print(f"\n📊 Segments in context_card_registry.json for {EPISODE_ID}: {len(episode_segments)}")

        if episode_segments:
            # Count claims per segment
            total_claims = sum(len(s.get("claims", [])) for s in episode_segments.values())
            print(f"   Total claims across segments: {total_claims}")

            # Parse timestamps from segment keys
            timestamps = []
            for key in episode_segments.keys():
                parts = key.split("|")
                if len(parts) >= 2:
                    ts_str = parts[1]  # e.g., "00:15:30.123"
                    try:
                        # Parse timestamp
                        time_parts = ts_str.replace(".", ":").split(":")
                        if len(time_parts) >= 3:
                            h, m, s = int(time_parts[0]), int(time_parts[1]), float(time_parts[2])
                            if len(time_parts) > 3:
                                s += float(time_parts[3]) / 1000
                            timestamps.append(h * 3600 + m * 60 + s)
                    except (ValueError, IndexError):
                        pass

            if timestamps:
                max_ts = max(timestamps)
                min_ts = min(timestamps)
                print(f"\n⏱️  Segment Timestamp Range:")
                print(f"   - Earliest segment: {min_ts/60:.1f} min")
                print(f"   - Latest segment: {max_ts/60:.1f} min")

                if max_ts < 7200:  # Less than 2 hours
                    print(f"\n⚠️  WARNING: Latest segment is at {max_ts/60:.1f} min!")
                    print(f"   Episode is 222 min long - no segments for last {222 - max_ts/60:.0f} min!")
    else:
        print(f"   ❌ File not found: {registry_file}")

    # Check window_segments.json
    window_file = DATA_DIR / "window_segments.json"
    if window_file.exists():
        with open(window_file) as f:
            windows = json.load(f)

        print(f"\n📊 Windows in window_segments.json: {len(windows)}")

        if windows:
            # Check structure
            sample = list(windows.values())[0] if isinstance(windows, dict) else windows[0]
            print(f"   Sample window structure: {list(sample.keys()) if isinstance(sample, dict) else type(sample)}")


def investigate_transcript():
    """Check if transcript covers full episode."""
    print("\n" + "="*60)
    print("TRANSCRIPT COVERAGE CHECK")
    print("="*60)

    transcript_file = DATA_DIR / "transcripts" / f"{EPISODE_ID}.txt"
    if transcript_file.exists():
        with open(transcript_file) as f:
            content = f.read()

        lines = content.strip().split("\n")
        print(f"\n📄 Transcript file: {transcript_file.name}")
        print(f"   - Total characters: {len(content):,}")
        print(f"   - Total lines: {len(lines):,}")

        # Look for timestamps in transcript
        import re
        timestamps = re.findall(r'\[?(\d{1,2}:\d{2}:\d{2})\]?', content)
        if timestamps:
            print(f"   - Found {len(timestamps)} timestamp markers")
            print(f"   - Last timestamp found: {timestamps[-1]}")
        else:
            print("   - No timestamp markers found in transcript")
    else:
        print(f"   ❌ Transcript not found: {transcript_file}")


if __name__ == "__main__":
    print("🔍 CLAIM TIMESTAMP DATA QUALITY INVESTIGATION")
    print(f"   Episode: {EPISODE_ID}")

    investigate_supabase()
    investigate_json_cache()
    investigate_transcript()

    print("\n" + "="*60)
    print("RECOMMENDATIONS")
    print("="*60)
    print("""
If claims stop partway through:
1. Check if claim extraction pipeline completed successfully
2. Re-run claim extraction for missing segments
3. Verify transcript covers full episode

If many claims have timestamp=0:
1. Check timestamp parsing in extraction pipeline
2. May need to re-extract with fixed timestamp parsing

If timestamps are from segment keys not claim-level:
1. Claims may be using segment start time, not actual claim time
2. Consider using end_ms or calculating from word timing
""")
