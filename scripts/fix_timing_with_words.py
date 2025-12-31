#!/usr/bin/env python3
"""
Fix Claim Timing Using Word-Level Data

This script improves timing accuracy for fallback claims by:
1. Loading the word-level transcript data (with precise timestamps)
2. For each claim, finding the best matching position in the word data
3. Using keyword matching (not full text match) to find claim positions
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
    """Save JSON file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def normalize_word(word: str) -> str:
    """Normalize a word for matching."""
    return re.sub(r'[^\w]', '', word.lower())


def extract_keywords(text: str, min_length: int = 4) -> List[str]:
    """Extract significant keywords from text."""
    stop_words = {'this', 'that', 'what', 'when', 'where', 'which', 'with', 
                  'they', 'them', 'their', 'there', 'these', 'those',
                  'have', 'been', 'were', 'will', 'would', 'could', 'should',
                  'from', 'into', 'about', 'just', 'like', 'make', 'made',
                  'some', 'very', 'also', 'because', 'really', 'basically'}
    
    words = re.findall(r'\b\w+\b', text.lower())
    keywords = [w for w in words if len(w) >= min_length and w not in stop_words]
    return keywords[:15]  # Return up to 15 keywords


def find_keywords_in_transcript(
    keywords: List[str],
    transcript_words: List[Dict],
    min_matches: int = 3
) -> Optional[Tuple[int, int, float]]:
    """
    Find where keywords appear in the transcript.
    
    Returns: (start_index, end_index, match_score) or None
    """
    if len(keywords) < 2 or len(transcript_words) < 10:
        return None
    
    # Create word list for searching
    word_texts = [normalize_word(w.get('text', '')) for w in transcript_words]
    
    # Sliding window search
    window_size = min(len(keywords) * 3, 50)  # Adaptive window
    best_match = None
    best_score = 0
    
    for i in range(len(word_texts) - window_size + 1):
        window = word_texts[i:i + window_size]
        
        # Count keyword matches in window
        matches = sum(1 for kw in keywords if kw in window)
        score = matches / len(keywords)
        
        if matches >= min_matches and score > best_score:
            best_score = score
            # Find the span of matched keywords
            first_match = None
            last_match = None
            for j, w in enumerate(window):
                if w in keywords:
                    if first_match is None:
                        first_match = j
                    last_match = j
            
            if first_match is not None and last_match is not None:
                best_match = (i + first_match, i + last_match + 1, score)
    
    if best_match and best_match[2] >= 0.3:  # At least 30% keywords matched
        return best_match
    
    return None


def find_phrase_start(
    phrase: str,
    transcript_words: List[Dict],
    min_words: int = 5  # Increased from 3 for better specificity
) -> Optional[int]:
    """Find where a phrase starts in the transcript (first few words)."""
    # Use MORE words for matching to avoid false positives
    all_phrase_words = [normalize_word(w) for w in phrase.split()]
    
    # Use up to 8 words for matching, minimum 5
    num_words = min(8, max(min_words, len(all_phrase_words)))
    phrase_words = all_phrase_words[:num_words]
    
    if len(phrase_words) < min_words:
        return None
    
    word_texts = [normalize_word(w.get('text', '')) for w in transcript_words]
    
    for i in range(len(word_texts) - len(phrase_words) + 1):
        window = word_texts[i:i + len(phrase_words)]
        if window == phrase_words:
            return i
    
    # Try with slightly fewer words if exact match fails
    if len(phrase_words) > min_words:
        shorter_phrase = phrase_words[:min_words]
        for i in range(len(word_texts) - len(shorter_phrase) + 1):
            window = word_texts[i:i + len(shorter_phrase)]
            if window == shorter_phrase:
                return i
    
    return None


def fix_claim_timing(
    claim: Dict[str, Any],
    transcript_words: List[Dict],
    segment_start_ms: int
) -> Dict[str, Any]:
    """Fix timing for a single claim using word-level data."""
    claim_text = claim.get('claim_text', '')
    timing = claim.get('timing', {})
    
    if not claim_text or not timing.get('fallback', False):
        return claim  # Already has good timing or no timing needed
    
    # Try phrase matching first (most accurate)
    phrase_idx = find_phrase_start(claim_text, transcript_words, min_words=4)
    if phrase_idx is not None:
        start_ms = transcript_words[phrase_idx].get('start', 
                   transcript_words[phrase_idx].get('start_ms', 0))
        
        # Update timing
        timing['start_ms'] = start_ms
        timing['end_ms'] = start_ms + 15000
        timing['match_method'] = 'phrase_match'
        timing['fallback_reason'] = f'Fixed with phrase match at word index {phrase_idx}'
        return claim
    
    # Try keyword matching
    keywords = extract_keywords(claim_text)
    if len(keywords) >= 3:
        match = find_keywords_in_transcript(keywords, transcript_words, min_matches=3)
        if match:
            start_idx, end_idx, score = match
            start_ms = transcript_words[start_idx].get('start',
                       transcript_words[start_idx].get('start_ms', 0))
            
            # Update timing
            timing['start_ms'] = start_ms
            timing['end_ms'] = start_ms + 15000
            timing['match_method'] = 'keyword_match'
            timing['match_score'] = round(score, 3)
            timing['fallback_reason'] = f'Fixed with keyword match (score={score:.2f})'
            return claim
    
    # Keep original fallback timing
    return claim


