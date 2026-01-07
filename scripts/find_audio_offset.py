#!/usr/bin/env python3
"""
Script to help find the audio offset between the audio file and claim timestamps.

This script generates specific test points where you can manually verify
if the audio matches the claim timing.
"""

import json
from pathlib import Path


def load_transcript(episode_id: str):
    """Load the transcript JSON file."""
    cache_path = Path(__file__).parent.parent / "cache" / f"podcast_{episode_id}_claims_with_timing.json"
    
    if not cache_path.exists():
        print(f"❌ Transcript file not found: {cache_path}")
        return None
    
    with open(cache_path, 'r') as f:
        return json.load(f)


def format_timestamp(ms):
    """Format milliseconds as MM:SS.mmm"""
    total_seconds = ms / 1000
    minutes = int(total_seconds // 60)
    seconds = total_seconds % 60
    return f"{minutes:02d}:{seconds:06.3f}"


def find_distinctive_claims(episode_id: str = "lex_325", num_test_points: int = 10):
    """
    Find distinctive claims at various points in the podcast for manual testing.
    """
    print(f"\n{'='*80}")
    print(f"AUDIO OFFSET DETECTION TEST for {episode_id}")
    print(f"{'='*80}\n")
    
    data = load_transcript(episode_id)
    if not data or 'segments' not in data:
        return
    
    # Extract all claims with their timing
    claims = []
    for segment_key, segment in data['segments'].items():
        if 'claims' in segment:
            for claim in segment['claims']:
                if 'timing' in claim and claim['timing'].get('start_ms'):
                    # Get the first few words for easy identification
                    claim_text = claim.get('claim_text', '')
                    first_words = ' '.join(claim_text.split()[:10])
                    
                    claims.append({
                        'start_ms': claim['timing']['start_ms'],
                        'first_words': first_words,
                        'full_text': claim_text
                    })
    
    # Sort by timestamp
    claims.sort(key=lambda c: c['start_ms'])
    
    # Select claims evenly distributed throughout the podcast
    if len(claims) < num_test_points:
        num_test_points = len(claims)
    
    step = len(claims) // num_test_points
    test_claims = [claims[i * step] for i in range(num_test_points)]
    
    print(f"📍 MANUAL VERIFICATION TEST POINTS")
    print(f"{'─'*80}\n")
    print("Instructions:")
    print("1. Open the podcast in your browser")
    print("2. For each test point below, scrub to the exact timestamp")
    print("3. Listen to what's being said")
    print("4. Note if you hear the expected text")
    print("5. If not, note how many seconds off it is (+ if later, - if earlier)")
    print(f"\n{'─'*80}\n")
    
    for i, claim in enumerate(test_claims, 1):
        timestamp_ms = claim['start_ms']
        timestamp_str = format_timestamp(timestamp_ms)
        timestamp_seconds = timestamp_ms / 1000
        
        print(f"\n{'='*80}")
        print(f"TEST POINT #{i}")
        print(f"{'='*80}")
        print(f"\n⏱️  EXACT TIMESTAMP: {timestamp_str} ({timestamp_seconds:.2f} seconds)")
        print(f"\n📝 YOU SHOULD HEAR:")
        print(f'   "{claim["first_words"]}..."')
        print(f"\n💭 FULL TEXT:")
        print(f'   {claim["full_text"][:200]}{"..." if len(claim["full_text"]) > 200 else ""}')
        print(f"\n✍️  WHAT YOU ACTUALLY HEAR:")
        print(f"   [ Write down the first few words you hear ]")
        print(f"\n⏰ TIME OFFSET (if any):")
        print(f"   [ +X seconds if you hear it LATER ]")
        print(f"   [ -X seconds if you hear it EARLIER ]")
        print()
    
    print(f"\n{'='*80}")
    print(f"CALCULATING OFFSET")
    print(f"{'='*80}\n")
    print("After testing all points, if there's a consistent offset:")
    print()
    print("1. Calculate the average offset across all test points")
    print("2. If average offset is -10 seconds:")
    print("   - Claims appear 10 seconds too early")
    print("   - Audio is delayed by 10 seconds")
    print("   - Fix: Add 10000ms to all claim timestamps")
    print()
    print("3. If average offset is +10 seconds:")
    print("   - Claims appear 10 seconds too late")
    print("   - Audio starts 10 seconds earlier")
    print("   - Fix: Subtract 10000ms from all claim timestamps")
    print()
    print("4. Apply the fix in listening-view.tsx around line 346:")
    print("   const AUDIO_OFFSET_MS = -10000; // Adjust based on your findings")
    print("   const currentTimeMs = (episode.currentTime * 1000) + AUDIO_OFFSET_MS;")
    print()


def quick_test_specific_timestamps():
    """Test a few specific well-known timestamps."""
    print(f"\n{'='*80}")
    print(f"QUICK TEST: Specific Known Timestamps")
    print(f"{'='*80}\n")
    
    test_points = [
        (160, "It turns out that if you train a planarian"),
        (27130, "And the first thing is planaria are immortal"),
        (32850, "that right there tells you that these theories of thermodynamic"),
        (152770, "Now you've gone from physics to true cognition"),
    ]
    
    print("🎯 Test these specific points in your browser:\n")
    
    for ms, expected_text in test_points:
        seconds = ms / 1000
        timestamp = format_timestamp(ms)
        print(f"⏱️  Go to {timestamp} ({seconds:.2f}s)")
        print(f"   Should hear: \"{expected_text}\"")
        print()
    
    print("\nIf you hear something different at ALL these points by the same amount,")
    print("you have an audio offset issue that needs to be fixed in the frontend.")


if __name__ == "__main__":
    import sys
    
    episode_id = sys.argv[1] if len(sys.argv) > 1 else "lex_325"
    
    # Run both tests
    quick_test_specific_timestamps()
    find_distinctive_claims(episode_id, num_test_points=5)



