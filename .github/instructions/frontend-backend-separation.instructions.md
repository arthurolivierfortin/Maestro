---
description: "Frontend-Backend Isolation Architecture for B-One Maestro project"
applyTo: "frontend/**/*.ts, frontend/**/*.tsx, frontend/src/services/**/*"
---

# Frontend-Backend Isolation Architecture

## 🎯 Core Principle

> **The frontend MUST be fully testable and functional without a running backend.**

This document defines mandatory patterns for all frontend code that interacts with backend services. Following these patterns ensures:
- **Parallel Development**: Frontend and backend teams work independently
- **Reliable Testing**: All tests run without external dependencies
- **Clean Architecture**: Clear separation of concerns
- **Easy Debugging**: Issues isolated to either frontend or backend

---

## 🔧 Configuration

### Configuration File

Configuration is managed via `maestro.config.json` at the **project root** (same level as `backend/` and `frontend/`):

```json
{
  "$schema": "./docs/schemas/maestro-config.schema.json",
  "environment": "development",
  "frontend": {
    "useMockBackend": true,
    "apiBaseUrl": "https://localhost:5001",
    "mockLatency": {
      "min": 100,
      "max": 300
    },
    "enableDevTools": true
  }
}
```

### Configuration Files

| File | Purpose |
|------|---------|
| `maestro.config.json` | Default development settings (committed to git) |
| `maestro.config.local.json` | Local overrides (gitignored) |

### Key Settings

| Property | Values | Description |
|----------|--------|-------------|
| `environment` | `development` / `production` / `test` | Current mode |
| `frontend.useMockBackend` | `true` / `false` | Use mock or real backend |
| `frontend.apiBaseUrl` | URL | Real backend API URL |
| `frontend.mockLatency` | `{min, max}` | Simulated network latency (ms) |

### Using Configuration in Code

```typescript
import { config } from '../config';

// Check if using mock backend
if (config.useMockBackend()) {
  // Use mock service
}

// Get API base URL
const url = config.apiBaseUrl();

// Get mock latency settings
const latency = config.mockLatency();
```

---

## 📁 Service Layer Structure

### Directory Organization

```
# Project Root
maestro.config.json           # Shared configuration
docs/schemas/
└── maestro-config.schema.json  # JSON Schema for IDE validation

# Frontend Services
frontend/src/
├── config/
│   ├── config.ts             # Config loader
│   └── config.types.ts       # TypeScript types
├── services/
│   ├── interfaces/           # Service contracts
│   │   ├── IModelService.ts
│   │   ├── IWorkflowService.ts
│   │   └── IExecutionService.ts
│   ├── mock/                 # Mock implementations
│   │   ├── mockModelService.ts
│   │   ├── mockData/
│   │   └── utils/
│   ├── real/                 # Real API implementations
│   │   └── realModelService.ts
│   └── modelService.ts       # Factory export
```

---

## 🏗️ Implementation Patterns

### 1. Define Service Interface

**ALWAYS start with the interface. This is the contract.**

```typescript
// services/interfaces/IModelService.ts
import type { Model, CreateModelDto, UpdateModelDto, ConnectionTestResult } from '../../types';

/**
 * Model Service Interface
 * 
 * Defines all operations for AI model management.
 * Both mock and real implementations MUST implement this interface.
 */
export interface IModelService {
  /** Get all configured models */
  getAll(): Promise<Model[]>;
  
  /** Get a specific model by ID */
  getById(id: string): Promise<Model>;
  
  /** Create a new model configuration */
  create(dto: CreateModelDto): Promise<Model>;
  
  /** Update an existing model */
  update(id: string, updates: UpdateModelDto): Promise<Model>;
  
  /** Delete a model configuration */
  delete(id: string): Promise<void>;
  
  /** Test connectivity to a model's API */
  testConnection(id: string): Promise<ConnectionTestResult>;
}
```

### 2. Implement Mock Service

