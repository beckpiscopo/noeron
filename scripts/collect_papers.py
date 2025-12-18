#!/usr/bin/env python3
"""Direct paper collection - no MCP needed"""
import asyncio
from src.bioelectricity_research.api import search_papers, save_paper

# Top 10 priority papers
PAPERS = [
    "xenobots scalable pipeline Kriegman Levin 2020",
    "xenobots kinematic self-replication Kriegman Levin 2021",
    "bioelectric networks cognitive glue Levin 2023",
    "Darwin agential materials Levin 2023",
    "bioelectric signaling reprogrammable circuits Levin Cell 2021",
    "computational boundary self Levin 2019",
    "anthrobots Gumuskaya Levin 2023",
    "wearable bioreactor limb regeneration Levin 2022",
    "HCN2 channel rescue brain Pai Levin 2020",
    "planarian neural control bioelectric Levin 2019"
]

async def collect_all():
    for i, query in enumerate(PAPERS, 1):
        print(f"\n{'='*60}")
        print(f"[{i}/{len(PAPERS)}] Searching: {query}")
        print('='*60)
        
        # Search
        results = await search_papers(query, limit=1)
        print(results[:300])
        
        # Extract paper ID from results (you'll see it in output)
        # Then save it
        # await save_paper(paper_id)
        
        await asyncio.sleep(2)  # Rate limiting

if __name__ == "__main__":
    asyncio.run(collect_all())
