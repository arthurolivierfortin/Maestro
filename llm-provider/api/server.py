"""
FastAPI server exposing endpoints for model management and generation.
Fully compatible with the .NET LLM Provider Platform.
"""
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import asyncio
import threading
import time
import os

import torch
from transformers import TextIteratorStreamer

from src.model_manager import get_default_manager, ModelManager
from src.image_manager import get_default_image_manager, ImageManager
from src.pixel_quantizer import PixelQuantizer
from api.hardware import (
    get_system_capabilities,
    get_gpu_info,
    get_available_vram,
    can_run_model,
    SystemCapabilities
)
from api.model_registry import (
    MODEL_REGISTRY,
    ModelCategory,
    ModelSpec,
    get_compatible_models,
    get_recommended_models,
    get_models_by_category,
    get_model,
    get_all_models
)
from api.model_discovery import (
    scan_local_models,
    get_local_model,
    is_model_cached,
    get_cache_stats
)

# Default coding models to pre-load
DEFAULT_CODING_MODELS = [
    "deepseek-ai/deepseek-coder-1.3b-instruct",
    # "Qwen/Qwen2.5-Coder-1.5B-Instruct",  # Uncomment if you have enough VRAM
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: pre-load default models on startup."""
    manager = get_default_manager()

    # Pre-load coding models
    preload_model = os.environ.get("LLM_PRELOAD_MODEL", "")
    if preload_model:
        print(f"[Startup] Pre-loading model: {preload_model}")
        try:
            manager.load(preload_model)
            print(f"[Startup] Model {preload_model} loaded successfully")
        except Exception as e:
            print(f"[Startup] Warning: Failed to pre-load {preload_model}: {e}")

    yield

    # Cleanup on shutdown
    print("[Shutdown] Cleaning up models...")


app = FastAPI(
    title="LLM-Provider Local API",
    version="1.0.0",
    description="Local LLM provider service for the LLM Provider Platform",
    lifespan=lifespan
)

# Enable CORS for .NET integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = get_default_manager()


# =============================================================================
# Request/Response Models
# =============================================================================

class Message(BaseModel):
    """A single message in a conversation."""
    role: str = Field(..., description="Message role: system, user, or assistant")
    content: str = Field(..., description="Message content")


class GenerateRequest(BaseModel):
    """Request for text generation."""
    prompt: str = Field(..., description="The prompt to generate from")
    model_id: Optional[str] = Field(None, description="Model to use (uses active model if not specified)")
    max_new_tokens: Optional[int] = Field(256, ge=1, le=4096, description="Maximum tokens to generate")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0, description="Sampling temperature")
    do_sample: Optional[bool] = Field(True, description="Whether to use sampling")
    top_p: Optional[float] = Field(0.95, ge=0.0, le=1.0, description="Top-p sampling")
    system_prompt: Optional[str] = Field(None, description="Optional system prompt")
    messages: Optional[List[Message]] = Field(None, description="Conversation history (alternative to prompt)")


class GenerateResponse(BaseModel):
    """Response from text generation."""
    generated_text: str = Field(..., description="Generated text content")
    model: str = Field(..., description="Model used for generation")
    prompt_tokens: int = Field(..., description="Number of tokens in prompt")
    completion_tokens: int = Field(..., description="Number of tokens generated")
    total_tokens: int = Field(..., description="Total tokens (prompt + completion)")
    finish_reason: str = Field("stop", description="Reason for stopping generation")


class ModelInfo(BaseModel):
    """Information about a loaded model."""
    model_id: str
    loaded_at: Optional[float] = None
    load_time_s: Optional[float] = None
    device: Optional[str] = None
    is_active: bool = False
    context_length: int = 2048
    max_output_tokens: int = 512
    capabilities: List[str] = ["chat", "completion"]


class ModelsResponse(BaseModel):
    """Response from models endpoint."""
    models: Dict[str, ModelInfo]
    active_model: Optional[str] = None


class SwitchModelRequest(BaseModel):
    """Request to switch the active model."""
    model_id: str = Field(..., description="Model ID to switch to")
    use_8bit: bool = Field(False, description="Whether to load in 8-bit mode")


class SwitchModelResponse(BaseModel):
    """Response from switch model endpoint."""
    status: str
    active_model: str
    load_time_s: Optional[float] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    active_model: Optional[str] = None
    models_loaded: int = 0
    device: str
    cuda_available: bool
    cuda_device_name: Optional[str] = None


class LoadModelRequest(BaseModel):
    """Request to load a model."""
    model_id: str = Field(..., description="Hugging Face model ID to load")
    use_8bit: bool = Field(False, description="Whether to load in 8-bit quantization")
    set_active: bool = Field(True, description="Whether to set as active model after loading")


# =============================================================================
# Image Generation Request/Response Models
# =============================================================================

class PostProcessConfig(BaseModel):
    """Post-processing configuration for pixel art output."""
    target_width: int = Field(32, ge=8, le=256, description="Target bitmap width in pixels")
    target_height: int = Field(32, ge=8, le=256, description="Target bitmap height in pixels")
    palette_size: int = Field(2, ge=2, le=4, description="Number of colors (2 or 3)")
    cleanup: bool = Field(True, description="Remove isolated noise pixels")
    output_format: str = Field("both", description="Output format: bitmap, png, or both")


class ImageGenerateRequest(BaseModel):
    """Request for image generation via Stable Diffusion."""
    prompt: str = Field(..., description="Image generation prompt")
    negative_prompt: str = Field(
        "smooth, blurry, gradient, 3D, realistic, antialiased",
        description="Negative prompt (things to avoid)"
    )
    width: int = Field(512, ge=256, le=1024, description="Generation width (before post-processing)")
    height: int = Field(512, ge=256, le=1024, description="Generation height (before post-processing)")
    steps: int = Field(30, ge=1, le=100, description="Number of inference steps")
    cfg_scale: float = Field(12.0, ge=1.0, le=30.0, description="Classifier-free guidance scale")
    seed: int = Field(-1, description="Random seed (-1 = random)")
    lora: Optional[str] = Field(None, description="LoRA style name to apply (e.g., 'maestro-v1')")
    lora_weight: float = Field(0.8, ge=0.0, le=1.5, description="LoRA weight")
    post_process: Optional[PostProcessConfig] = Field(None, description="Post-processing to pixel art bitmap")


class ImageGenerateResponse(BaseModel):
    """Response from image generation."""
    image_base64: Optional[str] = Field(None, description="PNG image as base64 string")
    bitmap: Optional[List[str]] = Field(None, description="Bitmap string array ('#'/'+'/'.'')")
    seed: int = Field(..., description="Seed used for generation (for reproducibility)")
    width: int = Field(..., description="Output width")
    height: int = Field(..., description="Output height")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Generation metadata")


class ImageStatusResponse(BaseModel):
    """Status of the image generation service."""
    loaded: bool = Field(..., description="Whether a model is loaded")
    model_id: Optional[str] = Field(None, description="Currently loaded model ID")
    device: str = Field(..., description="Device (cuda/cpu)")
    loras: List[str] = Field(default_factory=list, description="Loaded LoRA names")
    diffusers_available: bool = Field(..., description="Whether diffusers library is installed")


# =============================================================================
# Model Configuration (context lengths for known models)
# =============================================================================

MODEL_CONFIGS = {
    "deepseek-ai/deepseek-coder-1.3b-instruct": {
        "context_length": 16384,
        "max_output_tokens": 4096,
        "capabilities": ["chat", "completion", "code"],
        "chat_template": "deepseek"
    },
    "deepseek-ai/deepseek-coder-6.7b-instruct": {
        "context_length": 16384,
        "max_output_tokens": 4096,
        "capabilities": ["chat", "completion", "code"],
        "chat_template": "deepseek"
    },
    "Qwen/Qwen2.5-Coder-1.5B-Instruct": {
        "context_length": 32768,
        "max_output_tokens": 8192,
        "capabilities": ["chat", "completion", "code"],
        "chat_template": "qwen"
    },
    "Qwen/Qwen2.5-Coder-7B-Instruct": {
        "context_length": 32768,
        "max_output_tokens": 8192,
        "capabilities": ["chat", "completion", "code"],
        "chat_template": "qwen"
    },
    "codellama/CodeLlama-7b-Instruct-hf": {
        "context_length": 16384,
        "max_output_tokens": 4096,
        "capabilities": ["chat", "completion", "code"],
        "chat_template": "llama"
    },
    "microsoft/phi-2": {
        "context_length": 2048,
        "max_output_tokens": 512,
        "capabilities": ["chat", "completion", "code"],
        "chat_template": "phi"
    },
    "distilgpt2": {
        "context_length": 1024,
        "max_output_tokens": 256,
        "capabilities": ["completion"],
        "chat_template": "none"
    },
    # Tool Use / Function Calling Models
    "HuggingFaceTB/SmolLM2-1.7B-Instruct": {
        "context_length": 8192,
        "max_output_tokens": 2048,
        "capabilities": ["chat", "completion", "tool-use"],
        "chat_template": "smollm"
    },
    "HuggingFaceTB/SmolLM2-360M-Instruct": {
        "context_length": 8192,
        "max_output_tokens": 2048,
        "capabilities": ["chat", "completion", "tool-use"],
        "chat_template": "smollm"
    },
    "mistralai/Ministral-8B-Instruct-2410": {
        "context_length": 131072,
        "max_output_tokens": 8192,
        "capabilities": ["chat", "completion", "tool-use", "function-calling"],
        "chat_template": "mistral"
    },
    "NousResearch/Hermes-3-Llama-3.1-8B": {
        "context_length": 131072,
        "max_output_tokens": 8192,
        "capabilities": ["chat", "completion", "tool-use", "function-calling"],
        "chat_template": "hermes"
    },
    "meetkai/functionary-small-v3.2": {
        "context_length": 8192,
        "max_output_tokens": 4096,
        "capabilities": ["tool-use", "function-calling"],
        "chat_template": "functionary"
    },
    "llmware/slim-summary-tool": {
        "context_length": 2048,
        "max_output_tokens": 512,
        "capabilities": ["summarization", "structured-output"],
        "chat_template": "slim"
    },
    "llmware/slim-extract-tool": {
        "context_length": 2048,
        "max_output_tokens": 512,
        "capabilities": ["extraction", "structured-output"],
        "chat_template": "slim"
    },
}


def get_model_config(model_id: str) -> dict:
    """Get configuration for a model, with defaults for unknown models."""
    return MODEL_CONFIGS.get(model_id, {
        "context_length": 2048,
        "max_output_tokens": 512,
        "capabilities": ["chat", "completion"],
        "chat_template": "none"
    })


def format_chat_prompt(messages: List[Message], model_id: str, system_prompt: Optional[str] = None, tokenizer=None) -> str:
    """Format messages into a prompt string.

    Tries tokenizer.apply_chat_template() first (handles special tokens correctly),
    falls back to manual formatting if unavailable.
    """
    all_messages = []
    if system_prompt:
        all_messages.append(Message(role="system", content=system_prompt))
    all_messages.extend(messages)

    # Convert to dict format for apply_chat_template
    message_dicts = [{"role": m.role, "content": m.content} for m in all_messages]

    # Try tokenizer.apply_chat_template() first — this properly handles special tokens
    if tokenizer is not None and hasattr(tokenizer, 'apply_chat_template') and tokenizer.chat_template:
        try:
            result = tokenizer.apply_chat_template(
                message_dicts,
                tokenize=False,
                add_generation_prompt=True
            )
            return result
        except Exception as e:
            print(f"[Warning] apply_chat_template failed for {model_id}: {e}, falling back to manual template")

    # Fallback: manual template formatting
    config = get_model_config(model_id)
    template = config.get("chat_template", "none")

    if template == "deepseek":
        prompt_parts = []
        for msg in all_messages:
            if msg.role == "system":
                prompt_parts.append(f"### System:\n{msg.content}\n")
            elif msg.role == "user":
                prompt_parts.append(f"### Human:\n{msg.content}\n")
            elif msg.role == "assistant":
                prompt_parts.append(f"### Assistant:\n{msg.content}\n")
        prompt_parts.append("### Assistant:\n")
        return "".join(prompt_parts)

    elif template in ("qwen", "smollm", "hermes"):
        # ChatML format — only used as fallback when tokenizer has no chat_template
        prompt_parts = []
        for msg in all_messages:
            prompt_parts.append(f"<|im_start|>{msg.role}\n{msg.content}<|im_end|>\n")
        prompt_parts.append("<|im_start|>assistant\n")
        return "".join(prompt_parts)

    elif template == "llama":
        prompt_parts = []
        system_msg = ""
        for msg in all_messages:
            if msg.role == "system":
                system_msg = msg.content
            elif msg.role == "user":
                if system_msg:
                    prompt_parts.append(f"[INST] <<SYS>>\n{system_msg}\n<</SYS>>\n\n{msg.content} [/INST]")
                    system_msg = ""
                else:
                    prompt_parts.append(f"[INST] {msg.content} [/INST]")
            elif msg.role == "assistant":
                prompt_parts.append(f" {msg.content} ")
        return "".join(prompt_parts)

    elif template == "phi":
        prompt_parts = []
        for msg in all_messages:
            if msg.role == "system":
                prompt_parts.append(f"System: {msg.content}\n")
            elif msg.role == "user":
                prompt_parts.append(f"User: {msg.content}\n")
            elif msg.role == "assistant":
                prompt_parts.append(f"Assistant: {msg.content}\n")
        prompt_parts.append("Assistant:")
        return "".join(prompt_parts)

    elif template == "functionary":
        prompt_parts = []
        for msg in all_messages:
            if msg.role == "system":
                prompt_parts.append(f"system:\n{msg.content}\n\n")
            elif msg.role == "user":
                prompt_parts.append(f"user:\n{msg.content}\n\n")
            elif msg.role == "assistant":
                prompt_parts.append(f"assistant:\n{msg.content}\n\n")
        prompt_parts.append("assistant:\n")
        return "".join(prompt_parts)

    elif template == "slim":
        prompt_parts = []
        for msg in all_messages:
            if msg.role == "system":
                prompt_parts.append(f"<human>: {msg.content}\n")
            elif msg.role == "user":
                prompt_parts.append(f"<human>: {msg.content}\n")
            elif msg.role == "assistant":
                prompt_parts.append(f"<bot>: {msg.content}\n")
        prompt_parts.append("<bot>:")
        return "".join(prompt_parts)

    else:
        prompt_parts = []
        for msg in all_messages:
            prompt_parts.append(f"{msg.role.capitalize()}: {msg.content}\n")
        prompt_parts.append("Assistant:")
        return "".join(prompt_parts)


# =============================================================================
# Endpoints
# =============================================================================

@app.get("/health", response_model=HealthResponse, tags=["Health"])
@app.get("/v1/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Health check endpoint."""
    cuda_available = torch.cuda.is_available()
    return HealthResponse(
        status="healthy",
        active_model=manager.current(),
        models_loaded=len(manager.list_models()),
        device="cuda" if cuda_available else "cpu",
        cuda_available=cuda_available,
        cuda_device_name=torch.cuda.get_device_name(0) if cuda_available else None
    )


@app.get("/v1/models", response_model=ModelsResponse, tags=["Models"])
def list_models():
    """List all loaded models with their metadata."""
    raw_models = manager.list_models()
    models = {}

    for model_id, meta in raw_models.items():
        config = get_model_config(model_id)
        models[model_id] = ModelInfo(
            model_id=model_id,
            loaded_at=meta.get("loaded_at"),
            load_time_s=meta.get("load_time_s"),
            device=meta.get("device"),
            is_active=(model_id == manager.current()),
            context_length=config["context_length"],
            max_output_tokens=config["max_output_tokens"],
            capabilities=config["capabilities"]
        )

    return ModelsResponse(
        models=models,
        active_model=manager.current()
    )


@app.post("/v1/models/load", tags=["Models"])
def load_model(req: LoadModelRequest):
    """Load a new model from Hugging Face. Automatically unloads other models to free VRAM."""
    try:
        # Use switch() which auto-unloads other models to free VRAM
        if req.set_active:
            meta = manager.switch(req.model_id, use_8bit=req.use_8bit, keep_loaded=False)
        else:
            meta = manager.load(req.model_id, use_8bit=req.use_8bit)

        config = get_model_config(req.model_id)
        return {
            "status": "loaded",
            "model_id": req.model_id,
            "load_time_s": meta.get("load_time_s"),
            "device": meta.get("device"),
            "context_length": config["context_length"],
            "capabilities": config["capabilities"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/switch-model", response_model=SwitchModelResponse, tags=["Models"])
def switch_model(req: SwitchModelRequest):
    """Switch the active model (loads if not already loaded)."""
    try:
        meta = manager.switch(req.model_id, use_8bit=req.use_8bit)
        return SwitchModelResponse(
            status="switched",
            active_model=req.model_id,
            load_time_s=meta.get("load_time_s")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/generate", response_model=GenerateResponse, tags=["Generation"])
def generate(req: GenerateRequest):
    """Generate text from a prompt or conversation."""
    try:
        model_id = req.model_id or manager.current()

        # Get tokenizer for proper chat template formatting
        tokenizer = manager.get_tokenizer(model_id)

        # Build prompt from messages if provided
        if req.messages:
            prompt = format_chat_prompt(req.messages, model_id, req.system_prompt, tokenizer=tokenizer)
        elif req.system_prompt:
            prompt = format_chat_prompt(
                [Message(role="user", content=req.prompt)],
                model_id,
                req.system_prompt,
                tokenizer=tokenizer
            )
        else:
            prompt = req.prompt

        # Generate with CUDA error recovery
        result = manager.generate(
            prompt=prompt,
            model_id=model_id,
            max_new_tokens=req.max_new_tokens or 256,
            temperature=req.temperature or 0.7,
            do_sample=req.do_sample if req.do_sample is not None else True,
            top_p=req.top_p or 0.95
        )

        # Extract just the generated part (remove prompt from output)
        generated_text = result["text"]
        if generated_text.startswith(prompt):
            generated_text = generated_text[len(prompt):].strip()
        else:
            # When skip_special_tokens=True removes ChatML tags, the prompt comparison fails.
            stripped_prompt = prompt
            for tag in ["<|im_start|>", "<|im_end|>", "<|user|>", "<|assistant|>", "<|system|>"]:
                stripped_prompt = stripped_prompt.replace(tag, "")
            stripped_prompt = stripped_prompt.strip()

            if generated_text.startswith(stripped_prompt):
                generated_text = generated_text[len(stripped_prompt):].strip()
            elif "\nassistant" in generated_text:
                parts = generated_text.split("\nassistant")
                if len(parts) > 1:
                    generated_text = parts[-1].strip()
                    if generated_text.startswith("\n"):
                        generated_text = generated_text[1:]

        return GenerateResponse(
            generated_text=generated_text,
            model=result["model_id"],
            prompt_tokens=result["prompt_tokens"],
            completion_tokens=result["completion_tokens"],
            total_tokens=result["total_tokens"],
            finish_reason="stop"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/v1/stream")
@app.websocket("/v1/ws_generate")
async def websocket_generate(ws: WebSocket):
    """
    WebSocket endpoint for streaming text generation.

    Send JSON: {"prompt": "...", "model_id": "...", "max_new_tokens": 256, "temperature": 0.7}
    Or with messages: {"messages": [{"role": "user", "content": "..."}], ...}

    Receives streamed text chunks, then a final message with token counts.
    """
    await ws.accept()

    try:
        payload = await ws.receive_json()
    except Exception:
        await ws.close(code=1003, reason="Invalid JSON")
        return

    model_id = payload.get("model_id") or manager.current()
    max_new_tokens = int(payload.get("max_new_tokens", 256))
    temperature = float(payload.get("temperature", 0.7))
    do_sample = payload.get("do_sample", True)
    top_p = float(payload.get("top_p", 0.95))

    # Ensure model loaded first (need tokenizer for chat template)
    try:
        if model_id not in manager.list_models():
            manager.load(model_id)
        entry = manager._models[model_id]
        model = entry["model"]
        tokenizer = entry["tokenizer"]
    except Exception as e:
        await ws.send_json({"error": str(e)})
        await ws.close()
        return

    # Build prompt (after tokenizer is available)
    messages = payload.get("messages")
    system_prompt = payload.get("system_prompt")

    if messages:
        messages = [Message(**m) for m in messages]
        prompt = format_chat_prompt(messages, model_id, system_prompt, tokenizer=tokenizer)
    elif system_prompt:
        prompt = format_chat_prompt(
            [Message(role="user", content=payload.get("prompt", ""))],
            model_id,
            system_prompt,
            tokenizer=tokenizer
        )
    else:
        prompt = payload.get("prompt", "")

    # Token counting
    prompt_tokens = len(tokenizer.encode(prompt, add_special_tokens=False))

    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)

    generated_tokens = []

    def _gen():
        nonlocal generated_tokens
        inputs = tokenizer(prompt, return_tensors="pt")
        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}
            model.to("cuda")

        gen_kwargs = {
            "max_new_tokens": max_new_tokens,
            "temperature": temperature if temperature > 0 else 1.0,
            "do_sample": do_sample and temperature > 0,
            "streamer": streamer,
        }
        if top_p < 1.0:
            gen_kwargs["top_p"] = top_p

        outputs = model.generate(**inputs, **gen_kwargs)
        generated_tokens.append(outputs[0])

    thread = threading.Thread(target=_gen, daemon=True)
    thread.start()

    full_text = ""
    try:
        for chunk in streamer:
            full_text += chunk
            await ws.send_json({
                "type": "chunk",
                "content": chunk
            })
    except WebSocketDisconnect:
        return
    except Exception as e:
        await ws.send_json({"type": "error", "error": str(e)})

    # Wait for generation to complete
    thread.join(timeout=5.0)

    # Send final message with token counts
    completion_tokens = len(tokenizer.encode(full_text, add_special_tokens=False))

    try:
        await ws.send_json({
            "type": "done",
            "content": "",
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "finish_reason": "stop"
        })
    except:
        pass

    await ws.close()


# =============================================================================
# Available Models Info Endpoint
# =============================================================================

@app.get("/v1/available-models", tags=["Models"])
def get_available_models():
    """Get list of recommended models that can be loaded."""
    return {
        "recommended_coding_models": [
            {
                "model_id": "deepseek-ai/deepseek-coder-1.3b-instruct",
                "description": "DeepSeek Coder 1.3B - Excellent for code, runs on 4GB+ VRAM",
                "size_gb": 2.5,
                "context_length": 16384,
                "recommended": True
            },
            {
                "model_id": "Qwen/Qwen2.5-Coder-1.5B-Instruct",
                "description": "Qwen Coder 1.5B - Great code quality, 32K context",
                "size_gb": 3.0,
                "context_length": 32768,
                "recommended": True
            },
            {
                "model_id": "deepseek-ai/deepseek-coder-6.7b-instruct",
                "description": "DeepSeek Coder 6.7B - Higher quality, needs 8GB+ VRAM",
                "size_gb": 13.0,
                "context_length": 16384,
                "recommended": False
            },
            {
                "model_id": "codellama/CodeLlama-7b-Instruct-hf",
                "description": "CodeLlama 7B - Meta's coding model, needs 8GB+ VRAM",
                "size_gb": 14.0,
                "context_length": 16384,
                "recommended": False
            },
        ],
        "lightweight_models": [
            {
                "model_id": "distilgpt2",
                "description": "DistilGPT2 - Very fast, good for testing",
                "size_gb": 0.3,
                "context_length": 1024,
                "recommended": False
            },
            {
                "model_id": "microsoft/phi-2",
                "description": "Phi-2 - Microsoft's efficient model",
                "size_gb": 5.5,
                "context_length": 2048,
                "recommended": False
            },
        ]
    }


# =============================================================================
# System Capabilities & Model Discovery Endpoints
# =============================================================================

@app.get("/v1/system/capabilities", tags=["System"])
def get_capabilities():
    """
    Get detailed hardware capabilities of the system.
    Returns GPU, CPU, RAM info and what the system can support.
    """
    capabilities = get_system_capabilities()
    return capabilities.to_dict()


@app.get("/v1/models/local", tags=["Model Discovery"])
def list_local_models(complete_only: bool = True):
    """
    List all models cached locally in HuggingFace cache.

    Args:
        complete_only: If True, only return fully downloaded models.
    """
    local_models = scan_local_models()

    if complete_only:
        local_models = [m for m in local_models if m.is_complete]

    return {
        "count": len(local_models),
        "models": [m.to_dict() for m in local_models]
    }


@app.get("/v1/models/local/{model_id:path}", tags=["Model Discovery"])
def get_local_model_info(model_id: str):
    """
    Get information about a specific locally cached model.

    Args:
        model_id: The HuggingFace model ID (e.g., "deepseek-ai/deepseek-coder-1.3b-instruct")
    """
    model = get_local_model(model_id)
    if model is None:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_id}' not found in local cache"
        )
    return model.to_dict()


@app.get("/v1/models/compatible", tags=["Model Discovery"])
def list_compatible_models(
    category: Optional[str] = None,
    include_local_status: bool = True,
    include_quantized: bool = True
):
    """
    List all models from the registry that are compatible with current hardware.

    Args:
        category: Optional category filter ("code", "chat", "instruct", "reasoning")
        include_local_status: Include whether each model is cached locally
        include_quantized: Include models that can run with quantization
    """
    available_vram = get_available_vram()
    gpu_info = get_gpu_info()

    # Get compatible models (returns list of dicts with "model" and compatibility info)
    compatible = get_compatible_models(available_vram, include_quantized)

    # Filter by category if specified
    if category:
        try:
            cat_enum = ModelCategory(category.lower())
            compatible = [c for c in compatible if c["model"].category == cat_enum]
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid category '{category}'. Valid options: code, chat, instruct, reasoning"
            )

    # Build response with quantization grouping
    models = []
    models_by_quantization = {
        "full_precision": [],  # Can run at FP16
        "int8_required": [],   # Needs INT8 quantization
        "int4_required": []    # Needs INT4 quantization
    }

    for compat_info in compatible:
        model: ModelSpec = compat_info["model"]

        # Determine quantization requirement
        if compat_info["can_run_fp16"]:
            quantization_required = None
            quantization_group = "full_precision"
        elif compat_info["can_run_int8"]:
            quantization_required = "int8"
            quantization_group = "int8_required"
        else:
            quantization_required = "int4"
            quantization_group = "int4_required"

        model_dict = {
            "model_id": model.id,
            "name": model.name,
            "description": model.description,
            "category": model.category.value,
            "size": model.size.value,
            "parameters_b": model.parameters_b,
            "context_length": model.context_length,
            "vram_fp16_gb": model.vram_fp16_gb,
            "vram_int8_gb": model.vram_int8_gb,
            "vram_int4_gb": model.vram_int4_gb,
            "capabilities": model.capabilities,
            "license": model.license,
            "recommended": model.recommended,
            # Compatibility info
            "can_run_fp16": compat_info["can_run_fp16"],
            "can_run_int8": compat_info["can_run_int8"],
            "can_run_int4": compat_info["can_run_int4"],
            "recommended_precision": compat_info["recommended_precision"],
            "quantization_required": quantization_required,
            "vram_required": compat_info["vram_required"]
        }

        # Add local status if requested
        if include_local_status:
            model_dict["is_local"] = is_model_cached(model.id)

        models.append(model_dict)
        models_by_quantization[quantization_group].append({
            "model_id": model.id,
            "name": model.name,
            "parameters_b": model.parameters_b,
            "vram_required": compat_info["vram_required"]
        })

    return {
        "hardware": {
            "gpu_available": gpu_info.available,
            "gpu_name": gpu_info.name,
            "vram_total_gb": gpu_info.vram_total_gb,
            "vram_free_gb": gpu_info.vram_free_gb
        },
        "summary": {
            "total_compatible": len(models),
            "full_precision_count": len(models_by_quantization["full_precision"]),
            "int8_required_count": len(models_by_quantization["int8_required"]),
            "int4_required_count": len(models_by_quantization["int4_required"]),
            "note": f"With {available_vram:.1f}GB VRAM: {len(models_by_quantization['full_precision'])} models at full quality, {len(models_by_quantization['int8_required'])} need INT8, {len(models_by_quantization['int4_required'])} need INT4"
        },
        "by_quantization": {
            "full_precision": models_by_quantization["full_precision"],
            "int8_required": models_by_quantization["int8_required"],
            "int4_required": models_by_quantization["int4_required"]
        },
        "count": len(models),
        "models": models
    }


