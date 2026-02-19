"""
Comprehensive registry of open source LLM models with hardware requirements.
This serves as a catalog of models users can download and run locally.
"""
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class ModelCategory(str, Enum):
    CODE = "code"
    CHAT = "chat"
    INSTRUCT = "instruct"
    REASONING = "reasoning"
    MULTIMODAL = "multimodal"
    EMBEDDING = "embedding"
    SPECIALIZED = "specialized"


class ModelSize(str, Enum):
    TINY = "tiny"        # < 1B params
    SMALL = "small"      # 1-3B params
    MEDIUM = "medium"    # 3-7B params
    LARGE = "large"      # 7-13B params
    XLARGE = "xlarge"    # 13-34B params
    XXLARGE = "xxlarge"  # 34B+ params


@dataclass
class ModelSpec:
    """Specification for a model in the registry."""
    id: str                           # HuggingFace model ID
    name: str                         # Display name
    description: str                  # Short description
    category: ModelCategory           # Primary use case
    size: ModelSize                   # Size tier
    parameters_b: float               # Parameters in billions
    vram_fp16_gb: float              # VRAM required for fp16
    vram_int8_gb: float              # VRAM required for 8-bit quantization
    vram_int4_gb: float              # VRAM required for 4-bit quantization
    context_length: int               # Max context window
    languages: List[str] = field(default_factory=lambda: ["en"])
    capabilities: List[str] = field(default_factory=list)
    license: str = "unknown"
    recommended: bool = False         # Recommended for most users
    chat_template: Optional[str] = None  # Chat template type


# =============================================================================
# COMPREHENSIVE MODEL REGISTRY
# =============================================================================

MODEL_REGISTRY: Dict[str, ModelSpec] = {}


def register(spec: ModelSpec):
    """Register a model spec."""
    MODEL_REGISTRY[spec.id] = spec
    return spec


# -----------------------------------------------------------------------------
# CODE MODELS - Specialized for programming
# -----------------------------------------------------------------------------

# DeepSeek Coder Series (Excellent for code)
register(ModelSpec(
    id="deepseek-ai/deepseek-coder-1.3b-instruct",
    name="DeepSeek Coder 1.3B",
    description="Fast, efficient code model. Great for low VRAM systems.",
    category=ModelCategory.CODE,
    size=ModelSize.SMALL,
    parameters_b=1.3,
    vram_fp16_gb=3.0,
    vram_int8_gb=1.5,
    vram_int4_gb=1.0,
    context_length=16384,
    languages=["en", "code"],
    capabilities=["code-generation", "code-completion", "code-explanation"],
    license="MIT",
    recommended=True,
    chat_template="deepseek"
))

register(ModelSpec(
    id="deepseek-ai/deepseek-coder-6.7b-instruct",
    name="DeepSeek Coder 6.7B",
    description="High quality code generation. Best balance of speed/quality.",
    category=ModelCategory.CODE,
    size=ModelSize.MEDIUM,
    parameters_b=6.7,
    vram_fp16_gb=14.0,
    vram_int8_gb=7.0,
    vram_int4_gb=4.0,
    context_length=16384,
    languages=["en", "code"],
    capabilities=["code-generation", "code-completion", "code-explanation", "code-review"],
    license="MIT",
    recommended=True,
    chat_template="deepseek"
))

register(ModelSpec(
    id="deepseek-ai/deepseek-coder-33b-instruct",
    name="DeepSeek Coder 33B",
    description="Top-tier code model. Requires significant VRAM.",
    category=ModelCategory.CODE,
    size=ModelSize.XLARGE,
    parameters_b=33.0,
    vram_fp16_gb=70.0,
    vram_int8_gb=35.0,
    vram_int4_gb=18.0,
    context_length=16384,
    languages=["en", "code"],
    capabilities=["code-generation", "code-completion", "code-explanation", "code-review", "refactoring"],
    license="MIT",
    chat_template="deepseek"
))

