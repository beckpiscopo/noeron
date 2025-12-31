"""
Claim Distiller - Generate scannable, punchy summaries for Live Research Stream cards.

Takes transcript segments + matched papers and outputs distilled claims that are:
- SHORT (10-15 words max)
- SPECIFIC (actual finding, not meta-commentary)
- SCANNABLE (quick to read)
- PUNCHY (captures the "wait, really?" moment)
"""

import json
import os
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from pathlib import Path

try:
    from google import genai  # type: ignore[import]
except ImportError:
    genai = None


# =============================================================================
# Prompt Template
# =============================================================================

DISTILL_PROMPT = """You are a science journalist creating a headline for a "Live Research Stream" - a feed that shows research findings in real-time while someone listens to a podcast.

Your job: Distill this scientific claim into a SHORT, PUNCHY summary that makes someone think "wait, really?"

===INPUT===

TRANSCRIPT QUOTE:
"{transcript_quote}"

MATCHED PAPER:
Title: {paper_title}
Abstract: {paper_abstract}
Relevant Section ({section_heading}):
"{paper_excerpt}"

===YOUR TASK===

Generate a distilled claim that:
1. Is 10-15 words MAXIMUM (be ruthless)
2. States the ACTUAL FINDING (not "researchers found that..." or "this paper shows...")
3. Is SPECIFIC (names the organism/system/mechanism if space allows)
4. Captures the SURPRISING or COUNTERINTUITIVE element
5. Is SCANNABLE (can be read in 2 seconds)

===EXAMPLES===

BAD (too long, meta):
"Our simulations do not capture yet the most interesting and powerful things about biology"

GOOD:
"Current computational models miss key biological mechanisms"

BAD (too vague, academic):
"Bioelectric signaling regulates size in zebrafish fins"

GOOD:
"Zebrafish fins use electrical signals to control their size"

BAD (too wordy):
"If you train a planarian and then cut their heads off, the tail will regenerate a brand new brain that still remembers the original information"

GOOD:
"Planarian worms retain memories even after their brains are removed"

BAD (missing the punch):
"Computational approaches to anatomical synthesis"

GOOD:
"AI can design new body structures biology has never seen"

===RULES===

- NO meta-commentary ("this shows", "researchers found", "the paper demonstrates")
- NO hedging unless crucial ("may", "possibly", "suggests")
- START with the surprising element when possible
- Use ACTIVE VOICE
- DROP articles (a/an/the) if you need space
- Numbers/specifics are gold (keep them)
- If the claim is about a limitation/critique, lead with what's MISSING/WRONG

Return ONLY the distilled claim (no explanation, no quotes).
Maximum 15 words. Be ruthless."""


# =============================================================================
# Distiller Class
# =============================================================================

@dataclass
class DistillationInput:
    """Input for claim distillation."""
    transcript_quote: str
    paper_title: str
    paper_abstract: str
    paper_excerpt: str
    section_heading: str
    
    # Optional context for better distillation
    claim_type: Optional[str] = None
    speaker_stance: Optional[str] = None


@dataclass
class DistillationResult:
    """Result of claim distillation."""
    distilled_claim: str
    word_count: int
    success: bool
    error: Optional[str] = None
    
    
class ClaimDistiller:
    """Generate distilled, scannable summaries of scientific claims."""
    
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        """Initialize the distiller with Gemini API."""
        if genai is None:
            raise ImportError("google-genai package required. Install with: pip install google-genai")
        
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable required")
        
        self.model_name = model_name or os.getenv("GEMINI_MODEL", "gemini-3-pro-preview")
        self.client = genai.Client(api_key=self.api_key)
        
    def distill(self, input_data: DistillationInput) -> DistillationResult:
        """
        Distill a scientific claim into a short, punchy summary.
        
        Args:
            input_data: DistillationInput with transcript quote, paper info, etc.
            
        Returns:
            DistillationResult with distilled claim and metadata
        """
        try:
            # Format the prompt
            prompt = DISTILL_PROMPT.format(
                transcript_quote=input_data.transcript_quote[:300],
                paper_title=input_data.paper_title[:200],
                paper_abstract=input_data.paper_abstract[:500],
                paper_excerpt=input_data.paper_excerpt[:800],
                section_heading=input_data.section_heading[:100],
            )
            
            # Generate distilled claim
            # Note: gemini-3-pro-preview is a thinking model that uses 1000-2500 tokens
            # for internal reasoning before output. Token usage varies by claim complexity.
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=3500,  # Very high budget for thinking model
                )
            )
            
            # Extract text from response
            if hasattr(response, 'text') and response.text:
                distilled = response.text.strip().strip('"').strip("'")
            else:
                # gemini-3-pro-preview might return empty response
                raise ValueError(
                    f"Model returned empty response. Finish reason: {response.candidates[0].finish_reason if response.candidates else 'unknown'}"
                )
            
            # Validate length
            word_count = len(distilled.split())
            if word_count > 15:
                # Try once more with stronger emphasis
                retry_prompt = f"{prompt}\n\nYour previous attempt was {word_count} words. You MUST cut it to 15 words or less. Remove all unnecessary words."
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=retry_prompt,
                    config=genai.types.GenerateContentConfig(
                        temperature=0.5,
                        max_output_tokens=3000,  # High for thinking model
                    )
                )
                if response.text:
                    distilled = response.text.strip().strip('"').strip("'")
                    word_count = len(distilled.split())
            
            return DistillationResult(
                distilled_claim=distilled,
                word_count=word_count,
                success=True,
            )
            
        except Exception as e:
            import traceback
            error_details = f"{str(e)}\n{traceback.format_exc()}"
            return DistillationResult(
                distilled_claim="",
                word_count=0,
                success=False,
                error=error_details,
            )
    
    def distill_batch(
        self, 
        inputs: List[DistillationInput],
        show_progress: bool = True
    ) -> List[DistillationResult]:
        """
        Distill multiple claims.
        
        Args:
            inputs: List of DistillationInput objects
            show_progress: Whether to print progress
            
        Returns:
            List of DistillationResult objects
        """
        results = []
        for i, input_data in enumerate(inputs):
            if show_progress:
                print(f"[{i+1}/{len(inputs)}] Distilling claim...")
            
            result = self.distill(input_data)
            results.append(result)
            
            if show_progress:
                if result.success:
                    print(f"  ✓ {result.distilled_claim} ({result.word_count} words)")
                else:
                    print(f"  ✗ Error: {result.error}")
        
        return results


