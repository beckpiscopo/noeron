#!/usr/bin/env python3
"""Entry point for the bioelectricity research MCP server."""

import os
from pathlib import Path

# Load .env file from project root
try:
    from dotenv import load_dotenv
    project_root = Path(__file__).parent.parent.parent
    env_path = project_root / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"Loaded environment from {env_path}")
except ImportError:
    pass  # dotenv not installed, rely on system env vars


def main():
    """Run the HTTP server for tool access."""
    host = os.environ.get('FASTMCP_HOST', '127.0.0.1')
    port = int(os.environ.get('FASTMCP_PORT', '8000'))
    
    # Use the custom HTTP server that exposes tools as REST endpoints
    from bioelectricity_research.http_server import run_server
    run_server(host=host, port=port)


if __name__ == "__main__":
    main()
