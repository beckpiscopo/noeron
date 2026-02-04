# Agentic Vision Figure Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI-powered analysis of scientific paper figures using Gemini 3 Flash's Agentic Vision capability, integrated into the deep-exploration page.

**Architecture:** Three-phase approach: (1) Extract figure images from PDFs using GROBID coordinates, (2) Test Agentic Vision quality on sample figures, (3) Integrate into deep-exploration-view as a new collapsible section showing figure analysis alongside claims.

**Tech Stack:** Python (pdf2image, Pillow), Gemini 3 Flash with code_execution tool, Next.js/React frontend, Supabase Storage for figure images.

---

## Phase 1: Figure Extraction Pipeline

### Task 1.1: Create Figure Extraction Script

**Files:**
- Create: `scripts/extract_figures.py`

**Step 1: Write the extraction script**

```python
#!/usr/bin/env python3
"""
Extract figure images from PDFs using GROBID-extracted coordinates.

Reads the raw_tei from GROBID JSON files, parses figure coordinates,
and extracts figure images from the corresponding PDFs.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from xml.etree import ElementTree as ET
from typing import Optional

from pdf2image import convert_from_path
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
GROBID_DIR = DATA_DIR / "grobid_fulltext"
PDF_DIR = DATA_DIR / "pdfs"
FIGURES_DIR = DATA_DIR / "figure_images"
FIGURES_INDEX = DATA_DIR / "figures_metadata.json"

TEI_NS = {"tei": "http://www.tei-c.org/ns/1.0"}

logger = logging.getLogger("figure_extractor")


def parse_coords(coords_str: str) -> Optional[dict]:
    """Parse GROBID coords string: 'page,x1,y1,x2,y2' (points, 72 DPI)."""
    if not coords_str:
        return None
    parts = coords_str.split(",")
    if len(parts) < 5:
        return None
    try:
        return {
            "page": int(parts[0]),
            "x1": float(parts[1]),
            "y1": float(parts[2]),
            "x2": float(parts[3]),
            "y2": float(parts[4]),
        }
    except (ValueError, IndexError):
        return None


def extract_figures_from_tei(tei_xml: str, paper_id: str) -> list[dict]:
    """Extract figure metadata from TEI XML."""
    figures = []
    try:
        root = ET.fromstring(tei_xml)
    except ET.ParseError:
        return figures

    for idx, fig in enumerate(root.findall(".//tei:figure", TEI_NS)):
        label_el = fig.find(".//tei:label", TEI_NS)
        head_el = fig.find(".//tei:head", TEI_NS)
        desc_el = fig.find(".//tei:figDesc", TEI_NS)
        graphic_el = fig.find(".//tei:graphic", TEI_NS)

        label = label_el.text.strip() if label_el is not None and label_el.text else None
        head = head_el.text.strip() if head_el is not None and head_el.text else None
        caption = desc_el.text.strip() if desc_el is not None and desc_el.text else None
        coords = parse_coords(graphic_el.get("coords") if graphic_el is not None else None)

        if coords:  # Only include figures with extractable coordinates
            figures.append({
                "figure_id": f"{paper_id}_fig_{idx}",
                "paper_id": paper_id,
                "label": label,
                "title": head,
                "caption": caption,
                "coords": coords,
                "image_path": None,  # Filled after extraction
            })

    return figures


def extract_figure_image(
    pdf_path: Path,
    coords: dict,
    output_path: Path,
    dpi: int = 150,
    padding: int = 10,
) -> bool:
    """Extract a figure region from a PDF page."""
    try:
        # Convert just the target page (1-indexed in pdf2image)
        pages = convert_from_path(
            pdf_path,
            dpi=dpi,
            first_page=coords["page"],
            last_page=coords["page"],
        )
        if not pages:
            return False

        page_img = pages[0]

        # GROBID coords are in points (72 DPI), scale to target DPI
        scale = dpi / 72.0
        x1 = max(0, int(coords["x1"] * scale) - padding)
        y1 = max(0, int(coords["y1"] * scale) - padding)
        x2 = min(page_img.width, int(coords["x2"] * scale) + padding)
        y2 = min(page_img.height, int(coords["y2"] * scale) + padding)

        # Crop and save
        cropped = page_img.crop((x1, y1, x2, y2))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(output_path, "PNG", optimize=True)
        return True

    except Exception as e:
        logger.warning(f"Failed to extract figure from {pdf_path}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Extract figures from PDFs")
    parser.add_argument("--limit", type=int, help="Max papers to process")
    parser.add_argument("--paper-id", type=str, help="Process single paper")
    parser.add_argument("--dpi", type=int, default=150, help="Output DPI")
    parser.add_argument("--force", action="store_true", help="Re-extract existing")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    # Load existing index or start fresh
    if FIGURES_INDEX.exists() and not args.force:
        existing = json.loads(FIGURES_INDEX.read_text())
    else:
        existing = {"figures": [], "stats": {}}

    existing_ids = {f["figure_id"] for f in existing.get("figures", [])}
    all_figures = list(existing.get("figures", []))

    # Process GROBID files
    grobid_files = sorted(GROBID_DIR.glob("*.json"))
    if args.paper_id:
        grobid_files = [f for f in grobid_files if args.paper_id in f.stem]
    if args.limit:
        grobid_files = grobid_files[:args.limit]

    extracted_count = 0
    skipped_count = 0

    for grobid_path in grobid_files:
        paper_id = grobid_path.stem

        try:
            data = json.loads(grobid_path.read_text())
            tei_xml = data.get("raw_tei", "")
            pdf_path_str = data.get("pdf_path", "")
        except Exception as e:
            logger.warning(f"Failed to read {grobid_path}: {e}")
            continue

        if not tei_xml:
            continue

        pdf_path = Path(pdf_path_str)
        if not pdf_path.exists():
            # Try to find PDF in PDF_DIR
            pdf_path = PDF_DIR / f"{paper_id}.pdf"
            if not pdf_path.exists():
                logger.warning(f"PDF not found for {paper_id}")
                continue

        figures = extract_figures_from_tei(tei_xml, paper_id)

        for fig in figures:
            if fig["figure_id"] in existing_ids:
                skipped_count += 1
                continue

            output_path = FIGURES_DIR / paper_id / f"{fig['figure_id']}.png"
            success = extract_figure_image(pdf_path, fig["coords"], output_path, args.dpi)

            if success:
                fig["image_path"] = str(output_path.relative_to(ROOT_DIR))
                all_figures.append(fig)
                existing_ids.add(fig["figure_id"])
                extracted_count += 1
                logger.info(f"Extracted {fig['figure_id']}")
            else:
                skipped_count += 1

    # Save updated index
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    output = {
        "figures": all_figures,
        "stats": {
            "total_figures": len(all_figures),
            "papers_with_figures": len({f["paper_id"] for f in all_figures}),
        },
    }
    FIGURES_INDEX.write_text(json.dumps(output, indent=2))

    logger.info(f"Done: {extracted_count} extracted, {skipped_count} skipped")
    logger.info(f"Total figures indexed: {len(all_figures)}")


if __name__ == "__main__":
    main()
```

