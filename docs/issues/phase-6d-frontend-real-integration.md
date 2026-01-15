# Phase 6D: Frontend Real Service Integration

**Phase**: 6D  
**Priority**: High  
**Duration**: 1 week  
**Team**: Frontend (1 developer)  
**Dependencies**: Phase 6A, 6B complete  
**Blocks**: Phase 6E, 11  
**Status**: Not Started

---

## Overview

Make the frontend work seamlessly with the real backend, eliminating reliance on mock services for production use. The frontend should be able to switch between mock (development) and real (production) modes cleanly.

## Current Problem

### Mock vs Real Service Pattern

The frontend has a dual-service pattern:

```typescript
// frontend/src/services/blockService.ts
import { mockBlockService } from './mock/mockBlockService';
import { realBlockService } from './real/realBlockService';

export const blockService = import.meta.env.VITE_USE_MOCK_BACKEND === 'true'
  ? mockBlockService
  : realBlockService;
```

**But the real services are incomplete or use wrong endpoints:**

```typescript
// frontend/src/services/real/realBlockService.ts
export const realBlockService: IBlockService = {
  async getAllBlocks(): Promise<Block[]> {
    const response = await apiClient.get('/api/blocks');
    return response.data; // Works if 6A is complete
  },

  // Many methods missing or incomplete...
};

// frontend/src/services/real/realDiscoveryService.ts
export const realDiscoveryService: IDiscoveryService = {
  async discoverBlocks(): Promise<Block[]> {
    const response = await apiClient.get('/api/discovery/blocks');
    // ❌ This endpoint doesn't exist until 6B is complete!
    return response.data;
  },
};
```

### Issues

1. ❌ `realBlockService` methods are incomplete
2. ❌ `realDiscoveryService` expects non-existent endpoints
3. ❌ No `realExecutionService` for workflow execution
4. ❌ No `realModelService` for model registry
5. ❌ No SignalR connection for real-time updates
6. ❌ No error handling for network failures
7. ❌ Switching to real mode is untested

## Tasks

### 6D.1 Complete realBlockService

- [ ] Implement all methods matching `IBlockService` interface
- [ ] Map backend DTOs to frontend types
- [ ] Add proper error handling

```typescript
// frontend/src/services/real/realBlockService.ts
import { apiClient } from '../api/client';
import { Block, CreateBlockRequest, UpdateBlockRequest } from '../../types/block.types';
import { IBlockService } from '../interfaces/IBlockService';

export const realBlockService: IBlockService = {
  async getAllBlocks(): Promise<Block[]> {
    const response = await apiClient.get<BlockDto[]>('/api/blocks');
    return response.data.map(mapBlockDtoToBlock);
  },

  async getBlockById(id: string): Promise<Block | null> {
    try {
      const response = await apiClient.get<BlockDto>(`/api/blocks/${id}`);
      return mapBlockDtoToBlock(response.data);
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  },

  async createBlock(request: CreateBlockRequest): Promise<Block> {
    const response = await apiClient.post<BlockDto>('/api/blocks', request);
    return mapBlockDtoToBlock(response.data);
  },

  async updateBlock(id: string, updates: UpdateBlockRequest): Promise<Block> {
    const response = await apiClient.put<BlockDto>(`/api/blocks/${id}`, updates);
    return mapBlockDtoToBlock(response.data);
  },

  async deleteBlock(id: string): Promise<void> {
    await apiClient.delete(`/api/blocks/${id}`);
  },

  async searchBlocks(query: string, filters?: BlockFilters): Promise<Block[]> {
    const params = new URLSearchParams({ q: query });
    if (filters?.type) params.set('type', filters.type);
    if (filters?.capability) params.set('capability', filters.capability);
    
    const response = await apiClient.get<BlockDto[]>(`/api/blocks/search?${params}`);
    return response.data.map(mapBlockDtoToBlock);
  },

  async getBlocksByType(type: BlockType): Promise<Block[]> {
    const response = await apiClient.get<BlockDto[]>(`/api/blocks?type=${type}`);
    return response.data.map(mapBlockDtoToBlock);
  },

  async duplicateBlock(id: string): Promise<Block> {
    const response = await apiClient.post<BlockDto>(`/api/blocks/${id}/duplicate`);
    return mapBlockDtoToBlock(response.data);
  },

  async findUsages(id: string): Promise<BlockUsage[]> {
    const response = await apiClient.get<BlockUsage[]>(`/api/blocks/${id}/usages`);
    return response.data;
  }
};

// Helper functions
function mapBlockDtoToBlock(dto: BlockDto): Block {
  return {
    id: dto.id,
    name: dto.name,
    blockType: dto.type as BlockType,
    description: dto.description,
    version: dto.version,
    tags: dto.tags,
    capabilities: dto.capabilities,
    config: dto.config,
    isAtomic: dto.isAtomic ?? true,
    isFavorite: dto.isFavorite ?? false,
    status: dto.status ?? 'active',
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    // ... map other fields
  };
}

function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}
```

