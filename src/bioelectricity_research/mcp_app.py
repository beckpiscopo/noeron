"""MCP application instance, Gemini client, and shared infrastructure."""

import contextvars
import logging
import os
from typing import Optional

# Configure structured logging for the package
_log_level = getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper(), logging.INFO)
logging.basicConfig(
    level=_log_level,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "msg": "%(message)s"}',
)

from fastmcp import FastMCP

from .config import GEMINI_API_KEY
from .vector_store import VectorStore, SupabaseVectorStore, get_vectorstore as _create_vectorstore

logger = logging.getLogger(__name__)

# Slide generation constants
SLIDES_BUCKET = "generated-slides"
NANO_BANANA_MODEL = "gemini-3-pro-image-preview"
SLIDE_WIDTH = 1920
SLIDE_HEIGHT = 1080

# Gemini SDK (optional dep)
try:
    from google import genai  # type: ignore[import]
except ImportError:
    genai = None

_GENAI_CLIENT = None

# Per-request Gemini API key injected via X-Gemini-Key header (BYOK flow)
_request_gemini_key: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "_request_gemini_key", default=None
)

mcp = FastMCP("bioelectricity-research")

_vectorstore: Optional[VectorStore | SupabaseVectorStore] = None


def get_vectorstore() -> VectorStore | SupabaseVectorStore:
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = _create_vectorstore()
    return _vectorstore


def _ensure_gemini_client_ready() -> None:
    """Best-effort initializer kept for backward compatibility with direct env-var scripts.

    In the BYOK web flow the real guard is _get_genai_client(), so this intentionally
    does NOT raise when the env var is missing.
    """
    global _GENAI_CLIENT
    if _GENAI_CLIENT is not None:
        return
    if _request_gemini_key.get() is not None:
        return
    if genai is None:
        return
    api_key = GEMINI_API_KEY
    if not api_key:
        return
    _GENAI_CLIENT = genai.Client(api_key=api_key)


def _get_genai_client():
    """Return a Gemini client for the current request (BYOK — key from X-Gemini-Key header)."""
    request_key = _request_gemini_key.get()
    if not request_key:
        raise RuntimeError(
            "A Gemini API key is required to use AI features. "
            "Please add your key in Settings."
        )
    if genai is None:
        raise RuntimeError("google.genai is not installed. Run: pip install google-genai")
    return genai.Client(api_key=request_key)


def _get_supabase_client():
    """Return a Supabase client using the service key (for server-side operations)."""
    import sys
    from pathlib import Path
    repo_root = Path(__file__).resolve().parent.parent.parent
    sys.path.insert(0, str(repo_root))
    from scripts.supabase_client import get_db  # type: ignore[import]
    return get_db(use_service_key=True)
