#!/usr/bin/env python3
"""
Fix Fallback Timing - Estimate claim positions within segments.

This script improves the timing accuracy for claims that fell back to segment-level
timestamps by estimating their position within the segment based on:
1. Where the claim text appears in the segment transcript
2. The segment's duration (2 minutes = 120,000 ms)

This provides much better timing than just using the segment start for all claims.
"""

import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from difflib import SequenceMatcher


def load_json(filepath: Path) -> Any:
    """Load JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: Any, filepath: Path):
    """Save JSON file with proper formatting."""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def normalize_text(text: str) -> str:
    """Normalize text for matching."""
    text = re.sub(r'[^\w\s]', ' ', text.lower())
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def find_claim_position_in_segment(
    claim_text: str,
    segment_transcript: str,
    min_match_ratio: float = 0.5
) -> Optional[float]:
    """
    Find where a claim appears in a segment transcript.
    
    Returns a position ratio (0.0 = start, 1.0 = end) or None if not found.
    """
    if not claim_text or not segment_transcript:
        return None
    
    normalized_claim = normalize_text(claim_text)
    normalized_transcript = normalize_text(segment_transcript)
    
    # For short claims, try direct substring matching first
    claim_words = normalized_claim.split()
    
    # Try to find first 5-10 words of claim in transcript
    for num_words in [10, 7, 5, 3]:
        if len(claim_words) >= num_words:
            prefix = ' '.join(claim_words[:num_words])
            pos = normalized_transcript.find(prefix)
            if pos != -1:
                # Found! Return position as ratio
                return pos / max(1, len(normalized_transcript))
    
    # Fallback: sliding window fuzzy match
    claim_len = len(normalized_claim)
    best_pos = None
    best_score = 0
    
    # Use word-based sliding window for efficiency
    transcript_words = normalized_transcript.split()
    claim_word_count = len(claim_words)
    
    for window_size_mult in [1.0, 1.3, 0.7]:
        window_size = max(3, int(claim_word_count * window_size_mult))
        
        for i in range(len(transcript_words) - min(window_size, 3) + 1):
            window = ' '.join(transcript_words[i:i + window_size])
            
            # Quick check: do first few words match?
            if claim_words and transcript_words[i:]:
                if claim_words[0] != transcript_words[i]:
                    # First word doesn't match, skip unless this is a good position
                    if i > 0 and i < len(transcript_words) - 1:
                        # Check if any of first 3 claim words are here
                        if not any(w in transcript_words[i:i+3] for w in claim_words[:3]):
                            continue
            
            ratio = SequenceMatcher(None, normalized_claim[:100], window[:100]).ratio()
            
            if ratio > best_score:
                best_score = ratio
                # Calculate character position from word position
                char_pos = len(' '.join(transcript_words[:i]))
                best_pos = char_pos / max(1, len(normalized_transcript))
    
    if best_score >= min_match_ratio:
        return best_pos
    
    return None


def estimate_timing_from_position(
    position_ratio: float,
    segment_start_ms: int,
    segment_duration_ms: int = 120000  # 2 minutes default
) -> int:
    """
    Estimate a claim's start time based on its position in the segment.
    
    Args:
        position_ratio: 0.0 = segment start, 1.0 = segment end
        segment_start_ms: When the segment starts
        segment_duration_ms: How long the segment is (default 2 minutes)
    
    Returns:
        Estimated start time in milliseconds
    """
    estimated_ms = segment_start_ms + int(position_ratio * segment_duration_ms)
    return estimated_ms


def fix_fallback_timing(
    input_path: Path,
    output_path: Optional[Path] = None,
    segment_duration_ms: int = 120000
) -> Dict[str, int]:
    """
    Fix fallback timing by estimating claim positions within segments.
    
    Returns statistics about what was fixed.
    """
    print(f"Loading claims from: {input_path}")
    data = load_json(input_path)
    
    stats = {
        'total_claims': 0,
        'already_accurate': 0,
        'fixed_with_position': 0,
        'kept_segment_start': 0,
        'no_timing': 0
    }
    
    segments = data.get('segments', {})
    print(f"Processing {len(segments)} segments...")
    
    for seg_id, segment in segments.items():
        segment_transcript = segment.get('transcript_text', '')
        segment_timestamp = segment.get('timestamp', '00:00:00')
        
        # Parse segment start time
        try:
            parts = segment_timestamp.split(':')
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds_parts = parts[2].split('.') if len(parts) > 2 else ['0', '0']
            seconds = int(seconds_parts[0])
            millis = int(seconds_parts[1]) if len(seconds_parts) > 1 else 0
            segment_start_ms = (hours * 3600 + minutes * 60 + seconds) * 1000 + millis
        except:
            segment_start_ms = 0
        
        claims = segment.get('claims', [])
        
        for claim in claims:
            stats['total_claims'] += 1
            
            if not isinstance(claim, dict):
                stats['no_timing'] += 1
                continue
            
            timing = claim.get('timing', {})
            
            if not timing:
                stats['no_timing'] += 1
                continue
            
            # Check if this is a fallback timing that needs fixing
            if timing.get('fallback', False) and timing.get('match_confidence', 0) == 0:
                claim_text = claim.get('claim_text', '')
                
                # Try to find claim position in segment
                position = find_claim_position_in_segment(claim_text, segment_transcript)
                
                if position is not None:
                    # Estimate new timing based on position
                    estimated_ms = estimate_timing_from_position(
                        position, 
                        segment_start_ms, 
                        segment_duration_ms
                    )
                    
                    # Update the timing
                    old_ms = timing.get('start_ms', 0)
                    timing['start_ms'] = estimated_ms
                    timing['end_ms'] = estimated_ms + 15000  # 15 second window
                    timing['position_ratio'] = round(position, 3)
                    timing['fallback_reason'] = (
                        f"Position-estimated within segment ({position*100:.0f}% into transcript)"
                    )
                    timing['estimation_method'] = 'position_in_transcript'
                    
                    # For debugging
                    improvement_sec = abs(estimated_ms - old_ms) / 1000
                    if improvement_sec > 10:
                        print(f"  Adjusted by {improvement_sec:.0f}s: {claim_text[:50]}...")
                    
                    stats['fixed_with_position'] += 1
                else:
                    # Couldn't find position, keep original fallback
                    timing['estimation_method'] = 'segment_start'
                    stats['kept_segment_start'] += 1
            else:
                # Already has accurate timing
                stats['already_accurate'] += 1
    
    # Save results
    output = output_path or input_path
    print(f"\nSaving to: {output}")
    save_json(data, output)
    
    return stats


def main():
    """Main entry point."""
    import sys
    
    project_root = Path(__file__).parent.parent
    
    # Default paths
    input_path = project_root / 'cache' / 'podcast_lex_325_claims_with_timing.json'
    output_path = project_root / 'cache' / 'podcast_lex_325_claims_with_timing_fixed.json'
    
    # Allow custom paths from command line
    if len(sys.argv) > 1:
        input_path = Path(sys.argv[1])
    if len(sys.argv) > 2:
        output_path = Path(sys.argv[2])
    
    print("=" * 70)
    print("FIX FALLBACK TIMING - Estimate claim positions within segments")
    print("=" * 70)
    print()
    
    stats = fix_fallback_timing(input_path, output_path)
    
    print()
    print("=" * 70)
    print("RESULTS")
    print("=" * 70)
    print(f"Total claims: {stats['total_claims']}")
    print(f"Already accurate (word-level): {stats['already_accurate']} ({100*stats['already_accurate']/max(1,stats['total_claims']):.1f}%)")
    print(f"Fixed with position estimation: {stats['fixed_with_position']} ({100*stats['fixed_with_position']/max(1,stats['total_claims']):.1f}%)")
    print(f"Kept segment start (no match): {stats['kept_segment_start']} ({100*stats['kept_segment_start']/max(1,stats['total_claims']):.1f}%)")
    print(f"No timing data: {stats['no_timing']}")
    print()
    print(f"Output saved to: {output_path}")
    print()
    print("Next steps:")
    print("1. Review the fixed timing file")
    print("2. If good, run: cp cache/podcast_lex_325_claims_with_timing_fixed.json cache/podcast_lex_325_claims_with_timing.json")
    print("3. Re-run migration: python3 scripts/migrate_to_supabase.py")


if __name__ == '__main__':
    main()








