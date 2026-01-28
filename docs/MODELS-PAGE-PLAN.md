# Models Page Enhancement Plan

## Executive Summary

This plan enhances the Models page to provide comprehensive model management, including configured models, local model support, system specifications, quantization options, and model testing capabilities.

---

## Current State

The current Models page (`frontend/src/pages/ModelsPage.tsx`) is minimal:
- Wraps `ModelsPanel` component
- Supports preset models and custom model configuration
- Basic list/detail view with add/test functionality

---

## Proposed Enhancements

### 1. Tab-Based Layout

Replace the current single-panel layout with a tabbed interface:

```
+------------------------------------------------------------------+
| Models                                           [Refresh] [+ Add] |
+------------------------------------------------------------------+
| [Configured] [Local Models] [System Info] [Performance]           |
+------------------------------------------------------------------+
|                                                                    |
|  Tab content here...                                               |
|                                                                    |
+------------------------------------------------------------------+
```

**Tabs:**
1. **Configured** - Remote API models (OpenAI, Anthropic, Ollama, LLM-Provider, etc.)
2. **Local Models** - Downloaded/installed local models
3. **System Info** - Hardware specs for running local models
4. **Performance** - Model benchmarks and usage statistics

---

### 2. Configured Models Tab (Enhanced)

**Features:**
- Group models by provider (collapsible sections)
- Status indicators (connected, disconnected, error)
- Quick actions (test, edit, delete, set as default)
- API key management (masked display)
- Endpoint configuration

**UI Structure:**
```
+------------------------------------------+------------------------+
| Providers                                | Model Details          |
| ---------------------------------------- |                        |
| > OpenAI (3 models)                      | GPT-4 Turbo            |
|   - GPT-4 Turbo          [Test] [*]     | ---------------------- |
|   - GPT-4                [Test]          | Provider: OpenAI       |
|   - GPT-3.5 Turbo        [Test]          | Context: 128K tokens   |
| > Anthropic (2 models)                   | Input: $0.01/1K        |
|   - Claude 3 Opus        [Test]          | Output: $0.03/1K       |
|   - Claude 3 Sonnet      [Test] [*]     |                        |
| > LLM-Provider (1 model)                 | [Edit] [Test] [Delete] |
|   - DeepSeek Coder       [Test]          |                        |
+------------------------------------------+------------------------+
```

---

### 3. Local Models Tab (New)

**Features:**
- Discover installed models (Ollama, LM Studio, llama.cpp)
- Model metadata (size, quantization, capabilities)
- Download/import new models
- Model file management

**Backend Endpoints Needed:**
```
GET  /api/models/local              - List local models
GET  /api/models/local/{id}         - Get local model details
POST /api/models/local/scan         - Scan for local models
POST /api/models/local/download     - Download model from hub
DELETE /api/models/local/{id}       - Delete local model
```

**UI Structure:**
```
+------------------------------------------------------------------+
| Local Models                                             [Scan]   |
+------------------------------------------------------------------+
| Model Name           | Size    | Quantization | Status          |
|---------------------|---------|--------------|-----------------|
| Llama 2 7B          | 3.8 GB  | Q4_K_M       | Ready           |
| Mistral 7B          | 4.1 GB  | Q5_K_M       | Ready           |
| CodeLlama 13B       | 7.2 GB  | Q4_0         | Downloading 45% |
| Phi-2               | 2.7 GB  | F16          | Ready           |
+------------------------------------------------------------------+
| [Download Model] [Import from File]                               |
+------------------------------------------------------------------+
```

---

### 4. System Info Tab (New)

**Features:**
- Hardware detection (CPU, RAM, GPU)
- VRAM availability for GPU inference
- Recommended models based on specs
- Compatibility warnings

**Backend Endpoints Needed:**
```
GET /api/system/specs           - Get system specifications
GET /api/system/gpu             - Get GPU information
GET /api/models/recommendations - Get recommended models for system
```

