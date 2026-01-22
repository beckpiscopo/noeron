"""Checkpoint management for episode ingestion pipeline.

Provides save/load/resume functionality to handle failures gracefully.
Checkpoints store completed steps and intermediate data so the pipeline
can resume from where it left off.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CHECKPOINTS_DIR = REPO_ROOT / ".checkpoints"


@dataclass
class Checkpoint:
    """Represents the state of an episode ingestion run."""

    episode_id: str
    audio_path: str
    started_at: str
    completed_steps: List[str] = field(default_factory=list)
    current_step: Optional[str] = None
    data: Dict[str, Any] = field(default_factory=dict)
    errors: List[Dict[str, Any]] = field(default_factory=list)

    def mark_step_started(self, step_name: str) -> None:
        """Mark a step as started (current)."""
        self.current_step = step_name

    def mark_step_completed(self, step_name: str, step_data: Optional[Dict[str, Any]] = None) -> None:
        """Mark a step as completed and store any data."""
        if step_name not in self.completed_steps:
            self.completed_steps.append(step_name)
        if step_data:
            self.data.update(step_data)
        self.current_step = None

    def add_error(self, step_name: str, error: str, details: Optional[Dict[str, Any]] = None) -> None:
        """Record an error for a step."""
        error_entry = {
            "step": step_name,
            "error": error,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if details:
            error_entry["details"] = details
        self.errors.append(error_entry)

    def is_step_completed(self, step_name: str) -> bool:
        """Check if a step has been completed."""
        return step_name in self.completed_steps

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Checkpoint:
        """Create a Checkpoint from a dictionary."""
        return cls(
            episode_id=data.get("episode_id", ""),
            audio_path=data.get("audio_path", ""),
            started_at=data.get("started_at", ""),
            completed_steps=data.get("completed_steps", []),
            current_step=data.get("current_step"),
            data=data.get("data", {}),
            errors=data.get("errors", []),
        )


class CheckpointManager:
    """Manages checkpoint files for episode ingestion."""

    def __init__(self, checkpoints_dir: Optional[Path] = None):
        """Initialize the checkpoint manager.

        Args:
            checkpoints_dir: Directory to store checkpoint files.
                            Defaults to .checkpoints/ in repo root.
        """
        self.checkpoints_dir = checkpoints_dir or CHECKPOINTS_DIR
        self.checkpoints_dir.mkdir(parents=True, exist_ok=True)

    def _checkpoint_path(self, episode_id: str) -> Path:
        """Get the path for a checkpoint file."""
        return self.checkpoints_dir / f"{episode_id}.json"

    def exists(self, episode_id: str) -> bool:
        """Check if a checkpoint exists for the episode."""
        return self._checkpoint_path(episode_id).exists()

    def load(self, episode_id: str) -> Optional[Checkpoint]:
        """Load an existing checkpoint.

        Args:
            episode_id: Episode identifier

        Returns:
            Checkpoint if exists, None otherwise
        """
        path = self._checkpoint_path(episode_id)
        if not path.exists():
            return None

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return Checkpoint.from_dict(data)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Warning: Corrupted checkpoint for {episode_id}: {e}")
            return None

    def save(self, checkpoint: Checkpoint) -> None:
        """Save checkpoint to disk.

        Args:
            checkpoint: Checkpoint to save
        """
        path = self._checkpoint_path(checkpoint.episode_id)
        path.write_text(
            json.dumps(checkpoint.to_dict(), indent=2),
            encoding="utf-8"
        )

    def create(self, episode_id: str, audio_path: str) -> Checkpoint:
        """Create a new checkpoint for an episode.

        Args:
            episode_id: Episode identifier
            audio_path: Path to the audio file

        Returns:
            New Checkpoint instance
        """
        checkpoint = Checkpoint(
            episode_id=episode_id,
            audio_path=str(audio_path),
            started_at=datetime.utcnow().isoformat(),
        )
        self.save(checkpoint)
        return checkpoint

    def delete(self, episode_id: str) -> bool:
        """Delete a checkpoint file.

        Args:
            episode_id: Episode identifier

        Returns:
            True if deleted, False if didn't exist
        """
        path = self._checkpoint_path(episode_id)
        if path.exists():
            path.unlink()
            return True
        return False

    def get_resume_command(self, episode_id: str) -> str:
        """Generate the command to resume a failed run.

        Args:
            episode_id: Episode identifier

        Returns:
            Resume command string
        """
        return f"python scripts/add_episode.py --resume {episode_id}"