# Qwen Coder Series (Alibaba - excellent multilingual)
register(ModelSpec(
    id="Qwen/Qwen2.5-Coder-0.5B-Instruct",
    name="Qwen 2.5 Coder 0.5B",
    description="Ultra-light code model for edge devices.",
    category=ModelCategory.CODE,
    size=ModelSize.TINY,
    parameters_b=0.5,
    vram_fp16_gb=1.5,
    vram_int8_gb=0.8,
    vram_int4_gb=0.5,
    context_length=32768,
    languages=["en", "zh", "code"],
    capabilities=["code-generation", "code-completion"],
    license="Apache-2.0",
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-Coder-1.5B-Instruct",
    name="Qwen 2.5 Coder 1.5B",
    description="Efficient coder with 32K context. Great for most tasks.",
    category=ModelCategory.CODE,
    size=ModelSize.SMALL,
    parameters_b=1.5,
    vram_fp16_gb=3.5,
    vram_int8_gb=2.0,
    vram_int4_gb=1.2,
    context_length=32768,
    languages=["en", "zh", "code"],
    capabilities=["code-generation", "code-completion", "code-explanation"],
    license="Apache-2.0",
    recommended=True,
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-Coder-3B-Instruct",
    name="Qwen 2.5 Coder 3B",
    description="Balanced code model with excellent context length.",
    category=ModelCategory.CODE,
    size=ModelSize.SMALL,
    parameters_b=3.0,
    vram_fp16_gb=7.0,
    vram_int8_gb=3.5,
    vram_int4_gb=2.0,
    context_length=32768,
    languages=["en", "zh", "code"],
    capabilities=["code-generation", "code-completion", "code-explanation"],
    license="Apache-2.0",
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-Coder-7B-Instruct",
    name="Qwen 2.5 Coder 7B",
    description="High quality coder with 128K context window.",
    category=ModelCategory.CODE,
    size=ModelSize.MEDIUM,
    parameters_b=7.0,
    vram_fp16_gb=15.0,
    vram_int8_gb=8.0,
    vram_int4_gb=4.5,
    context_length=131072,
    languages=["en", "zh", "code"],
    capabilities=["code-generation", "code-completion", "code-explanation", "code-review"],
    license="Apache-2.0",
    recommended=True,
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-Coder-14B-Instruct",
    name="Qwen 2.5 Coder 14B",
    description="Professional grade coder with massive context.",
    category=ModelCategory.CODE,
    size=ModelSize.LARGE,
    parameters_b=14.0,
    vram_fp16_gb=30.0,
    vram_int8_gb=15.0,
    vram_int4_gb=8.0,
    context_length=131072,
    languages=["en", "zh", "code"],
    capabilities=["code-generation", "code-completion", "code-explanation", "code-review", "refactoring"],
    license="Apache-2.0",
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-Coder-32B-Instruct",
    name="Qwen 2.5 Coder 32B",
    description="State-of-the-art open source code model.",
    category=ModelCategory.CODE,
    size=ModelSize.XLARGE,
    parameters_b=32.0,
    vram_fp16_gb=68.0,
    vram_int8_gb=34.0,
    vram_int4_gb=18.0,
    context_length=131072,
    languages=["en", "zh", "code"],
    capabilities=["code-generation", "code-completion", "code-explanation", "code-review", "refactoring", "architecture"],
    license="Apache-2.0",
    chat_template="qwen"
))

# CodeLlama Series (Meta)
register(ModelSpec(
    id="codellama/CodeLlama-7b-Instruct-hf",
    name="CodeLlama 7B",
    description="Meta's code-specialized Llama. Good all-rounder.",
    category=ModelCategory.CODE,
    size=ModelSize.MEDIUM,
    parameters_b=7.0,
    vram_fp16_gb=14.0,
    vram_int8_gb=7.0,
    vram_int4_gb=4.0,
    context_length=16384,
    languages=["en", "code"],
    capabilities=["code-generation", "code-completion", "infilling"],
    license="Llama 2",
    chat_template="llama"
))

register(ModelSpec(
    id="codellama/CodeLlama-13b-Instruct-hf",
    name="CodeLlama 13B",
    description="Larger CodeLlama for better code quality.",
    category=ModelCategory.CODE,
    size=ModelSize.LARGE,
    parameters_b=13.0,
    vram_fp16_gb=28.0,
    vram_int8_gb=14.0,
    vram_int4_gb=7.5,
    context_length=16384,
    languages=["en", "code"],
    capabilities=["code-generation", "code-completion", "infilling", "code-review"],
    license="Llama 2",
    chat_template="llama"
))

register(ModelSpec(
    id="codellama/CodeLlama-34b-Instruct-hf",
    name="CodeLlama 34B",
    description="Largest CodeLlama. Excellent code quality.",
    category=ModelCategory.CODE,
    size=ModelSize.XLARGE,
    parameters_b=34.0,
    vram_fp16_gb=70.0,
    vram_int8_gb=35.0,
    vram_int4_gb=18.0,
    context_length=16384,
    languages=["en", "code"],
    capabilities=["code-generation", "code-completion", "infilling", "code-review", "refactoring"],
    license="Llama 2",
    chat_template="llama"
))

