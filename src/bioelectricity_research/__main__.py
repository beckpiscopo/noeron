#!/usr/bin/env python3
"""Entry point for the bioelectricity research MCP server."""

from bioelectricity_research.server import mcp


def main():
    """Run the MCP server."""
    mcp.run()


if __name__ == "__main__":
    main()