**Step 2: Add dependencies**

Run: `uv add pdf2image pillow`

Note: pdf2image requires poppler. On macOS: `brew install poppler`

**Step 3: Test the extraction script on 3 papers**

Run: `python scripts/extract_figures.py --limit 3`

Expected: Creates `data/figure_images/` directory with PNG files and `data/figures_metadata.json` index.

**Step 4: Verify extraction quality**

Run: `ls -la data/figure_images/ && head -50 data/figures_metadata.json`

Expected: PNG files of reasonable size (50KB-500KB), metadata with captions.

**Step 5: Commit**

```bash
git add scripts/extract_figures.py pyproject.toml uv.lock
git commit -m "feat: add figure extraction script using GROBID coordinates"
```

---

### Task 1.2: Run Full Figure Extraction

**Step 1: Extract all figures**

Run: `python scripts/extract_figures.py`

Expected: Extracts ~400 figures across 79 papers (based on earlier analysis).

**Step 2: Verify stats**

Run: `python -c "import json; d=json.load(open('data/figures_metadata.json')); print(f\"Figures: {d['stats']['total_figures']}, Papers: {d['stats']['papers_with_figures']}\")"

Expected: ~400 figures, ~79 papers

**Step 3: Check sample images visually**

Open a few PNG files in `data/figure_images/` to verify quality.

**Step 4: Commit extracted data**

```bash
git add data/figures_metadata.json
git commit -m "data: index 400+ extracted figure metadata"
```

Note: Don't commit actual PNG files to git (too large). They can be regenerated.

---

## Phase 2: Agentic Vision Testing

### Task 2.1: Create Agentic Vision Test Script

**Files:**
- Create: `scripts/test_agentic_vision.py`

**Step 1: Write the test script**

```python
#!/usr/bin/env python3
"""
Test Gemini 3 Flash Agentic Vision on extracted paper figures.

Tests the Think → Act → Observe loop with code_execution for:
- Figure analysis and description
- Data extraction from graphs
- Annotation of key findings
"""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path

