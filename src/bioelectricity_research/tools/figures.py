"""Figure analysis tool using Gemini Agentic Vision."""

import logging
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..figure_utils import _analyze_paper_figures_impl
from ..mcp_app import mcp
from ..schemas.figures import FigureAnalysisResponse

logger = logging.getLogger(__name__)


class AnalyzeFigureInput(BaseModel):
    """Input for figure analysis using Agentic Vision."""
    paper_id: str = Field(..., description="Paper ID to find figures for")
    figure_id: Optional[str] = Field(None, description="Specific figure ID, or analyze first 5")
    claim_context: Optional[str] = Field(None, description="Related claim text for context")


@mcp.tool()
async def analyze_paper_figures(params: AnalyzeFigureInput) -> FigureAnalysisResponse:
    """
    Analyze scientific figures from a paper using Gemini vision with Agentic Vision.

    Uses code_execution tool to enable enhanced analysis (zoom, annotate, calculate).
    """
    return await _analyze_paper_figures_impl(
        paper_id=params.paper_id,
        figure_id=params.figure_id,
        claim_context=params.claim_context,
    )
