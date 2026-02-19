"""
Model discovery module for scanning local HuggingFace cache and identifying installed models.
"""
import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime

try:
    from api.model_registry import MODEL_REGISTRY, ModelSpec
except ImportError:
    from model_registry import MODEL_REGISTRY, ModelSpec


@dataclass
class LocalModelInfo:
    """Information about a locally cached model."""
    model_id: str
    path: str
    size_gb: float
    last_accessed: Optional[datetime] = None
    is_complete: bool = True
    # Registry info (if available)
    display_name: Optional[str] = None
    category: Optional[str] = None
    vram_required_fp16: Optional[float] = None
    vram_required_int8: Optional[float] = None
    vram_required_int4: Optional[float] = None
    context_length: Optional[int] = None
    capabilities: Optional[List[str]] = None

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        if result.get("last_accessed"):
            result["last_accessed"] = result["last_accessed"].isoformat()
        return result


def get_huggingface_cache_dir() -> Path:
    """Get the HuggingFace cache directory."""
    # Check environment variable first
    cache_dir = os.environ.get("HF_HOME")
    if cache_dir:
        return Path(cache_dir) / "hub"

    # Check XDG cache (Linux)
    xdg_cache = os.environ.get("XDG_CACHE_HOME")
    if xdg_cache:
        return Path(xdg_cache) / "huggingface" / "hub"

    # Default locations
    home = Path.home()

    # Windows
    if os.name == "nt":
        return home / ".cache" / "huggingface" / "hub"

    # Linux/Mac
    return home / ".cache" / "huggingface" / "hub"


def get_directory_size(path: Path) -> float:
    """Calculate total size of a directory in GB."""
    total = 0
    try:
        for entry in path.rglob("*"):
            if entry.is_file():
                total += entry.stat().st_size
    except (PermissionError, OSError):
        pass
    return round(total / (1024**3), 2)


def parse_model_id_from_cache_dir(cache_dir_name: str) -> Optional[str]:
    """
    Parse model ID from HuggingFace cache directory name.
    Cache dirs are named like: models--org--model-name
    """
    if not cache_dir_name.startswith("models--"):
        return None

    # Remove 'models--' prefix and replace '--' with '/'
    parts = cache_dir_name[8:].split("--", 1)
    if len(parts) == 2:
        return f"{parts[0]}/{parts[1]}"
    elif len(parts) == 1:
        return parts[0]
    return None


def check_model_completeness(model_path: Path) -> bool:
    """
    Check if a model download appears complete.
    Looks for common model files and checks for incomplete downloads.
    """
    snapshots_dir = model_path / "snapshots"
    if not snapshots_dir.exists():
        return False

    # Get the latest snapshot
    snapshots = list(snapshots_dir.iterdir())
    if not snapshots:
        return False

    latest_snapshot = max(snapshots, key=lambda p: p.stat().st_mtime)

    # Check for incomplete files (*.incomplete)
    incomplete_files = list(latest_snapshot.glob("*.incomplete"))
    if incomplete_files:
        return False

    # Check for common model files
    model_files = (
        list(latest_snapshot.glob("*.bin")) +
        list(latest_snapshot.glob("*.safetensors")) +
        list(latest_snapshot.glob("model.safetensors.index.json")) +
        list(latest_snapshot.glob("pytorch_model.bin.index.json"))
    )

    return len(model_files) > 0


def get_model_last_accessed(model_path: Path) -> Optional[datetime]:
    """Get the last access time for a model."""
    try:
        snapshots_dir = model_path / "snapshots"
        if snapshots_dir.exists():
            snapshots = list(snapshots_dir.iterdir())
            if snapshots:
                latest_snapshot = max(snapshots, key=lambda p: p.stat().st_mtime)
                return datetime.fromtimestamp(latest_snapshot.stat().st_mtime)
    except (OSError, PermissionError):
        pass
    return None


def enrich_with_registry_info(local_model: LocalModelInfo) -> LocalModelInfo:
    """Add registry information to a local model if available."""
    model_id_lower = local_model.model_id.lower()

    for model_id, reg_model in MODEL_REGISTRY.items():
        if model_id.lower() == model_id_lower:
            local_model.display_name = reg_model.name
            local_model.category = reg_model.category.value if reg_model.category else None
            local_model.vram_required_fp16 = reg_model.vram_fp16_gb
            local_model.vram_required_int8 = reg_model.vram_int8_gb
            local_model.vram_required_int4 = reg_model.vram_int4_gb
            local_model.context_length = reg_model.context_length
            local_model.capabilities = reg_model.capabilities
            break

    return local_model