# StarCoder Series (BigCode)
register(ModelSpec(
    id="bigcode/starcoder2-3b",
    name="StarCoder2 3B",
    description="Efficient code model trained on The Stack v2.",
    category=ModelCategory.CODE,
    size=ModelSize.SMALL,
    parameters_b=3.0,
    vram_fp16_gb=7.0,
    vram_int8_gb=3.5,
    vram_int4_gb=2.0,
    context_length=16384,
    languages=["en", "code"],
    capabilities=["code-generation", "code-completion"],
    license="BigCode-OpenRAIL-M",
    chat_template="none"
))

register(ModelSpec(
    id="bigcode/starcoder2-7b",
    name="StarCoder2 7B",
    description="Balanced StarCoder for most coding tasks.",
    category=ModelCategory.CODE,
    size=ModelSize.MEDIUM,
    parameters_b=7.0,
    vram_fp16_gb=15.0,
    vram_int8_gb=8.0,
    vram_int4_gb=4.5,
    context_length=16384,
    languages=["en", "code"],
    capabilities=["code-generation", "code-completion", "fill-in-middle"],
    license="BigCode-OpenRAIL-M",
    chat_template="none"
))

register(ModelSpec(
    id="bigcode/starcoder2-15b",
    name="StarCoder2 15B",
    description="Largest StarCoder2. Top code performance.",
    category=ModelCategory.CODE,
    size=ModelSize.LARGE,
    parameters_b=15.0,
    vram_fp16_gb=32.0,
    vram_int8_gb=16.0,
    vram_int4_gb=8.5,
    context_length=16384,
    languages=["en", "code"],
    capabilities=["code-generation", "code-completion", "fill-in-middle", "code-review"],
    license="BigCode-OpenRAIL-M",
    chat_template="none"
))

# -----------------------------------------------------------------------------
# CHAT/INSTRUCT MODELS - General purpose assistants
# -----------------------------------------------------------------------------

# Llama 3 Series (Meta)
register(ModelSpec(
    id="meta-llama/Llama-3.2-1B-Instruct",
    name="Llama 3.2 1B",
    description="Compact Llama 3.2 for edge deployment.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.SMALL,
    parameters_b=1.0,
    vram_fp16_gb=2.5,
    vram_int8_gb=1.3,
    vram_int4_gb=0.8,
    context_length=131072,
    languages=["en", "de", "fr", "it", "pt", "hi", "es", "th"],
    capabilities=["chat", "instruction-following", "summarization"],
    license="Llama 3.2",
    chat_template="llama"
))

register(ModelSpec(
    id="meta-llama/Llama-3.2-3B-Instruct",
    name="Llama 3.2 3B",
    description="Efficient Llama 3.2 with great multilingual support.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.SMALL,
    parameters_b=3.0,
    vram_fp16_gb=7.0,
    vram_int8_gb=3.5,
    vram_int4_gb=2.0,
    context_length=131072,
    languages=["en", "de", "fr", "it", "pt", "hi", "es", "th"],
    capabilities=["chat", "instruction-following", "summarization", "translation"],
    license="Llama 3.2",
    recommended=True,
    chat_template="llama"
))

register(ModelSpec(
    id="meta-llama/Llama-3.1-8B-Instruct",
    name="Llama 3.1 8B",
    description="Versatile Llama with excellent instruction following.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.MEDIUM,
    parameters_b=8.0,
    vram_fp16_gb=17.0,
    vram_int8_gb=8.5,
    vram_int4_gb=4.5,
    context_length=131072,
    languages=["en", "de", "fr", "it", "pt", "hi", "es", "th"],
    capabilities=["chat", "instruction-following", "summarization", "translation", "code-generation"],
    license="Llama 3.1",
    recommended=True,
    chat_template="llama"
))

register(ModelSpec(
    id="meta-llama/Llama-3.1-70B-Instruct",
    name="Llama 3.1 70B",
    description="Flagship Llama. Rivals GPT-4 on many tasks.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.XXLARGE,
    parameters_b=70.0,
    vram_fp16_gb=140.0,
    vram_int8_gb=70.0,
    vram_int4_gb=35.0,
    context_length=131072,
    languages=["en", "de", "fr", "it", "pt", "hi", "es", "th"],
    capabilities=["chat", "instruction-following", "summarization", "translation", "code-generation", "reasoning"],
    license="Llama 3.1",
    chat_template="llama"
))

# Mistral Series
register(ModelSpec(
    id="mistralai/Mistral-7B-Instruct-v0.3",
    name="Mistral 7B v0.3",
    description="Fast, efficient instruct model. Great quality/speed ratio.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.MEDIUM,
    parameters_b=7.0,
    vram_fp16_gb=15.0,
    vram_int8_gb=7.5,
    vram_int4_gb=4.0,
    context_length=32768,
    languages=["en", "fr", "de", "es", "it"],
    capabilities=["chat", "instruction-following", "summarization"],
    license="Apache-2.0",
    recommended=True,
    chat_template="mistral"
))