```typescript
// services/mock/mockModelService.ts
import type { IModelService } from '../interfaces/IModelService';
import type { Model, CreateModelDto, UpdateModelDto, ConnectionTestResult } from '../../types';
import { mockModels } from './mockData/models';
import { delay } from './utils/delay';
import { createNotFoundError, createValidationError } from './utils/errors';

/**
 * Mock Model Service
 * 
 * In-memory implementation for development and testing.
 * Simulates network latency and error conditions.
 */
class MockModelService implements IModelService {
  private models: Map<string, Model> = new Map();
  
  constructor() {
    // Initialize with preset data
    mockModels.forEach(model => this.models.set(model.id, model));
  }
  
  async getAll(): Promise<Model[]> {
    await delay(100, 300); // Simulate 100-300ms latency
    return Array.from(this.models.values());
  }
  
  async getById(id: string): Promise<Model> {
    await delay(50, 150);
    const model = this.models.get(id);
    if (!model) {
      throw createNotFoundError('Model', id);
    }
    return model;
  }
  
  async create(dto: CreateModelDto): Promise<Model> {
    await delay(200, 400);
    
    // Validate required fields
    if (!dto.name || !dto.provider) {
      throw createValidationError('Name and provider are required');
    }
    
    // Check for duplicate
    if (this.models.has(dto.id)) {
      throw createValidationError(`Model with ID ${dto.id} already exists`);
    }
    
    const now = new Date().toISOString();
    const model: Model = {
      ...dto,
      id: dto.id || crypto.randomUUID(),
      isAvailable: true,
      createdAt: now,
      updatedAt: now,
    } as Model;
    
    this.models.set(model.id, model);
    return model;
  }
  
  async update(id: string, updates: UpdateModelDto): Promise<Model> {
    await delay(150, 300);
    
    const existing = this.models.get(id);
    if (!existing) {
      throw createNotFoundError('Model', id);
    }
    
    const updated: Model = {
      ...existing,
      ...updates,
      id, // Prevent ID change
      updatedAt: new Date().toISOString(),
    };
    
    this.models.set(id, updated);
    return updated;
  }
  
  async delete(id: string): Promise<void> {
    await delay(100, 200);
    
    if (!this.models.has(id)) {
      throw createNotFoundError('Model', id);
    }
    
    this.models.delete(id);
  }
  
  async testConnection(id: string): Promise<ConnectionTestResult> {
    await delay(500, 1500); // Simulate API call
    
    const model = this.models.get(id);
    if (!model) {
      throw createNotFoundError('Model', id);
    }
    
    // Simulate 90% success rate
    const success = Math.random() > 0.1;
    
    return {
      success,
      latencyMs: Math.floor(Math.random() * 500) + 100,
      error: success ? undefined : 'Connection timeout',
      testedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
let instance: MockModelService | null = null;

export function getMockModelService(): IModelService {
  if (!instance) {
    instance = new MockModelService();
  }
  return instance;
}
```

### 3. Implement Real Service

```typescript
// services/real/realModelService.ts
import type { IModelService } from '../interfaces/IModelService';
import type { Model, CreateModelDto, UpdateModelDto, ConnectionTestResult } from '../../types';
import { apiClient } from '../api';

/**
 * Real Model Service
 * 
 * Communicates with the actual backend API.
 */
class RealModelService implements IModelService {
  private readonly basePath = '/api/models';
  
  async getAll(): Promise<Model[]> {
    return apiClient.get<Model[]>(this.basePath);
  }
  
  async getById(id: string): Promise<Model> {
    return apiClient.get<Model>(`${this.basePath}/${id}`);
  }
  
  async create(dto: CreateModelDto): Promise<Model> {
    return apiClient.post<Model>(this.basePath, dto);
  }
  
  async update(id: string, updates: UpdateModelDto): Promise<Model> {
    return apiClient.put<Model>(`${this.basePath}/${id}`, updates);
  }
  
  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`${this.basePath}/${id}`);
  }
  
  async testConnection(id: string): Promise<ConnectionTestResult> {
    return apiClient.post<ConnectionTestResult>(`${this.basePath}/${id}/test`);
  }
}

// Singleton instance
let instance: RealModelService | null = null;

export function getRealModelService(): IModelService {
  if (!instance) {
    instance = new RealModelService();
  }
  return instance;
}
```

### 4. Create Factory Export

