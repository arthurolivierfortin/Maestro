# Models Page Enhancement Plan

## Executive Summary

This plan enhances the Models page to provide comprehensive model management, including configured models, local model support, system specifications, quantization options, and model testing capabilities.

**Key Principle:** Show ALL models (even unconfigured ones) so users can compare and discover options, with clear visual status indicators.

---

## Model Status System

### Three-Tier Status Model

Every model has one of three statuses:

| Status | Description | Visual Treatment | Clickable | Usable |
|--------|-------------|------------------|-----------|--------|
| **Ready** | Configured and working | Full color, green indicator | Yes | Yes |
| **Available** | Can be auto-setup (local download or LLM-Provider) | Full color, blue "Setup" badge | Yes | After setup |
| **Not Configured** | Requires manual setup (API key, etc.) | Muted/grayed, gray indicator | Yes | No |

### Visual Status Indicators

```
READY (Green)           AVAILABLE (Blue)         NOT CONFIGURED (Gray)
+------------------+    +------------------+     +------------------+
| [*] GPT-4 Turbo  |    | [+] Llama 2 7B   |     | [?] Claude 3     |
|     Ready        |    |     Available    |     |     Setup needed |
+------------------+    +------------------+     +------------------+
     Full color              Full color              Muted/50% opacity
     Green dot               Blue "Setup" badge      Gray dot
     Can use                 **Click** to setup          Click to view info
```

### Status Icons
- **Ready**: Filled green circle or checkmark
- **Available**: Blue download icon or "+" badge
- **Not Configured**: Gray circle or lock icon

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
| [All Models] [Local] [System Info] [Performance]                  |
+------------------------------------------------------------------+
| Filter: [All] [Ready] [Available] [Not Configured]    [Search...] |
+------------------------------------------------------------------+
|                                                                    |
|  Tab content here...                                               |
|                                                                    |
+------------------------------------------------------------------+
```

**Tabs:**
1. **All Models** - Complete catalog of all models (ready, available, and not configured)
2. **Local** - Focus on local/downloadable models
3. **System Info** - Hardware specs for running local models
4. **Performance** - Model benchmarks and usage statistics

---

### 2. All Models Tab (Main View)

**Features:**
- Show ALL models regardless of configuration status
- Group by provider (collapsible sections)
- Clear status indicators for each model
- Filter by status (All / Ready / Available / Not Configured)
- Quick actions based on status
- Compare models side-by-side (even unconfigured ones)

**UI Structure:**
```
+------------------------------------------+------------------------+
| All Models                    [Compare]  | Model Details          |
| ---------------------------------------- |                        |
| Filter: [All ▼]              [Search...] | GPT-4 Turbo            |
| ---------------------------------------- | ---------------------- |
| > OpenAI (5 models)                      | Status: Ready          |
|   [*] GPT-4 Turbo     Ready    [Test]   | Provider: OpenAI       |
|   [*] GPT-4           Ready    [Test]   | Context: 128K tokens   |
|   [?] GPT-4 32K       Not configured    | Input: $0.01/1K        |
|   [*] GPT-3.5 Turbo   Ready    [Test]   | Output: $0.03/1K       |
|   [?] GPT-3.5 16K     Not configured    |                        |
| > Anthropic (4 models)                   | [Test] [Edit]          |
|   [?] Claude 3 Opus   Not configured    |------------------------+
|   [?] Claude 3 Sonnet Not configured    | To use this model:     |
|   [?] Claude 3 Haiku  Not configured    | 1. Add API key         |
|   [?] Claude 2.1      Not configured    | 2. Configure endpoint  |
| > Local Models (3 models)                |                        |
|   [*] DeepSeek Coder  Ready    [Test]   | [Configure]            |
|   [+] Llama 2 7B      Available [Setup] |                        |
|   [+] Mistral 7B      Available [Setup] |                        |
+------------------------------------------+------------------------+