**UI Structure:**
```
+------------------------------------------------------------------+
| System Specifications                                             |
+------------------------------------------------------------------+
| CPU                                                               |
| +--------------------------------------------------------------+ |
| | Intel Core i9-13900K                                          | |
| | 24 cores (8P + 16E) @ 5.8 GHz                                 | |
| | AVX-512 Support: Yes                                          | |
| +--------------------------------------------------------------+ |
|                                                                   |
| Memory                                                            |
| +--------------------------------------------------------------+ |
| | Total: 64 GB DDR5                                             | |
| | Available: 48 GB                                              | |
| | Recommended for: 7B-13B models (Q4-Q8 quantization)           | |
| +--------------------------------------------------------------+ |
|                                                                   |
| GPU                                                               |
| +--------------------------------------------------------------+ |
| | NVIDIA RTX 4090                                               | |
| | VRAM: 24 GB GDDR6X                                            | |
| | CUDA Compute: 8.9                                             | |
| | Recommended for: Up to 70B models (Q4 quantization)           | |
| +--------------------------------------------------------------+ |
|                                                                   |
| Recommended Models                                                |
| +--------------------------------------------------------------+ |
| | Based on your specs, you can run:                             | |
| | - Llama 2 70B (Q4_K_M) - GPU recommended                      | |
| | - Mixtral 8x7B (Q4_K_M) - GPU required                        | |
| | - Any 7B-13B model - CPU/GPU both work                        | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

---

### 5. Performance Tab (New)

**Features:**
- Token throughput metrics
- Latency benchmarks
- Cost tracking
- Model comparison charts

**Backend Endpoints Needed:**
```
GET /api/models/benchmarks                  - Get model benchmarks
GET /api/models/{id}/performance            - Get specific model performance
GET /api/models/usage                       - Get usage statistics
POST /api/models/{id}/benchmark             - Run benchmark
```

**UI Structure:**
```
+------------------------------------------------------------------+
| Performance Metrics                          [Run Benchmark]      |
+------------------------------------------------------------------+
| Model Comparison (tokens/second)                                  |
| +--------------------------------------------------------------+ |
| | GPT-4 Turbo    ████████████████████████████████  120 tok/s    | |
| | Claude 3       ██████████████████████████████████  95 tok/s   | |
| | Llama 2 7B     ████████████████  65 tok/s (local)             | |
| | DeepSeek       ██████████  42 tok/s                           | |
| +--------------------------------------------------------------+ |
|                                                                   |
| Latency (time to first token)                                     |
| +--------------------------------------------------------------+ |
| | GPT-4 Turbo:   ~800ms                                         | |
| | Claude 3:      ~650ms                                         | |
| | Llama 2 7B:    ~150ms (local)                                 | |
| | DeepSeek:      ~1200ms                                        | |
| +--------------------------------------------------------------+ |
|                                                                   |
| Usage Statistics (Last 30 days)                                   |
| +--------------------------------------------------------------+ |
| | Total Tokens: 1.2M                                            | |
| | Total Cost: $45.23                                            | |
| | Most Used: GPT-4 Turbo (68%)                                  | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

---

## Implementation Plan

### Phase 1: Frontend Restructure (2-3 days)
1. Convert ModelsPage to tab-based layout
2. Extract Configured tab from current ModelsPanel
3. Add tab navigation and routing

### Phase 2: Local Models Support (3-4 days)
1. Create LocalModelsTab component
2. Implement model scanning service
3. Add download/import functionality
4. Create backend endpoints

### Phase 3: System Info (2 days)
1. Create SystemInfoTab component
2. Implement hardware detection service
3. Add model recommendations logic
4. Create backend endpoints

### Phase 4: Performance Tab (2-3 days)
1. Create PerformanceTab component
2. Implement benchmarking service
3. Add usage tracking integration
4. Create charts/visualizations

---

## File Changes

