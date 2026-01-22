#!/usr/bin/env python3
"""
Episode Ingestion Orchestrator

Automates the entire episode ingestion pipeline:
1. Transcribe audio via AssemblyAI
2. Extract metadata from transcript via Gemini
3. Update episodes.json
4. Map audio file to standard location
5. Generate AI summaries (narrative arc, chapters, themes)
6. Extract claims from transcript
7. Build taxonomy clusters
8. Sync to Supabase
9. Update vector store

Usage:
    # Standard usage
    python scripts/add_episode.py --audio /path/to/episode.mp3 --id lex_450

    # Resume a failed run
    python scripts/add_episode.py --resume lex_450

    # Skip expensive steps
    python scripts/add_episode.py --audio ep.mp3 --id lex_450 --skip-claims --skip-vectors
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add scripts directory to path for imports
SCRIPTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_DIR.parent
sys.path.insert(0, str(SCRIPTS_DIR))

from lib.checkpoint import Checkpoint, CheckpointManager

# Lazy imports for optional dependencies
AssemblyAIClient = None
TranscriptionResult = None
MetadataExtractor = None
EpisodeMetadata = None


def _ensure_assemblyai():
    """Lazy import AssemblyAI client."""
    global AssemblyAIClient, TranscriptionResult
    if AssemblyAIClient is None:
        from lib.assemblyai_client import AssemblyAIClient as _AAI, TranscriptionResult as _TR
        AssemblyAIClient = _AAI
        TranscriptionResult = _TR


def _ensure_metadata_extractor():
    """Lazy import metadata extractor."""
    global MetadataExtractor, EpisodeMetadata
    if MetadataExtractor is None:
        from lib.metadata_extractor import MetadataExtractor as _ME, EpisodeMetadata as _EM
        MetadataExtractor = _ME
        EpisodeMetadata = _EM


# Configuration
DATA_DIR = REPO_ROOT / "data"
EPISODES_FILE = DATA_DIR / "episodes.json"
SUMMARIES_FILE = DATA_DIR / "episode_summaries.json"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"
AUDIO_DIR = DATA_DIR / "podcasts" / "raw"
AUDIO_ROUTE_FILE = REPO_ROOT / "frontend" / "app" / "api" / "audio" / "[episodeId]" / "route.ts"


# Pipeline steps
STEPS = [
    "transcribe",
    "extract_metadata",
    "update_episodes_json",
    "map_audio_file",
    "generate_summaries",
    "extract_claims",
    "build_clusters",
    "migrate_to_supabase",
    "update_vector_store",
]


class EpisodeOrchestrator:
    """Orchestrates the episode ingestion pipeline."""

    def __init__(
        self,
        checkpoint_manager: Optional[CheckpointManager] = None,
        skip_claims: bool = False,
        skip_vectors: bool = False,
        skip_summaries: bool = False,
        skip_clusters: bool = False,
        skip_supabase: bool = False,
        dry_run: bool = False,
    ):
        """Initialize the orchestrator.

        Args:
            checkpoint_manager: Checkpoint manager for persistence.
            skip_claims: Skip claim extraction step.
            skip_vectors: Skip vector store update step.
            skip_summaries: Skip summary generation step.
            skip_clusters: Skip cluster building step.
            skip_supabase: Skip Supabase sync step.
            dry_run: Print what would be done without executing.
        """
        self.checkpoint_manager = checkpoint_manager or CheckpointManager()
        self.skip_claims = skip_claims
        self.skip_vectors = skip_vectors
        self.skip_summaries = skip_summaries
        self.skip_clusters = skip_clusters
        self.skip_supabase = skip_supabase
        self.dry_run = dry_run

        # Lazy-loaded clients
        self._assemblyai_client: Optional[AssemblyAIClient] = None
        self._metadata_extractor: Optional[MetadataExtractor] = None

    @property
    def assemblyai_client(self):
        """Get or create AssemblyAI client."""
        if self._assemblyai_client is None:
            _ensure_assemblyai()
            self._assemblyai_client = AssemblyAIClient()
        return self._assemblyai_client

    @property
    def metadata_extractor(self):
        """Get or create metadata extractor."""
        if self._metadata_extractor is None:
            _ensure_metadata_extractor()
            self._metadata_extractor = MetadataExtractor()
        return self._metadata_extractor

    def run(
        self,
        audio_path: Path,
        episode_id: str,
        checkpoint: Optional[Checkpoint] = None,
    ) -> bool:
        """Run the full ingestion pipeline.

        Args:
            audio_path: Path to the audio file.
            episode_id: Unique episode identifier (e.g., 'lex_450').
            checkpoint: Optional existing checkpoint to resume from.

        Returns:
            True if successful, False otherwise.
        """
        print(f"\n{'=' * 60}")
        print(f"Adding Episode: {episode_id}")
        print(f"Audio: {audio_path}")
        print(f"{'=' * 60}\n")

        # Use existing checkpoint or create new one
        if checkpoint is None:
            checkpoint = self.checkpoint_manager.create(episode_id, str(audio_path))

        try:
            # Run each step
            for i, step in enumerate(STEPS, 1):
                if self._should_skip_step(step, checkpoint):
                    print(f"[{i}/9] Skipping {step} (already completed or skipped)")
                    continue

                print(f"\n[{i}/9] Running {step}...")
                checkpoint.mark_step_started(step)
                self.checkpoint_manager.save(checkpoint)

                if self.dry_run:
                    print(f"      (dry run) Would execute {step}")
                    checkpoint.mark_step_completed(step)
                    continue

                # Execute the step
                step_method = getattr(self, f"_step_{step}", None)
                if step_method is None:
                    print(f"      Warning: Step {step} not implemented")
                    checkpoint.mark_step_completed(step)
                    continue

                step_data = step_method(checkpoint, audio_path, episode_id)
                checkpoint.mark_step_completed(step, step_data)
                self.checkpoint_manager.save(checkpoint)

            # Success - delete checkpoint
            self.checkpoint_manager.delete(episode_id)
            print(f"\n{'=' * 60}")
            print(f"✅ Episode '{episode_id}' added successfully!")
            print(f"{'=' * 60}\n")
            return True

        except Exception as e:
            # Save checkpoint with error
            checkpoint.add_error(checkpoint.current_step or "unknown", str(e))
            self.checkpoint_manager.save(checkpoint)

            print(f"\n{'=' * 60}")
            print(f"❌ Failed at step: {checkpoint.current_step}")
            print(f"   Error: {e}")
            print(f"\n   To resume, run:")
            print(f"   {self.checkpoint_manager.get_resume_command(episode_id)}")
            print(f"{'=' * 60}\n")
            return False

    def resume(self, episode_id: str) -> bool:
        """Resume a failed pipeline run.

        Args:
            episode_id: Episode identifier to resume.

        Returns:
            True if successful, False otherwise.
        """
        checkpoint = self.checkpoint_manager.load(episode_id)
        if checkpoint is None:
            print(f"Error: No checkpoint found for episode '{episode_id}'")
            return False

        print(f"\n{'=' * 60}")
        print(f"Resuming Episode: {episode_id}")
        print(f"Audio: {checkpoint.audio_path}")
        print(f"Completed steps: {', '.join(checkpoint.completed_steps) or 'none'}")
        print(f"{'=' * 60}\n")

        audio_path = Path(checkpoint.audio_path)
        return self.run(audio_path, episode_id, checkpoint=checkpoint)

    def _should_skip_step(self, step: str, checkpoint: Checkpoint) -> bool:
        """Check if a step should be skipped."""
        if checkpoint.is_step_completed(step):
            return True
        if step == "extract_claims" and self.skip_claims:
            return True
        if step == "update_vector_store" and self.skip_vectors:
            return True
        if step == "generate_summaries" and self.skip_summaries:
            return True
        if step == "build_clusters" and self.skip_clusters:
            return True
        if step == "migrate_to_supabase" and self.skip_supabase:
            return True
        return False

    # =========================================================================
    # Pipeline Steps
    # =========================================================================

    def _step_transcribe(
        self, checkpoint: Checkpoint, audio_path: Path, episode_id: str
    ) -> Dict[str, Any]:
        """Step 1: Transcribe audio via AssemblyAI."""
        # Check if we have a transcript_id to resume
        transcript_id = checkpoint.data.get("transcript_id")
        if transcript_id:
            print(f"      Resuming transcript {transcript_id}...")
            result = self.assemblyai_client.resume_transcription(transcript_id)
        else:
            print(f"      Uploading {audio_path.name} to AssemblyAI...")
            result = self.assemblyai_client.transcribe(audio_path)

        # Save transcript to file
        transcript_path = TRANSCRIPTS_DIR / f"{episode_id}.json"
        self.assemblyai_client.save_transcript(result, transcript_path, format="json")

        print(f"      ✓ Transcribed ({result.duration_formatted})")
        print(f"      ✓ Saved to {transcript_path}")

        return {
            "transcript_id": result.transcript_id,
            "transcript_path": str(transcript_path),
            "duration_ms": result.duration_ms,
            "utterances": result.utterances,
        }

    def _step_extract_metadata(
        self, checkpoint: Checkpoint, audio_path: Path, episode_id: str
    ) -> Dict[str, Any]:
        """Step 2: Extract metadata from transcript via Gemini."""
        utterances = checkpoint.data.get("utterances", [])
        duration_ms = checkpoint.data.get("duration_ms")

        if not utterances:
            # Try to load from transcript file
            transcript_path = checkpoint.data.get("transcript_path")
            if transcript_path:
                data = json.loads(Path(transcript_path).read_text())
                utterances = data.get("utterances", [])
                duration_ms = data.get("duration_ms")

        metadata = self.metadata_extractor.extract_from_utterances(
            utterances,
            duration_ms=duration_ms,
            fallback_title=episode_id,
        )

        print(f"      ✓ Title: \"{metadata.title}\"")
        print(f"      ✓ Guest: {metadata.guest}")
        print(f"      ✓ Podcast: {metadata.podcast}")

        return {"metadata": metadata.to_dict()}

    def _step_update_episodes_json(
        self, checkpoint: Checkpoint, audio_path: Path, episode_id: str
    ) -> Dict[str, Any]:
        """Step 3: Add episode entry to episodes.json."""
        metadata = checkpoint.data.get("metadata", {})
        duration_ms = checkpoint.data.get("duration_ms", 0)

        # Load existing episodes
        episodes = []
        if EPISODES_FILE.exists():
            episodes = json.loads(EPISODES_FILE.read_text())

        # Check if episode already exists
        existing = next((e for e in episodes if e.get("id") == episode_id), None)
        if existing:
            print(f"      ⚠ Episode {episode_id} already exists, updating...")
            episodes = [e for e in episodes if e.get("id") != episode_id]

        # Format duration
        total_minutes = duration_ms // 60000
        hours = total_minutes // 60
        minutes = total_minutes % 60
        duration_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"

        # Create episode entry
        episode_entry = {
            "id": episode_id,
            "title": metadata.get("title", episode_id),
            "podcast": metadata.get("podcast", "Unknown Podcast"),
            "guest": metadata.get("guest", "Unknown Guest"),
            "host": metadata.get("host", "Unknown Host"),
            "date": metadata.get("date", ""),
            "duration": duration_str,
            "description": metadata.get("description", ""),
            "topics": metadata.get("topics", []),
            "has_audio": True,
            "has_transcript": True,
        }

        episodes.append(episode_entry)

        # Save
        EPISODES_FILE.parent.mkdir(parents=True, exist_ok=True)
        EPISODES_FILE.write_text(json.dumps(episodes, indent=2), encoding="utf-8")

        print(f"      ✓ Added episode entry")

        return {"episode_entry": episode_entry}

    def _step_map_audio_file(
        self, checkpoint: Checkpoint, audio_path: Path, episode_id: str
    ) -> Dict[str, Any]:
        """Step 4: Copy audio to standard location and update route mapping."""
        # Copy audio file
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        dest_path = AUDIO_DIR / f"{episode_id}.mp3"

        if audio_path != dest_path:
            shutil.copy2(audio_path, dest_path)
            print(f"      ✓ Copied to {dest_path}")
        else:
            print(f"      ✓ Audio already at {dest_path}")

        # Update audio route mapping
        if AUDIO_ROUTE_FILE.exists():
            route_content = AUDIO_ROUTE_FILE.read_text()

            # Check if mapping already exists
            if f'"{episode_id}":' not in route_content:
                # Find the AUDIO_FILES object and add the mapping
                # Pattern: const AUDIO_FILES: Record<string, string> = {
                import re
                pattern = r'(const AUDIO_FILES: Record<string, string> = \{)'
                replacement = f'\\1\n  {episode_id}: "{episode_id}.mp3",'

                new_content = re.sub(pattern, replacement, route_content)
                if new_content != route_content:
                    AUDIO_ROUTE_FILE.write_text(new_content)
                    print(f"      ✓ Updated audio route mapping")
                else:
                    print(f"      ⚠ Could not update route mapping automatically")
            else:
                print(f"      ✓ Route mapping already exists")

        return {"audio_path": str(dest_path)}

    def _step_generate_summaries(
        self, checkpoint: Checkpoint, audio_path: Path, episode_id: str
    ) -> Dict[str, Any]:
        """Step 5: Generate narrative arc, chapters, themes via Gemini."""
        # Import the existing summary generator
        try:
            from generate_episode_summaries import EpisodeSummaryGenerator, save_summary
        except ImportError:
            print("      ⚠ Summary generator not available, skipping")
            return {}

        # First, we need to create window segments for the summary generator
        # The summary generator expects window_segments_{episode_id}.json
        self._create_window_segments(checkpoint, episode_id)

        generator = EpisodeSummaryGenerator()
        summary = generator.generate_summary(episode_id)

        if summary:
            save_summary(summary, update_episodes=True)
            print(f"      ✓ Created narrative arc, chapters, themes")
            return {"summary_generated": True}
        else:
            print(f"      ⚠ Summary generation failed")
            return {"summary_generated": False}

    def _create_window_segments(self, checkpoint: Checkpoint, episode_id: str) -> None:
        """Create window segments file for summary generation."""
        utterances = checkpoint.data.get("utterances", [])
        if not utterances:
            return

        # Group utterances into ~5 minute windows with some overlap
        windows = []
        window_duration_ms = 5 * 60 * 1000  # 5 minutes
        overlap_ms = 30 * 1000  # 30 seconds overlap

        current_window = {
            "start_timestamp": "00:00:00",
            "start_ms": 0,
            "text": "",
            "utterances": [],
        }

        for u in utterances:
            start = u.get("start", 0)
            text = u.get("text", "")

            # Check if we need to start a new window
            if start - current_window["start_ms"] > window_duration_ms:
                # Save current window
                if current_window["text"].strip():
                    windows.append(current_window)

                # Start new window (with overlap from previous utterances)
                # Format timestamp
                hours = start // 3600000
                minutes = (start % 3600000) // 60000
                seconds = (start % 60000) // 1000
                timestamp = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

                current_window = {
                    "start_timestamp": timestamp,
                    "start_ms": start,
                    "text": "",
                    "utterances": [],
                }

            current_window["text"] += " " + text
            current_window["utterances"].append(u)

        # Add final window
        if current_window["text"].strip():
            windows.append(current_window)

        # Save window segments
        window_file = DATA_DIR / f"window_segments_{episode_id}.json"
        window_file.write_text(json.dumps(windows, indent=2), encoding="utf-8")
        print(f"      ✓ Created {len(windows)} window segments")

    def _step_extract_claims(
        self, checkpoint: Checkpoint, audio_path: Path, episode_id: str
    ) -> Dict[str, Any]:
        """Step 6: Identify scientific claims with timestamps, link to papers."""
        import subprocess

        # This requires window segments to exist
        window_file = DATA_DIR / f"window_segments_{episode_id}.json"
        if not window_file.exists():
            print(f"      ⚠ No window segments found at {window_file}")
            return {"claims_extracted": False}

        metadata = checkpoint.data.get("metadata", {})
        episode_title = metadata.get("title", episode_id)

        # Call the batch runner script
        cmd = [
            sys.executable,
            str(SCRIPTS_DIR / "run_context_card_builder_batch.py"),
            "--window-json", str(window_file),
            "--podcast-id", episode_id,
            "--episode-title", episode_title,
            "--use-gemini",
        ]

        print(f"      Running claim extraction on {window_file.name}...")
        try:
            result = subprocess.run(
                cmd,
                cwd=str(REPO_ROOT),
                capture_output=True,
                text=True,
                timeout=3600,  # 1 hour timeout
            )

            if result.returncode != 0:
                print(f"      ⚠ Claim extraction returned non-zero: {result.returncode}")
                if result.stderr:
                    print(f"      stderr: {result.stderr[:500]}")
                return {"claims_extracted": False}

            print(f"      ✓ Extracted claims, linked to papers")
            return {"claims_extracted": True}
        except subprocess.TimeoutExpired:
            print(f"      ⚠ Claim extraction timed out after 1 hour")
            return {"claims_extracted": False}
        except Exception as e:
            print(f"      ⚠ Claim extraction failed: {e}")
            return {"claims_extracted": False}

    def _step_build_clusters(
        self, checkpoint: Checkpoint, audio_path: Path, episode_id: str
    ) -> Dict[str, Any]:
        """Step 7: Group claims into thematic clusters."""
        import subprocess

        # Call the cluster builder script
        cmd = [
            sys.executable,
            str(SCRIPTS_DIR / "build_taxonomy_clusters.py"),
        ]

        print("      Building taxonomy clusters (this may take a while)...")
        try:
            result = subprocess.run(
                cmd,
                cwd=str(REPO_ROOT),
                capture_output=True,
                text=True,
                timeout=1800,  # 30 min timeout
            )

            if result.returncode != 0:
                print(f"      ⚠ Cluster building returned non-zero: {result.returncode}")
                if result.stderr:
                    print(f"      stderr: {result.stderr[:500]}")
                return {"clusters_built": False}

            print(f"      ✓ Grouped into thematic clusters")
            return {"clusters_built": True}
        except subprocess.TimeoutExpired:
            print(f"      ⚠ Cluster building timed out")
            return {"clusters_built": False}
        except Exception as e:
            print(f"      ⚠ Cluster building failed: {e}")
            return {"clusters_built": False}

    def _step_migrate_to_supabase(
        self, checkpoint: Checkpoint, audio_path: Path, episode_id: str
    ) -> Dict[str, Any]:
        """Step 8: Sync episode and claims to Supabase database."""
        try:
            from supabase_client import get_db
        except ImportError:
            print("      ⚠ Supabase client not available")
            print("      Run manually: python scripts/migrate_to_supabase.py")
            return {"synced_to_supabase": False}

        metadata = checkpoint.data.get("metadata", {})

        try:
            db = get_db(use_service_key=True)

            # Check if episode already exists
            existing = db.get_episode(episode_id)
            if existing:
                print(f"      Episode already exists in Supabase, updating...")

            # Create/update episode record
            episode_data = {
                "podcast_id": episode_id,
                "title": metadata.get("title", episode_id),
                "guest_name": metadata.get("guest"),
                "podcast_series": metadata.get("podcast", "Unknown Podcast"),
                "description": metadata.get("description"),
            }

            if existing:
                db.update_episode(episode_id, episode_data)
            else:
                db.create_episode(episode_data)

            print(f"      ✓ Episode record synced")

            # TODO: Sync claims from context card registry
            # For now, this requires running migrate_to_supabase.py manually
            # or extending the supabase_client to handle claim migration
            print(f"      ⚠ Claims sync not yet automated - run migrate_to_supabase.py manually if needed")

            return {"synced_to_supabase": True}
        except Exception as e:
            print(f"      ⚠ Supabase sync failed: {e}")
            import traceback
            traceback.print_exc()
            return {"synced_to_supabase": False}

    def _step_update_vector_store(
        self, checkpoint: Checkpoint, audio_path: Path, episode_id: str
    ) -> Dict[str, Any]:
        """Step 9: Add claim embeddings for semantic search."""
        import subprocess

        # Note: This rebuilds the entire vector store, not just for the new episode
        # Could be optimized in future to do incremental updates
        cmd = [
            sys.executable,
            str(SCRIPTS_DIR / "build_vector_store.py"),
        ]

        print("      Rebuilding vector store (this may take a while)...")
        try:
            result = subprocess.run(
                cmd,
                cwd=str(REPO_ROOT),
                capture_output=True,
                text=True,
                timeout=1800,  # 30 min timeout
            )

            if result.returncode != 0:
                print(f"      ⚠ Vector store build returned non-zero: {result.returncode}")
                if result.stderr:
                    print(f"      stderr: {result.stderr[:500]}")
                return {"vector_store_updated": False}

            print(f"      ✓ Vector store updated")
            return {"vector_store_updated": True}
        except subprocess.TimeoutExpired:
            print(f"      ⚠ Vector store build timed out")
            return {"vector_store_updated": False}
        except Exception as e:
            print(f"      ⚠ Vector store update failed: {e}")
            return {"vector_store_updated": False}


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Add a new episode to the Noeron system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Add a new episode
    python scripts/add_episode.py --audio /path/to/episode.mp3 --id lex_450

    # Resume a failed run
    python scripts/add_episode.py --resume lex_450

    # Skip expensive steps
    python scripts/add_episode.py --audio ep.mp3 --id lex_450 --skip-claims --skip-vectors

    # Dry run (see what would happen)
    python scripts/add_episode.py --audio ep.mp3 --id lex_450 --dry-run
        """
    )

    # Input options (mutually exclusive)
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--audio", "-a",
        type=Path,
        help="Path to the audio file (MP3, WAV, etc.)",
    )
    input_group.add_argument(
        "--resume", "-r",
        metavar="EPISODE_ID",
        help="Resume a failed run for the specified episode ID",
    )

    # Episode identifier
    parser.add_argument(
        "--id", "-i",
        dest="episode_id",
        help="Unique episode identifier (e.g., 'lex_450'). Required with --audio.",
    )

    # Skip options
    parser.add_argument(
        "--skip-claims",
        action="store_true",
        help="Skip claim extraction step",
    )
    parser.add_argument(
        "--skip-vectors",
        action="store_true",
        help="Skip vector store update step",
    )
    parser.add_argument(
        "--skip-summaries",
        action="store_true",
        help="Skip summary generation step",
    )
    parser.add_argument(
        "--skip-clusters",
        action="store_true",
        help="Skip cluster building step",
    )
    parser.add_argument(
        "--skip-supabase",
        action="store_true",
        help="Skip Supabase sync step",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without executing",
    )

    args = parser.parse_args()

    # Validate arguments
    if args.audio and not args.episode_id:
        parser.error("--id is required when using --audio")

    if args.audio and not args.audio.exists():
        parser.error(f"Audio file not found: {args.audio}")

    # Create orchestrator
    orchestrator = EpisodeOrchestrator(
        skip_claims=args.skip_claims,
        skip_vectors=args.skip_vectors,
        skip_summaries=args.skip_summaries,
        skip_clusters=args.skip_clusters,
        skip_supabase=args.skip_supabase,
        dry_run=args.dry_run,
    )

    # Run or resume
    if args.resume:
        success = orchestrator.resume(args.resume)
    else:
        success = orchestrator.run(args.audio, args.episode_id)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