register(ModelSpec(
    id="mistralai/Mixtral-8x7B-Instruct-v0.1",
    name="Mixtral 8x7B (MoE)",
    description="Mixture of Experts. 47B params, uses 13B active.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.XLARGE,
    parameters_b=47.0,  # Total, but only ~13B active
    vram_fp16_gb=90.0,
    vram_int8_gb=45.0,
    vram_int4_gb=24.0,
    context_length=32768,
    languages=["en", "fr", "de", "es", "it"],
    capabilities=["chat", "instruction-following", "summarization", "code-generation", "reasoning"],
    license="Apache-2.0",
    chat_template="mistral"
))

# Qwen Chat Series
register(ModelSpec(
    id="Qwen/Qwen2.5-0.5B-Instruct",
    name="Qwen 2.5 0.5B",
    description="Tiny but capable. Perfect for edge devices.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.TINY,
    parameters_b=0.5,
    vram_fp16_gb=1.5,
    vram_int8_gb=0.8,
    vram_int4_gb=0.5,
    context_length=32768,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following"],
    license="Apache-2.0",
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-1.5B-Instruct",
    name="Qwen 2.5 1.5B",
    description="Efficient general assistant with 32K context.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.SMALL,
    parameters_b=1.5,
    vram_fp16_gb=3.5,
    vram_int8_gb=2.0,
    vram_int4_gb=1.2,
    context_length=32768,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following", "summarization"],
    license="Apache-2.0",
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-3B-Instruct",
    name="Qwen 2.5 3B",
    description="Balanced assistant with excellent Chinese support.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.SMALL,
    parameters_b=3.0,
    vram_fp16_gb=7.0,
    vram_int8_gb=3.5,
    vram_int4_gb=2.0,
    context_length=32768,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following", "summarization", "translation"],
    license="Apache-2.0",
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-7B-Instruct",
    name="Qwen 2.5 7B",
    description="High quality assistant with 128K context.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.MEDIUM,
    parameters_b=7.0,
    vram_fp16_gb=15.0,
    vram_int8_gb=8.0,
    vram_int4_gb=4.5,
    context_length=131072,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following", "summarization", "translation", "code-generation"],
    license="Apache-2.0",
    recommended=True,
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-14B-Instruct",
    name="Qwen 2.5 14B",
    description="Professional grade assistant.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.LARGE,
    parameters_b=14.0,
    vram_fp16_gb=30.0,
    vram_int8_gb=15.0,
    vram_int4_gb=8.0,
    context_length=131072,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following", "summarization", "translation", "code-generation", "reasoning"],
    license="Apache-2.0",
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-32B-Instruct",
    name="Qwen 2.5 32B",
    description="Top-tier Qwen assistant.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.XLARGE,
    parameters_b=32.0,
    vram_fp16_gb=68.0,
    vram_int8_gb=34.0,
    vram_int4_gb=18.0,
    context_length=131072,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following", "summarization", "translation", "code-generation", "reasoning"],
    license="Apache-2.0",
    chat_template="qwen"
))

register(ModelSpec(
    id="Qwen/Qwen2.5-72B-Instruct",
    name="Qwen 2.5 72B",
    description="Flagship Qwen. State-of-the-art open source.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.XXLARGE,
    parameters_b=72.0,
    vram_fp16_gb=150.0,
    vram_int8_gb=75.0,
    vram_int4_gb=38.0,
    context_length=131072,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following", "summarization", "translation", "code-generation", "reasoning", "analysis"],
    license="Apache-2.0",
    chat_template="qwen"
))

# Phi Series (Microsoft)
register(ModelSpec(
    id="microsoft/Phi-3-mini-4k-instruct",
    name="Phi-3 Mini 4K",
    description="Microsoft's small but mighty model.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.SMALL,
    parameters_b=3.8,
    vram_fp16_gb=8.0,
    vram_int8_gb=4.0,
    vram_int4_gb=2.5,
    context_length=4096,
    languages=["en"],
    capabilities=["chat", "instruction-following", "reasoning"],
    license="MIT",
    recommended=True,
    chat_template="phi"
))

