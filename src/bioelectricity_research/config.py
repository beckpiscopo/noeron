"""Centralized environment variable handling for the MCP server."""

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from project root once at import time
_project_root = Path(__file__).parent.parent.parent
load_dotenv(_project_root / ".env")

# Gemini — optional at the module level; server supports per-request BYOK keys via X-Gemini-Key header
GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3-pro-preview")

# Data backend — True uses Supabase pgvector, False uses ChromaDB (local dev only)
USE_SUPABASE: bool = os.getenv("USE_SUPABASE", "true").lower() == "true"

# HTTP server
FASTMCP_HOST: str = os.getenv("FASTMCP_HOST", "127.0.0.1")
FASTMCP_PORT: int = int(os.getenv("FASTMCP_PORT", "8000"))
CORS_ALLOWED_ORIGINS: list[str] = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001"
).split(",")

# External services
UNPAYWALL_EMAIL: str = os.getenv("UNPAYWALL_EMAIL", "your.email@example.com")
