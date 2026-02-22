"""
ModelManager: Manages loading, unloading, switching, and inference for local HuggingFace models.
Used by the FastAPI server (api/server.py) to provide local GPU-accelerated LLM inference.
"""
import time
import threading
from typing import Optional, Dict, Any

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


class ModelManager:
    """Manages multiple loaded models, tracks the active model, and runs inference."""

    def __init__(self):
        self._models: Dict[str, Dict[str, Any]] = {}
        self._active_model: Optional[str] = None
        self._lock = threading.Lock()

    def current(self) -> Optional[str]:
        """Return the currently active model ID, or None."""
        return self._active_model

    def list_models(self) -> Dict[str, Dict[str, Any]]:
        """Return metadata for all loaded models."""
        result = {}
        for model_id, entry in self._models.items():
            result[model_id] = {
                "loaded_at": entry.get("loaded_at"),
                "load_time_s": entry.get("load_time_s"),
                "device": entry.get("device"),
            }
        return result

    def load(self, model_id: str, use_8bit: bool = False) -> Dict[str, Any]:
        """Load a model into memory. Returns metadata dict."""
        with self._lock:
            if model_id in self._models:
                return {
                    "loaded_at": self._models[model_id]["loaded_at"],
                    "load_time_s": self._models[model_id]["load_time_s"],
                    "device": self._models[model_id]["device"],
                }

            start = time.time()
            device = "cuda" if torch.cuda.is_available() else "cpu"

            tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token

            load_kwargs: Dict[str, Any] = {
                "trust_remote_code": True,
            }

            if use_8bit and device == "cuda":
                load_kwargs["load_in_8bit"] = True
                load_kwargs["device_map"] = "auto"
            elif device == "cuda":
                load_kwargs["torch_dtype"] = torch.float16
                load_kwargs["device_map"] = "auto"

            model = AutoModelForCausalLM.from_pretrained(model_id, **load_kwargs)

            if not use_8bit and device == "cuda" and not hasattr(model, "hf_device_map"):
                model = model.to(device)

            model.eval()

            load_time = time.time() - start
            actual_device = str(next(model.parameters()).device) if len(list(model.parameters())) > 0 else device

            self._models[model_id] = {
                "model": model,
                "tokenizer": tokenizer,
                "loaded_at": time.time(),
                "load_time_s": round(load_time, 2),
                "device": actual_device,
                "use_8bit": use_8bit,
            }

            if self._active_model is None:
                self._active_model = model_id

            return {
                "loaded_at": self._models[model_id]["loaded_at"],
                "load_time_s": self._models[model_id]["load_time_s"],
                "device": actual_device,
            }

    def unload(self, model_id: str) -> None:
        """Unload a model from memory and free GPU resources."""
        with self._lock:
            if model_id not in self._models:
                return

            entry = self._models.pop(model_id)
            del entry["model"]
            del entry["tokenizer"]

            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            if self._active_model == model_id:
                self._active_model = next(iter(self._models), None)

    def switch(self, model_id: str, use_8bit: bool = False, keep_loaded: bool = False) -> Dict[str, Any]:
        """Switch active model. Loads if not loaded. Unloads others unless keep_loaded=True."""
        if not keep_loaded:
            models_to_unload = [mid for mid in self._models if mid != model_id]
            for mid in models_to_unload:
                self.unload(mid)

        meta = self.load(model_id, use_8bit=use_8bit)
        self._active_model = model_id
        return meta

    def get_tokenizer(self, model_id: Optional[str] = None):
        """Return the tokenizer for a loaded model."""
        mid = model_id or self._active_model
        if mid is None:
            raise ValueError("No model loaded")
        if mid not in self._models:
            raise ValueError(f"Model '{mid}' is not loaded")
        return self._models[mid]["tokenizer"]

    def generate(
        self,
        prompt: str,
        model_id: Optional[str] = None,
        max_new_tokens: int = 256,
        temperature: float = 0.7,
        do_sample: bool = True,
        top_p: float = 0.95,
    ) -> Dict[str, Any]:
        """Generate text from a prompt. Returns dict with text, token counts."""
        mid = model_id or self._active_model
        if mid is None:
            raise ValueError("No model loaded")
        if mid not in self._models:
            self.load(mid)

        entry = self._models[mid]
        model = entry["model"]
        tokenizer = entry["tokenizer"]
        device = entry["device"]

        inputs = tokenizer(prompt, return_tensors="pt")
        if "cuda" in device:
            inputs = {k: v.to(device) for k, v in inputs.items()}

        prompt_tokens = inputs["input_ids"].shape[1]

        gen_kwargs: Dict[str, Any] = {
            "max_new_tokens": max_new_tokens,
            "do_sample": do_sample and temperature > 0,
        }
        if do_sample and temperature > 0:
            gen_kwargs["temperature"] = temperature
            if top_p < 1.0:
                gen_kwargs["top_p"] = top_p

        with torch.no_grad():
            try:
                outputs = model.generate(**inputs, **gen_kwargs)
            except RuntimeError as e:
                if "CUDA" in str(e):
                    torch.cuda.empty_cache()
                    outputs = model.generate(**inputs, **gen_kwargs)
                else:
                    raise

        generated_ids = outputs[0]
        text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        completion_tokens = len(generated_ids) - prompt_tokens

        return {
            "text": text,
            "model_id": mid,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": max(0, completion_tokens),
            "total_tokens": prompt_tokens + max(0, completion_tokens),
        }


_default_manager: Optional[ModelManager] = None
_manager_lock = threading.Lock()


def get_default_manager() -> ModelManager:
    """Return the singleton ModelManager instance."""
    global _default_manager
    if _default_manager is None:
        with _manager_lock:
            if _default_manager is None:
                _default_manager = ModelManager()
    return _default_manager