register(ModelSpec(
    id="microsoft/Phi-3-mini-128k-instruct",
    name="Phi-3 Mini 128K",
    description="Phi-3 with massive 128K context window.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.SMALL,
    parameters_b=3.8,
    vram_fp16_gb=8.0,
    vram_int8_gb=4.0,
    vram_int4_gb=2.5,
    context_length=131072,
    languages=["en"],
    capabilities=["chat", "instruction-following", "reasoning", "long-context"],
    license="MIT",
    chat_template="phi"
))

register(ModelSpec(
    id="microsoft/Phi-3-small-8k-instruct",
    name="Phi-3 Small 8K",
    description="Larger Phi-3 variant.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.MEDIUM,
    parameters_b=7.0,
    vram_fp16_gb=15.0,
    vram_int8_gb=7.5,
    vram_int4_gb=4.0,
    context_length=8192,
    languages=["en"],
    capabilities=["chat", "instruction-following", "reasoning"],
    license="MIT",
    chat_template="phi"
))

register(ModelSpec(
    id="microsoft/Phi-3-medium-4k-instruct",
    name="Phi-3 Medium",
    description="Largest Phi-3. Excellent reasoning.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.LARGE,
    parameters_b=14.0,
    vram_fp16_gb=30.0,
    vram_int8_gb=15.0,
    vram_int4_gb=8.0,
    context_length=4096,
    languages=["en"],
    capabilities=["chat", "instruction-following", "reasoning", "analysis"],
    license="MIT",
    chat_template="phi"
))

# Gemma Series (Google)
register(ModelSpec(
    id="google/gemma-2-2b-it",
    name="Gemma 2 2B",
    description="Google's efficient instruction-tuned model.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.SMALL,
    parameters_b=2.0,
    vram_fp16_gb=5.0,
    vram_int8_gb=2.5,
    vram_int4_gb=1.5,
    context_length=8192,
    languages=["en"],
    capabilities=["chat", "instruction-following"],
    license="Gemma",
    chat_template="gemma"
))

register(ModelSpec(
    id="google/gemma-2-9b-it",
    name="Gemma 2 9B",
    description="Balanced Gemma with great performance.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.MEDIUM,
    parameters_b=9.0,
    vram_fp16_gb=19.0,
    vram_int8_gb=9.5,
    vram_int4_gb=5.0,
    context_length=8192,
    languages=["en"],
    capabilities=["chat", "instruction-following", "summarization"],
    license="Gemma",
    recommended=True,
    chat_template="gemma"
))

register(ModelSpec(
    id="google/gemma-2-27b-it",
    name="Gemma 2 27B",
    description="Largest Gemma. Top-tier quality.",
    category=ModelCategory.INSTRUCT,
    size=ModelSize.XLARGE,
    parameters_b=27.0,
    vram_fp16_gb=58.0,
    vram_int8_gb=29.0,
    vram_int4_gb=15.0,
    context_length=8192,
    languages=["en"],
    capabilities=["chat", "instruction-following", "summarization", "reasoning"],
    license="Gemma",
    chat_template="gemma"
))

# Yi Series (01.AI)
register(ModelSpec(
    id="01-ai/Yi-1.5-6B-Chat",
    name="Yi 1.5 6B",
    description="Strong Chinese/English bilingual model.",
    category=ModelCategory.CHAT,
    size=ModelSize.MEDIUM,
    parameters_b=6.0,
    vram_fp16_gb=13.0,
    vram_int8_gb=6.5,
    vram_int4_gb=3.5,
    context_length=4096,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following"],
    license="Apache-2.0",
    chat_template="yi"
))

register(ModelSpec(
    id="01-ai/Yi-1.5-9B-Chat",
    name="Yi 1.5 9B",
    description="Balanced Yi model with excellent bilingual capabilities.",
    category=ModelCategory.CHAT,
    size=ModelSize.MEDIUM,
    parameters_b=9.0,
    vram_fp16_gb=19.0,
    vram_int8_gb=9.5,
    vram_int4_gb=5.0,
    context_length=4096,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following", "translation"],
    license="Apache-2.0",
    chat_template="yi"
))

register(ModelSpec(
    id="01-ai/Yi-1.5-34B-Chat",
    name="Yi 1.5 34B",
    description="Large Yi with excellent reasoning.",
    category=ModelCategory.CHAT,
    size=ModelSize.XLARGE,
    parameters_b=34.0,
    vram_fp16_gb=70.0,
    vram_int8_gb=35.0,
    vram_int4_gb=18.0,
    context_length=4096,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following", "translation", "reasoning"],
    license="Apache-2.0",
    chat_template="yi"
))