### 6D.2 Complete realDiscoveryService

- [ ] Update to match endpoints from Phase 6B
- [ ] Add health check method
- [ ] Add capabilities method

```typescript
// frontend/src/services/real/realDiscoveryService.ts
export const realDiscoveryService: IDiscoveryService = {
  async discoverBlocks(): Promise<Block[]> {
    const response = await apiClient.get<BlockDto[]>('/api/discovery/blocks');
    return response.data.map(mapBlockDtoToBlock);
  },

  async discoverBlocksByType(type: BlockType): Promise<Block[]> {
    const response = await apiClient.get<BlockDto[]>(
      `/api/discovery/blocks/by-type/${type}`
    );
    return response.data.map(mapBlockDtoToBlock);
  },

  async discoverBlocksByCapability(capability: string): Promise<Block[]> {
    const response = await apiClient.get<BlockDto[]>(
      `/api/discovery/blocks/by-capability/${capability}`
    );
    return response.data.map(mapBlockDtoToBlock);
  },

  async getHealth(): Promise<HealthStatus> {
    const response = await apiClient.get<HealthResponse>('/api/discovery/health');
    return {
      isHealthy: response.data.status === 'healthy',
      version: response.data.version,
      blockCount: response.data.blockCount,
      services: response.data.services
    };
  },

  async getCapabilities(): Promise<Capabilities> {
    const response = await apiClient.get<CapabilitiesResponse>(
      '/api/discovery/capabilities'
    );
    return {
      blockTypes: response.data.blockTypes,
      executors: response.data.executors,
      llmProviders: response.data.llmProviders,
      features: response.data.features
    };
  }
};
```

### 6D.3 Create realExecutionService

- [ ] Create new service for workflow execution
- [ ] Integrate with SignalR for real-time updates

