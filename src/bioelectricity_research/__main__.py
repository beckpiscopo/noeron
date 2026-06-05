#!/usr/bin/env python3
"""Entry point for the bioelectricity research MCP server."""

from bioelectricity_research.config import FASTMCP_HOST, FASTMCP_PORT


def main():
    """Run the HTTP server for tool access."""
    from bioelectricity_research.http_server import run_server
    run_server(host=FASTMCP_HOST, port=FASTMCP_PORT)


if __name__ == "__main__":
    main()
