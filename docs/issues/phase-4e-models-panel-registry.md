# Phase 4e: Models Panel & Registry

## 📋 Issue Summary

**Phase**: 4e  
**Title**: Implement Model Management Panel & Registry  
**Priority**: 🟡 High  
**Estimated Effort**: Medium (1-2 weeks)  
**Dependencies**: Phase 4a (Frontend Foundation) ✅, Phase 3 (LLM Gateway) in progress  
**Blocks**: Phase 6 (Agent Implementations), Phase 13 (Auto-Optimization)

---

## 🎯 Objective

Implement a centralized model management system where users can:
- Configure, compare, and assign AI models to agent blocks
- View rich metadata (capabilities, costs, speed, quality ratings)
- Select optimal models for specific task types
- Prepare infrastructure for future auto-optimization and benchmarking

---

## 📖 Context

### Current State
- Agents use hardcoded model references
- No centralized model configuration
- No visibility into model capabilities or costs
- No way to compare models or select by task type

### Target State (Phase 4e)
- **Model Registry**: Centralized store of all configured models
- **Models Panel**: UI for viewing, configuring, and comparing models
- **Model Selector**: Dropdown for assigning models to agent blocks
- **Capability Matching**: Query models by capabilities
- **Cost Tracking**: Per-model cost information for budget optimization
- **Presets**: Built-in configurations for major providers

---

## 🏗️ Architecture

### Model Interface

```typescript
/**
 * Core Model interface representing an AI/LLM model
 */
interface Model {
  // Identity
  id: string;
  name: string;
  displayName: string;
  provider: ModelProvider;
  
  // Capabilities
  capabilities: ModelCapability[];
  contextWindow: number;           // Max tokens in context
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsToolUse: boolean;
  supportsVision: boolean;
  supportsStructuredOutput: boolean;
  
  // Performance
  averageLatencyMs: number;        // Typical response time
  tokensPerSecond: number;         // Generation speed
  
  // Cost
  costPer1kInputTokens: number;    // USD
  costPer1kOutputTokens: number;   // USD
  
  // Quality ratings per task type (0-100)
  qualityRatings: Record<TaskType, number>;
  
  // Configuration
  apiEndpoint?: string;            // Custom endpoint for local/Azure
  apiKeyEnvVar?: string;           // Environment variable for API key
  defaultTemperature: number;
  defaultMaxTokens: number;
  
  // Metadata
  isAvailable: boolean;            // Connection verified
  isDefault: boolean;              // Default model for new agents
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'azure-openai'
  | 'google'
  | 'mistral'
  | 'groq'
  | 'local'
  | 'custom';

type ModelCapability =
  | 'code-generation'
  | 'code-review'
  | 'code-debugging'
  | 'reasoning'
  | 'planning'
  | 'summarization'
  | 'analysis'
  | 'creative-writing'
  | 'translation'
  | 'vision'
  | 'tool-use'
  | 'function-calling'
  | 'structured-output'
  | 'long-context'
  | 'fast-inference';

type TaskType =
  | 'code-generation'
  | 'code-review'
  | 'planning'
  | 'summarization'
  | 'analysis'
  | 'debugging'
  | 'documentation'
  | 'testing'
  | 'refactoring';
```

### Model Store

```typescript
interface ModelStoreState {
  // State
  models: Map<string, Model>;
  selectedModelId: string | null;
  defaultModelId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // CRUD Actions
  addModel: (model: Model) => void;
  updateModel: (id: string, updates: Partial<Model>) => void;
  removeModel: (id: string) => void;
  setDefaultModel: (id: string) => void;
  
  // Query helpers
  getModelsByProvider: (provider: ModelProvider) => Model[];
  getModelsByCapability: (capability: ModelCapability) => Model[];
  getAvailableModels: () => Model[];
  getBestModelForTask: (taskType: TaskType, constraints?: ModelConstraints) => Model | null;
  
  // Testing
  testModelConnection: (id: string) => Promise<boolean>;
  
  // Persistence
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

interface ModelConstraints {
  maxCostPer1kTokens?: number;
  minContextWindow?: number;
  requiredCapabilities?: ModelCapability[];
  preferredProvider?: ModelProvider;
  maxLatencyMs?: number;
}
```

---

## ✅ Acceptance Criteria