```typescript
// frontend/src/services/real/realExecutionService.ts
import { HubConnectionBuilder, HubConnection } from '@microsoft/signalr';

export const realExecutionService: IExecutionService = {
  async executeWorkflow(workflowId: string, options?: ExecutionOptions): Promise<ExecutionResult> {
    const response = await apiClient.post<ExecutionResultDto>(
      `/api/workflows/${workflowId}/execute`,
      options
    );
    return mapExecutionResult(response.data);
  },

  async getExecutionStatus(executionId: string): Promise<ExecutionStatus> {
    const response = await apiClient.get<ExecutionStatusDto>(
      `/api/executions/${executionId}/status`
    );
    return mapExecutionStatus(response.data);
  },

  async cancelExecution(executionId: string): Promise<void> {
    await apiClient.post(`/api/executions/${executionId}/cancel`);
  },

  async pauseExecution(executionId: string): Promise<void> {
    await apiClient.post(`/api/executions/${executionId}/pause`);
  },

  async resumeExecution(executionId: string): Promise<void> {
    await apiClient.post(`/api/executions/${executionId}/resume`);
  },

  // Real-time updates via SignalR
  subscribeToExecution(executionId: string, callbacks: ExecutionCallbacks): () => void {
    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/execution`)
      .withAutomaticReconnect()
      .build();

    connection.on('NodeStarted', callbacks.onNodeStarted);
    connection.on('NodeCompleted', callbacks.onNodeCompleted);
    connection.on('NodeFailed', callbacks.onNodeFailed);
    connection.on('ExecutionCompleted', callbacks.onCompleted);
    connection.on('ExecutionFailed', callbacks.onFailed);

    connection.start().then(() => {
      connection.invoke('JoinExecution', executionId);
    });

    // Return unsubscribe function
    return () => {
      connection.invoke('LeaveExecution', executionId);
      connection.stop();
    };
  }
};
```

### 6D.4 Create realModelService

- [ ] Create service for model registry operations

```typescript
// frontend/src/services/real/realModelService.ts
export const realModelService: IModelService = {
  async getAllModels(): Promise<Model[]> {
    const response = await apiClient.get<ModelDto[]>('/api/models');
    return response.data.map(mapModelDtoToModel);
  },

  async getModelById(id: string): Promise<Model | null> {
    try {
      const response = await apiClient.get<ModelDto>(`/api/models/${id}`);
      return mapModelDtoToModel(response.data);
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  },

  async createModel(model: CreateModelRequest): Promise<Model> {
    const response = await apiClient.post<ModelDto>('/api/models', model);
    return mapModelDtoToModel(response.data);
  },

  async updateModel(id: string, updates: UpdateModelRequest): Promise<Model> {
    const response = await apiClient.put<ModelDto>(`/api/models/${id}`, updates);
    return mapModelDtoToModel(response.data);
  },

  async deleteModel(id: string): Promise<void> {
    await apiClient.delete(`/api/models/${id}`);
  },

  async testConnection(id: string): Promise<ConnectionTestResult> {
    const response = await apiClient.post<ConnectionTestResult>(
      `/api/models/${id}/test`
    );
    return response.data;
  }
};
```

### 6D.5 Create useBackendConnection Hook

- [ ] Create hook for managing backend connection state
- [ ] Handle reconnection logic
- [ ] Provide connection status to UI

```typescript
// frontend/src/hooks/useBackendConnection.ts
import { useState, useEffect, useCallback } from 'react';
import { discoveryService } from '../services/discoveryService';

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastChecked: Date | null;
  backendVersion: string | null;
}

export function useBackendConnection(checkInterval = 30000) {
  const [state, setState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: true,
    error: null,
    lastChecked: null,
    backendVersion: null
  });

  const checkConnection = useCallback(async () => {
    setState(s => ({ ...s, isConnecting: true, error: null }));
    
    try {
      const health = await discoveryService.getHealth();
      setState({
        isConnected: health.isHealthy,
        isConnecting: false,
        error: null,
        lastChecked: new Date(),
        backendVersion: health.version
      });
    } catch (error) {
      setState({
        isConnected: false,
        isConnecting: false,
        error: getErrorMessage(error),
        lastChecked: new Date(),
        backendVersion: null
      });
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, checkInterval);
    return () => clearInterval(interval);
  }, [checkConnection, checkInterval]);

  return { ...state, retry: checkConnection };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('ECONNREFUSED')) {
      return 'Cannot connect to backend. Is it running?';
    }
    return error.message;
  }
  return 'Unknown error';
}
```

### 6D.6 SignalR Integration

- [ ] Create SignalR connection manager
- [ ] Handle block update events
- [ ] Handle execution events

```typescript
// frontend/src/services/signalr/SignalRManager.ts
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';