def fix_all_claims(
    claims_path: Path,
    transcript_path: Path,
    output_path: Optional[Path] = None
) -> Dict[str, int]:
    """Fix timing for all fallback claims."""
    print(f"Loading claims from: {claims_path}")
    claims_data = load_json(claims_path)
    
    print(f"Loading transcript from: {transcript_path}")
    transcript_data = load_json(transcript_path)
    transcript_words = transcript_data.get('words', [])
    print(f"Found {len(transcript_words)} words with timing")
    
    stats = {
        'total': 0,
        'already_accurate': 0,
        'fixed_phrase': 0,
        'fixed_keyword': 0,
        'kept_fallback': 0
    }
    
    segments = claims_data.get('segments', {})
    
    for seg_id, segment in segments.items():
        segment_timestamp = segment.get('timestamp', '00:00:00')
        
        # Parse segment start ms
        try:
            parts = segment_timestamp.split(':')
            h, m = int(parts[0]), int(parts[1])
            s = float(parts[2]) if len(parts) > 2 else 0
            segment_start_ms = int((h * 3600 + m * 60 + s) * 1000)
        except:
            segment_start_ms = 0
        
        claims = segment.get('claims', [])
        
        for claim in claims:
            stats['total'] += 1
            
            if not isinstance(claim, dict):
                continue
            
            timing = claim.get('timing', {})
            
            if not timing.get('fallback', False):
                stats['already_accurate'] += 1
                continue
            
            old_ms = timing.get('start_ms', 0)
            
            # Try to fix the timing
            fixed_claim = fix_claim_timing(claim, transcript_words, segment_start_ms)
            
            new_ms = fixed_claim.get('timing', {}).get('start_ms', 0)
            match_method = fixed_claim.get('timing', {}).get('match_method', '')
            
            if match_method == 'phrase_match':
                stats['fixed_phrase'] += 1
                diff = abs(new_ms - old_ms) / 1000
                if diff > 10:
                    mins = int(new_ms / 60000)
                    secs = int((new_ms % 60000) / 1000)
                    print(f"  Fixed (phrase): {mins:02d}:{secs:02d} - {claim.get('claim_text', '')[:50]}...")
            elif match_method == 'keyword_match':
                stats['fixed_keyword'] += 1
                diff = abs(new_ms - old_ms) / 1000
                if diff > 10:
                    mins = int(new_ms / 60000)
                    secs = int((new_ms % 60000) / 1000)
                    print(f"  Fixed (keyword): {mins:02d}:{secs:02d} - {claim.get('claim_text', '')[:50]}...")
            else:
                stats['kept_fallback'] += 1
    
    # Save results
    output = output_path or claims_path
    print(f"\nSaving to: {output}")
    save_json(claims_data, output)
    
    return stats


def main():
    project_root = Path(__file__).parent.parent
    
    claims_path = project_root / 'cache' / 'podcast_lex_325_claims_with_timing.json'
    transcript_path = project_root / 'data' / 'cleaned_papers' / 'f46991b7-42f6-4842-a913-68e1877d298a.raw.json'
    output_path = project_root / 'cache' / 'podcast_lex_325_claims_with_timing_v2.json'
    
    print("=" * 70)
    print("FIX TIMING WITH WORD-LEVEL DATA")
    print("=" * 70)
    print()
    
    stats = fix_all_claims(claims_path, transcript_path, output_path)
    
    print()
    print("=" * 70)
    print("RESULTS")
    print("=" * 70)
    print(f"Total claims: {stats['total']}")
    print(f"Already accurate: {stats['already_accurate']}")
    print(f"Fixed with phrase match: {stats['fixed_phrase']}")
    print(f"Fixed with keyword match: {stats['fixed_keyword']}")
    print(f"Kept position-based: {stats['kept_fallback']}")
    print()
    print(f"Output: {output_path}")


if __name__ == '__main__':
    main()