Legend: [*] Ready  [+] Available  [?] Not Configured
```

**Status-Based Actions:**
| Status | Primary Action | Secondary Actions |
|--------|---------------|-------------------|
| Ready | Test | Edit, Delete, Set Default |
| Available | Setup/Download | View Details |
| Not Configured | Configure | View Details, Compare |

### Model Detail Panel (Status-Aware)

**When clicking a READY model:**
```
+----------------------------------+
| GPT-4 Turbo                      |
| [*] Ready                        |
+----------------------------------+
| Provider: OpenAI                 |
| Context: 128K tokens             |
| Input: $0.01/1K tokens           |
| Output: $0.03/1K tokens          |
| Capabilities: Code, Vision       |
|                                  |
| Configuration                    |
| Endpoint: https://api.openai...  |
| API Key: ****...****             |
| Last tested: 2 min ago           |
|                                  |
| [Test] [Edit] [Set as Default]   |
+----------------------------------+
```

**When clicking an AVAILABLE model:**
```
+----------------------------------+
| Llama 2 7B                       |
| [+] Available                    |
+----------------------------------+
| Provider: Local (llama.cpp)      |
| Context: 4K tokens               |
| Cost: Free (runs locally)        |
| Size: 3.8 GB (Q4_K_M)            |
| Capabilities: Code, Chat         |
|                                  |
| Ready to Download                |
| This model can be automatically  |
| downloaded and configured.       |
|                                  |
| Estimated download: ~5 min       |
| Requires: 8GB RAM minimum        |
|                                  |
| [Download & Setup]               |
+----------------------------------+
```

**When clicking a NOT CONFIGURED model:**
```
+----------------------------------+
| Claude 3 Opus                    |
| [?] Not Configured               |
+----------------------------------+
| Provider: Anthropic              |
| Context: 200K tokens             |
| Input: $0.015/1K tokens          |
| Output: $0.075/1K tokens         |
| Capabilities: Code, Vision       |
| Quality: Excellent               |
|                                  |
| ┌────────────────────────────┐   |
| │ To use this model:         │   |
| │ 1. Get API key from        │   |
| │    anthropic.com           │   |
| │ 2. Add API key below       │   |
| │ 3. Test connection         │   |
| └────────────────────────────┘   |
|                                  |
| API Key: [________________]      |
| Endpoint: [________________]     |
|                                  |
| [Save Configuration]             |
+----------------------------------+
```

---

### 3. Model Comparison Feature

**Features:**
- Compare ANY models side-by-side (even unconfigured ones)
- Compare specs: context window, pricing, capabilities
- Performance comparison (for ready models only)
- Help users decide which models to configure

**UI Structure:**
```
+------------------------------------------------------------------+
| Compare Models                                           [Close]  |
+------------------------------------------------------------------+
| Select models to compare (up to 4):                               |
| [GPT-4 Turbo ▼] [Claude 3 Opus ▼] [Llama 2 70B ▼] [+ Add]        |
+------------------------------------------------------------------+
|                  | GPT-4 Turbo  | Claude 3 Opus | Llama 2 70B    |
|------------------|--------------|---------------|----------------|
| Status           | [*] Ready    | [?] Not conf. | [+] Available  |
| Provider         | OpenAI       | Anthropic     | Local          |
| Context Window   | 128K         | 200K          | 4K             |
| Input Cost       | $0.01/1K     | $0.015/1K     | Free (local)   |
| Output Cost      | $0.03/1K     | $0.075/1K     | Free (local)   |
| Capabilities     | Code, Vision | Code, Vision  | Code           |
| Speed*           | 120 tok/s    | N/A           | N/A            |
| Quality Rating   | Excellent    | Excellent     | Good           |
+------------------------------------------------------------------+
| * Speed only shown for Ready models                               |
| [Configure Claude 3 Opus] [Download Llama 2 70B]                  |
+------------------------------------------------------------------+
```

---

### 4. Local Models Tab

**Features:**
- Show all known local models (ready, available for download, downloading)
- Discover installed models (Ollama, LM Studio, llama.cpp)
- Model metadata (size, quantization, capabilities)
- Download progress for models being downloaded
- Clear status for each model

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
| Local Models                                    [Scan] [Download] |
+------------------------------------------------------------------+
| Filter: [All ▼]                                      [Search...] |
+------------------------------------------------------------------+
| Model Name           | Size    | Quant    | Status              |
|---------------------|---------|----------|---------------------|
| [*] Llama 2 7B      | 3.8 GB  | Q4_K_M   | Ready      [Test]   |
| [*] Mistral 7B      | 4.1 GB  | Q5_K_M   | Ready      [Test]   |
| [~] CodeLlama 13B   | 7.2 GB  | Q4_0     | Downloading 45%     |
| [*] Phi-2           | 2.7 GB  | F16      | Ready      [Test]   |
| [+] Llama 2 13B     | 7.4 GB  | Q4_K_M   | Available  [Setup]  |
| [+] Mixtral 8x7B    | 26 GB   | Q4_K_M   | Available  [Setup]  |
+------------------------------------------------------------------+
| Legend: [*] Ready  [+] Available  [~] Downloading                 |
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

### Phase 1: Model Catalog & Status System (3-4 days)
1. Create model catalog with ALL known models (preconfigured list)
2. Implement three-tier status system (ready, available, not_configured)
3. Create backend `/api/models/catalog` endpoint
4. Add status-based styling (opacity, border colors, icons)
5. Ensure non-configured models are clickable but clearly marked

### Phase 2: Frontend Restructure (2-3 days)
1. Convert ModelsPage to tab-based layout
2. Create AllModelsTab with filtering by status
3. Add model comparison feature
4. Create status-aware ModelDetailPanel

### Phase 3: Local Models Support (3-4 days)
1. Create LocalModelsTab component
2. Implement model scanning service
3. Add download/import functionality
4. Create backend endpoints

### Phase 4: System Info (2 days)
1. Create SystemInfoTab component
2. Implement hardware detection service
3. Add model recommendations logic
4. Create backend endpoints

### Phase 5: Performance Tab (2-3 days)
1. Create PerformanceTab component
2. Implement benchmarking service
3. Add usage tracking integration
4. Create charts/visualizations

---

## File Changes

### Frontend Files to Create
- `frontend/src/pages/ModelsPage.tsx` (rewrite with tabs)
- `frontend/src/components/Models/AllModelsTab.tsx` - Main view with all models
- `frontend/src/components/Models/LocalModelsTab.tsx`
- `frontend/src/components/Models/SystemInfoTab.tsx`
- `frontend/src/components/Models/PerformanceTab.tsx`
- `frontend/src/components/Models/ModelListItem.tsx` - Status-aware list item
- `frontend/src/components/Models/ModelDetailPanel.tsx` - Status-aware detail view
- `frontend/src/components/Models/ModelCompareDialog.tsx` - Compare models
- `frontend/src/components/Models/ModelDownloadDialog.tsx`
- `frontend/src/components/Models/ModelConfigureDialog.tsx` - For not_configured models
- `frontend/src/data/modelCatalog.ts` - All known models with specs
- `frontend/src/services/localModelService.ts`
- `frontend/src/services/systemInfoService.ts`
- `frontend/src/services/benchmarkService.ts`
- `frontend/src/types/modelStatus.types.ts` - Status type definitions

### Backend Files to Create
- `backend/src/Maestro.Api/Controllers/SystemController.cs`
- `backend/src/Maestro.Api/Controllers/LocalModelsController.cs`
- `backend/src/Maestro.Api/Controllers/ModelCatalogController.cs` - Returns all models with status
- `backend/src/Maestro.Application/Services/SystemInfoService.cs`
- `backend/src/Maestro.Application/Services/LocalModelDiscoveryService.cs`
- `backend/src/Maestro.Application/Services/ModelCatalogService.cs` - Merges catalog with user config
- `backend/src/Maestro.Application/Services/BenchmarkService.cs`
- `backend/src/Maestro.Domain/Entities/LocalModel.cs`
- `backend/src/Maestro.Domain/Entities/SystemSpecs.cs`
- `backend/src/Maestro.Domain/Entities/ModelBenchmark.cs`
- `backend/src/Maestro.Domain/Entities/ModelCatalogEntry.cs`
- `backend/src/Maestro.Domain/Enums/ModelStatus.cs`

### Backend Files to Modify
- `backend/src/Maestro.Api/Controllers/ModelsController.cs` - Add performance endpoints
- `backend/src/Maestro.Api/Program.cs` - Register new services

---

## API Specifications

### Model Status Enum

All model endpoints use a consistent status system:

```typescript
type ModelStatus =
  | "ready"           // Configured and working
  | "available"       // Can be auto-setup (download or LLM-Provider)
  | "not_configured"  // Requires manual configuration
  | "downloading"     // Currently being downloaded
  | "error";          // Configuration error