from google import genai
from google.genai import types

ROOT_DIR = Path(__file__).resolve().parent.parent
FIGURES_INDEX = ROOT_DIR / "data" / "figures_metadata.json"


def load_image_as_base64(image_path: Path) -> str:
    """Load image and encode as base64."""
    with open(image_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def analyze_figure_with_agentic_vision(
    client: genai.Client,
    image_path: Path,
    caption: str | None,
    paper_title: str | None,
) -> dict:
    """
    Analyze a scientific figure using Agentic Vision.

    Uses code_execution tool to enable Think → Act → Observe loop.
    """

    # Load image
    image_data = load_image_as_base64(image_path)

    # Build prompt
    context = ""
    if paper_title:
        context += f"This figure is from the paper: {paper_title}\n"
    if caption:
        context += f"Original caption: {caption}\n"

    prompt = f"""Analyze this scientific figure from a bioelectricity research paper.

{context}

Your task:
1. Describe what the figure shows (experimental setup, data visualization, diagram, etc.)
2. If this is a graph or chart, extract any key data points or trends
3. If there are labeled components, identify and explain each
4. Highlight the key scientific finding or insight this figure demonstrates

Use code execution if helpful to:
- Zoom into regions that are hard to read
- Annotate important features
- Calculate or measure aspects of the data shown

Provide a structured analysis suitable for helping a podcast listener understand this figure."""

    # Configure with code_execution for Agentic Vision
    config = types.GenerateContentConfig(
        tools=[types.Tool(code_execution=types.ToolCodeExecution())],
        temperature=0.3,
    )

    # Create content with image
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_bytes(
                    data=base64.standard_b64decode(image_data),
                    mime_type="image/png",
                ),
                types.Part.from_text(prompt),
            ],
        )
    ]

    # Call Gemini 3 Flash with Agentic Vision
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=contents,
        config=config,
    )

    # Extract results
    result = {
        "analysis": "",
        "code_executed": False,
        "annotations": [],
    }

    for part in response.candidates[0].content.parts:
        if hasattr(part, "text") and part.text:
            result["analysis"] += part.text
        if hasattr(part, "executable_code"):
            result["code_executed"] = True
        if hasattr(part, "code_execution_result"):
            result["code_executed"] = True

    return result


def main():
    parser = argparse.ArgumentParser(description="Test Agentic Vision on figures")
    parser.add_argument("--limit", type=int, default=5, help="Number of figures to test")
    parser.add_argument("--paper-id", type=str, help="Test figures from specific paper")
    parser.add_argument("--figure-id", type=str, help="Test specific figure")
    parser.add_argument("--output", type=Path, help="Save results to JSON file")
    args = parser.parse_args()

    # Check for API key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable required")
        return

    # Initialize client
    client = genai.Client(api_key=api_key)

    # Load figure index
    if not FIGURES_INDEX.exists():
        print(f"Error: Run extract_figures.py first to create {FIGURES_INDEX}")
        return

    index = json.loads(FIGURES_INDEX.read_text())
    figures = index.get("figures", [])

    # Filter figures
    if args.figure_id:
        figures = [f for f in figures if f["figure_id"] == args.figure_id]
    elif args.paper_id:
        figures = [f for f in figures if f["paper_id"] == args.paper_id]

    # Limit
    figures = figures[:args.limit]

    if not figures:
        print("No figures found matching criteria")
        return

    print(f"Testing Agentic Vision on {len(figures)} figures...\n")

    results = []
    for fig in figures:
        image_path = ROOT_DIR / fig["image_path"]
        if not image_path.exists():
            print(f"Skipping {fig['figure_id']}: image not found")
            continue

        print(f"Analyzing {fig['figure_id']}...")
        print(f"  Caption: {(fig.get('caption') or 'None')[:100]}...")

        try:
            result = analyze_figure_with_agentic_vision(
                client=client,
                image_path=image_path,
                caption=fig.get("caption"),
                paper_title=fig.get("title"),
            )

            print(f"  Code executed: {result['code_executed']}")
            print(f"  Analysis preview: {result['analysis'][:200]}...")
            print()

            results.append({
                "figure_id": fig["figure_id"],
                "paper_id": fig["paper_id"],
                "caption": fig.get("caption"),
                **result,
            })

        except Exception as e:
            print(f"  Error: {e}")
            results.append({
                "figure_id": fig["figure_id"],
                "error": str(e),
            })

    # Save results
    if args.output:
        args.output.write_text(json.dumps(results, indent=2))
        print(f"Results saved to {args.output}")

    # Summary
    successful = [r for r in results if "error" not in r]
    code_used = [r for r in successful if r.get("code_executed")]
    print(f"\nSummary:")
    print(f"  Successful: {len(successful)}/{len(results)}")
    print(f"  Used code execution: {len(code_used)}/{len(successful)}")