### 4e.1 Model Types & Interfaces
- [ ] `Model` interface with all properties defined
- [ ] `ModelProvider` type with all supported providers
- [ ] `ModelCapability` type with all capabilities
- [ ] `TaskType` type for quality ratings
- [ ] `ModelConstraints` interface for filtering
- [ ] Type guards and utility functions
- [ ] Unit tests for type utilities

### 4e.2 Model Store (Zustand)
- [ ] `useModelStore` hook created
- [ ] State: `models: Map<string, Model>`, `defaultModelId`, `selectedModelId`
- [ ] CRUD actions:
  - [ ] `addModel(model)` - add new model configuration
  - [ ] `updateModel(id, updates)` - partial update
  - [ ] `removeModel(id)` - delete model
  - [ ] `setDefaultModel(id)` - set as default for new agents
- [ ] Query helpers:
  - [ ] `getModelsByProvider(provider)` - filter by provider
  - [ ] `getModelsByCapability(capability)` - filter by capability
  - [ ] `getAvailableModels()` - only models with verified connection
  - [ ] `getBestModelForTask(taskType, constraints)` - intelligent selection
- [ ] Persist to localStorage with key `maestro.models`
- [ ] Load preset models on first launch
- [ ] Unit tests with 90%+ coverage

### 4e.3 Models Panel UI
- [ ] `ModelsPanel` component (sidebar section or modal)
- [ ] Model list view with:
  - [ ] Provider icon and logo
  - [ ] Model display name
  - [ ] Capability badges (icons)
  - [ ] Cost indicator ($ / $$ / $$$)
  - [ ] Availability status indicator (green/red dot)
  - [ ] Default model badge
- [ ] Model detail view:
  - [ ] Full capability list with icons
  - [ ] Context window and token limits
  - [ ] Cost breakdown (input/output tokens)
  - [ ] Latency and speed metrics
  - [ ] Quality ratings chart (radar or bar)
  - [ ] Last tested timestamp
- [ ] Add model button → opens config form
- [ ] Edit model button → opens config form
- [ ] Delete model button → confirmation dialog
- [ ] Test connection button → shows result toast
- [ ] Unit tests

### 4e.4 Model Configuration Form
- [ ] `ModelConfigForm` component
- [ ] Form fields:
  - [ ] Provider dropdown (required)
  - [ ] Model name/ID (required)
  - [ ] Display name (required)
  - [ ] API endpoint (optional, for custom/Azure/Ollama)
  - [ ] API key env var (optional)
  - [ ] Context window (number)
  - [ ] Max output tokens (number)
  - [ ] Default temperature (0-2 range)
  - [ ] Capabilities multi-select
  - [ ] Quality ratings per task type (sliders or inputs)
  - [ ] Cost per 1k tokens (input/output)
- [ ] Validation:
  - [ ] Required fields check
  - [ ] Valid ranges (temperature 0-2, tokens > 0)
  - [ ] Unique model ID
- [ ] "Test Connection" button in form
- [ ] Import from provider button (auto-detect capabilities)
- [ ] Unit tests

### 4e.5 Model Comparison View
- [ ] `ModelComparisonView` component
- [ ] Select 2-4 models to compare
- [ ] Side-by-side comparison table:
  - [ ] Capabilities (✓ / ✗)
  - [ ] Context window
  - [ ] Cost (with highlight for cheapest)
  - [ ] Speed (with highlight for fastest)
  - [ ] Quality ratings per task type
- [ ] Visual diff highlighting (better = green, worse = red)
- [ ] Export comparison as Markdown
- [ ] Unit tests

### 4e.6 Model Selector Component
- [ ] `ModelSelector` dropdown component
- [ ] Used in `AgentBlockConfig` properties panel
- [ ] Features:
  - [ ] Show model icon, name, provider
  - [ ] Group by provider
  - [ ] Search/filter
  - [ ] Show capability badges on hover
  - [ ] Indicate default model
  - [ ] Indicate unavailable models (grayed out)
- [ ] Add `modelId` field to `AgentBlockConfig`
- [ ] Add `fallbackModelId` for automatic fallback
- [ ] Validate model capabilities match agent requirements
- [ ] Unit tests

