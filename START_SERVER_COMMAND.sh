#!/bin/bash
# Start MCP Server with HTTP Transport

cd /Users/beckpiscopo/Desktop/dev/mcp-tools/bioelectricity-research-mcp-v2

# Install package in editable mode if not already installed
uv pip install -e . 2>/dev/null || true

# Start server with HTTP transport
FASTMCP_HOST=127.0.0.1 FASTMCP_PORT=8000 uv run bioelectricity-research