if __name__ == "__main__":
    main()
```

**Step 2: Add google-genai dependency if not present**

Run: `uv add google-genai` (if not already in pyproject.toml)

**Step 3: Test on 3 figures**

Run: `GEMINI_API_KEY=your_key python scripts/test_agentic_vision.py --limit 3 --output data/agentic_vision_test_results.json`

Expected: Successful analysis of 3 figures with structured output.

**Step 4: Review results quality**

Run: `cat data/agentic_vision_test_results.json | python -m json.tool | head -100`

Evaluate:
- Does the analysis capture key scientific content?
- Did code execution add value (zoom, annotation)?
- Is the output suitable for podcast listeners?

**Step 5: Commit test script**

```bash
git add scripts/test_agentic_vision.py
git commit -m "feat: add Agentic Vision test script for figure analysis"
```

---

### Task 2.2: Evaluate Agentic Vision Quality

**Step 1: Run larger test (10-20 figures)**

Run: `GEMINI_API_KEY=your_key python scripts/test_agentic_vision.py --limit 20 --output data/agentic_vision_full_test.json`

**Step 2: Manual quality review**

Review the output and answer:
1. Are analyses scientifically accurate?
2. Do they add value beyond the caption?
3. Is code execution being used effectively?
4. Are there any hallucinations or errors?

**Step 3: Document decision**

If quality is good → Proceed to Phase 3 (Integration)
If quality is poor → Document issues, consider adjustments or skip feature

---

## Phase 3: Backend Integration

### Task 3.1: Add Figure Analysis MCP Tool

**Files:**
- Modify: `src/bioelectricity_research/server.py` (add tool)
- Modify: `src/bioelectricity_research/http_server.py` (add endpoint)

**Step 1: Add Pydantic models for figure analysis**

In `server.py`, add after existing model definitions (~line 200):

```python
class AnalyzeFigureInput(BaseModel):
    """Input for figure analysis."""
    paper_id: str = Field(..., description="Paper ID to find figures for")
    figure_id: Optional[str] = Field(None, description="Specific figure ID, or analyze all")
    claim_context: Optional[str] = Field(None, description="Related claim text for context")


class FigureAnalysis(BaseModel):
    """Result of Agentic Vision figure analysis."""
    figure_id: str
    paper_id: str
    image_url: str
    caption: Optional[str]
    analysis: str
    key_findings: list[str]
    relevance_to_claim: Optional[str]
    code_executed: bool
```

**Step 2: Add figure loading helper**

```python
FIGURES_INDEX_PATH = DATA_DIR / "figures_metadata.json"


def _load_figures_index() -> dict:
    """Load the figures metadata index."""
    if not FIGURES_INDEX_PATH.exists():
        return {"figures": [], "stats": {}}
    return json.loads(FIGURES_INDEX_PATH.read_text())


def _get_figures_for_paper(paper_id: str) -> list[dict]:
    """Get all figures for a specific paper."""
    index = _load_figures_index()
    return [f for f in index.get("figures", []) if f["paper_id"] == paper_id]