# InternLM Series (Shanghai AI Lab)
register(ModelSpec(
    id="internlm/internlm2_5-7b-chat",
    name="InternLM 2.5 7B",
    description="Strong multilingual model from Shanghai AI Lab.",
    category=ModelCategory.CHAT,
    size=ModelSize.MEDIUM,
    parameters_b=7.0,
    vram_fp16_gb=15.0,
    vram_int8_gb=7.5,
    vram_int4_gb=4.0,
    context_length=32768,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following", "tool-use"],
    license="Apache-2.0",
    chat_template="internlm"
))

register(ModelSpec(
    id="internlm/internlm2_5-20b-chat",
    name="InternLM 2.5 20B",
    description="Large InternLM with tool use capabilities.",
    category=ModelCategory.CHAT,
    size=ModelSize.LARGE,
    parameters_b=20.0,
    vram_fp16_gb=42.0,
    vram_int8_gb=21.0,
    vram_int4_gb=11.0,
    context_length=32768,
    languages=["en", "zh"],
    capabilities=["chat", "instruction-following", "tool-use", "reasoning"],
    license="Apache-2.0",
    chat_template="internlm"
))

# -----------------------------------------------------------------------------
# REASONING MODELS - Specialized for complex reasoning
# -----------------------------------------------------------------------------

register(ModelSpec(
    id="Qwen/QwQ-32B-Preview",
    name="QwQ 32B (Reasoning)",
    description="Qwen's reasoning model. Thinks step-by-step.",
    category=ModelCategory.REASONING,
    size=ModelSize.XLARGE,
    parameters_b=32.0,
    vram_fp16_gb=68.0,
    vram_int8_gb=34.0,
    vram_int4_gb=18.0,
    context_length=32768,
    languages=["en", "zh"],
    capabilities=["reasoning", "math", "code-generation", "analysis"],
    license="Apache-2.0",
    chat_template="qwen"
))

register(ModelSpec(
    id="deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
    name="DeepSeek R1 1.5B",
    description="Distilled reasoning model. Small but capable.",
    category=ModelCategory.REASONING,
    size=ModelSize.SMALL,
    parameters_b=1.5,
    vram_fp16_gb=3.5,
    vram_int8_gb=2.0,
    vram_int4_gb=1.2,
    context_length=32768,
    languages=["en", "zh"],
    capabilities=["reasoning", "math", "analysis"],
    license="MIT",
    recommended=True,
    chat_template="deepseek"
))

register(ModelSpec(
    id="deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    name="DeepSeek R1 7B",
    description="Balanced distilled reasoning model.",
    category=ModelCategory.REASONING,
    size=ModelSize.MEDIUM,
    parameters_b=7.0,
    vram_fp16_gb=15.0,
    vram_int8_gb=8.0,
    vram_int4_gb=4.5,
    context_length=32768,
    languages=["en", "zh"],
    capabilities=["reasoning", "math", "code-generation", "analysis"],
    license="MIT",
    recommended=True,
    chat_template="deepseek"
))

register(ModelSpec(
    id="deepseek-ai/DeepSeek-R1-Distill-Qwen-14B",
    name="DeepSeek R1 14B",
    description="Larger distilled reasoning model.",
    category=ModelCategory.REASONING,
    size=ModelSize.LARGE,
    parameters_b=14.0,
    vram_fp16_gb=30.0,
    vram_int8_gb=15.0,
    vram_int4_gb=8.0,
    context_length=32768,
    languages=["en", "zh"],
    capabilities=["reasoning", "math", "code-generation", "analysis"],
    license="MIT",
    chat_template="deepseek"
))

register(ModelSpec(
    id="deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
    name="DeepSeek R1 32B",
    description="Large distilled reasoning model.",
    category=ModelCategory.REASONING,
    size=ModelSize.XLARGE,
    parameters_b=32.0,
    vram_fp16_gb=68.0,
    vram_int8_gb=34.0,
    vram_int4_gb=18.0,
    context_length=32768,
    languages=["en", "zh"],
    capabilities=["reasoning", "math", "code-generation", "analysis"],
    license="MIT",
    chat_template="deepseek"
))

register(ModelSpec(
    id="deepseek-ai/DeepSeek-R1-Distill-Llama-8B",
    name="DeepSeek R1 Llama 8B",
    description="R1 distilled to Llama architecture.",
    category=ModelCategory.REASONING,
    size=ModelSize.MEDIUM,
    parameters_b=8.0,
    vram_fp16_gb=17.0,
    vram_int8_gb=8.5,
    vram_int4_gb=4.5,
    context_length=32768,
    languages=["en"],
    capabilities=["reasoning", "math", "code-generation", "analysis"],
    license="MIT",
    chat_template="llama"
))

