#!/usr/bin/env python3
"""
Enrich claims with word-level timing from transcript.

This script:
1. Loads transcript with word-level timestamps
2. Loads claims data
3. Matches claim text to transcript words using fuzzy matching
4. Outputs claims enriched with word-level timing data
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from difflib import SequenceMatcher


def load_json(filepath: Path) -> Any:
    """Load JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: Any, filepath: Path):
    """Save JSON file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def normalize_text(text: str) -> str:
    """Normalize text for matching (lowercase, remove punctuation)."""
    # Remove punctuation and extra whitespace
    text = re.sub(r'[^\w\s]', ' ', text.lower())
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def timestamp_to_ms(timestamp: str) -> int:
    """Convert timestamp string (HH:MM:SS.mmm) to milliseconds."""
    try:
        # Remove any prefix like "lex_325|"
        if '|' in timestamp:
            timestamp = timestamp.split('|')[1]
        
        # Parse HH:MM:SS.mmm
        parts = timestamp.split(':')
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds_parts = parts[2].split('.')
        seconds = int(seconds_parts[0])
        milliseconds = int(seconds_parts[1]) if len(seconds_parts) > 1 else 0
        
        total_ms = (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds
        return total_ms
    except:
        return 0


def timestamp_to_ms(timestamp: str) -> int:
    """Convert timestamp string (HH:MM:SS.mmm) to milliseconds."""
    try:
        # Remove any 'lex_325|' prefix if present
        if '|' in timestamp:
            timestamp = timestamp.split('|')[1] if len(timestamp.split('|')) > 1 else timestamp
        
        # Parse HH:MM:SS.mmm format
        parts = timestamp.split(':')
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds_parts = parts[2].split('.')
            seconds = int(seconds_parts[0])
            milliseconds = int(seconds_parts[1]) if len(seconds_parts) > 1 else 0
            
            total_ms = (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds
            return total_ms
    except:
        pass
    
    return 0


def find_word_sequence_in_transcript(
    claim_words: List[str],
    transcript_words: List[Dict],
    min_match_ratio: float = 0.6  # Lowered from 0.7
) -> Optional[Tuple[int, int, float]]:
    """
    Find a sequence of words in the transcript using sliding window + fuzzy matching.
    
    Returns: (start_index, end_index, match_score) or None
    """
    claim_len = len(claim_words)
    transcript_len = len(transcript_words)
    
    if claim_len == 0 or transcript_len == 0:
        return None
    
    best_match = None
    best_score = 0
    
    claim_text = ' '.join(claim_words)
    
    # Try multiple window sizes to handle paraphrasing
    window_sizes = [
        int(claim_len * 1.0),  # Exact size
        int(claim_len * 1.3),  # 30% larger
        int(claim_len * 1.5),  # 50% larger
        int(claim_len * 0.7),  # 30% smaller (for summaries)
    ]
    
    # Slide window through transcript
    for i in range(transcript_len - min(claim_len, 5) + 1):
        for window_size in window_sizes:
            end_idx = min(i + window_size, transcript_len)
            window_words = [normalize_text(transcript_words[j]['text']) 
                           for j in range(i, end_idx)]
            window_text = ' '.join(window_words)
            
            # Use SequenceMatcher for fuzzy matching
            ratio = SequenceMatcher(None, claim_text, window_text).ratio()
            
            # Also try matching just the beginning of the claim (first 20 words)
            if len(claim_words) > 20:
                claim_prefix = ' '.join(claim_words[:20])
                prefix_ratio = SequenceMatcher(None, claim_prefix, window_text[:len(claim_prefix)*2]).ratio()
                # Use the better score
                ratio = max(ratio, prefix_ratio * 0.9)  # Slight penalty for prefix-only match
            
            if ratio > best_score:
                best_score = ratio
                best_match = (i, end_idx, ratio)
    
    if best_match and best_match[2] >= min_match_ratio:
        return best_match
    
    return None


def enrich_claim_with_timing(
    claim: Dict[str, Any],
    transcript_words: List[Dict],
    segment_timestamp: str,
    segment_text: str = ""
) -> Dict[str, Any]:
    """
    Enrich a single claim with word-level timing.
    """
    # Handle malformed claims (strings instead of dicts)
    if not isinstance(claim, dict):
        print(f"⚠ Skipping malformed claim (not a dict): {str(claim)[:80]}")
        return {'claim_text': str(claim), 'error': 'Malformed claim'}
    
    claim_text = claim.get('claim_text', '')
    if not claim_text:
        return claim
    
    # Normalize and split claim into words
    normalized_claim = normalize_text(claim_text)
    claim_words = normalized_claim.split()
    
    # Optional: narrow search to segment region if we have segment text
    search_words = transcript_words
    search_offset = 0
    
    if segment_text:
        # Try to find rough segment location
        segment_normalized = normalize_text(segment_text[:200])  # First 200 chars
        segment_start_words = segment_normalized.split()[:20]
        
        # Find where this segment starts in transcript
        for i in range(len(transcript_words) - 20):
            window = [normalize_text(transcript_words[j]['text']) 
                     for j in range(i, min(i + 20, len(transcript_words)))]
            if any(w in ' '.join(window) for w in segment_start_words[:5]):
                # Search in a window around this location (±1000 words)
                search_offset = max(0, i - 100)
                end = min(len(transcript_words), i + 1000)
                search_words = transcript_words[search_offset:end]
                break
    
    # Find matching sequence in transcript
    match = find_word_sequence_in_transcript(claim_words, search_words)
    
    if match:
        start_idx, end_idx, score = match
        
        # Adjust indices if we narrowed the search
        actual_start = start_idx + search_offset
        actual_end = end_idx + search_offset
        
        # Extract matched words with timing
        matched_words = transcript_words[actual_start:actual_end]
        
        # Add timing information to claim
        enriched_claim = claim.copy()
        enriched_claim['timing'] = {
            'start_ms': matched_words[0]['start'] if matched_words else 0,
            'end_ms': matched_words[-1]['end'] if matched_words else 0,
            'match_confidence': round(score, 3),
            'word_count': len(matched_words),
            'words': [
                {
                    'text': w['text'],
                    'start_ms': w['start'],
                    'end_ms': w['end'],
                    'confidence': w.get('confidence', 1.0),
                    'speaker': w.get('speaker', '')
                }
                for w in matched_words
            ]
        }
        
        print(f"✓ Matched claim (score: {score:.2f}): {claim_text[:80]}...")
        return enriched_claim
    else:
        # Fallback: Use segment-level timing
        print(f"⚠ Using fallback timing for: {claim_text[:80]}...")
        segment_start_ms = timestamp_to_ms(segment_timestamp)
        
        fallback_claim = claim.copy()
        fallback_claim['timing'] = {
            'start_ms': segment_start_ms,
            'end_ms': segment_start_ms + 30000,  # 30 second window
            'match_confidence': 0.0,
            'fallback': True,
            'fallback_reason': 'No word-level match found - using segment timestamp',
            'word_count': 0,
            'words': []
        }
        return fallback_claim


def enrich_claims_with_timing(
    claims_path: Path,
    transcript_path: Path,
    output_path: Path
):
    """
    Main function to enrich all claims with timing data.
    """
    print(f"Loading claims from: {claims_path}")
    claims_data = load_json(claims_path)
    
    print(f"Loading transcript from: {transcript_path}")
    transcript_data = load_json(transcript_path)
    transcript_words = transcript_data.get('words', [])
    
    print(f"\nFound {len(transcript_words)} words in transcript")
    
    # Process each segment
    segments = claims_data.get('segments', {})
    total_claims = 0
    exact_matches = 0
    fallback_matches = 0
    
    print(f"\nProcessing {len(segments)} segments...\n")
    
    for segment_id, segment in segments.items():
        segment_claims = segment.get('claims', [])
        total_claims += len(segment_claims)
        
        print(f"\nSegment: {segment_id}")
        print(f"Timestamp: {segment.get('timestamp')}")
        print(f"Claims: {len(segment_claims)}")
        
        # Enrich each claim
        enriched_claims = []
        segment_text = segment.get('transcript_text', '')
        for claim in segment_claims:
            try:
                enriched = enrich_claim_with_timing(
                    claim, 
                    transcript_words,
                    segment.get('timestamp', ''),
                    segment_text
                )
                enriched_claims.append(enriched)
                
                if 'timing' in enriched:
                    if enriched['timing'].get('fallback', False):
                        fallback_matches += 1
                    else:
                        exact_matches += 1
            except Exception as e:
                print(f"⚠ Error processing claim: {e}")
                print(f"  Claim data: {str(claim)[:100]}")
                # Add the claim anyway with error flag
                enriched_claims.append(claim if isinstance(claim, dict) else {'error': str(e)})
        
        # Update segment with enriched claims
        segment['claims'] = enriched_claims
    
    # Save enriched data
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Total claims: {total_claims}")
    print(f"  ✓ Exact word-level matches: {exact_matches} ({exact_matches/total_claims*100:.1f}%)")
    print(f"  ⚠ Fallback segment timing: {fallback_matches} ({fallback_matches/total_claims*100:.1f}%)")
    print(f"  Total enriched: {exact_matches + fallback_matches} ({(exact_matches + fallback_matches)/total_claims*100:.1f}%)")
    print(f"\nSaving enriched claims to: {output_path}")
    save_json(claims_data, output_path)
    print("✓ Done!")


if __name__ == '__main__':
    # Paths
    project_root = Path(__file__).parent.parent
    claims_path = project_root / 'cache' / 'podcast_lex_325_claims.json'
    transcript_path = project_root / 'data' / 'cleaned_papers' / 'f46991b7-42f6-4842-a913-68e1877d298a.raw.json'
    output_path = project_root / 'cache' / 'podcast_lex_325_claims_with_timing.json'
    
    # Run enrichment
    enrich_claims_with_timing(claims_path, transcript_path, output_path)