### 4e.7 Model Presets
- [ ] Create preset configurations for major providers:
  - [ ] **OpenAI**: GPT-4o, GPT-4o-mini, GPT-4-turbo, o1, o1-mini, o1-pro
  - [ ] **Anthropic**: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus
  - [ ] **Google**: Gemini 2.0 Flash, Gemini 1.5 Pro
  - [ ] **Ollama**: Llama 3.2, CodeLlama, Mistral, Phi-3
  - [ ] **Groq**: Llama 3.1 70B, Mixtral
- [ ] Load presets on first launch (if no models configured)
- [ ] "Reset to Defaults" button to reload presets
- [ ] Presets marked with special badge
- [ ] Unit tests

### 4e.8 Backend API (Optional for MVP)
- [ ] `GET /api/models` - list all configured models
- [ ] `POST /api/models` - add new model
- [ ] `PUT /api/models/{id}` - update model
- [ ] `DELETE /api/models/{id}` - remove model
- [ ] `POST /api/models/{id}/test` - test model connectivity
- [ ] Store in JSON file (like workflows)
- [ ] Validate configuration on save
- [ ] Integration tests

---

## 📁 Files to Create/Modify

### New Files
```
frontend/src/types/
├── model.types.ts                # Model, Provider, Capability types

frontend/src/store/
├── modelStore.ts                 # Zustand model store

frontend/src/data/
├── modelPresets.ts               # Built-in model configurations

frontend/src/components/
├── ModelsPanel/
│   ├── ModelsPanel.tsx           # Main panel component
│   ├── ModelsPanel.scss
│   ├── ModelsPanel.test.tsx
│   ├── ModelListItem.tsx         # List item with preview
│   ├── ModelDetailView.tsx       # Full model details
│   ├── ModelQualityChart.tsx     # Radar/bar chart for ratings
│   └── index.ts
├── ModelConfigForm/
│   ├── ModelConfigForm.tsx       # Add/edit form
│   ├── ModelConfigForm.scss
│   ├── ModelConfigForm.test.tsx
│   ├── CapabilitySelector.tsx    # Multi-select for capabilities
│   ├── QualityRatingInput.tsx    # Rating inputs per task
│   └── index.ts
├── ModelComparison/
│   ├── ModelComparisonView.tsx
│   ├── ModelComparisonView.scss
│   ├── ComparisonTable.tsx
│   └── index.ts
├── ModelSelector/
│   ├── ModelSelector.tsx         # Dropdown component
│   ├── ModelSelector.scss
│   └── index.ts
└── icons/
    ├── ProviderIcons.tsx         # Provider logos/icons
    └── CapabilityIcons.tsx       # Capability icons

frontend/src/hooks/
├── useModelStore.ts              # Re-export with selectors
├── useModelSelection.ts          # Model selection logic
└── useBestModel.ts               # Best model for task hook
```

### Modified Files
```
frontend/src/types/index.ts                    # Export model types
frontend/src/types/block-config.types.ts       # Add modelId to AgentBlockConfig
frontend/src/components/PropertiesPanel/       # Add ModelSelector for agents
frontend/src/layouts/IDELayout.tsx             # Add ModelsPanel access
```

---

## 🎨 Design Specifications

### Provider Icons & Colors
| Provider | Icon | Primary Color |
|----------|------|---------------|
| OpenAI | OpenAI logo | `#10a37f` |
| Anthropic | Anthropic logo | `#d97706` |
| Google | Google AI logo | `#4285f4` |
| Ollama | Ollama logo | `#000000` |
| Groq | Groq logo | `#f97316` |
| Mistral | Mistral logo | `#ff7000` |
| Azure | Azure logo | `#0078d4` |
| Local | Server icon | `#6b7280` |
| Custom | Puzzle icon | `#8b5cf6` |

### Capability Badges
| Capability | Icon | Short Label |
|------------|------|-------------|
| code-generation | `<Code />` | Code |
| reasoning | `<Brain />` | Reason |
| vision | `<Eye />` | Vision |
| tool-use | `<Wrench />` | Tools |
| long-context | `<FileText />` | Long |
| fast-inference | `<Zap />` | Fast |

### Cost Indicator
| Range | Label | Color |
|-------|-------|-------|
| < $0.001 | $ | `#10b981` (green) |
| $0.001 - $0.01 | $$ | `#f59e0b` (yellow) |
| > $0.01 | $$$ | `#ef4444` (red) |