register(ModelSpec(
    id="deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
    name="DeepSeek R1 Llama 70B",
    description="Largest R1 Llama distillation.",
    category=ModelCategory.REASONING,
    size=ModelSize.XXLARGE,
    parameters_b=70.0,
    vram_fp16_gb=140.0,
    vram_int8_gb=70.0,
    vram_int4_gb=35.0,
    context_length=32768,
    languages=["en"],
    capabilities=["reasoning", "math", "code-generation", "analysis"],
    license="MIT",
    chat_template="llama"
))

# -----------------------------------------------------------------------------
# TOOL USE / FUNCTION CALLING MODELS - Specialized for structured output
# -----------------------------------------------------------------------------

register(ModelSpec(
    id="HuggingFaceTB/SmolLM2-1.7B-Instruct",
    name="SmolLM2 1.7B",
    description="Hugging Face's efficient model. Good instruction following.",
    category=ModelCategory.SPECIALIZED,
    size=ModelSize.SMALL,
    parameters_b=1.7,
    vram_fp16_gb=4.0,
    vram_int8_gb=2.0,
    vram_int4_gb=1.2,
    context_length=8192,
    languages=["en"],
    capabilities=["chat", "instruction-following", "tool-use"],
    license="Apache-2.0",
    recommended=True,
    chat_template="smollm"
))

register(ModelSpec(
    id="HuggingFaceTB/SmolLM2-360M-Instruct",
    name="SmolLM2 360M",
    description="Tiny but capable. Great for testing tool calling.",
    category=ModelCategory.SPECIALIZED,
    size=ModelSize.TINY,
    parameters_b=0.36,
    vram_fp16_gb=1.0,
    vram_int8_gb=0.5,
    vram_int4_gb=0.3,
    context_length=8192,
    languages=["en"],
    capabilities=["chat", "instruction-following", "tool-use"],
    license="Apache-2.0",
    chat_template="smollm"
))

register(ModelSpec(
    id="mistralai/Ministral-8B-Instruct-2410",
    name="Ministral 8B",
    description="Mistral's edge model. Excellent function calling and JSON output.",
    category=ModelCategory.SPECIALIZED,
    size=ModelSize.MEDIUM,
    parameters_b=8.0,
    vram_fp16_gb=17.0,
    vram_int8_gb=8.5,
    vram_int4_gb=4.5,
    context_length=131072,
    languages=["en", "fr", "de", "es", "it"],
    capabilities=["chat", "instruction-following", "tool-use", "function-calling", "json-output"],
    license="Apache-2.0",
    recommended=True,
    chat_template="mistral"
))

register(ModelSpec(
    id="NousResearch/Hermes-3-Llama-3.1-8B",
    name="Hermes 3 8B",
    description="Nous Research model fine-tuned for function calling and tool use.",
    category=ModelCategory.SPECIALIZED,
    size=ModelSize.MEDIUM,
    parameters_b=8.0,
    vram_fp16_gb=17.0,
    vram_int8_gb=8.5,
    vram_int4_gb=4.5,
    context_length=131072,
    languages=["en"],
    capabilities=["chat", "instruction-following", "tool-use", "function-calling", "json-output", "structured-output"],
    license="Llama 3.1",
    recommended=True,
    chat_template="llama"
))

register(ModelSpec(
    id="meetkai/functionary-small-v3.2",
    name="Functionary Small 3.2",
    description="MeetKai's model specialized for function calling. Excellent JSON output.",
    category=ModelCategory.SPECIALIZED,
    size=ModelSize.MEDIUM,
    parameters_b=8.0,
    vram_fp16_gb=17.0,
    vram_int8_gb=8.5,
    vram_int4_gb=4.5,
    context_length=8192,
    languages=["en"],
    capabilities=["tool-use", "function-calling", "json-output", "structured-output"],
    license="MIT",
    recommended=True,
    chat_template="functionary"
))

register(ModelSpec(
    id="Nexusflow/NexusRaven-V2-13B",
    name="NexusRaven V2 13B",
    description="Specialized for function calling. Excellent at tool selection.",
    category=ModelCategory.SPECIALIZED,
    size=ModelSize.LARGE,
    parameters_b=13.0,
    vram_fp16_gb=28.0,
    vram_int8_gb=14.0,
    vram_int4_gb=7.5,
    context_length=16384,
    languages=["en"],
    capabilities=["tool-use", "function-calling", "api-calling"],
    license="Apache-2.0",
    chat_template="nexusraven"
))

