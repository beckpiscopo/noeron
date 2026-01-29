#!/usr/bin/env python3
"""
Test Gemini 3 Flash Agentic Vision on extracted paper figures.

Uses the code_execution tool to enable Gemini's Think -> Act -> Observe loop
for enhanced figure analysis including data extraction from graphs.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent
METADATA_PATH = ROOT_DIR / "data" / "figures_metadata.json"

logger = logging.getLogger("agentic_vision_test")


@dataclass
class FigureAnalysis:
    """Result of analyzing a single figure with Agentic Vision."""
    figure_id: str
    paper_id: str
    image_path: str
    caption: Optional[str]
    success: bool
    used_code_execution: bool = False
    analysis_text: Optional[str] = None
    code_executed: Optional[str] = None
    code_output: Optional[str] = None
    error: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = field(default=None, repr=False)


def load_figures_metadata() -> Dict[str, List[Dict]]:
    """Load figures metadata from JSON file."""
    if not METADATA_PATH.exists():
        raise FileNotFoundError(
            f"Figures metadata not found at {METADATA_PATH}. "
            "Run extract_figures.py first."
        )

    with open(METADATA_PATH) as f:
        data = json.load(f)

    return data.get("figures_by_paper", {})


def get_figures_to_test(
    figures_by_paper: Dict[str, List[Dict]],
    limit: int = 5,
    paper_id: Optional[str] = None,
    figure_id: Optional[str] = None,
) -> List[Dict]:
    """
    Select figures to test based on CLI arguments.

    Returns list of figure metadata dicts with image_path populated.
    """
    figures = []

    if paper_id and figure_id:
        # Specific figure requested
        paper_figures = figures_by_paper.get(paper_id, [])
        for fig in paper_figures:
            if fig.get("figure_id") == figure_id and fig.get("image_path"):
                figures.append(fig)
                break
        if not figures:
            logger.warning(
                "Figure %s not found in paper %s (or has no image)",
                figure_id, paper_id
            )
    elif paper_id:
        # All figures from specific paper
        paper_figures = figures_by_paper.get(paper_id, [])
        figures = [f for f in paper_figures if f.get("image_path")]
        if limit:
            figures = figures[:limit]
    else:
        # Sample from all papers
        for pid, paper_figures in figures_by_paper.items():
            for fig in paper_figures:
                if fig.get("image_path"):
                    figures.append(fig)
                    if len(figures) >= limit:
                        break
            if len(figures) >= limit:
                break

    return figures


def build_analysis_prompt(caption: Optional[str]) -> str:
    """Build the prompt for figure analysis."""
    base_prompt = """Analyze this scientific figure from a research paper.

Please provide:
1. A description of what the figure shows (type of visualization, main elements)
2. Key data points or measurements if this is a graph/chart (use code execution to extract precise values if helpful)
3. Identification of any labeled components (panel labels like A, B, C, axis labels, legends)
4. Any notable patterns or trends visible in the data

If this figure contains quantitative data (graphs, charts, plots), use the code execution capability to:
- Zoom into specific regions for better reading of values
- Annotate important data points
- Extract approximate numerical values from axes

Be thorough but concise in your analysis."""

    if caption:
        return f"""{base_prompt}

The paper's caption for this figure is:
"{caption}"

