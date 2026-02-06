# Phase 6D Handoff Document

**Date**: 2026-01-18  
**Status**: Ready to Begin  
**Previous Phases**: 6A, 6B, 6C ✅ Complete

---

## 🎯 Objective

Complete frontend real service integration to eliminate mock service dependencies and enable production use with real backend.

---

## 📋 Prerequisites (All Complete)

✅ **Phase 6A**: BlocksController CRUD API implemented  
✅ **Phase 6B**: Discovery API with 8 endpoints  
✅ **Phase 6C**: CLI refactored to use API client  

**Backend Status**: Backend exposes complete REST API with discovery, blocks CRUD, and SignalR hub.

---

## 📂 Phase 6D Documentation

**Full Issue File**: `docs/issues/phase-6d-frontend-real-integration.md` (623 lines)

**Key Sections**:
- Lines 1-100: Overview and current problems (already read)
- Lines 100-623: Detailed implementation tasks (need to read)

---

## 🛠️ Tasks Overview (From Issue File)

### 6D.1: Complete realBlockService.ts
- Implement all IBlockService methods using backend API
- Map backend BlockDto to frontend Block types
- Add error handling for network failures
- **Status**: Partially implemented, needs completion

### 6D.2: Complete realDiscoveryService.ts
- Update to use `/api/discovery` endpoints (Phase 6B)
- Implement health checks, capabilities, configuration
- **Status**: Needs update to use correct endpoints

### 6D.3: Create realExecutionService.ts
- Implement workflow execution operations
- Handle long-running operations with polling
- Add cancellation support
- **Status**: Not started

### 6D.4: Create realModelService.ts
- Implement model registry operations
- Manage LLM provider configurations
- **Status**: Not started

### 6D.5: SignalR Integration
- Connect to `/hubs/blocks` SignalR hub
- Subscribe to block events (Added, Updated, Deleted)
- Update UI in real-time
- **Status**: SignalR configured but not connected in frontend

### 6D.6: Connection State Management
- Create `useBackendConnection` hook
- Track connection status (connected, disconnected, error)
- Auto-reconnect on connection loss
- **Status**: Not started

### 6D.7: Error Handling
- Network failure handling with retries
- Timeout handling
- Offline mode detection
- **Status**: Basic error handling exists, needs enhancement

### 6D.8: Environment Configuration
- Implement `VITE_USE_MOCK_BACKEND` toggle
- Add backend URL configuration
- **Status**: Flag exists but switching untested

### 6D.9: Integration Tests
- Test frontend + backend together
- Test real-time updates via SignalR
- **Status**: Not started

### 6D.10: Documentation
- Document switching between mock and real backend
- Add troubleshooting guide
- **Status**: Not started

---

## 🗂️ Files to Modify

### Existing Files (Need Completion)
```
frontend/src/services/real/realBlockService.ts         - Complete CRUD methods
frontend/src/services/real/realDiscoveryService.ts     - Update to use /api/discovery
```

### New Files to Create
```
frontend/src/services/real/realExecutionService.ts     - Workflow execution
frontend/src/services/real/realModelService.ts         - Model registry
frontend/src/hooks/useBackendConnection.ts             - Connection state hook
frontend/src/hooks/useSignalR.ts                       - SignalR connection hook
frontend/src/config/backendConfig.ts                   - Backend configuration
```

### Test Files to Create
```
frontend/src/services/real/realBlockService.test.ts
frontend/src/services/real/realExecutionService.test.ts
frontend/__tests__/integration/BackendIntegration.test.tsx
```

---

## 🔗 Backend API Endpoints Available

### Blocks API (`/api/blocks`)
```
GET    /api/blocks                - List all blocks (with filtering)
GET    /api/blocks/{id}           - Get block by ID
POST   /api/blocks                - Create new block
PUT    /api/blocks/{id}           - Update block
DELETE /api/blocks/{id}           - Delete block
```

### Discovery API (`/api/discovery`)
```
GET    /api/discovery/health               - Health check
GET    /api/discovery/capabilities         - System capabilities
GET    /api/discovery/config               - Configuration
GET    /api/discovery/blocks/types         - Block type metadata
GET    /api/discovery/blocks               - All blocks (filtered)
GET    /api/discovery/blocks/by-type/{t}   - Blocks by type
GET    /api/discovery/blocks/by-capability/{c} - Blocks by capability
GET    /api/discovery/blocks/search?q={q}  - Search blocks
```

### SignalR Hub (`/hubs/blocks`)
```
Events:
- BlockAdded(BlockDto)     - New block created
- BlockUpdated(BlockDto)   - Block modified
- BlockDeleted(string id)  - Block removed
```

---

## 📝 Implementation Strategy

### Step 1: Read Full Documentation
```
Read lines 100-623 of docs/issues/phase-6d-frontend-real-integration.md
```

