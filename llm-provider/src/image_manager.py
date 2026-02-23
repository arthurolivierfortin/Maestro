"""
ImageManager: Manages loading, unloading, and inference for Stable Diffusion image generation.
Separate from ModelManager (text models) because:
  - Different pipeline (StableDiffusionPipeline vs AutoModelForCausalLM)
  - Different API surface (image output vs text output)
  - VRAM mutual exclusion (can't have both loaded on small GPUs)

Used by the FastAPI server (api/server.py) to provide local GPU-accelerated image generation.
"""
import time
import threading
import random
from typing import Optional, Dict, Any, List
from pathlib import Path

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    from diffusers import StableDiffusionPipeline
    DIFFUSERS_AVAILABLE = True
except ImportError:
    DIFFUSERS_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


# Default SD 1.5 model — runs on 4GB VRAM with float16
DEFAULT_SD_MODEL = "stable-diffusion-v1-5/stable-diffusion-v1-5"

# LoRA models directory (relative to llm-provider root)
LORA_DIR = Path(__file__).parent.parent / "api" / "models" / "pixel-art-lora"


class ImageManager:
    """Manages Stable Diffusion pipeline for image generation."""

    def __init__(self):
        self._pipeline = None
        self._model_id: Optional[str] = None
        self._loaded_loras: Dict[str, float] = {}  # name -> weight
        self._lock = threading.Lock()
        self._device = "cuda" if (TORCH_AVAILABLE and torch.cuda.is_available()) else "cpu"
        self._loaded_at: Optional[float] = None
        self._load_time_s: Optional[float] = None

    def is_loaded(self) -> bool:
        """Check if a model is currently loaded."""
        return self._pipeline is not None

    def status(self) -> Dict[str, Any]:
        """Return current status of the image manager."""
        return {
            "loaded": self.is_loaded(),
            "model_id": self._model_id,
            "device": self._device,
            "loras": list(self._loaded_loras.keys()),
            "loaded_at": self._loaded_at,
            "load_time_s": self._load_time_s,
            "diffusers_available": DIFFUSERS_AVAILABLE,
            "torch_available": TORCH_AVAILABLE,
        }

    def load(self, model_id: str = DEFAULT_SD_MODEL) -> Dict[str, Any]:
        """
        Load a Stable Diffusion model into memory.
        Unloads text models if VRAM is tight.
        Returns metadata dict.
        """
        if not DIFFUSERS_AVAILABLE:
            raise RuntimeError(
                "diffusers library not installed. "
                "Run: pip install diffusers accelerate safetensors Pillow"
            )

        with self._lock:
            # Already loaded this model
            if self._pipeline is not None and self._model_id == model_id:
                return {
                    "loaded_at": self._loaded_at,
                    "load_time_s": self._load_time_s,
                    "device": self._device,
                    "model_id": self._model_id,
                }

            # Unload current model if different
            if self._pipeline is not None:
                self._unload_internal()

            # Try to free VRAM by unloading text models
            self._free_vram_if_needed()

            start = time.time()
            print(f"[ImageManager] Loading {model_id} on {self._device}...")

            load_kwargs: Dict[str, Any] = {
                "safety_checker": None,  # Disable for speed
                "requires_safety_checker": False,
            }

            if self._device == "cuda":
                load_kwargs["torch_dtype"] = torch.float16

            try:
                pipeline = StableDiffusionPipeline.from_pretrained(
                    model_id, **load_kwargs
                )
                pipeline = pipeline.to(self._device)

                # Enable memory optimizations
                if self._device == "cuda":
                    try:
                        pipeline.enable_attention_slicing()
                    except Exception:
                        pass  # Not all pipelines support this

                self._pipeline = pipeline
                self._model_id = model_id
                self._loaded_loras = {}
                self._load_time_s = round(time.time() - start, 2)
                self._loaded_at = time.time()

                print(f"[ImageManager] Loaded {model_id} in {self._load_time_s}s on {self._device}")

                return {
                    "loaded_at": self._loaded_at,
                    "load_time_s": self._load_time_s,
                    "device": self._device,
                    "model_id": self._model_id,
                }

            except Exception as e:
                print(f"[ImageManager] Failed to load {model_id}: {e}")
                self._pipeline = None
                self._model_id = None
                raise

    def unload(self) -> None:
        """Unload the current model and free VRAM."""
        with self._lock:
            self._unload_internal()

    def _unload_internal(self) -> None:
        """Internal unload (caller must hold lock)."""
        if self._pipeline is not None:
            print(f"[ImageManager] Unloading {self._model_id}")
            del self._pipeline
            self._pipeline = None
            self._model_id = None
            self._loaded_loras = {}
            self._loaded_at = None
            self._load_time_s = None

            if TORCH_AVAILABLE and torch.cuda.is_available():
                torch.cuda.empty_cache()

    def _free_vram_if_needed(self) -> None:
        """Try to free VRAM by unloading text models if needed."""
        try:
            from api.hardware import get_available_vram
            vram = get_available_vram()

            # SD 1.5 needs ~4GB, leave some headroom
            if vram < 5.0:
                print(f"[ImageManager] Low VRAM ({vram:.1f}GB). Unloading text models...")
                try:
                    from src.model_manager import get_default_manager
                    text_manager = get_default_manager()
                    for mid in list(text_manager.list_models().keys()):
                        text_manager.unload(mid)
                    print("[ImageManager] Text models unloaded")
                except Exception as e:
                    print(f"[ImageManager] Warning: could not unload text models: {e}")
        except ImportError:
            pass  # hardware module not available

    def load_lora(self, lora_name: str, lora_path: Optional[str] = None,
                  weight: float = 0.8) -> None:
        """
        Load a LoRA adapter on top of the base model.

        Args:
            lora_name: Name identifier for the LoRA
            lora_path: Path to .safetensors file. If None, looks in LORA_DIR.
            weight: LoRA weight (0.0-1.5)
        """
        if self._pipeline is None:
            self.load()

        if lora_name in self._loaded_loras:
            return  # Already loaded

        if lora_path is None:
            lora_path = str(LORA_DIR / f"{lora_name}.safetensors")

        lora_file = Path(lora_path)
        if not lora_file.exists():
            print(f"[ImageManager] LoRA not found: {lora_path}, skipping")
            return

        with self._lock:
            try:
                print(f"[ImageManager] Loading LoRA: {lora_name} (weight={weight})")
                self._pipeline.load_lora_weights(str(lora_file.parent), weight_name=lora_file.name)
                self._pipeline.fuse_lora(lora_scale=weight)
                self._loaded_loras[lora_name] = weight
                print(f"[ImageManager] LoRA {lora_name} loaded and fused")
            except Exception as e:
                print(f"[ImageManager] Warning: could not load LoRA {lora_name}: {e}")

    def generate(
        self,
        prompt: str,
        negative_prompt: str = "",
        width: int = 512,
        height: int = 512,
        steps: int = 30,
        cfg_scale: float = 12.0,
        seed: int = -1,
    ) -> Dict[str, Any]:
        """
        Generate an image from a text prompt.

        Returns dict with:
          - image: PIL.Image
          - seed: int (the seed used)
          - metadata: dict with generation params
        """
        if not PIL_AVAILABLE:
            raise RuntimeError("Pillow not installed. Run: pip install Pillow")

        # Auto-load if not loaded
        if self._pipeline is None:
            self.load()

        # Resolve seed
        if seed < 0:
            seed = random.randint(0, 2**32 - 1)

        # Create generator for reproducibility
        if TORCH_AVAILABLE and self._device == "cuda":
            generator = torch.Generator(device="cuda").manual_seed(seed)
        elif TORCH_AVAILABLE:
            generator = torch.Generator().manual_seed(seed)
        else:
            generator = None

        start = time.time()

        with self._lock:
            try:
                result = self._pipeline(
                    prompt=prompt,
                    negative_prompt=negative_prompt if negative_prompt else None,
                    width=width,
                    height=height,
                    num_inference_steps=steps,
                    guidance_scale=cfg_scale,
                    generator=generator,
                )
            except RuntimeError as e:
                if "CUDA" in str(e) and TORCH_AVAILABLE:
                    torch.cuda.empty_cache()
                    result = self._pipeline(
                        prompt=prompt,
                        negative_prompt=negative_prompt if negative_prompt else None,
                        width=width,
                        height=height,
                        num_inference_steps=steps,
                        guidance_scale=cfg_scale,
                        generator=generator,
                    )
                else:
                    raise

        gen_time = round(time.time() - start, 2)

        return {
            "image": result.images[0],
            "seed": seed,
            "metadata": {
                "model_id": self._model_id,
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "width": width,
                "height": height,
                "steps": steps,
                "cfg_scale": cfg_scale,
                "generation_time_s": gen_time,
                "device": self._device,
                "loras": list(self._loaded_loras.keys()),
            },
        }


# =============================================================================
# Singleton
# =============================================================================

_default_image_manager: Optional[ImageManager] = None
_image_manager_lock = threading.Lock()


def get_default_image_manager() -> ImageManager:
    """Return the singleton ImageManager instance."""
    global _default_image_manager
    if _default_image_manager is None:
        with _image_manager_lock:
            if _default_image_manager is None:
                _default_image_manager = ImageManager()
    return _default_image_manager