```

**Step 3: Add the MCP tool**

```python
@mcp.tool()
async def analyze_paper_figures(params: AnalyzeFigureInput) -> dict[str, Any]:
    """
    Analyze scientific figures from a paper using Gemini 3 Flash Agentic Vision.

    Uses the Think → Act → Observe loop with code execution to:
    - Describe figure content and experimental setups
    - Extract data from graphs and charts
    - Identify key scientific findings
    - Relate figures to podcast claims when context provided

    Returns:
        figures: List of analyzed figures with AI insights
        paper_id: The paper analyzed
        total_figures: Number of figures found
    """
    figures = _get_figures_for_paper(params.paper_id)

    if not figures:
        return {"error": f"No figures found for paper {params.paper_id}", "figures": []}

    if params.figure_id:
        figures = [f for f in figures if f["figure_id"] == params.figure_id]

    # Limit to first 5 figures to manage API costs
    figures = figures[:5]

    results = []
    client = _get_gemini_client()

    for fig in figures:
        image_path = ROOT_DIR / fig["image_path"]
        if not image_path.exists():
            continue

        # Load and encode image
        with open(image_path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")

        # Build context-aware prompt
        context = f"Caption: {fig.get('caption', 'No caption')}\n"
        if params.claim_context:
            context += f"Related claim from podcast: {params.claim_context}\n"

        prompt = f"""Analyze this scientific figure from bioelectricity research.

{context}

Provide:
1. A clear description of what the figure shows
2. Key scientific findings or data points
3. How this relates to the claim (if provided)

Keep the analysis concise (2-3 paragraphs) and accessible to non-experts."""

        try:
            config = types.GenerateContentConfig(
                tools=[types.Tool(code_execution=types.ToolCodeExecution())],
                temperature=0.3,
            )

            contents = [
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(
                            data=base64.standard_b64decode(image_data),
                            mime_type="image/png",
                        ),
                        types.Part.from_text(prompt),
                    ],
                )
            ]

            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-3-flash-preview",
                contents=contents,
                config=config,
            )

            analysis_text = ""
            code_executed = False
            for part in response.candidates[0].content.parts:
                if hasattr(part, "text") and part.text:
                    analysis_text += part.text
                if hasattr(part, "executable_code") or hasattr(part, "code_execution_result"):
                    code_executed = True

            results.append({
                "figure_id": fig["figure_id"],
                "paper_id": fig["paper_id"],
                "image_path": fig["image_path"],
                "caption": fig.get("caption"),
                "analysis": analysis_text,
                "code_executed": code_executed,
            })

        except Exception as e:
            logger.warning(f"Failed to analyze figure {fig['figure_id']}: {e}")

    return {
        "paper_id": params.paper_id,
        "figures": results,
        "total_figures": len(results),
    }
```

**Step 4: Add HTTP endpoint**

In `http_server.py`, add:

```python
@app.post("/tools/analyze_paper_figures/execute")
async def http_analyze_paper_figures(request: Request):
    """Analyze figures from a paper using Agentic Vision."""
    try:
        body = await request.json()
        from .server import AnalyzeFigureInput, analyze_paper_figures

        params = AnalyzeFigureInput(**body)
        result = await analyze_paper_figures(params)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)
```

**Step 5: Test the endpoint**

Run server: `uv run python -m bioelectricity_research.http_server`

Test: `curl -X POST http://localhost:8000/tools/analyze_paper_figures/execute -H "Content-Type: application/json" -H "X-Gemini-Key: YOUR_KEY" -d '{"paper_id": "PAPER_ID_HERE"}'`

**Step 6: Commit backend changes**

```bash
git add src/bioelectricity_research/server.py src/bioelectricity_research/http_server.py
git commit -m "feat: add analyze_paper_figures tool with Agentic Vision"
```

---

### Task 3.2: Add Frontend API Function

**Files:**
- Modify: `frontend/lib/api.ts`

**Step 1: Add the API function**

In `api.ts`, add alongside other API functions:

```typescript
export interface FigureAnalysis {
  figure_id: string
  paper_id: string
  image_path: string
  caption: string | null
  analysis: string
  code_executed: boolean
}

export interface AnalyzeFiguresResponse {
  paper_id: string
  figures: FigureAnalysis[]
  total_figures: number
  error?: string
}

export async function analyzePaperFigures(
  paperId: string,
  claimContext?: string
): Promise<AnalyzeFiguresResponse> {
  return callMcpTool<AnalyzeFiguresResponse>("analyze_paper_figures", {
    paper_id: paperId,
    claim_context: claimContext,
  })
}
```

