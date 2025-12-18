#!/usr/bin/env python3
import asyncio
from src.bioelectricity_research.api import search_papers, get_paper_details, save_paper

async def main():
    print("🧪 Testing MCP Server\n")
    
    print("1. Searching for xenobots...")
    result = await search_papers("Michael Levin xenobots", limit=3)
    print(result[:200], "...\n")
    
    print("2. Getting paper details...")
    result = await get_paper_details("10.1073/pnas.1910837117")
    print(result[:200], "...\n")
    
    print("3. Saving paper...")
    result = await save_paper("10.1073/pnas.1910837117")
    print(result, "\n")
    
    print("✅ All tests passed!")

if __name__ == "__main__":
    asyncio.run(main())