```typescript
// services/modelService.ts
import type { IModelService } from './interfaces/IModelService';
import { getMockModelService } from './mock/mockModelService';
import { getRealModelService } from './real/realModelService';

/**
 * Model Service Factory
 * 
 * Returns mock or real service based on environment configuration.
 * Components should import this, NOT the specific implementations.
 */
function createModelService(): IModelService {
  const useMock = import.meta.env.VITE_USE_MOCK_BACKEND === 'true';
  
  if (import.meta.env.DEV) {
    console.log(`[ModelService] Using ${useMock ? 'MOCK' : 'REAL'} backend`);
  }
  
  return useMock ? getMockModelService() : getRealModelService();
}

export const modelService = createModelService();
```

---

## 🧪 Testing Requirements

### Unit Tests for Mock Services

Every mock service MUST have tests:

```typescript
// services/mock/__tests__/mockModelService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getMockModelService } from '../mockModelService';
import type { IModelService } from '../../interfaces/IModelService';

describe('MockModelService', () => {
  let service: IModelService;
  
  beforeEach(() => {
    // Get fresh instance for each test
    service = getMockModelService();
  });
  
  describe('getAll', () => {
    it('should return all models', async () => {
      const models = await service.getAll();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });
  });
  
  describe('create', () => {
    it('should create a new model', async () => {
      const dto = {
        id: 'test-model',
        name: 'Test Model',
        provider: 'openai',
        // ... other required fields
      };
      
      const model = await service.create(dto);
      
      expect(model.id).toBe('test-model');
      expect(model.createdAt).toBeDefined();
    });
    
    it('should throw validation error for missing required fields', async () => {
      const dto = { id: 'test' }; // Missing name and provider
      
      await expect(service.create(dto as any)).rejects.toThrow();
    });
  });
  
  describe('getById', () => {
    it('should return model when exists', async () => {
      const model = await service.getById('gpt-4o');
      expect(model).toBeDefined();
      expect(model.id).toBe('gpt-4o');
    });
    
    it('should throw 404 when model not found', async () => {
      await expect(service.getById('nonexistent')).rejects.toThrow();
    });
  });
});
```

### Component Tests with Mock Services

```typescript
// components/ModelsPanel/__tests__/ModelsPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelsPanel } from '../ModelsPanel';

// Mock the service
vi.mock('../../../services/modelService', () => ({
  modelService: {
    getAll: vi.fn().mockResolvedValue([
      { id: '1', name: 'GPT-4o', provider: 'openai' },
    ]),
    create: vi.fn().mockResolvedValue({ id: '2', name: 'New Model' }),
  },
}));

describe('ModelsPanel', () => {
  it('should display models from service', async () => {
    render(<ModelsPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('GPT-4o')).toBeInTheDocument();
    });
  });
});
```

---

## ✅ Checklist for New Services

When adding a new service, ensure:

- [ ] Interface defined in `services/interfaces/`
- [ ] Mock implementation in `services/mock/`
- [ ] Mock data in `services/mock/mockData/`
- [ ] Real implementation in `services/real/`
- [ ] Factory export in `services/`
- [ ] Unit tests for mock service
- [ ] Mock simulates network latency
- [ ] Mock handles error cases (404, 500, validation)
- [ ] Documentation in interface file

---

## ❌ Anti-Patterns to Avoid

### Don't Import Implementations Directly

```typescript
// ❌ WRONG - Direct import of implementation
import { getMockModelService } from './mock/mockModelService';
const service = getMockModelService();

// ✅ CORRECT - Import from factory
import { modelService } from './modelService';
```

### Don't Check Environment in Components

```typescript
// ❌ WRONG - Environment check in component
if (import.meta.env.VITE_USE_MOCK_BACKEND) {
  // mock logic
} else {
  // real logic
}

// ✅ CORRECT - Use injected service
const result = await modelService.getAll();
```

### Don't Skip Latency Simulation

```typescript
// ❌ WRONG - Instant response
async getAll() {
  return this.models; // Too fast, unrealistic
}

// ✅ CORRECT - Simulate network
async getAll() {
  await delay(100, 300);
  return Array.from(this.models.values());
}
```

---

## 🔗 Related Documentation

- [ROADMAP.md](../../ROADMAP.md) - Frontend-Backend Isolation Architecture section
- [Clean Architecture Guidelines](./clean-architecture.instructions.md)
- [Testing Guidelines](./testing.instructions.md)
- [Code Conventions](./code-conventions.instructions.md)
