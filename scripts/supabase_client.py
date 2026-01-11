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
        order_by: str = "start_ms",
        include_duplicates: bool = False
    ) -> List[Dict[str, Any]]:
        """Get all claims for an episode, ordered by timestamp.

        Args:
            podcast_id: Episode ID (e.g., 'lex_325')
            order_by: Column to order by (default: 'start_ms')
            include_duplicates: If False (default), excludes claims marked as duplicates
        """
        query = (
            self.client.table("claims")
            .select("*")
            .eq("podcast_id", podcast_id)
        )

        if not include_duplicates:
            query = query.is_("duplicate_of", "null")

        response = query.order(order_by).execute()
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
    # Temporal Windows
    # =========================================================================

    def get_temporal_windows(self, podcast_id: str) -> List[Dict[str, Any]]:
        """Get all temporal windows for an episode, ordered by time."""
        response = (
            self.client.table("temporal_windows")
            .select("*")
            .eq("podcast_id", podcast_id)
            .order("start_ms")
            .execute()
        )
        return response.data

    def find_temporal_window(
        self,
        podcast_id: str,
        timestamp_ms: int
    ) -> Optional[Dict[str, Any]]:
        """Find the temporal window containing a specific timestamp."""
        response = (
            self.client.table("temporal_windows")
            .select("*")
            .eq("podcast_id", podcast_id)
            .lte("start_ms", timestamp_ms)
            .gte("end_ms", timestamp_ms)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    # =========================================================================
    # Evidence Cards
    # =========================================================================

    def get_evidence_cards(self, podcast_id: str) -> List[Dict[str, Any]]:
        """Get all evidence cards for an episode."""
        response = (
            self.client.table("evidence_cards")
            .select("*")
            .eq("podcast_id", podcast_id)
            .order("timestamp_ms")
            .execute()
        )
        return response.data

    def get_evidence_cards_in_range(
        self,
        podcast_id: str,
        current_timestamp_ms: int,
        lookback_ms: int = 300000  # 5 minutes
    ) -> List[Dict[str, Any]]:
        """Get evidence cards within lookback window of current timestamp."""
        range_start = max(0, current_timestamp_ms - lookback_ms)

        response = (
            self.client.table("evidence_cards")
            .select("*")
            .eq("podcast_id", podcast_id)
            .gte("timestamp_ms", range_start)
            .lte("timestamp_ms", current_timestamp_ms)
            .order("timestamp_ms", desc=True)
            .execute()
        )
        return response.data

    def get_evidence_card_by_key(
        self,
        podcast_id: str,
        timestamp: str,
        window_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a specific evidence card by its composite key."""
        response = (
            self.client.table("evidence_cards")
            .select("*")
            .eq("podcast_id", podcast_id)
            .eq("timestamp", timestamp)
            .eq("window_id", window_id)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    # =========================================================================
    # Paper Chunks & Vector Search
    # =========================================================================

    def get_paper_chunks(self, paper_id: str) -> List[Dict[str, Any]]:
        """Get all chunks for a paper."""
        response = (
            self.client.table("paper_chunks")
            .select("*")
            .eq("paper_id", paper_id)
            .order("chunk_index")
            .execute()
        )
        return response.data

    def match_papers(
        self,
        query_embedding: List[float],
        threshold: float = 0.5,
        count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Vector similarity search using pgvector via RPC function.

        Args:
            query_embedding: 384-dimensional embedding vector
            threshold: Minimum similarity threshold (0.0-1.0)
            count: Maximum number of results

        Returns:
            List of matching paper chunks with similarity scores
        """
        response = self.client.rpc(
            "match_papers",
            {
                "query_embedding": query_embedding,
                "match_threshold": threshold,
                "match_count": count
            }
        ).execute()
        return response.data

    def match_papers_with_filters(
        self,
        query_embedding: List[float],
        threshold: float = 0.5,
        count: int = 5,
        year_min: int = None,
        year_max: int = None,
        sections: List[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Vector similarity search with optional filters.

        Args:
            query_embedding: 384-dimensional embedding vector
            threshold: Minimum similarity threshold
            count: Maximum number of results
            year_min: Filter papers published on or after this year
            year_max: Filter papers published on or before this year
            sections: Filter to specific section types
        """
        response = self.client.rpc(
            "match_papers_with_filters",
            {
                "query_embedding": query_embedding,
                "match_threshold": threshold,
                "match_count": count,
                "filter_year_min": year_min,
                "filter_year_max": year_max,
                "filter_sections": sections
            }
        ).execute()
        return response.data

    # =========================================================================
    # Chat Sessions
    # =========================================================================

    def create_chat_session(
        self,
        podcast_id: str = None,
        user_id: str = "default_user",
        claim_id: str = None,
        title: str = None,
        context_snapshot: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Create a new chat session."""
        data = {
            "user_id": user_id,
            "podcast_id": podcast_id,
            "claim_id": claim_id,
            "title": title,
            "context_snapshot": context_snapshot
        }
        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}

        response = self.client.table("chat_sessions").insert(data).execute()
        return response.data[0] if response.data else {}

    def get_chat_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get a chat session by ID."""
        response = (
            self.client.table("chat_sessions")
            .select("*")
            .eq("id", session_id)
            .execute()
        )
        return response.data[0] if response.data else None

    def list_chat_sessions(
        self,
        user_id: str = "default_user",
        podcast_id: str = None,
        active_only: bool = False,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """List chat sessions for a user."""
        query = (
            self.client.table("chat_sessions")
            .select("*")
            .eq("user_id", user_id)
            .order("last_activity_at", desc=True)
            .limit(limit)
        )

        if podcast_id:
            query = query.eq("podcast_id", podcast_id)
        if active_only:
            query = query.eq("is_active", True)

        response = query.execute()
        return response.data

    def update_chat_session(
        self,
        session_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update a chat session."""
        # Always update last_activity_at
        updates["last_activity_at"] = "now()"

        response = (
            self.client.table("chat_sessions")
            .update(updates)
            .eq("id", session_id)
            .execute()
        )
        return response.data[0] if response.data else {}

    def close_chat_session(self, session_id: str) -> Dict[str, Any]:
        """Mark a chat session as inactive."""
        return self.update_chat_session(session_id, {"is_active": False})

    # =========================================================================
    # Chat Messages
    # =========================================================================

    def add_chat_message(
        self,
        session_id: str,
        role: str,
        content: str,
        playback_timestamp: str = None,
        playback_timestamp_ms: int = None,
        sources: List[Dict[str, Any]] = None,
        rag_query: str = None,
        model: str = None
    ) -> Dict[str, Any]:
        """Add a message to a chat session."""
        data = {
            "session_id": session_id,
            "role": role,
            "content": content,
        }

        if playback_timestamp:
            data["playback_timestamp"] = playback_timestamp
        if playback_timestamp_ms:
            data["playback_timestamp_ms"] = playback_timestamp_ms
        if sources:
            data["sources"] = sources
        if rag_query:
            data["rag_query"] = rag_query
        if model:
            data["model"] = model

        response = self.client.table("chat_messages").insert(data).execute()

        # Update session last_activity_at
        self.client.table("chat_sessions").update(
            {"last_activity_at": "now()"}
        ).eq("id", session_id).execute()

        return response.data[0] if response.data else {}

    def get_chat_messages(
        self,
        session_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get messages for a chat session in chronological order."""
        response = (
            self.client.table("chat_messages")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .range(offset, offset + limit - 1)
            .execute()
        )
        return response.data

    def get_recent_messages(
        self,
        session_id: str,
        count: int = 6
    ) -> List[Dict[str, Any]]:
        """Get the most recent messages for context building."""
        response = (
            self.client.table("chat_messages")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(count)
            .execute()
        )
        # Reverse to get chronological order
        return list(reversed(response.data))

    # =========================================================================
    # User Interests
    # =========================================================================

    def track_interest(
        self,
        interest_type: str,
        interest_value: str,
        user_id: str = "default_user",
        explicit: bool = False
    ) -> Dict[str, Any]:
        """Track or increment a user interest."""
        # Try to get existing
        existing = (
            self.client.table("user_interests")
            .select("*")
            .eq("user_id", user_id)
            .eq("interest_type", interest_type)
            .eq("interest_value", interest_value)
            .execute()
        )

        if existing.data:
            # Increment count
            current = existing.data[0]
            response = (
                self.client.table("user_interests")
                .update({
                    "interaction_count": current["interaction_count"] + 1,
                    "last_interaction_at": "now()"
                })
                .eq("id", current["id"])
                .execute()
            )
        else:
            # Create new
            response = (
                self.client.table("user_interests")
                .insert({
                    "user_id": user_id,
                    "interest_type": interest_type,
                    "interest_value": interest_value,
                    "explicit_interest": explicit
                })
                .execute()
            )

        return response.data[0] if response.data else {}

    def get_user_interests(
        self,
        user_id: str = "default_user",
        interest_type: str = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get user interests, optionally filtered by type."""
        query = (
            self.client.table("user_interests")
            .select("*")
            .eq("user_id", user_id)
            .order("interaction_count", desc=True)
            .limit(limit)
        )

        if interest_type:
            query = query.eq("interest_type", interest_type)

        response = query.execute()
        return response.data

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
    # Taxonomy Clusters
    # =========================================================================

    def get_taxonomy_clusters(self) -> List[Dict[str, Any]]:
        """Get all taxonomy clusters with metadata."""
        response = (
            self.client.table("taxonomy_clusters")
            .select("*")
            .order("cluster_id")
            .execute()
        )
        return response.data

    def get_taxonomy_overview(self) -> List[Dict[str, Any]]:
        """Get taxonomy overview via RPC function."""
        response = self.client.rpc("get_taxonomy_overview", {}).execute()
        return response.data

    def get_cluster_papers(
        self,
        cluster_id: int,
        limit: int = 20,
        include_paper_details: bool = True
    ) -> List[Dict[str, Any]]:
        """Get papers assigned to a cluster."""
        if include_paper_details:
            response = (
                self.client.table("paper_cluster_assignments")
                .select("*, papers!inner(paper_id, title, abstract, year, citation_count)")
                .eq("cluster_id", cluster_id)
                .order("confidence", desc=True)
                .limit(limit)
                .execute()
            )
        else:
            response = (
                self.client.table("paper_cluster_assignments")
                .select("*")
                .eq("cluster_id", cluster_id)
                .order("confidence", desc=True)
                .limit(limit)
                .execute()
            )
        return response.data

    def get_paper_clusters(self, paper_id: str) -> List[Dict[str, Any]]:
        """Get clusters assigned to a paper."""
        response = (
            self.client.table("paper_cluster_assignments")
            .select("*, taxonomy_clusters!inner(cluster_id, label, description)")
            .eq("paper_id", paper_id)
            .order("confidence", desc=True)
            .execute()
        )
        return response.data

    def get_episode_cluster_coverage(self, podcast_id: str) -> List[Dict[str, Any]]:
        """Get clusters covered by an episode via RPC function."""
        response = self.client.rpc(
            "get_episode_cluster_coverage",
            {"p_podcast_id": podcast_id}
        ).execute()
        return response.data

    def get_notebook_cluster_distribution(
        self,
        user_id: str = "default_user",
        episode_id: str = None
    ) -> List[Dict[str, Any]]:
        """Get cluster distribution of notebook items via RPC function."""
        params = {"p_user_id": user_id}
        if episode_id:
            params["p_episode_id"] = episode_id

        response = self.client.rpc(
            "get_notebook_cluster_distribution",
            params
        ).execute()
        return response.data

    def compare_episode_to_notebook(
        self,
        podcast_id: str,
        user_id: str = "default_user"
    ) -> List[Dict[str, Any]]:
        """Compare episode clusters to notebook via RPC function."""
        response = self.client.rpc(
            "compare_episode_to_notebook",
            {
                "p_podcast_id": podcast_id,
                "p_user_id": user_id
            }
        ).execute()
        return response.data

    def get_clusters_for_papers(self, paper_ids: List[str]) -> List[Dict[str, Any]]:
        """Get clusters for a set of paper IDs via RPC function."""
        response = self.client.rpc(
            "get_clusters_for_papers",
            {"paper_ids": paper_ids}
        ).execute()
        return response.data

    def match_nearest_cluster(
        self,
        query_embedding: List[float],
        count: int = 3
    ) -> List[Dict[str, Any]]:
        """Find nearest clusters for an embedding via RPC function."""
        response = self.client.rpc(
            "match_nearest_cluster",
            {
                "query_embedding": query_embedding,
                "match_count": count
            }
        ).execute()
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



