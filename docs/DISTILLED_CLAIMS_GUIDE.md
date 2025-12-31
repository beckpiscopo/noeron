# Distilled Claims Guide

## Overview

The **Distilled Claims** feature generates short, scannable summaries for the Live Research Stream. Instead of showing long transcript quotes or dense paper titles, listeners see punchy 10-15 word summaries that capture the "wait, really?" moment of each finding.

## The Problem We're Solving

**Before:**
```
❌ "It turns out that if you train a planarian and then cut their heads off, 
    the tail will regenerate a brand new brain that still remembers the 
    original information."
    (Too long, rambling)

❌ "Bioelectric signaling regulates size in zebrafish fins"
    (Academic jargon, unclear impact)
```

**After:**
```
✓ "Planarian worms retain memories even after their brains are removed"
   (10 words, clear, intriguing)

✓ "Zebrafish fins use electrical signals to control their size"
   (10 words, specific, understandable)
```

## Architecture

### 1. Core Module: `claim_distiller.py`

The main distillation engine with two key components:

**ClaimDistiller Class:**
- Uses Gemini 2.0 Flash for fast, high-quality generation
- Takes transcript quote + matched paper → outputs 10-15 word summary
- Handles retries if first attempt is too long
- Batch processing support

**DISTILL_PROMPT Template:**
- Comprehensive prompt with examples and rules
- Enforces: brevity, specificity, scannable format, punchy tone
- Avoids: meta-commentary, hedging, academic jargon

### 2. Batch Processing: `enrich_claims_with_distillation.py`

Enriches existing claim caches with distilled summaries:
- Loads claims from JSON cache
- Fetches paper abstracts from `data/cleaned_papers/`
- Generates distilled_claim for each claim
- Saves enriched cache back to disk

Modes:
- **Full enrichment**: Process all claims and save
- **Preview mode**: Test on N samples without saving
- **Force regenerate**: Overwrite existing distilled claims

### 3. Data Model Updates: `context_card_builder.py`

Added `distilled_claim` field to `ContextCard` dataclass:

```python
@dataclass
class ContextCard:
    # ... existing fields ...
    distilled_claim: Optional[str] = None  # New field
```

## Usage

### Test the Distiller

```bash
cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2

# Run standalone test with hardcoded examples
python scripts/claim_distiller.py
```

### Preview Distillations (Recommended First Step)

```bash
# Preview 5 sample distillations without saving
python scripts/enrich_claims_with_distillation.py \
  cache/podcast_lex_325_claims_with_timing.json \
  --preview 5
```

This shows you:
- Original transcript quote
- Matched paper title
- Generated distilled claim
- Word count

Perfect for testing the prompt and verifying quality before processing all claims.

### Enrich Full Cache

```bash
# Process all claims and add distilled_claim field
python scripts/enrich_claims_with_distillation.py \
  cache/podcast_lex_325_claims_with_timing.json

# Or specify output path
python scripts/enrich_claims_with_distillation.py \
  cache/podcast_lex_325_claims_with_timing.json \
  --output cache/podcast_lex_325_claims_distilled.json

# Force regeneration of existing distilled claims
python scripts/enrich_claims_with_distillation.py \
  cache/podcast_lex_325_claims_with_timing.json \
  --force
```

### Integrate into Pipeline

To add distillation to your claim generation pipeline, modify `context_card_builder.py`:

```python
from claim_distiller import ClaimDistiller, DistillationInput

# After building a ContextCard:
distiller = ClaimDistiller()
distill_input = DistillationInput(
    transcript_quote=claim.text,
    paper_title=card.paper_title,
    paper_abstract=paper_abstract,  # Fetch from cleaned_papers
    paper_excerpt=card.rationale,
    section_heading=card.section,
)
result = distiller.distill(distill_input)
if result.success:
    card.distilled_claim = result.distilled_claim
```

## Prompt Engineering Details

### Key Design Principles

1. **Examples over rules**: The prompt includes 8 before/after examples
2. **Negative examples**: Shows common mistakes (too long, too vague, meta-commentary)
3. **Forced brevity**: Max 50 output tokens, temperature 0.7 for creativity within constraints
4. **Retry logic**: If first attempt is >15 words, retry with stronger emphasis

### Prompt Structure

```
1. Context setting (who you are, what you're creating)
2. Input format (transcript, paper title, abstract, excerpt)
3. Requirements (SHORT, SPECIFIC, SCANNABLE, PUNCHY)
4. Examples (BAD vs GOOD pairs)
5. Rules (NO meta-commentary, NO hedging, START with surprise, etc.)
6. Output format (ONLY the claim, max 15 words)
```

### Customization Points

If you want to adjust the style:

**Make it more technical:**
```python
# In DISTILL_PROMPT, change:
"Is SCANNABLE (can be read in 2 seconds)"
→ "Includes mechanism/technique when relevant"
```

