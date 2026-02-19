"""
Hardware detection module for GPU, CPU, and RAM information.
Provides system capabilities for model compatibility assessment.
"""
import platform
import os
from typing import Dict, Optional, Any
from dataclasses import dataclass, asdict

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False


@dataclass
class GPUInfo:
    """Information about a GPU device."""
    available: bool
    name: Optional[str] = None
    vram_total_gb: float = 0.0
    vram_used_gb: float = 0.0
    vram_free_gb: float = 0.0
    cuda_version: Optional[str] = None
    compute_capability: Optional[str] = None
    driver_version: Optional[str] = None
    device_index: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CPUInfo:
    """Information about the CPU."""
    name: str
    cores_physical: int
    cores_logical: int
    architecture: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RAMInfo:
    """Information about system RAM."""
    total_gb: float
    available_gb: float
    used_gb: float
    percent_used: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SystemCapabilities:
    """Complete system hardware capabilities."""
    gpu: GPUInfo
    cpu: CPUInfo
    ram: RAMInfo
    platform: str
    python_version: str
    torch_version: Optional[str]
    cuda_available: bool
    mps_available: bool  # Apple Silicon

    def to_dict(self) -> Dict[str, Any]:
        return {
            "gpu": self.gpu.to_dict(),
            "cpu": self.cpu.to_dict(),
            "ram": self.ram.to_dict(),
            "platform": self.platform,
            "python_version": self.python_version,
            "torch_version": self.torch_version,
            "cuda_available": self.cuda_available,
            "mps_available": self.mps_available
        }


def get_gpu_info(device_index: int = 0) -> GPUInfo:
    """
    Get information about the GPU.
    Returns GPUInfo with available=False if no GPU detected.
    """
    if not TORCH_AVAILABLE:
        return GPUInfo(available=False)

    # Check CUDA (NVIDIA)
    if torch.cuda.is_available():
        try:
            props = torch.cuda.get_device_properties(device_index)

            # Get memory info
            total_memory = props.total_memory
            allocated_memory = torch.cuda.memory_allocated(device_index)
            reserved_memory = torch.cuda.memory_reserved(device_index)

            # Calculate free VRAM (total - reserved is more accurate for availability)
            free_memory = total_memory - reserved_memory

            # Get CUDA version
            cuda_version = None
            if hasattr(torch.version, 'cuda') and torch.version.cuda:
                cuda_version = torch.version.cuda

            return GPUInfo(
                available=True,
                name=props.name,
                vram_total_gb=round(total_memory / (1024**3), 2),
                vram_used_gb=round(reserved_memory / (1024**3), 2),
                vram_free_gb=round(free_memory / (1024**3), 2),
                cuda_version=cuda_version,
                compute_capability=f"{props.major}.{props.minor}",
                device_index=device_index
            )
        except Exception as e:
            print(f"Error getting GPU info: {e}")
            return GPUInfo(available=False)

    # Check MPS (Apple Silicon)
    if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        return GPUInfo(
            available=True,
            name="Apple Silicon (MPS)",
            # MPS doesn't provide detailed memory info
            vram_total_gb=0.0,  # Shared with system RAM
            vram_used_gb=0.0,
            vram_free_gb=0.0,
            device_index=0
        )

    return GPUInfo(available=False)


def get_cpu_info() -> CPUInfo:
    """Get information about the CPU."""
    # Get CPU name
    cpu_name = "Unknown"
    try:
        if platform.system() == "Windows":
            import subprocess
            result = subprocess.run(
                ["wmic", "cpu", "get", "name"],
                capture_output=True,
                text=True,
                timeout=5
            )
            lines = result.stdout.strip().split('\n')
            if len(lines) > 1:
                cpu_name = lines[1].strip()
        elif platform.system() == "Linux":
            with open("/proc/cpuinfo", "r") as f:
                for line in f:
                    if "model name" in line:
                        cpu_name = line.split(":")[1].strip()
                        break
        elif platform.system() == "Darwin":
            import subprocess
            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True,
                text=True,
                timeout=5
            )
            cpu_name = result.stdout.strip()
    except Exception:
        pass

    # Get core counts
    cores_physical = os.cpu_count() or 1
    cores_logical = cores_physical

    if PSUTIL_AVAILABLE:
        try:
            cores_physical = psutil.cpu_count(logical=False) or cores_physical
            cores_logical = psutil.cpu_count(logical=True) or cores_logical
        except Exception:
            pass

    return CPUInfo(
        name=cpu_name,
        cores_physical=cores_physical,
        cores_logical=cores_logical,
        architecture=platform.machine()
    )


def get_ram_info() -> RAMInfo:
    """Get information about system RAM."""
    if not PSUTIL_AVAILABLE:
        return RAMInfo(
            total_gb=0.0,
            available_gb=0.0,
            used_gb=0.0,
            percent_used=0.0
        )

    try:
        mem = psutil.virtual_memory()
        return RAMInfo(
            total_gb=round(mem.total / (1024**3), 2),
            available_gb=round(mem.available / (1024**3), 2),
            used_gb=round(mem.used / (1024**3), 2),
            percent_used=round(mem.percent, 1)
        )
    except Exception:
        return RAMInfo(
            total_gb=0.0,
            available_gb=0.0,
            used_gb=0.0,
            percent_used=0.0
        )


def get_system_capabilities() -> SystemCapabilities:
    """Get complete system hardware capabilities."""
    gpu = get_gpu_info()
    cpu = get_cpu_info()
    ram = get_ram_info()

    # Torch version
    torch_version = None
    if TORCH_AVAILABLE:
        torch_version = torch.__version__

    # MPS availability
    mps_available = False
    if TORCH_AVAILABLE and hasattr(torch.backends, 'mps'):
        mps_available = torch.backends.mps.is_available()

    return SystemCapabilities(
        gpu=gpu,
        cpu=cpu,
        ram=ram,
        platform=f"{platform.system()} {platform.release()}",
        python_version=platform.python_version(),
        torch_version=torch_version,
        cuda_available=TORCH_AVAILABLE and torch.cuda.is_available(),
        mps_available=mps_available
    )


def get_available_vram() -> float:
    """
    Get available VRAM in GB.
    Returns 0 if no GPU available.
    """
    gpu = get_gpu_info()
    if gpu.available:
        return gpu.vram_free_gb
    return 0.0


def can_run_model(vram_required_gb: float, use_system_ram: bool = False) -> bool:
    """
    Check if a model with given VRAM requirement can run.

    Args:
        vram_required_gb: VRAM needed for the model
        use_system_ram: If True, also consider system RAM (for CPU inference)

    Returns:
        True if model can run
    """
    gpu = get_gpu_info()

    if gpu.available and gpu.vram_free_gb >= vram_required_gb:
        return True

    if use_system_ram:
        ram = get_ram_info()
        return ram.available_gb >= vram_required_gb

    return False