@app.get("/v1/models/recommended", tags=["Model Discovery"])
def list_recommended_models(include_local_status: bool = True):
    """
    Get recommended models based on current hardware.
    Returns models marked as recommended in the registry.
    """
    available_vram = get_available_vram()
    gpu_info = get_gpu_info()
    capabilities = get_system_capabilities()

    recommended = get_recommended_models()

    models = []
    for model in recommended:
        model_dict = {
            "model_id": model.id,
            "name": model.name,
            "description": model.description,
            "category": model.category.value,
            "size": model.size.value,
            "parameters_b": model.parameters_b,
            "context_length": model.context_length,
            "vram_fp16_gb": model.vram_fp16_gb,
            "vram_int8_gb": model.vram_int8_gb,
            "vram_int4_gb": model.vram_int4_gb,
            "capabilities": model.capabilities,
            "license": model.license
        }

        if include_local_status:
            model_dict["is_local"] = is_model_cached(model.id)

        # Determine best quantization based on VRAM
        can_run_fp16 = available_vram >= model.vram_fp16_gb
        can_run_int8 = available_vram >= model.vram_int8_gb
        can_run_int4 = available_vram >= model.vram_int4_gb

        model_dict["can_run_fp16"] = can_run_fp16
        model_dict["can_run_int8"] = can_run_int8
        model_dict["can_run_int4"] = can_run_int4

        if can_run_fp16:
            model_dict["recommended_quantization"] = "fp16"
        elif can_run_int8:
            model_dict["recommended_quantization"] = "int8"
        elif can_run_int4:
            model_dict["recommended_quantization"] = "int4"
        else:
            model_dict["recommended_quantization"] = "cpu"

        models.append(model_dict)

    return {
        "hardware_summary": {
            "gpu": gpu_info.name if gpu_info.available else "None",
            "vram_gb": gpu_info.vram_free_gb if gpu_info.available else 0,
            "ram_gb": capabilities.ram.available_gb,
            "cuda_available": capabilities.cuda_available,
            "mps_available": capabilities.mps_available
        },
        "recommendation_note": _get_recommendation_note(available_vram),
        "count": len(models),
        "models": models
    }


