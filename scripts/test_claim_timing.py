#!/usr/bin/env python3
"""
Test script to verify claim timing synchronization with podcast audio.

This script:
1. Loads claims from Supabase with their start_ms timestamps
2. Loads the transcript with word-level timing
3. Finds what's actually being said at each claim's timestamp
4. Reports any mismatches or timing offsets
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional


def load_transcript_with_timing(episode_id: str) -> Dict:
    """Load the full transcript with word-level timing."""
    cache_path = Path(__file__).parent.parent / "cache" / f"podcast_{episode_id}_claims_with_timing.json"
    
    if not cache_path.exists():
        print(f"❌ Transcript file not found: {cache_path}")
        return {}
    
    with open(cache_path, 'r') as f:
        data = json.load(f)
    
    return data


def find_text_at_timestamp(segments: Dict, timestamp_ms: int, window_ms: int = 5000) -> Optional[Dict]:
    """
    Find what text is being spoken at a given timestamp.
    
    Args:
        segments: Dict of segments from transcript
        timestamp_ms: The timestamp to check (in milliseconds)
        window_ms: How many milliseconds before/after to include in context
    
    Returns:
        Dict with the text found and confidence
    """
    # Collect all words with their timing
    all_words = []
    
    for segment_key, segment in segments.items():
        if 'claims' not in segment:
            continue
            
        for claim in segment['claims']:
            if 'timing' in claim and 'words' in claim['timing']:
                for word in claim['timing']['words']:
                    all_words.append({
                        'text': word['text'],
                        'start_ms': word['start_ms'],
                        'end_ms': word['end_ms'],
                        'claim_text': claim['claim_text']
                    })
    
    # Sort by start time
    all_words.sort(key=lambda w: w['start_ms'])
    
    # Find words around the timestamp
    words_at_timestamp = []
    context_before = []
    context_after = []
    
    for word in all_words:
        # Check if this word is being spoken at the timestamp
        if word['start_ms'] <= timestamp_ms <= word['end_ms']:
            words_at_timestamp.append(word['text'])
        
        # Collect context before (within window)
        elif word['end_ms'] < timestamp_ms and word['end_ms'] >= (timestamp_ms - window_ms):
            context_before.append(word['text'])
        
        # Collect context after (within window)
        elif word['start_ms'] > timestamp_ms and word['start_ms'] <= (timestamp_ms + window_ms):
            context_after.append(word['text'])
    
    if not words_at_timestamp and not context_before and not context_after:
        return None
    
    return {
        'exact_words': ' '.join(words_at_timestamp) if words_at_timestamp else '(silence)',
        'context_before': ' '.join(context_before[-10:]) if context_before else '',
        'context_after': ' '.join(context_after[:10]) if context_after else '',
        'timestamp_ms': timestamp_ms
    }


def test_claim_timing(episode_id: str = "lex_325", max_claims: int = 10):
    """
    Test claim timing by checking what's actually being said at each claim's timestamp.
    """
    print(f"\n{'='*80}")
    print(f"TESTING CLAIM TIMING SYNCHRONIZATION FOR {episode_id}")
    print(f"{'='*80}\n")
    
    # Load transcript first to extract claims
    print("📄 Loading transcript with timing...")
    transcript_data = load_transcript_with_timing(episode_id)
    
    if not transcript_data or 'segments' not in transcript_data:
        print("❌ Could not load transcript")
        return
    
    print(f"✅ Loaded transcript with {len(transcript_data['segments'])} segments")
    
    # Extract claims from transcript
    print("📊 Extracting claims from transcript...")
    claims = []
    for segment_key, segment in transcript_data['segments'].items():
        if 'claims' in segment:
            for claim in segment['claims']:
                if 'timing' in claim and claim['timing'].get('start_ms'):
                    claims.append({
                        'id': segment_key + '_' + str(len(claims)),
                        'start_ms': claim['timing']['start_ms'],
                        'end_ms': claim['timing'].get('end_ms', 0),
                        'claim_text': claim.get('claim_text', ''),
                        'distilled_claim': None  # Not in JSON
                    })
    
    if not claims:
        print("❌ No claims found in transcript")
        return
    
    print(f"✅ Extracted {len(claims)} claims from transcript\n")
    
    
    # Filter valid claims and sort by start_ms
    valid_claims = [c for c in claims if c.get('start_ms', 0) > 0]
    valid_claims.sort(key=lambda c: c['start_ms'])
    
    print(f"📋 Testing first {max_claims} claims...\n")
    print(f"{'='*80}\n")
    
    mismatches = []
    matches = []
    
    for i, claim in enumerate(valid_claims[:max_claims]):
        claim_id = claim['id']
        claim_start_ms = claim['start_ms']
        claim_text = claim.get('claim_text', '')
        distilled = claim.get('distilled_claim', '')
        
        print(f"\n🔍 CLAIM #{i+1} (ID: {claim_id})")
        print(f"{'─'*80}")
        print(f"📍 Timestamp: {claim_start_ms}ms ({claim_start_ms/1000:.2f}s / {claim_start_ms/60000:.2f}min)")
        print(f"\n💬 Claim Text:")
        print(f"   {claim_text[:150]}{'...' if len(claim_text) > 150 else ''}")
        if distilled:
            print(f"\n🎯 Distilled:")
            print(f"   {distilled}")
        
        # Find what's being said at this timestamp
        audio_context = find_text_at_timestamp(transcript_data['segments'], claim_start_ms)
        
        if audio_context:
            print(f"\n🎧 What's Actually Being Said at {claim_start_ms/1000:.2f}s:")
            print(f"   Exact: \"{audio_context['exact_words']}\"")
            if audio_context['context_before']:
                print(f"   Before: \"...{audio_context['context_before']}\"")
            if audio_context['context_after']:
                print(f"   After: \"{audio_context['context_after']}...\"")
            
            # Check if the audio context matches the claim
            claim_words = set(claim_text.lower().split()[:10])  # First 10 words of claim
            audio_words = set((audio_context['exact_words'] + ' ' + 
                             audio_context['context_before'] + ' ' + 
                             audio_context['context_after']).lower().split())
            
            # Calculate word overlap
            overlap = len(claim_words & audio_words)
            overlap_percent = (overlap / len(claim_words) * 100) if claim_words else 0
            
            if overlap_percent > 30:  # If more than 30% words match
                print(f"\n✅ MATCH: {overlap_percent:.0f}% word overlap")
                matches.append({
                    'claim_id': claim_id,
                    'timestamp_ms': claim_start_ms,
                    'overlap_percent': overlap_percent
                })
            else:
                print(f"\n⚠️  POSSIBLE MISMATCH: Only {overlap_percent:.0f}% word overlap")
                mismatches.append({
                    'claim_id': claim_id,
                    'timestamp_ms': claim_start_ms,
                    'overlap_percent': overlap_percent,
                    'claim_text': claim_text[:100],
                    'audio_text': audio_context['exact_words'] + ' ' + audio_context['context_after'][:100]
                })
        else:
            print(f"\n❌ NO AUDIO FOUND at this timestamp (might be silence or gap)")
            mismatches.append({
                'claim_id': claim_id,
                'timestamp_ms': claim_start_ms,
                'overlap_percent': 0,
                'claim_text': claim_text[:100],
                'audio_text': '(no audio found)'
            })
    
    # Summary
    print(f"\n\n{'='*80}")
    print(f"SUMMARY")
    print(f"{'='*80}\n")
    print(f"✅ Matches: {len(matches)}/{max_claims} ({len(matches)/max_claims*100:.0f}%)")
    print(f"⚠️  Mismatches: {len(mismatches)}/{max_claims} ({len(mismatches)/max_claims*100:.0f}%)")
    
    if mismatches:
        print(f"\n\n⚠️  MISMATCHED CLAIMS:")
        print(f"{'─'*80}")
        for mismatch in mismatches:
            print(f"\nClaim ID {mismatch['claim_id']} at {mismatch['timestamp_ms']/1000:.2f}s:")
            print(f"  Claim: {mismatch['claim_text']}")
            print(f"  Audio: {mismatch['audio_text']}")
            print(f"  Overlap: {mismatch['overlap_percent']:.0f}%")
    
    # Check for consistent offset
    print(f"\n\n{'='*80}")
    print(f"OFFSET ANALYSIS")
    print(f"{'='*80}\n")
    print("Checking if there's a consistent time offset between claims and audio...")
    print("(This would suggest all timestamps need to be shifted by a fixed amount)")
    
    # To detect offset, we'd need to search for each claim text in the transcript
    # and compare the found timestamp to the claim's timestamp
    print("\n💡 To detect offset, try these manual checks:")
    print(f"   1. Play audio at {valid_claims[0]['start_ms']/1000:.2f}s")
    print(f"   2. Listen for: \"{valid_claims[0].get('claim_text', '')[:80]}...\"")
    print(f"   3. If you hear it 10s earlier, offset is -10000ms")
    print(f"   4. If you hear it 10s later, offset is +10000ms")


if __name__ == "__main__":
    import sys
    
    episode_id = sys.argv[1] if len(sys.argv) > 1 else "lex_325"
    max_claims = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    
    test_claim_timing(episode_id, max_claims)