### Frontend Files to Create
- `frontend/src/pages/ModelsPage.tsx` (rewrite with tabs)
- `frontend/src/components/Models/ConfiguredModelsTab.tsx`
- `frontend/src/components/Models/LocalModelsTab.tsx`
- `frontend/src/components/Models/SystemInfoTab.tsx`
- `frontend/src/components/Models/PerformanceTab.tsx`
- `frontend/src/components/Models/ModelDownloadDialog.tsx`
- `frontend/src/services/localModelService.ts`
- `frontend/src/services/systemInfoService.ts`
- `frontend/src/services/benchmarkService.ts`

### Backend Files to Create
- `backend/src/Maestro.Api/Controllers/SystemController.cs`
- `backend/src/Maestro.Api/Controllers/LocalModelsController.cs`
- `backend/src/Maestro.Application/Services/SystemInfoService.cs`
- `backend/src/Maestro.Application/Services/LocalModelDiscoveryService.cs`
- `backend/src/Maestro.Application/Services/BenchmarkService.cs`
- `backend/src/Maestro.Domain/Entities/LocalModel.cs`
- `backend/src/Maestro.Domain/Entities/SystemSpecs.cs`
- `backend/src/Maestro.Domain/Entities/ModelBenchmark.cs`

### Backend Files to Modify
- `backend/src/Maestro.Api/Controllers/ModelsController.cs` - Add performance endpoints
- `backend/src/Maestro.Api/Program.cs` - Register new services

---

## API Specifications

### Local Models Endpoints

```
GET /api/models/local
Response: {
  models: [{
    id: string,
    name: string,
    path: string,
    size: number,
    quantization: string,
    format: string, // gguf, ggml, etc.
    status: "ready" | "downloading" | "error",
    downloadProgress?: number,
    metadata: {
      contextLength: number,
      architecture: string,
      parameterCount: string
    }
  }]
}

POST /api/models/local/download
Request: {
  source: "huggingface" | "ollama" | "url",
  modelId: string,
  quantization?: string
}
Response: {
  taskId: string,
  status: "queued"
}
```

### System Info Endpoints

```
GET /api/system/specs
Response: {
  cpu: {
    name: string,
    cores: number,
    threads: number,
    frequency: string,
    avx512: boolean
  },
  memory: {
    total: number,
    available: number,
    type: string
  },
  gpu: [{
    name: string,
    vram: number,
    cudaVersion?: string,
    rocmVersion?: string
  }],
  os: {
    name: string,
    version: string,
    architecture: string
  }
}

GET /api/models/recommendations
Response: {
  recommendations: [{
    modelName: string,
    modelId: string,
    reason: string,
    requirements: {
      minRam: number,
      minVram?: number,
      quantization: string
    },
    performance: {
      estimatedTokensPerSecond: number,
      runOn: "cpu" | "gpu"
    }
  }]
}
```

### Benchmark Endpoints

```
POST /api/models/{id}/benchmark
Request: {
  testType: "throughput" | "latency" | "quality",
  iterations?: number
}
Response: {
  modelId: string,
  testType: string,
  results: {
    tokensPerSecond: number,
    timeToFirstToken: number,
    totalTime: number,
    promptTokens: number,
    completionTokens: number
  },
  timestamp: string
}

GET /api/models/usage
Request: ?startDate=...&endDate=...
Response: {
  totalTokens: number,
  totalCost: number,
  byModel: [{
    modelId: string,
    tokens: number,
    cost: number,
    percentage: number
  }]
}
```

---

## Success Criteria

1. Users can view and manage both remote API models and local models
2. System specs are displayed with clear model recommendations
3. Users can download models directly from the UI
4. Performance metrics help users choose the right model for their use case
5. Quantization options are clear and actionable
6. The UI is consistent with the rest of Maestro (no emojis, Lucide icons only)

---

## Dependencies

- For GPU detection on Windows: NVML (NVIDIA) / ROCm (AMD)
- For local model support: llama.cpp / Ollama integration
- For benchmarking: Existing metrics infrastructure

---

## Notes

- Start with Phase 1 (restructure) to establish the foundation
- Local model support is the highest priority enhancement
- System info helps users understand what they can run
- Performance tab is optional but valuable for power users