Use the caption to guide your analysis and verify what you observe matches the described content."""

    return base_prompt


def analyze_figure_with_agentic_vision(
    figure: Dict,
    client: Any,  # google.genai.Client
    model: str = "gemini-2.0-flash",
) -> FigureAnalysis:
    """
    Analyze a single figure using Gemini's Agentic Vision.

    Uses the code_execution tool to enable the Think -> Act -> Observe loop.
    """
    from google.genai import types

    figure_id = figure["figure_id"]
    paper_id = figure["paper_id"]
    image_path = ROOT_DIR / figure["image_path"]
    caption = figure.get("caption")

    result = FigureAnalysis(
        figure_id=figure_id,
        paper_id=paper_id,
        image_path=str(image_path),
        caption=caption,
        success=False,
    )

    if not image_path.exists():
        result.error = f"Image file not found: {image_path}"
        return result

    try:
        # Read the image
        with open(image_path, "rb") as f:
            image_bytes = f.read()

        # Build the prompt
        prompt = build_analysis_prompt(caption)

        # Configure for Agentic Vision with code execution
        config = types.GenerateContentConfig(
            tools=[types.Tool(code_execution=types.ToolCodeExecution())],
            temperature=0.3,
        )

        # Create the multimodal content
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
            types.Part.from_text(text=prompt),
        ]

        # Call the model
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=config,
        )

        # Parse the response
        result.raw_response = {
            "text": response.text if hasattr(response, "text") else None,
            "candidates_count": len(response.candidates) if response.candidates else 0,
        }

        # Check for code execution parts
        analysis_parts = []
        for candidate in response.candidates or []:
            for part in candidate.content.parts or []:
                # Check for different part types
                if hasattr(part, "text") and part.text:
                    analysis_parts.append(part.text)

                if hasattr(part, "executable_code") and part.executable_code:
                    result.used_code_execution = True
                    result.code_executed = part.executable_code.code

                if hasattr(part, "code_execution_result") and part.code_execution_result:
                    result.used_code_execution = True
                    result.code_output = part.code_execution_result.output

        result.analysis_text = "\n\n".join(analysis_parts) if analysis_parts else response.text
        result.success = True

    except Exception as e:
        result.error = str(e)
        logger.error("Failed to analyze %s/%s: %s", paper_id, figure_id, e)

    return result


def print_analysis_result(result: FigureAnalysis, verbose: bool = False) -> None:
    """Print a single analysis result to console."""
    status = "[OK]" if result.success else "[FAIL]"
    code_exec = "[CODE]" if result.used_code_execution else ""

    print(f"\n{status} {code_exec} {result.paper_id}/{result.figure_id}")
    print(f"   Image: {result.image_path}")

    if result.caption:
        caption_preview = result.caption[:100] + "..." if len(result.caption) > 100 else result.caption
        print(f"   Caption: {caption_preview}")

    if result.success and result.analysis_text:
        # Print first few lines of analysis
        lines = result.analysis_text.strip().split("\n")
        preview_lines = lines[:5] if not verbose else lines
        for line in preview_lines:
            print(f"   {line}")
        if len(lines) > 5 and not verbose:
            print(f"   ... ({len(lines) - 5} more lines)")

    if result.used_code_execution and result.code_executed:
        print(f"   Code executed: {result.code_executed[:100]}...")

    if result.error:
        print(f"   Error: {result.error}")


def save_results(results: List[FigureAnalysis], output_path: Path) -> None:
    """Save analysis results to JSON file."""
    data = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_analyzed": len(results),
        "successful": sum(1 for r in results if r.success),
        "used_code_execution": sum(1 for r in results if r.used_code_execution),
        "results": [
            {
                "figure_id": r.figure_id,
                "paper_id": r.paper_id,
                "image_path": r.image_path,
                "caption": r.caption,
                "success": r.success,
                "used_code_execution": r.used_code_execution,
                "analysis_text": r.analysis_text,
                "code_executed": r.code_executed,
                "code_output": r.code_output,
                "error": r.error,
            }
            for r in results
        ],
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    logger.info("Results saved to %s", output_path)


def main():
    parser = argparse.ArgumentParser(
        description="Test Gemini 3 Flash Agentic Vision on paper figures",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Number of figures to test (default: 5)",
    )
    parser.add_argument(
        "--paper-id",
        type=str,
        default=None,
        help="Test figures from specific paper",
    )
    parser.add_argument(
        "--figure-id",
        type=str,
        default=None,
        help="Test specific figure (requires --paper-id)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Save results to JSON file",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gemini-2.0-flash",
        help="Gemini model to use (default: gemini-2.0-flash)",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show full analysis output",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    # Check for API key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable not set.")
        print("\nTo use this script, set your Gemini API key:")
        print("  export GEMINI_API_KEY='your-api-key-here'")
        print("\nYou can get an API key from: https://aistudio.google.com/apikey")
        sys.exit(1)

    # Validate arguments
    if args.figure_id and not args.paper_id:
        parser.error("--figure-id requires --paper-id")

    # Load figures metadata
    try:
        figures_by_paper = load_figures_metadata()
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)

    # Select figures to test
    figures = get_figures_to_test(
        figures_by_paper,
        limit=args.limit,
        paper_id=args.paper_id,
        figure_id=args.figure_id,
    )

    if not figures:
        logger.error("No figures found to test")
        sys.exit(1)

    logger.info("Testing Agentic Vision on %d figures", len(figures))

    # Initialize Gemini client
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
    except Exception as e:
        logger.error("Failed to initialize Gemini client: %s", e)
        sys.exit(1)

    # Analyze each figure
    results: List[FigureAnalysis] = []
    for i, figure in enumerate(figures, 1):
        logger.info(
            "Analyzing figure %d/%d: %s/%s",
            i, len(figures), figure["paper_id"], figure["figure_id"]
        )

        result = analyze_figure_with_agentic_vision(
            figure=figure,
            client=client,
            model=args.model,
        )
        results.append(result)
        print_analysis_result(result, verbose=args.verbose)

    # Print summary
    successful = sum(1 for r in results if r.success)
    used_code = sum(1 for r in results if r.used_code_execution)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total figures analyzed: {len(results)}")
    print(f"Successful analyses:    {successful}/{len(results)}")
    print(f"Used code execution:    {used_code}/{len(results)}")

    if args.output:
        save_results(results, Path(args.output))


if __name__ == "__main__":
    main()