def _get_recommendation_note(vram_gb: float) -> str:
    """Generate a recommendation note based on available VRAM."""
    if vram_gb >= 24:
        return "Excellent! You can run most large models including 70B at int4 quantization."
    elif vram_gb >= 16:
        return "Great! You can run 13B-34B models comfortably and larger models with quantization."
    elif vram_gb >= 12:
        return "Good! You can run 7B-13B models in full precision or larger models quantized."
    elif vram_gb >= 8:
        return "You can run 7B models comfortably. Consider int8/int4 for larger models."
    elif vram_gb >= 6:
        return "You can run smaller models (1.3B-3B) well. Use quantization for 7B models."
    elif vram_gb >= 4:
        return "Limited VRAM. Best suited for 1B-3B models or heavily quantized 7B models."
    elif vram_gb > 0:
        return "Very limited VRAM. Consider CPU inference or very small models."
    else:
        return "No GPU detected. Models will run on CPU (slower but works for smaller models)."


@app.get("/v1/models/registry", tags=["Model Discovery"])
def list_registry_models(category: Optional[str] = None, include_local_status: bool = True):
    """
    List all models in the registry (regardless of hardware compatibility).

    Args:
        category: Optional category filter ("code", "chat", "instruct", "reasoning")
        include_local_status: Include whether each model is cached locally
    """
    if category:
        try:
            cat_enum = ModelCategory(category.lower())
            models = get_models_by_category(cat_enum)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid category '{category}'. Valid options: code, chat, instruct, reasoning"
            )
    else:
        models = get_all_models()

    result = []
    for model in models:
        model_dict = {
            "model_id": model.id,
            "name": model.name,
            "description": model.description,
            "category": model.category.value,
            "size": model.size.value,
            "parameters_b": model.parameters_b,
            "context_length": model.context_length,
            "vram_fp16_gb": model.vram_fp16_gb,
            "vram_int8_gb": model.vram_int8_gb,
            "vram_int4_gb": model.vram_int4_gb,
            "capabilities": model.capabilities,
            "license": model.license,
            "recommended": model.recommended,
            "languages": model.languages
        }
        if include_local_status:
            model_dict["is_local"] = is_model_cached(model.id)
        result.append(model_dict)

    return {
        "count": len(result),
        "categories": ["code", "chat", "instruct", "reasoning", "multimodal", "embedding", "specialized"],
        "models": result
    }