**Make it more sensational:**
```python
# In DISTILL_PROMPT, add:
"Lead with the most surprising/counterintuitive element"
"Use power words (reveal, breakthrough, hidden, etc.)"
```

**Adjust length:**
```python
# In ClaimDistiller.distill(), change:
max_output_tokens=50  # Higher = allows longer outputs
# And in prompt:
"10-15 words MAXIMUM"  → "8-12 words MAXIMUM"
```

## Frontend Integration

Once claims are enriched, update your frontend to display `distilled_claim`:

```typescript
// In listening-view.tsx or wherever you render cards:

interface ClaimCard {
  claim_text: string;        // Full transcript quote
  paper_title: string;       // Academic title
  distilled_claim?: string;  // New field - short summary
  // ... other fields
}

// Render logic:
<Card>
  {/* Primary text - use distilled claim if available */}
  <h3>{card.distilled_claim || card.claim_text}</h3>
  
  {/* Show paper title as secondary info */}
  <p className="text-sm text-muted">{card.paper_title}</p>
  
  {/* Expand to see full transcript quote */}
  <CollapsibleContent>
    <p>{card.claim_text}</p>
  </CollapsibleContent>
</Card>
```

### Recommended UI Pattern

```
┌─────────────────────────────────────────┐
│ Planarian worms retain memories after   │  ← Distilled claim (primary)
│ brain removal                          │
│                                         │
│ 📄 Memory transfer in regenerated...   │  ← Paper title (secondary)
│ ⏱️ 00:03:24                            │  ← Timestamp
│                                         │
│ [Expand for full quote →]             │  ← Expandable
└─────────────────────────────────────────┘
```

## Quality Assurance

### What Makes a Good Distilled Claim?

✓ **Passes the "glance test"**: Can you understand it in 2 seconds?  
✓ **Creates curiosity**: Does it make you want to know more?  
✓ **Self-contained**: No dangling references or unclear context  
✓ **Specific**: Names the organism/system/finding when possible  
✓ **Active voice**: "X does Y" not "Y is done by X"  

### Common Issues & Fixes

**Issue: Too vague**
```
❌ "Computational models have limitations"
✓ "Current brain simulations miss biological decision-making"
```

**Issue: Too academic**
```
❌ "Bioelectric signaling modulates morphogenetic outcomes"
✓ "Electrical signals control body shape during development"
```

**Issue: Too long**
```
❌ "Researchers discovered that planarian worms can regenerate their brains while retaining memories"
✓ "Planarian worms retain memories after brain regeneration"
```

**Issue: Meta-commentary**
```
❌ "This paper shows that cells communicate electrically"
✓ "Cells communicate using electrical signals"
```

## Performance

- **Speed**: ~2-3 seconds per claim (Gemini 2.0 Flash)
- **Cost**: ~$0.0001 per claim (50 input tokens + 15 output tokens)
- **Batch processing**: Process 100 claims in ~5 minutes

For a typical 2-hour podcast with 50 claims:
- **Total time**: ~3 minutes
- **Total cost**: ~$0.005 (half a cent)

## Troubleshooting

### "GEMINI_API_KEY environment variable required"

```bash
export GEMINI_API_KEY="your-key-here"
```

Or add to `.env` file in project root.

### Distillations are too long

Adjust the prompt to be more aggressive:

```python
# In DISTILL_PROMPT:
"10-15 words MAXIMUM" → "10 words MAXIMUM (12 word hard limit)"
```

Or reduce max_output_tokens:

```python
# In ClaimDistiller.distill():
max_output_tokens=50 → max_output_tokens=30
```

### Distillations are too generic

Add more paper context:

```python
# In claim_distiller.py, increase abstract length:
paper_abstract=input_data.paper_abstract[:500]
→ paper_abstract=input_data.paper_abstract[:800]
```

## Future Enhancements

1. **A/B Testing Framework**: Test different distillations with real users
2. **Style Presets**: "Technical", "General Audience", "Sensational" modes
3. **Human-in-the-Loop**: Flag low-confidence distillations for manual review
4. **Contextual Adaptation**: Adjust style based on podcast topic/audience
5. **Multi-language Support**: Generate distillations in multiple languages

## Related Files

- `scripts/claim_distiller.py` - Core distillation engine
- `scripts/enrich_claims_with_distillation.py` - Batch enrichment script
- `scripts/context_card_builder.py` - ContextCard data model (updated)
- `cache/podcast_lex_325_claims_with_timing.json` - Example input
- `data/cleaned_papers/` - Paper abstracts (used for context)

## Questions?

- Check examples in `claim_distiller.py` main() function
- Run preview mode to see distillations without committing
- Adjust DISTILL_PROMPT for different styles
- Read prompt engineering comments for customization points