# =============================================================================
# Helper Functions
# =============================================================================

def load_paper_abstract(paper_id: str, papers_dir: Path) -> Optional[str]:
    """Load paper abstract from cleaned_papers directory."""
    paper_file = papers_dir / f"{paper_id}.json"
    if not paper_file.exists():
        # Try variations
        for variation in papers_dir.glob(f"{paper_id}*.json"):
            paper_file = variation
            break
    
    if paper_file.exists():
        try:
            data = json.loads(paper_file.read_text())
            return data.get("abstract") or data.get("Abstract") or ""
        except:
            pass
    
    return ""


def create_distillation_input_from_claim(
    claim_data: Dict[str, Any],
    papers_dir: Path
) -> Optional[DistillationInput]:
    """
    Create DistillationInput from a claim in the cache format.
    
    Args:
        claim_data: A claim dict with claim_text, paper_title, rationale, etc.
        papers_dir: Path to cleaned_papers directory
        
    Returns:
        DistillationInput or None if missing required fields
    """
    transcript_quote = claim_data.get("claim_text")
    paper_title = claim_data.get("paper_title")
    section = claim_data.get("section")
    rationale = claim_data.get("rationale", "")
    
    if not all([transcript_quote, paper_title]):
        return None
    
    # Extract paper excerpt from rationale (contains the snippet)
    paper_excerpt = rationale.replace("Matches the paper section by quoting: ", "").strip() if rationale else ""
    
    # Try to load abstract - extract paper ID from source_link
    source_link = claim_data.get("source_link", "")
    paper_id = ""
    if "Paper ID:" in source_link:
        paper_id = source_link.replace("Paper ID: ", "").strip()
    elif "semanticscholar.org/paper/" in source_link:
        # Extract paper ID from URL: https://semanticscholar.org/paper/{paper_id}
        paper_id = source_link.split("/")[-1]
    
    abstract = load_paper_abstract(paper_id, papers_dir) if paper_id else ""
    
    return DistillationInput(
        transcript_quote=transcript_quote,
        paper_title=paper_title,
        paper_abstract=abstract or "Abstract not available",
        paper_excerpt=paper_excerpt,
        section_heading=section or "Unknown Section",
        claim_type=claim_data.get("claim_type"),
        speaker_stance=claim_data.get("speaker_stance"),
    )


# =============================================================================
# CLI
# =============================================================================

def main():
    """Test the distiller with a few examples."""
    import sys
    
    # Initialize distiller
    distiller = ClaimDistiller()
    
    # Test examples
    test_cases = [
        DistillationInput(
            transcript_quote="It turns out that if you train a planarian and then cut their heads off, the tail will regenerate a brand new brain that still remembers the original information.",
            paper_title="Memory transfer in regenerated planarians",
            paper_abstract="We demonstrate that trained planarian flatworms retain learned behaviors after regeneration of their entire head and brain.",
            paper_excerpt="Our experiments show that trained planarians, after decapitation and regeneration, exhibit the same conditioned responses as before amputation.",
            section_heading="Results",
        ),
        DistillationInput(
            transcript_quote="our simulations do not capture yet the most interesting and powerful things about biology",
            paper_title="Computational approaches to anatomical synthesis: understanding anatomy as an agential material",
            paper_abstract="Current computational models of biological systems fail to capture emergent properties of living tissues.",
            paper_excerpt="Despite advances in simulation technology, our models cannot yet replicate the adaptive, goal-directed behavior seen in biological systems.",
            section_heading="Discussion",
        ),
    ]
    
    print("=" * 80)
    print("CLAIM DISTILLER TEST")
    print("=" * 80)
    
    for i, test in enumerate(test_cases, 1):
        print(f"\nTest Case {i}:")
        print(f"Original: {test.transcript_quote[:100]}...")
        
        result = distiller.distill(test)
        
        if result.success:
            print(f"✓ Distilled: {result.distilled_claim}")
            print(f"  ({result.word_count} words)")
        else:
            print(f"✗ Error: {result.error}")
    
    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()

