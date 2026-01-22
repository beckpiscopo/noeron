"""Library modules for episode ingestion pipeline."""

from .checkpoint import Checkpoint, CheckpointManager

# Optional imports - may not be available if dependencies aren't installed
try:
    from .assemblyai_client import AssemblyAIClient
except ImportError:
    AssemblyAIClient = None

try:
    from .metadata_extractor import MetadataExtractor
except ImportError:
    MetadataExtractor = None

__all__ = [
    "Checkpoint",
    "CheckpointManager",
    "AssemblyAIClient",
    "MetadataExtractor",
]