### Step 2: Complete Real Services (Priority Order)
1. **realBlockService.ts** - Most critical, blocks CRUD operations
2. **realDiscoveryService.ts** - Update to use Phase 6B endpoints
3. **realExecutionService.ts** - Workflow execution
4. **realModelService.ts** - Model registry

### Step 3: Add Real-Time Updates
1. Create `useSignalR` hook for connection management
2. Subscribe to block events in components
3. Update UI when events received

### Step 4: Connection Management
1. Create `useBackendConnection` hook
2. Add reconnection logic
3. Handle offline/online transitions

### Step 5: Testing
1. Test with real backend (`VITE_USE_MOCK_BACKEND=false`)
2. Test SignalR real-time updates
3. Test error handling and retries
4. Create integration tests

### Step 6: Documentation
1. Update frontend README with backend setup
2. Add troubleshooting guide
3. Document environment variables

---

## 🔧 Technical Details

### Type Mapping (Backend DTO ↔ Frontend Model)

**Backend BlockDto**:
```typescript
interface BlockDto {
  id: string;
  type: string;
  name: string;
  description: string;
  category?: string;
  capabilities?: string[];
  tags?: string[];
  config?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

**Frontend Block**:
```typescript
interface Block {
  id: string;
  type: BlockType;
  name: string;
  description?: string;
  category?: string;
  capabilities?: string[];
  tags?: string[];
  config?: BlockConfig;
  metadata?: BlockMetadata;
}
```

**Mapping Function Needed**:
```typescript
function mapBlockDtoToBlock(dto: BlockDto): Block {
  return {
    id: dto.id,
    type: dto.type as BlockType,
    name: dto.name,
    description: dto.description,
    category: dto.category,
    capabilities: dto.capabilities || [],
    tags: dto.tags || [],
    config: dto.config || {},
    metadata: {
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt)
    }
  };
}
```

### SignalR Connection Pattern

```typescript
import * as signalR from '@microsoft/signalr';

const connection = new signalR.HubConnectionBuilder()
  .withUrl('http://localhost:5000/hubs/blocks')
  .withAutomaticReconnect()
  .build();

connection.on('BlockAdded', (block: BlockDto) => {
  // Update UI with new block
});

connection.on('BlockUpdated', (block: BlockDto) => {
  // Update existing block in UI
});

connection.on('BlockDeleted', (id: string) => {
  // Remove block from UI
});

await connection.start();
```

### Error Handling Pattern

```typescript
async function apiCall<T>(operation: () => Promise<T>): Promise<T> {
  const maxRetries = 3;
  const retryDelay = 1000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## ⚙️ Environment Configuration

### Environment Variables
```bash
# .env.development
VITE_USE_MOCK_BACKEND=false
VITE_API_BASE_URL=http://localhost:5000
VITE_SIGNALR_HUB_URL=http://localhost:5000/hubs/blocks
```

### Backend Configuration
```bash
# Backend must be running
cd backend
dotnet run --project src/Maestro.Api

# Backend will start on http://localhost:5000
# SignalR hub available at /hubs/blocks
```

---

## ✅ Success Criteria

Phase 6D is complete when:

1. ✅ Frontend works with `VITE_USE_MOCK_BACKEND=false`
2. ✅ All block CRUD operations use backend API
3. ✅ Real-time updates work via SignalR
4. ✅ Error handling shows user-friendly messages
5. ✅ Offline mode detected and handled gracefully
6. ✅ Connection state visible in UI
7. ✅ Auto-reconnect works after backend restart
8. ✅ Integration tests pass (frontend + backend)
9. ✅ Documentation updated with setup instructions
10. ✅ No console errors when switching between mock/real backend

---

## 📊 Estimated Timeline

- **Reading Documentation**: 30 minutes
- **realBlockService completion**: 2-3 hours
- **realDiscoveryService update**: 1 hour
- **realExecutionService creation**: 2-3 hours
- **realModelService creation**: 1-2 hours
- **SignalR integration**: 2-3 hours
- **Connection management**: 1-2 hours
- **Error handling enhancement**: 1-2 hours
- **Testing**: 2-3 hours
- **Documentation**: 1 hour

**Total Estimate**: 2-3 days (16-24 hours of focused work)

---

## 🚀 Next Command to Run

```bash
# Read full Phase 6D documentation
code docs/issues/phase-6d-frontend-real-integration.md
```

Or for AI agent:
```typescript
read_file({
  filePath: 'c:\\Aitools-unsync\\Meastro\\docs\\issues\\phase-6d-frontend-real-integration.md',
  startLine: 100,
  endLine: 300
});
```

---

**Phase 6D is ready to begin!** 🎉

All prerequisites are complete. Backend API is fully functional. Time to connect the frontend to the real backend.

---

*Handoff Document Generated: 2026-01-18*  
*Previous Session: Phase 6A-6C Implementation Complete*  
*Next Session: Phase 6D Frontend Integration*
