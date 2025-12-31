"""
Supabase client wrapper for Noeron.

Provides clean interface for database operations.
"""

import os
from typing import Optional, List, Dict, Any
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    print("⚠️  supabase-py not installed. Run: pip install supabase")
    raise

# Load environment variables
REPO_ROOT = Path(__file__).resolve().parent.parent
_env_file = REPO_ROOT / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


class NoeronDB:
    """Database client for Noeron with Supabase."""
    
    def __init__(self, use_service_key: bool = False):
        """
        Initialize Supabase client.
        
        Args:
            use_service_key: If True, use service key (for backend scripts).
                            If False, use anon key (for frontend).
        """
        url = os.getenv("SUPABASE_URL")
        if use_service_key:
            key = os.getenv("SUPABASE_SERVICE_KEY")
            if not key:
                raise ValueError("SUPABASE_SERVICE_KEY not found in environment")
        else:
            key = os.getenv("SUPABASE_ANON_KEY")
            if not key:
                raise ValueError("SUPABASE_ANON_KEY not found in environment")
        
        if not url:
            raise ValueError("SUPABASE_URL not found in environment")
        
        self.client: Client = create_client(url, key)
    
    # =========================================================================
    # Episodes
    # =========================================================================
    
    def create_episode(self, episode_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new episode record."""
        response = self.client.table("episodes").insert(episode_data).execute()
        return response.data[0] if response.data else {}
    
    def get_episode(self, podcast_id: str) -> Optional[Dict[str, Any]]:
        """Get episode by podcast_id."""
        response = self.client.table("episodes").select("*").eq("podcast_id", podcast_id).execute()
        return response.data[0] if response.data else None
    
    def list_episodes(self) -> List[Dict[str, Any]]:
        """List all episodes."""
        response = self.client.table("episodes").select("*").order("published_date", desc=True).execute()
        return response.data
    
    # =========================================================================
    # Claims
    # =========================================================================
    
    def create_claim(self, claim_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new claim record."""
        response = self.client.table("claims").insert(claim_data).execute()
        return response.data[0] if response.data else {}
    
    def create_claims_batch(self, claims: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create multiple claims at once."""
        response = self.client.table("claims").insert(claims).execute()
        return response.data
    
    def get_claim(self, claim_id: int) -> Optional[Dict[str, Any]]:
        """Get a single claim by ID."""
        response = self.client.table("claims").select("*").eq("id", claim_id).execute()
        return response.data[0] if response.data else None
    
    def get_claims_for_episode(
        self, 
        podcast_id: str,
        order_by: str = "start_ms"
    ) -> List[Dict[str, Any]]:
        """Get all claims for an episode, ordered by timestamp."""
        response = (
            self.client.table("claims")
            .select("*")
            .eq("podcast_id", podcast_id)
            .order(order_by)
            .execute()
        )
        return response.data
    
    def get_claims_needing_distillation(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get claims that need distilled summaries."""
        response = (
            self.client.table("claims")
            .select("*")
            .is_("distilled_claim", "null")
            .not_.is_("paper_title", "null")  # Only if matched to paper
            .limit(limit)
            .execute()
        )
        return response.data
    
    def update_claim(self, claim_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update a claim record."""
        response = (
            self.client.table("claims")
            .update(updates)
            .eq("id", claim_id)
            .execute()
        )
        return response.data[0] if response.data else {}
    
    def add_distilled_claim(
        self, 
        claim_id: int, 
        distilled_claim: str, 
        word_count: int
    ) -> Dict[str, Any]:
        """Add distilled claim to existing claim record."""
        return self.update_claim(claim_id, {
            "distilled_claim": distilled_claim,
            "distilled_word_count": word_count
        })
    
    # =========================================================================
    # Papers
    # =========================================================================
    
    def create_paper(self, paper_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update a paper record."""
        # Use upsert to avoid duplicates
        response = (
            self.client.table("papers")
            .upsert(paper_data, on_conflict="paper_id")
            .execute()
        )
        return response.data[0] if response.data else {}
    
    def get_paper(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """Get paper by ID."""
        response = self.client.table("papers").select("*").eq("paper_id", paper_id).execute()
        return response.data[0] if response.data else None
    
    # =========================================================================
    # Statistics & Views
    # =========================================================================
    
    def get_episode_stats(self, podcast_id: str) -> Dict[str, Any]:
        """Get statistics for an episode."""
        response = (
            self.client.table("episode_stats")
            .select("*")
            .eq("podcast_id", podcast_id)
            .execute()
        )
        return response.data[0] if response.data else {}
    
    def get_all_stats(self) -> List[Dict[str, Any]]:
        """Get statistics for all episodes."""
        response = self.client.table("episode_stats").select("*").execute()
        return response.data
    
    # =========================================================================
    # Utility
    # =========================================================================
    
    def test_connection(self) -> bool:
        """Test database connection."""
        try:
            response = self.client.table("episodes").select("count", count="exact").limit(0).execute()
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            return False


# Convenience function
def get_db(use_service_key: bool = False) -> NoeronDB:
    """Get a database client instance."""
    return NoeronDB(use_service_key=use_service_key)


if __name__ == "__main__":
    # Test connection
    print("Testing Supabase connection...")
    db = get_db(use_service_key=True)
    
    if db.test_connection():
        print("✓ Connected to Supabase successfully!")
        print("\nEpisodes in database:")
        episodes = db.list_episodes()
        for ep in episodes:
            print(f"  - {ep['title']} ({ep['podcast_id']})")
        
        if not episodes:
            print("  (No episodes yet - run migration script)")
    else:
        print("✗ Connection failed. Check your SUPABASE_URL and keys in .env")