@app.get("/v1/models/cache-stats", tags=["Model Discovery"])
def get_model_cache_stats():
    """Get statistics about the local model cache."""
    return get_cache_stats()


# =============================================================================
# Image Generation Endpoints
# =============================================================================

@app.post("/v1/image/generate", response_model=ImageGenerateResponse, tags=["Image Generation"])
def generate_image(req: ImageGenerateRequest):
    """
    Generate an image using Stable Diffusion.
    Optionally post-process to pixel art bitmap format.

    The model loads lazily on first call (~30-60s). Subsequent calls are fast (~5-15s).
    If VRAM is tight, text models will be unloaded automatically.
    """
    import base64
    from io import BytesIO

    try:
        img_manager = get_default_image_manager()

        # Load LoRA if specified
        if req.lora:
            img_manager.load_lora(req.lora, weight=req.lora_weight)

        # Generate image
        result = img_manager.generate(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            width=req.width,
            height=req.height,
            steps=req.steps,
            cfg_scale=req.cfg_scale,
            seed=req.seed,
        )

        image = result["image"]  # PIL.Image
        seed = result["seed"]
        metadata = result.get("metadata", {})

        response_data: Dict[str, Any] = {
            "seed": seed,
            "width": req.width,
            "height": req.height,
            "metadata": metadata,
        }

        # Post-process to pixel art bitmap if requested
        if req.post_process:
            pp = req.post_process
            quantized = PixelQuantizer.process(
                image,
                target_width=pp.target_width,
                target_height=pp.target_height,
                palette_size=pp.palette_size,
                cleanup=pp.cleanup,
            )
            response_data["bitmap"] = quantized["bitmap"]
            response_data["width"] = pp.target_width
            response_data["height"] = pp.target_height

            if pp.output_format in ("png", "both"):
                buf = BytesIO()
                image.save(buf, format="PNG")
                response_data["image_base64"] = base64.b64encode(buf.getvalue()).decode()
        else:
            # Return full PNG image
            buf = BytesIO()
            image.save(buf, format="PNG")
            response_data["image_base64"] = base64.b64encode(buf.getvalue()).decode()

        return ImageGenerateResponse(**response_data)

    except RuntimeError as e:
        if "diffusers" in str(e).lower() or "not installed" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail=str(e)
            )
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/image/status", response_model=ImageStatusResponse, tags=["Image Generation"])
def image_status():
    """Get status of the image generation service."""
    img_manager = get_default_image_manager()
    status = img_manager.status()
    return ImageStatusResponse(
        loaded=status["loaded"],
        model_id=status.get("model_id"),
        device=status.get("device", "cpu"),
        loras=status.get("loras", []),
        diffusers_available=status.get("diffusers_available", False),
    )


@app.post("/v1/image/unload", tags=["Image Generation"])
def unload_image_model():
    """Unload the image generation model to free VRAM."""
    img_manager = get_default_image_manager()
    was_loaded = img_manager.is_loaded()
    img_manager.unload()
    return {"status": "unloaded" if was_loaded else "not_loaded"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
