#!/usr/bin/env python3
"""
Interactive calibration tool to find the exact audio offset.

This helps you determine the precise offset between your audio file and transcript timestamps.
"""

import json
from pathlib import Path


def load_claims(episode_id: str):
    """Load claims with timing from cache."""
    cache_path = Path(__file__).parent.parent / "cache" / f"podcast_{episode_id}_claims_with_timing.json"
    
    if not cache_path.exists():
        print(f"❌ File not found: {cache_path}")
        return []
    
    with open(cache_path) as f:
        data = json.load(f)
    
    # Extract claims with timing
    claims = []
    for segment_key, segment in data.get('segments', {}).items():
        if 'claims' in segment:
            for claim in segment['claims']:
                if 'timing' in claim and claim['timing'].get('start_ms'):
                    claims.append({
                        'start_ms': claim['timing']['start_ms'],
                        'start_s': claim['timing']['start_ms'] / 1000,
                        'text': claim.get('claim_text', '')[:100],
                        'quote': claim.get('transcript_quote', '')[:150]
                    })
    
    return sorted(claims, key=lambda x: x['start_ms'])


def format_time(seconds):
    """Format seconds as MM:SS"""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"


def main():
    print("\n" + "="*80)
    print("AUDIO OFFSET CALIBRATION TOOL")
    print("="*80)
    print("\nThis tool helps you find the exact offset between your audio file")
    print("and the transcript timestamps.\n")
    
    episode_id = "lex_325"
    claims = load_claims(episode_id)
    
    if not claims:
        print("❌ No claims found")
        return
    
    print(f"✅ Loaded {len(claims)} claims\n")
    print("="*80)
    print("\n📋 CALIBRATION CLAIMS (use these to find the offset):\n")
    
    # Show a few claims spread throughout the podcast
    test_claims = [
        claims[0],  # First claim
        claims[len(claims)//4],  # 25%
        claims[len(claims)//2],  # 50%
        claims[3*len(claims)//4],  # 75%
    ]
    
    for i, claim in enumerate(test_claims, 1):
        print(f"{i}. TRANSCRIPT TIME: {format_time(claim['start_s'])} ({claim['start_s']:.1f}s)")
        print(f"   TEXT: \"{claim['text']}...\"")
        print(f"   QUOTE: \"{claim['quote']}...\"")
        print()
    
    print("="*80)
    print("\n📝 INSTRUCTIONS:")
    print("\n1. Go to http://localhost:3000 and play the podcast")
    print("2. For EACH claim above, note when you HEAR those exact words")
    print("3. Calculate the difference:")
    print("   OFFSET = (When you heard it) - (Transcript time)")
    print("\nExample:")
    print("   - Transcript says: 2:30 (150s)")
    print("   - You hear it at: 4:47 (287s)")
    print("   - Offset = 287 - 150 = 137 seconds")
    print("\n4. If the offset is consistent across all test claims, that's your offset!")
    print("\n5. Update AUDIO_OFFSET_MS in frontend/components/listening-view.tsx:")
    print("   const AUDIO_OFFSET_MS = -137000 // (negative of your offset in milliseconds)")
    print("\n" + "="*80)
    
    # Interactive mode
    print("\n🎯 QUICK OFFSET CALCULATOR\n")
    
    try:
        transcript_time = input("Enter transcript time when claim should appear (in seconds, e.g., 150): ").strip()
        actual_time = input("Enter actual time when you heard it in audio (in seconds, e.g., 287): ").strip()
        
        if transcript_time and actual_time:
            offset = float(actual_time) - float(transcript_time)
            offset_ms = int(offset * 1000)
            
            print(f"\n✅ CALCULATED OFFSET: {offset:.1f} seconds ({offset_ms}ms)")
            print(f"\n📝 Set this in your code:")
            print(f"   const AUDIO_OFFSET_MS = {-offset_ms} // Negative: subtract from audio time")
            print(f"\nThis means: when audio plays at {format_time(float(actual_time))}, claims from {format_time(float(transcript_time))} will appear.\n")
    except (ValueError, KeyboardInterrupt):
        print("\n\nSkipped calculator.")
    
    print("\n" + "="*80 + "\n")


if __name__ == "__main__":
    main()


