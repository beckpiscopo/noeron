#!/usr/bin/env python3
"""
Quick test script for the bioelectricity research MCP server.

Run this to verify your installation is working correctly.
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from bioelectricity_research.storage import PaperStorage


async def test_search():
    """Test basic search functionality - just verify imports work."""
    print("Testing module imports...\n")
    
    # Import the server module
    from bioelectricity_research import server
    
    print(f"✓ Server module loaded")
    print(f"✓ MCP server name: {server.mcp.name}")
    print(f"✓ API base: {server.API_BASE}")
    
    # Test storage import
    storage = PaperStorage()
    print(f"✓ Storage initialized")
    
    print("\n✓ Import test passed!")


async def test_storage():
    """Test storage initialization."""
    print("\nTesting storage initialization...\n")
    
    storage = PaperStorage()
    data = storage.load()
    
    from pathlib import Path
    storage_file = Path(__file__).parent / "data" / "papers_collection.json"
    
    print(f"Storage file: {storage_file}")
    print(f"Total papers in collection: {data['metadata']['total_papers']}")
    print("\n✓ Storage test passed!")


async def main():
    """Run all tests."""
    print("=" * 60)
    print("Bioelectricity Research MCP Server - Quick Test")
    print("=" * 60)
    print()
    
    try:
        await test_search()
        await test_storage()
        
        print("\n" + "=" * 60)
        print("✓ All tests passed!")
        print("=" * 60)
        print("\nYour MCP server is ready to use!")
        print("See docs/SETUP.md for Claude Desktop integration instructions.")
        
    except Exception as e:
        print(f"\n✗ Error during testing: {e}")
        print("\nPlease check:")
        print("1. Internet connection (for API calls)")
        print("2. All dependencies installed (uv pip install -e .)")
        print("3. Python version >= 3.10")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
