# Frontend Backend Integration Guide

This guide explains how to connect the Maestro frontend to the real backend API.

## Environment Configuration

The frontend supports two modes: **mock** (for development without backend) and **real** (production mode with backend API).

### Environment Variables

Create a `.env` file in the `apps/desktop/` directory:

```bash
# Use mock backend (development mode)
VITE_USE_MOCK_BACKEND=true

# Backend API URL
VITE_API_BASE_URL=http://localhost:5000
```

For production, set:

```bash
VITE_USE_MOCK_BACKEND=false
VITE_API_BASE_URL=http://your-backend-url
```

## Switching Between Mock and Real Backend

The frontend automatically switches between mock and real services based on the `VITE_USE_MOCK_BACKEND` environment variable.

### Development Mode (Mock Backend)

```bash
# .env.development
VITE_USE_MOCK_BACKEND=true
VITE_API_BASE_URL=http://localhost:5000
```

Run frontend:
```bash
cd apps/desktop
npm run dev
```

The frontend will use hardcoded mock data. No backend required.

### Production Mode (Real Backend)

```bash
# .env.production
VITE_USE_MOCK_BACKEND=false
VITE_API_BASE_URL=http://localhost:5000
```

**Start the backend first:**
```bash
cd apps/backend
dotnet run --project src/Maestro.Api
```

Backend will start on `http://localhost:5000`

**Then start the frontend:**
```bash
cd apps/desktop
npm run dev
```

Frontend will connect to the real backend API.

## Features

### Real-Time Updates

When connected to the real backend, the frontend receives real-time updates via SignalR:

- **Block Changes**: Automatically updates when blocks are added, modified, or deleted
- **Execution Progress**: Live updates during workflow execution
- **Connection Status**: Visual indicator showing backend connection state

### Connection Management

The frontend includes automatic connection management:

- **Health Checks**: Periodic health checks every 30 seconds
- **Auto-Reconnect**: Automatically reconnects if connection is lost
- **Retry Logic**: Exponential backoff retry for transient failures
- **Offline Mode**: Detects when backend is unavailable and queues operations

### Error Handling

User-friendly error messages for common scenarios:

- **Backend Not Running**: "Cannot connect to the backend. Please ensure the server is running."
- **404 Not Found**: "The requested resource was not found."
- **Network Errors**: Automatic retry with exponential backoff

## Connection Status Component

Add the `ConnectionStatus` component to your UI to show backend connection state:

```tsx
import { ConnectionStatus } from '@/components/ConnectionStatus';

function App() {
  return (
    <div>
      {/* Show connection status in header/footer */}
      <ConnectionStatus showDetails={true} />
      
      {/* Your app content */}
    </div>
  );
}
```

## Hooks

### useBackendConnection

Monitor backend connection state:

```tsx
import { useBackendConnection } from '@/hooks';

function MyComponent() {
  const {
    isConnected,
    isConnecting,
    error,
    backendVersion,
    blockCount,
    retry
  } = useBackendConnection();

  if (!isConnected) {
    return (
      <div>
        <p>Backend disconnected: {error}</p>
        <button onClick={retry}>Retry</button>
      </div>
    );
  }

  return <div>Connected to backend v{backendVersion}</div>;
}
```

### useOfflineMode

Handle offline scenarios with operation queueing:

```tsx
import { useOfflineMode } from '@/hooks';

function MyComponent() {
  const { isOffline, pendingOperations, queueOperation } = useOfflineMode();

  const handleSave = async () => {
    if (isOffline) {
      // Queue operation for later
      queueOperation({
        type: 'update',
        description: 'Update block',
        execute: async () => {
          await blockService.update(blockId, updates);
        }
      });
    } else {
      // Execute immediately
      await blockService.update(blockId, updates);
    }
  };

  return (
    <div>
      {isOffline && (
        <div className="offline-banner">
          Offline mode: {pendingOperations.length} operations queued
        </div>
      )}
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

## API Services

All services automatically use the real backend when `VITE_USE_MOCK_BACKEND=false`:

### Block Service

```tsx
import { blockService } from '@/services';

// List all blocks
const blocks = await blockService.getAll();

// Get block by ID
const block = await blockService.getById('block-id');

// Create block
const newBlock = await blockService.create({
  name: 'My Block',
  type: 'tool',
  config: { /* ... */ }
});

// Update block
const updated = await blockService.update('block-id', {
  name: 'Updated Name'
});