```

### All Models Endpoint (Catalog)

```
GET /api/models/catalog
Response: {
  models: [{
    id: string,
    name: string,
    displayName: string,
    provider: string,
    status: ModelStatus,

    // Available for all models (for comparison)
    specs: {
      contextWindow: number,
      inputPricePerMillion?: number,
      outputPricePerMillion?: number,
      capabilities: string[],        // "code", "vision", "function_calling"
      qualityTier: "basic" | "good" | "excellent",
      parameterCount?: string        // "7B", "70B", etc.
    },

    // Only for ready models
    configuration?: {
      apiEndpoint: string,
      hasApiKey: boolean,
      lastTested?: string
    },

    // Only for available models
    setupInfo?: {
      setupType: "download" | "llm_provider" | "api_key",
      downloadSize?: number,
      estimatedTime?: string
    },

    // Only for not_configured models
    configurationSteps?: string[]    // ["Add API key", "Configure endpoint"]
  }]
}
```

### Local Models Endpoints

```
GET /api/models/local
Response: {
  models: [{
    id: string,
    name: string,
    path?: string,                   // null if not downloaded
    size: number,
    quantization: string,
    format: string,                  // gguf, ggml, etc.
    status: "ready" | "available" | "downloading" | "error",
    downloadProgress?: number,       // 0-100 if downloading
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

## Visual Design Specifications

### Status-Based Styling (CSS)

```scss
// Ready models - full visibility, green accent
.model-item--ready {
  opacity: 1;
  border-left: 3px solid var(--color-success);

  .model-item__status-icon {
    color: var(--color-success);
  }
}

// Available models - full visibility, blue accent
.model-item--available {
  opacity: 1;
  border-left: 3px solid var(--color-primary);

  .model-item__status-icon {
    color: var(--color-primary);
  }

  .model-item__action {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }
}

// Not configured models - muted but still interactive
.model-item--not-configured {
  opacity: 0.6;
  border-left: 3px solid var(--color-border);

  .model-item__status-icon {
    color: var(--text-tertiary);
  }

  &:hover {
    opacity: 0.8;  // Show it's still clickable
    background: var(--surface-hover);
  }
}

// Downloading models - blue with progress indicator
.model-item--downloading {
  opacity: 1;
  border-left: 3px solid var(--color-primary);

  .model-item__progress {
    height: 2px;
    background: var(--color-primary);
  }
}
```

### Status Icons (Lucide)

| Status | Icon | Color |
|--------|------|-------|
| Ready | `CheckCircle` | Green (`--color-success`) |
| Available | `Download` or `Plus` | Blue (`--color-primary`) |
| Not Configured | `Circle` (outline) or `Lock` | Gray (`--text-tertiary`) |
| Downloading | `Loader` (spinning) | Blue (`--color-primary`) |
| Error | `AlertCircle` | Red (`--color-error`) |

### Status Badges

```
Ready:          [Ready]        - Green background, white text
Available:      [Setup]        - Blue background, white text
Not Configured: [Configure]    - Gray background, gray text (but still clickable)
Downloading:    [45%]          - Blue background with progress
```

---

## Success Criteria

1. **All models visible** - Users can see and compare ALL models, even unconfigured ones
2. **Clear status distinction** - At a glance, users know which models are ready, available, or need setup
3. **Non-blocking exploration** - Users can click on any model to see details, compare specs
4. **Actionable states** - Each status has a clear primary action (Test, Setup, Configure)
5. System specs are displayed with clear model recommendations
6. Users can download models directly from the UI
7. Performance metrics help users choose the right model for their use case
8. Quantization options are clear and actionable
9. The UI is consistent with the rest of Maestro (no emojis, Lucide icons only)

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

---

## Implementation Status

### Completed (Frontend)

**Date:** 2026-01-28

The following frontend components have been implemented:

1. **Model Status System** (`frontend/src/types/modelStatus.types.ts`)
   - Three-tier status: `ready`, `available`, `not_configured`
   - Helper functions: `getStatusDisplayInfo()`, `canUseModel()`, `isConfigurable()`
   - Visual mapping for icons, colors, and labels

2. **Model Catalog** (`frontend/src/data/modelCatalog.ts`)
   - Complete catalog of 40+ models across all providers:
     - OpenAI (GPT-4o, GPT-4 Turbo, GPT-4, GPT-3.5, etc.)
     - Anthropic (Claude 3.5, Claude 3 Opus/Sonnet/Haiku)
     - Google (Gemini 1.5 Pro/Flash)
     - Mistral (Large, Medium, Small, Mixtral)
     - Groq (Llama 3, Mixtral)
     - Local (Llama 2, CodeLlama, Mistral, Phi-2, Deepseek)
     - LLM-Provider (auto-configured models)
   - Functions: `getModelCatalog()`, `groupCatalogByProvider()`, `filterCatalogByStatus()`, `searchCatalog()`

3. **Tab-Based ModelsPage** (`frontend/src/pages/ModelsPage.tsx`)
   - Four tabs: All Models, Local, System Info, Performance
   - Compare models feature (up to 4 models)
   - Configuration dialog integration
   - URL-based tab state with React Router

4. **All Models Tab** (`frontend/src/components/Models/AllModelsTab.tsx`)
   - Search functionality
   - Status filter (All/Ready/Available/Not Configured)
   - Provider grouping with collapsible sections
   - Model selection with detail panel

5. **Model List Item** (`frontend/src/components/Models/ModelListItem.tsx`)
   - Status-aware styling with border colors and opacity
   - Status icons using Lucide (CheckCircle, Download, Circle, Loader, AlertCircle)
   - Add to compare and configure actions

6. **Model Detail Panel** (`frontend/src/components/Models/ModelDetailPanel.tsx`)
   - Status-aware content (ready, available, not_configured)
   - Specifications display (context window, pricing, capabilities)
   - Setup steps for unconfigured models
   - Download info for available models
   - Action buttons based on status

7. **Local Models Tab** (`frontend/src/components/Models/LocalModelsTab.tsx`)
   - Table view with model info, size, quantization, status
   - Scan for models functionality
   - Download and delete actions

8. **System Info Tab** (`frontend/src/components/Models/SystemInfoTab.tsx`)
   - Hardware specs display (CPU, Memory, GPU)
   - Model recommendations based on hardware

9. **Performance Tab** (`frontend/src/components/Models/PerformanceTab.tsx`)
   - Benchmark results with bar charts
   - Usage statistics with cost tracking
   - Run benchmark functionality

10. **Model Compare Dialog** (`frontend/src/components/Models/ModelCompareDialog.tsx`)
    - Side-by-side comparison table
    - Compare ANY models regardless of status
    - Specs: context, pricing, capabilities, quality tier

11. **Model Configure Dialog** (`frontend/src/components/Models/ModelConfigureDialog.tsx`)
    - API key and endpoint configuration
    - Different UI for cloud vs local models
    - Connection test functionality

12. **CSS Styling** (8 SCSS files)
    - `ModelsPage.scss`, `AllModelsTab.scss`, `ModelListItem.scss`
    - `ModelDetailPanel.scss`, `LocalModelsTab.scss`, `SystemInfoTab.scss`
    - `PerformanceTab.scss`, `ModelCompareDialog.scss`, `ModelConfigureDialog.scss`

### Pending (Backend)

The following backend endpoints need to be implemented:

1. `GET /api/models/catalog` - Return all models with status
2. `GET /api/models/local` - List local models
3. `POST /api/models/local/scan` - Scan for local models
4. `POST /api/models/local/download` - Download model
5. `DELETE /api/models/local/{id}` - Delete local model
6. `GET /api/system/specs` - Get system specifications
7. `GET /api/system/gpu` - Get GPU information
8. `GET /api/models/recommendations` - Get recommended models
9. `POST /api/models/{id}/benchmark` - Run benchmark
10. `GET /api/models/usage` - Get usage statistics

### Build Status

- TypeScript compilation: PASSED
- Vite build: PASSED
- Tests: 153 passed, 19 failed (pre-existing failures in ReactFlow mocks)
