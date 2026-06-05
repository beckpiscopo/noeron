"""Bioelectricity Research MCP Server — registers all tool modules."""

import sys
from pathlib import Path

from .mcp_app import mcp  # noqa: F401

scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))

# Import tool modules to trigger @mcp.tool() registration
from .tools import (  # noqa: F401
    papers,
    episodes,
    rag,
    claims,
    figures,
    deep_dive,
    evidence_threads,
    knowledge_graph,
    expansion,
    quiz,
    chat,
    image,
    podcast,
    tts,
    taxonomy,
    slides,
)

# Re-export names imported by http_server.py lazy imports
from .figure_utils import (  # noqa: F401
    _analyze_paper_figures_impl,
    _get_claim_figures_impl,
    _get_paper_figures_impl,
    _get_papers_with_figures,
)
from .media_utils import (  # noqa: F401
    _generate_image_impl,
    _generate_mini_podcast_impl,
    _text_to_speech_impl,
)
from .slide_utils import _generate_slide_deck_impl  # noqa: F401
from .mcp_app import _get_supabase_client  # noqa: F401
from .cache_store import _load_papers_collection  # noqa: F401

if __name__ == "__main__":
    mcp.run()