### Quality Rating Chart
- Radar chart showing ratings for each `TaskType`
- Scale 0-100
- Color: primary accent color
- Show average rating in center

---

## 🧪 Testing Requirements

### Unit Tests
- Model type utilities and guards
- Model store actions (CRUD, queries)
- Model presets loading
- ModelSelector filtering and grouping
- ModelConfigForm validation
- Quality rating calculations
- Best model selection algorithm

### Integration Tests
- Add model → appears in list → select in agent
- Update model → reflects in all usages
- Delete model → agents updated to use fallback
- Test connection → updates availability status
- Import presets → all models available

---

## 📝 Implementation Notes

### Best Model Selection Algorithm
```typescript
function getBestModelForTask(
  taskType: TaskType,
  constraints?: ModelConstraints
): Model | null {
  let candidates = getAvailableModels();
  
  // Apply constraints
  if (constraints?.requiredCapabilities) {
    candidates = candidates.filter(m => 
      constraints.requiredCapabilities!.every(c => m.capabilities.includes(c))
    );
  }
  if (constraints?.maxCostPer1kTokens) {
    candidates = candidates.filter(m => 
      m.costPer1kInputTokens <= constraints.maxCostPer1kTokens!
    );
  }
  if (constraints?.minContextWindow) {
    candidates = candidates.filter(m => 
      m.contextWindow >= constraints.minContextWindow!
    );
  }
  if (constraints?.preferredProvider) {
    const preferred = candidates.filter(m => 
      m.provider === constraints.preferredProvider
    );
    if (preferred.length > 0) candidates = preferred;
  }
  
  // Sort by quality rating for task type
  candidates.sort((a, b) => 
    (b.qualityRatings[taskType] || 0) - (a.qualityRatings[taskType] || 0)
  );
  
  return candidates[0] || null;
}
```

### LocalStorage Schema
```typescript
// Key: maestro.models
interface StoredModelData {
  version: 1;
  models: Model[];
  defaultModelId: string | null;
  lastUpdated: string;
}
```

### Future: Auto-Optimization Integration (Phase 13)
The model registry prepares for auto-optimization by:
- Storing quality ratings that can be updated from benchmarks
- Tracking cost for budget optimization
- Storing latency for speed optimization
- Supporting capability-based task routing

---

## 🔗 Related Documentation

- [ROADMAP.md](../../ROADMAP.md) - Phase 4e and Phase 13 sections
- [README.md](../../README.md) - Model Registry & Auto-Optimization section
- [ADR-0001: Model-Agnostic Design](../adr/0001-model-agnostic-design.md)
- [Phase 3: Infrastructure Layer](../../ROADMAP.md) - LLM Gateway implementation

---

## 📎 Example Model Configuration

```json
{
  "id": "gpt-4o",
  "name": "gpt-4o",
  "displayName": "GPT-4o",
  "provider": "openai",
  "capabilities": [
    "code-generation",
    "code-review",
    "reasoning",
    "planning",
    "vision",
    "tool-use",
    "function-calling",
    "structured-output"
  ],
  "contextWindow": 128000,
  "maxOutputTokens": 16384,
  "supportsStreaming": true,
  "supportsToolUse": true,
  "supportsVision": true,
  "supportsStructuredOutput": true,
  "averageLatencyMs": 1500,
  "tokensPerSecond": 80,
  "costPer1kInputTokens": 0.0025,
  "costPer1kOutputTokens": 0.01,
  "qualityRatings": {
    "code-generation": 95,
    "code-review": 90,
    "planning": 92,
    "summarization": 88,
    "analysis": 90,
    "debugging": 88,
    "documentation": 85,
    "testing": 82,
    "refactoring": 87
  },
  "defaultTemperature": 0.7,
  "defaultMaxTokens": 4096,
  "isAvailable": true,
  "isDefault": true,
  "createdAt": "2026-01-10T08:00:00Z",
  "updatedAt": "2026-01-10T08:00:00Z"
}
```

---

## 🏷️ Labels

- `frontend`
- `backend`
- `phase-4e`
- `priority: high`
- `models`
- `configuration`
- `auto-optimization`

---

**Created**: 2026-01-10  
**Assignee**: TBD  
**Milestone**: MVP - Frontend Core