**Step 2: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add analyzePaperFigures API function"
```

---

### Task 3.3: Add Figure Analysis Section to Deep Exploration

**Files:**
- Modify: `frontend/components/deep-exploration-view.tsx`

**Step 1: Add imports and types**

At top of file, add:

```typescript
import { Image as ImageIcon } from "lucide-react"
import { analyzePaperFigures, type FigureAnalysis, type AnalyzeFiguresResponse } from "@/lib/api"
```

**Step 2: Add state for figure analysis**

Inside the component, after other state declarations (~line 245):

```typescript
// Figure Analysis state (Agentic Vision)
const [figureAnalysis, setFigureAnalysis] = useState<AnalyzeFiguresResponse | null>(null)
const [isLoadingFigures, setIsLoadingFigures] = useState(false)
const [figuresError, setFiguresError] = useState<string | null>(null)
const [selectedFigure, setSelectedFigure] = useState<FigureAnalysis | null>(null)
```

**Step 3: Add fetch function**

After other fetch functions (~line 430):

```typescript
// Function to analyze figures from papers in evidence threads
const fetchFigureAnalysis = async (paperId: string) => {
  setIsLoadingFigures(true)
  setFiguresError(null)

  try {
    const data = await analyzePaperFigures(
      paperId,
      synthesis?.claim_text || claim.title
    )

    if (data.error) {
      setFiguresError(data.error)
    } else {
      setFigureAnalysis(data)
      if (data.figures.length > 0) {
        setSelectedFigure(data.figures[0])
      }
    }
  } catch (err) {
    setFiguresError(err instanceof Error ? err.message : "Failed to analyze figures")
    console.error("Error analyzing figures:", err)
  } finally {
    setIsLoadingFigures(false)
  }
}
```

**Step 4: Add Figure Analysis UI section**

After the Knowledge Graph section (~line 884), add:

```tsx
{/* Figure Analysis - Agentic Vision */}
<div className="hidden md:block pt-4">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <ImageIcon className="w-5 h-5 text-[var(--golden-chestnut)]" />
      <h4 className="font-bold text-lg">Paper Figures</h4>
      <span className="text-xs text-foreground/50 bg-[var(--golden-chestnut)]/20 px-2 py-0.5 rounded">
        Agentic Vision
      </span>
    </div>
  </div>

  {/* Paper selector from evidence threads */}
  {contextData?.evidence_threads && contextData.evidence_threads.length > 0 && !figureAnalysis && !isLoadingFigures && (
    <CornerBrackets className="bg-card/30 p-6">
      <p className="text-foreground/60 text-sm mb-4">
        Analyze figures from supporting papers using AI vision
      </p>
      <div className="flex flex-wrap gap-2">
        {contextData.evidence_threads.slice(0, 3).map((thread, idx) => (
          <button
            key={idx}
            onClick={() => fetchFigureAnalysis(thread.paper_id)}
            className="text-xs px-3 py-2 border border-[var(--golden-chestnut)]/50 hover:bg-[var(--golden-chestnut)]/10 text-foreground/80 transition-colors"
          >
            {thread.paper_title.length > 40
              ? thread.paper_title.slice(0, 40) + "..."
              : thread.paper_title}
          </button>
        ))}
      </div>
    </CornerBrackets>
  )}

  {/* Loading State */}
  {isLoadingFigures && (
    <CornerBrackets className="bg-card/30 p-8">
      <div className="flex flex-col items-center justify-center">
        <Loader2 className="w-6 h-6 text-[var(--golden-chestnut)] animate-spin mb-3" />
        <p className="text-foreground/60 text-sm">Analyzing figures with AI...</p>
        <p className="text-foreground/50 text-xs mt-1">Using Agentic Vision to examine graphs and diagrams</p>
      </div>
    </CornerBrackets>
  )}

  {/* Error State */}
  {figuresError && !isLoadingFigures && (
    <div className="bg-red-500/10 border border-red-500/30 rounded-none p-4">
      <p className="text-red-400 text-sm">{figuresError}</p>
    </div>
  )}

  {/* Figure Analysis Results */}
  {figureAnalysis && !isLoadingFigures && !figuresError && (
    <CornerBrackets className="bg-card/30 p-6">
      {/* Figure thumbnails */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {figureAnalysis.figures.map((fig, idx) => (
          <button
            key={fig.figure_id}
            onClick={() => setSelectedFigure(fig)}
            className={`shrink-0 w-20 h-20 border-2 transition-all overflow-hidden ${
              selectedFigure?.figure_id === fig.figure_id
                ? "border-[var(--golden-chestnut)]"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <img
              src={`/api/figures/${fig.image_path}`}
              alt={`Figure ${idx + 1}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Selected figure detail */}
      {selectedFigure && (
        <div className="space-y-4">
          <div className="aspect-video bg-background rounded overflow-hidden">
            <img
              src={`/api/figures/${selectedFigure.image_path}`}
              alt="Selected figure"
              className="w-full h-full object-contain"
            />
          </div>

          {selectedFigure.caption && (
            <p className="text-xs text-foreground/60 italic">
              {selectedFigure.caption}
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--golden-chestnut)]" />
              <span className="text-sm font-medium">AI Analysis</span>
              {selectedFigure.code_executed && (
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                  Enhanced
                </span>
              )}
            </div>
            <MarkdownContent content={selectedFigure.analysis} />
          </div>
        </div>
      )}
    </CornerBrackets>
  )}
</div>
```

**Step 5: Add API route for serving figure images**

Create `frontend/app/api/figures/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const imagePath = params.path.join("/")

  // Security: only allow paths within data/figure_images
  if (!imagePath.startsWith("data/figure_images/")) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    // Adjust path based on your project structure
    const fullPath = join(process.cwd(), "..", imagePath)
    const data = await readFile(fullPath)

    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000",
      },
    })
  } catch (error) {
    return new NextResponse("Not found", { status: 404 })
  }
}
```

**Step 6: Test the integration**

1. Start the backend: `uv run python -m bioelectricity_research.http_server`
2. Start the frontend: `cd frontend && npm run dev`
3. Navigate to a deep exploration page
4. Click on a paper to analyze its figures
5. Verify figures load and analysis displays

**Step 7: Commit frontend changes**

```bash
git add frontend/components/deep-exploration-view.tsx frontend/lib/api.ts frontend/app/api/figures/
git commit -m "feat: add Agentic Vision figure analysis to deep exploration view"
```

---

## Phase 4: Polish and Deploy

### Task 4.1: Upload Figures to Supabase Storage

Instead of serving figures locally, upload to Supabase Storage for production.

**Files:**
- Modify: `scripts/extract_figures.py` (add Supabase upload)
- Modify: `src/bioelectricity_research/server.py` (return Supabase URLs)

**Step 1: Add Supabase upload to extraction script**

Add upload function after extraction:

```python
from supabase import create_client