// Delete block
await blockService.delete('block-id');
```

### Discovery Service

```tsx
import { getRealDiscoveryService } from '@/services/real/realDiscoveryService';

const discoveryService = getRealDiscoveryService();

// Check backend health
const health = await discoveryService.getHealth();
console.log(`Backend version: ${health.version}`);

// Get backend capabilities
const capabilities = await discoveryService.getCapabilities();
console.log(`Available block types: ${capabilities.blockTypes.join(', ')}`);

// Get configuration
const config = await discoveryService.getConfig();
console.log(`SignalR enabled: ${config.signalREnabled}`);
```

### Execution Service

```tsx
import { realExecutionService } from '@/services/realExecutionService';

// Execute workflow
const result = await realExecutionService.executeWorkflow('workflow-id', {
  inputs: { key: 'value' }
});

// Subscribe to execution events
const unsubscribe = await realExecutionService.subscribeToExecution(
  result.executionId,
  {
    onNodeStarted: ({ nodeId }) => console.log(`Node started: ${nodeId}`),
    onNodeCompleted: ({ nodeId, outputs }) => console.log(`Node completed: ${nodeId}`, outputs),
    onExecutionCompleted: ({ outputs }) => console.log('Execution complete!', outputs),
    onExecutionFailed: ({ error }) => console.error('Execution failed:', error),
  }
);

// Later: unsubscribe
unsubscribe?.();
```

## Troubleshooting

### Backend Not Running

**Error**: "Cannot connect to the backend"

**Solution**:
1. Ensure backend is running: `cd apps/backend && dotnet run --project src/Maestro.Api`
2. Check backend URL in `.env` file
3. Verify backend is accessible at `http://localhost:5000`

### CORS Errors

**Error**: "Access to fetch blocked by CORS policy"

**Solution**: Backend already has CORS configured for `http://localhost:5173` (Vite default).

If using different port, update `Program.cs`:

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:YOUR_PORT")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});
```

### SignalR Connection Fails

**Error**: "SignalR connection failed"

**Solution**:
1. Check backend has SignalR hubs configured
2. Verify `VITE_API_BASE_URL` is correct
3. Check browser console for detailed SignalR errors
4. Ensure backend is running with SignalR enabled

### Mock Data Still Showing

**Problem**: Frontend shows mock data even with `VITE_USE_MOCK_BACKEND=false`

**Solution**:
1. Restart Vite dev server (Ctrl+C and `npm run dev`)
2. Clear browser cache and reload
3. Check `.env` file is in `frontend/` directory
4. Verify environment variable with `console.log(import.meta.env.VITE_USE_MOCK_BACKEND)`

## Testing Real Backend Integration

### Manual Testing

1. Start backend:
   ```bash
   cd apps/backend
   dotnet run --project src/Maestro.Api
   ```

2. Set environment to use real backend:
   ```bash
   # apps/desktop/.env
   VITE_USE_MOCK_BACKEND=false
   ```

3. Start frontend:
   ```bash
   cd apps/desktop
   npm run dev
   ```

4. Open browser to `http://localhost:5173`

5. Check connection status:
   - Should show "Connected" indicator
   - Backend version should be displayed
   - Block count should match backend data

6. Test CRUD operations:
   - Create a new block → should appear in backend
   - Edit a block → changes should persist
   - Delete a block → should be removed from backend

7. Test real-time updates:
   - Open multiple browser windows
   - Create/edit block in one window
   - Changes should appear in other windows automatically

### Integration Tests

Run integration tests with both frontend and backend:

```bash
# Start backend
cd apps/backend
dotnet run --project src/Maestro.Api

# In another terminal, run frontend tests
cd apps/desktop
npm test:integration
```

## Production Deployment

For production deployment:

1. Build frontend with production config:
   ```bash
   cd apps/desktop
   VITE_USE_MOCK_BACKEND=false VITE_API_BASE_URL=https://api.yourdomain.com npm run build
   ```

2. Deploy built files from `frontend/dist/` to web server

3. Ensure backend is deployed and accessible at configured URL

4. Test connection status in production environment

---

**See Also**:
- [Backend API Documentation](../apps/backend/README.md)
- [Phase 6D Issue File](../docs/issues/phase-6d-frontend-real-integration.md)
- [SignalR Documentation](https://docs.microsoft.com/en-us/aspnet/core/signalr/)