register(ModelSpec(
    id="llmware/slim-summary-tool",
    name="SLIM Summary Tool",
    description="LLMWare SLIM model for summarization. Outputs structured JSON.",
    category=ModelCategory.SPECIALIZED,
    size=ModelSize.TINY,
    parameters_b=0.3,
    vram_fp16_gb=0.8,
    vram_int8_gb=0.4,
    vram_int4_gb=0.3,
    context_length=2048,
    languages=["en"],
    capabilities=["summarization", "json-output", "structured-output"],
    license="Apache-2.0",
    chat_template="slim"
))

register(ModelSpec(
    id="llmware/slim-extract-tool",
    name="SLIM Extract Tool",
    description="LLMWare SLIM model for entity extraction. Outputs structured JSON.",
    category=ModelCategory.SPECIALIZED,
    size=ModelSize.TINY,
    parameters_b=0.3,
    vram_fp16_gb=0.8,
    vram_int8_gb=0.4,
    vram_int4_gb=0.3,
    context_length=2048,
    languages=["en"],
    capabilities=["extraction", "json-output", "structured-output"],
    license="Apache-2.0",
    chat_template="slim"
))

register(ModelSpec(
    id="llmware/slim-sql-tool",
    name="SLIM SQL Tool",
    description="LLMWare SLIM model for SQL generation. Outputs structured queries.",
    category=ModelCategory.SPECIALIZED,
    size=ModelSize.TINY,
    parameters_b=0.3,
    vram_fp16_gb=0.8,
    vram_int8_gb=0.4,
    vram_int4_gb=0.3,
    context_length=2048,
    languages=["en", "sql"],
    capabilities=["sql-generation", "structured-output"],
    license="Apache-2.0",
    chat_template="slim"
))

register(ModelSpec(
    id="llmware/slim-tags-tool",
    name="SLIM Tags Tool",
    description="LLMWare SLIM model for tagging/classification. Outputs structured JSON.",
    category=ModelCategory.SPECIALIZED,
    size=ModelSize.TINY,
    parameters_b=0.3,
    vram_fp16_gb=0.8,
    vram_int8_gb=0.4,
    vram_int4_gb=0.3,
    context_length=2048,
    languages=["en"],
    capabilities=["classification", "tagging", "json-output", "structured-output"],
    license="Apache-2.0",
    chat_template="slim"
))

# -----------------------------------------------------------------------------
# UTILITY MODELS
# -----------------------------------------------------------------------------

register(ModelSpec(
    id="distilgpt2",
    name="DistilGPT2",
    description="Tiny model for testing. Not for production.",
    category=ModelCategory.CHAT,
    size=ModelSize.TINY,
    parameters_b=0.08,
    vram_fp16_gb=0.3,
    vram_int8_gb=0.2,
    vram_int4_gb=0.1,
    context_length=1024,
    languages=["en"],
    capabilities=["text-generation"],
    license="Apache-2.0",
    chat_template="none"
))


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_all_models() -> List[ModelSpec]:
    """Get all registered models."""
    return list(MODEL_REGISTRY.values())


def get_model(model_id: str) -> Optional[ModelSpec]:
    """Get a specific model by ID."""
    return MODEL_REGISTRY.get(model_id)


def get_models_by_category(category: ModelCategory) -> List[ModelSpec]:
    """Get all models in a category."""
    return [m for m in MODEL_REGISTRY.values() if m.category == category]


def get_models_by_size(size: ModelSize) -> List[ModelSpec]:
    """Get all models of a specific size."""
    return [m for m in MODEL_REGISTRY.values() if m.size == size]


def get_recommended_models() -> List[ModelSpec]:
    """Get recommended models for most users."""
    return [m for m in MODEL_REGISTRY.values() if m.recommended]


def get_compatible_models(vram_gb: float, include_quantized: bool = True) -> List[Dict]:
    """
    Get models compatible with available VRAM.
    Returns list with compatibility info.
    """
    results = []
    for model in MODEL_REGISTRY.values():
        can_run_fp16 = vram_gb >= model.vram_fp16_gb
        can_run_int8 = vram_gb >= model.vram_int8_gb
        can_run_int4 = vram_gb >= model.vram_int4_gb

        if can_run_fp16 or (include_quantized and (can_run_int8 or can_run_int4)):
            results.append({
                "model": model,
                "can_run_fp16": can_run_fp16,
                "can_run_int8": can_run_int8,
                "can_run_int4": can_run_int4,
                "recommended_precision": (
                    "fp16" if can_run_fp16 else
                    "int8" if can_run_int8 else
                    "int4"
                ),
                "vram_required": (
                    model.vram_fp16_gb if can_run_fp16 else
                    model.vram_int8_gb if can_run_int8 else
                    model.vram_int4_gb
                )
            })

    # Sort by VRAM required
    results.sort(key=lambda x: x["vram_required"])
    return results