def scan_local_models(cache_dir: Optional[Path] = None) -> List[LocalModelInfo]:
    """
    Scan the HuggingFace cache for locally downloaded models.

    Returns:
        List of LocalModelInfo for each model found in cache.
    """
    if cache_dir is None:
        cache_dir = get_huggingface_cache_dir()

    local_models = []

    if not cache_dir.exists():
        return local_models

    # Scan for model directories
    try:
        for entry in cache_dir.iterdir():
            if not entry.is_dir():
                continue

            model_id = parse_model_id_from_cache_dir(entry.name)
            if not model_id:
                continue

            # Get model info
            size_gb = get_directory_size(entry)
            is_complete = check_model_completeness(entry)
            last_accessed = get_model_last_accessed(entry)

            local_model = LocalModelInfo(
                model_id=model_id,
                path=str(entry),
                size_gb=size_gb,
                last_accessed=last_accessed,
                is_complete=is_complete
            )

            # Enrich with registry info
            local_model = enrich_with_registry_info(local_model)

            local_models.append(local_model)

    except (PermissionError, OSError) as e:
        print(f"Error scanning cache directory: {e}")

    # Sort by last accessed (most recent first)
    local_models.sort(
        key=lambda m: m.last_accessed or datetime.min,
        reverse=True
    )

    return local_models


def get_local_model(model_id: str, cache_dir: Optional[Path] = None) -> Optional[LocalModelInfo]:
    """
    Get information about a specific locally cached model.

    Args:
        model_id: The HuggingFace model ID (e.g., "deepseek-ai/deepseek-coder-1.3b-instruct")
        cache_dir: Optional custom cache directory

    Returns:
        LocalModelInfo if found, None otherwise.
    """
    if cache_dir is None:
        cache_dir = get_huggingface_cache_dir()

    # Convert model ID to cache directory name
    cache_dir_name = f"models--{model_id.replace('/', '--')}"
    model_path = cache_dir / cache_dir_name

    if not model_path.exists():
        return None

    size_gb = get_directory_size(model_path)
    is_complete = check_model_completeness(model_path)
    last_accessed = get_model_last_accessed(model_path)

    local_model = LocalModelInfo(
        model_id=model_id,
        path=str(model_path),
        size_gb=size_gb,
        last_accessed=last_accessed,
        is_complete=is_complete
    )

    return enrich_with_registry_info(local_model)


def is_model_cached(model_id: str, cache_dir: Optional[Path] = None) -> bool:
    """Check if a model is cached locally."""
    model = get_local_model(model_id, cache_dir)
    return model is not None and model.is_complete


def get_cache_stats(cache_dir: Optional[Path] = None) -> Dict[str, Any]:
    """Get statistics about the local model cache."""
    local_models = scan_local_models(cache_dir)

    total_size = sum(m.size_gb for m in local_models)
    complete_models = [m for m in local_models if m.is_complete]
    incomplete_models = [m for m in local_models if not m.is_complete]

    # Count by category
    categories = {}
    for model in local_models:
        cat = model.category or "unknown"
        categories[cat] = categories.get(cat, 0) + 1

    return {
        "cache_directory": str(get_huggingface_cache_dir() if cache_dir is None else cache_dir),
        "total_models": len(local_models),
        "complete_models": len(complete_models),
        "incomplete_models": len(incomplete_models),
        "total_size_gb": round(total_size, 2),
        "categories": categories,
        "models": [m.to_dict() for m in local_models]
    }


# CLI for testing
if __name__ == "__main__":
    print("Scanning local HuggingFace cache...")
    stats = get_cache_stats()

    print(f"\nCache directory: {stats['cache_directory']}")
    print(f"Total models: {stats['total_models']}")
    print(f"Complete: {stats['complete_models']}, Incomplete: {stats['incomplete_models']}")
    print(f"Total size: {stats['total_size_gb']} GB")

    print("\nCategories:")
    for cat, count in stats['categories'].items():
        print(f"  {cat}: {count}")

    print("\nLocal models:")
    for model in stats['models']:
        status = "complete" if model['is_complete'] else "INCOMPLETE"
        name = model.get('display_name') or model['model_id']
        print(f"  - {name} ({model['size_gb']} GB) [{status}]")