class SignalRManager {
  private connections: Map<string, HubConnection> = new Map();
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  }

  async connectToBlockHub(): Promise<HubConnection> {
    if (this.connections.has('blocks')) {
      return this.connections.get('blocks')!;
    }

    const connection = new HubConnectionBuilder()
      .withUrl(`${this.apiBaseUrl}/hubs/blocks`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    await connection.start();
    this.connections.set('blocks', connection);
    return connection;
  }

  async connectToExecutionHub(): Promise<HubConnection> {
    if (this.connections.has('execution')) {
      return this.connections.get('execution')!;
    }

    const connection = new HubConnectionBuilder()
      .withUrl(`${this.apiBaseUrl}/hubs/execution`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    await connection.start();
    this.connections.set('execution', connection);
    return connection;
  }

  async disconnectAll(): Promise<void> {
    for (const connection of this.connections.values()) {
      await connection.stop();
    }
    this.connections.clear();
  }
}

export const signalRManager = new SignalRManager();
```

### 6D.7 Error Handling & Retry Logic

- [ ] Create API error handling utilities
- [ ] Add retry logic for transient failures
- [ ] Show user-friendly error messages

```typescript
// frontend/src/services/api/errorHandling.ts
import axios, { AxiosError } from 'axios';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; details?: unknown }>;
    
    if (axiosError.code === 'ECONNREFUSED') {
      throw new ApiError(0, 'Cannot connect to backend server');
    }
    
    if (axiosError.response) {
      throw new ApiError(
        axiosError.response.status,
        axiosError.response.data?.message || `HTTP ${axiosError.response.status}`,
        axiosError.response.data?.details as Record<string, unknown>
      );
    }
    
    throw new ApiError(0, axiosError.message);
  }
  
  throw error;
}

// Retry wrapper
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on 4xx errors (client errors)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError;
}
```

### 6D.8 Offline Mode Detection

- [ ] Detect when backend is unavailable
- [ ] Show offline indicator in UI
- [ ] Queue operations for retry when back online

```typescript
// frontend/src/hooks/useOfflineMode.ts
export function useOfflineMode() {
  const { isConnected, error } = useBackendConnection();
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);

  const isOffline = !isConnected && error !== null;

  const queueOperation = useCallback((operation: PendingOperation) => {
    setPendingOperations(ops => [...ops, operation]);
  }, []);

  const flushQueue = useCallback(async () => {
    for (const op of pendingOperations) {
      try {
        await op.execute();
        setPendingOperations(ops => ops.filter(o => o.id !== op.id));
      } catch (error) {
        console.error(`Failed to execute queued operation: ${op.id}`, error);
      }
    }
  }, [pendingOperations]);

  // Auto-flush when coming back online
  useEffect(() => {
    if (isConnected && pendingOperations.length > 0) {
      flushQueue();
    }
  }, [isConnected, pendingOperations.length, flushQueue]);

  return { isOffline, pendingOperations, queueOperation };
}
```

### 6D.9 Integration Tests

- [ ] Test frontend with real backend
- [ ] Test all CRUD operations
- [ ] Test SignalR events
- [ ] Test error scenarios
- [ ] Test mock/real switching

### 6D.10 Documentation

- [ ] Document switching between mock and real modes
- [ ] Document environment variables
- [ ] Update frontend README

## Files to Create/Modify

### Create
- `frontend/src/services/real/realExecutionService.ts`
- `frontend/src/services/real/realModelService.ts`
- `frontend/src/services/signalr/SignalRManager.ts`
- `frontend/src/services/api/errorHandling.ts`
- `frontend/src/hooks/useBackendConnection.ts`
- `frontend/src/hooks/useOfflineMode.ts`
- `frontend/src/components/ConnectionStatus.tsx`

### Modify
- `frontend/src/services/real/realBlockService.ts`
- `frontend/src/services/real/realDiscoveryService.ts`
- `frontend/src/services/api/client.ts`
- `frontend/src/App.tsx` (add connection status)

## Acceptance Criteria

1. [ ] Frontend works with `VITE_USE_MOCK_BACKEND=false`
2. [ ] All CRUD operations work with real backend
3. [ ] SignalR events update UI in real-time
4. [ ] Error messages are helpful and actionable
5. [ ] Offline mode is handled gracefully
6. [ ] Integration tests pass
7. [ ] Documentation is complete

## Environment Variables

```bash
# .env.development
VITE_USE_MOCK_BACKEND=true
VITE_API_BASE_URL=http://localhost:5000

# .env.production
VITE_USE_MOCK_BACKEND=false
VITE_API_BASE_URL=http://localhost:5000
```

---

**Related Issues:**
- Phase 6A: [Unified Block Source](phase-6a-unified-block-source.md)
- Phase 6B: [Discovery API](phase-6b-discovery-api.md)
- Phase 6E: [Docker Preparation](phase-6e-docker-preparation.md)