def upload_to_supabase(local_path: Path, figure_id: str) -> str:
    """Upload figure to Supabase Storage and return public URL."""
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    with open(local_path, "rb") as f:
        result = supabase.storage.from_("paper-figures").upload(
            f"{figure_id}.png",
            f.read(),
            {"content-type": "image/png"},
        )

    return supabase.storage.from_("paper-figures").get_public_url(f"{figure_id}.png")
```

**Step 2: Update server to return Supabase URLs**

Modify `analyze_paper_figures` to return `image_url` instead of `image_path`.

**Step 3: Commit**

```bash
git add scripts/extract_figures.py src/bioelectricity_research/server.py
git commit -m "feat: upload figures to Supabase Storage for production"
```

---

### Task 4.2: Add Loading States and Error Handling

**Files:**
- Modify: `frontend/components/deep-exploration-view.tsx`

Ensure graceful handling of:
- No figures found for a paper
- API key not provided
- Slow Gemini responses
- Rate limiting

**Step 1: Add retry logic and better error messages**

**Step 2: Test error scenarios**

**Step 3: Commit**

```bash
git add frontend/components/deep-exploration-view.tsx
git commit -m "fix: improve figure analysis error handling and loading states"
```

---

## Success Criteria

- [ ] Figure extraction script successfully extracts 400+ figures from PDFs
- [ ] Agentic Vision test shows quality analyses (>80% useful)
- [ ] Backend endpoint returns figure analyses within 10 seconds
- [ ] Frontend displays figures with AI analysis in deep exploration view
- [ ] Feature works in production deployment

## Rollback Plan

If Agentic Vision quality is insufficient:
1. Keep figure extraction pipeline (still useful for future features)
2. Skip backend integration
3. Consider alternative: display figures with captions only (no AI analysis)
