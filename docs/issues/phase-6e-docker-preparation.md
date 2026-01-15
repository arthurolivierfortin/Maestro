# Phase 6E: Docker Isolation Preparation

**Phase**: 6E  
**Priority**: High  
**Duration**: 2-3 days  
**Team**: DevOps/Backend (1 developer)  
**Dependencies**: Phase 6C, 6D complete  
**Blocks**: Phase 11, 14  
**Status**: Not Started

---

## Overview

Prepare the architecture for Docker deployment where the backend runs in a container. This enables:

1. **Isolated execution environment** for tools and scripts
2. **Consistent deployment** across development, staging, production
3. **Future auto-training** where agents can safely modify blocks
4. **Multi-user deployment** (future)

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HOST MACHINE                                  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Docker Network                               │ │
│  │                                                                 │ │
│  │  ┌─────────────────────┐    ┌─────────────────────────────────┐│ │
│  │  │   maestro-backend   │    │     maestro-frontend (dev)     ││ │
│  │  │    (API + Hubs)     │◄───│         (Vite dev server)       ││ │
│  │  │                     │    │                                 ││ │
│  │  │  Port: 5000         │    │  Port: 5173                     ││ │
│  │  └─────────┬───────────┘    └─────────────────────────────────┘│ │
│  │            │                                                    │ │
│  │            ▼                                                    │ │
│  │  ┌─────────────────────┐                                       │ │
│  │  │   Volume: blocks    │                                       │ │
│  │  │   /app/blocks ◄─────┼────── ./blocks (host)                 │ │
│  │  │   /app/.maestro ◄───┼────── ./.maestro (host)               │ │
│  │  └─────────────────────┘                                       │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  CLI/MCP connect via HTTP: http://localhost:5000                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Tasks

### 6E.1 Create Backend Dockerfile

- [ ] Create `backend/Dockerfile`
- [ ] Multi-stage build for smaller image
- [ ] Include .NET runtime
- [ ] Expose port 5000

```dockerfile
# backend/Dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files
COPY src/Maestro.Domain/*.csproj src/Maestro.Domain/
COPY src/Maestro.Application/*.csproj src/Maestro.Application/
COPY src/Maestro.Infrastructure/*.csproj src/Maestro.Infrastructure/
COPY src/Maestro.Api/*.csproj src/Maestro.Api/

# Restore dependencies
RUN dotnet restore src/Maestro.Api/Maestro.Api.csproj

# Copy source code
COPY src/ src/

# Build
RUN dotnet publish src/Maestro.Api/Maestro.Api.csproj -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Create blocks directories
RUN mkdir -p /app/blocks /app/.maestro/blocks

# Copy published app
COPY --from=build /app/publish .

# Expose port
EXPOSE 5000

# Set environment variables
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/discovery/health || exit 1

ENTRYPOINT ["dotnet", "Maestro.Api.dll"]
```

### 6E.2 Create docker-compose.yml

- [ ] Create `docker-compose.yml` at project root
- [ ] Configure volumes for blocks
- [ ] Configure network
- [ ] Add health checks

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: maestro-backend
    ports:
      - "5000:5000"
    volumes:
      # Mount blocks directories
      - ./blocks:/app/blocks:rw
      - ./.maestro:/app/.maestro:rw
      # Mount user blocks (read-only)
      - ~/.maestro/blocks:/root/.maestro/blocks:ro
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://+:5000
      - LLM__DefaultProvider=OpenAI
      - LLM__Providers__OpenAI__ApiKey=${OPENAI_API_KEY:-}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/discovery/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped

  # Optional: Frontend for development
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: maestro-frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src:ro
    environment:
      - VITE_USE_MOCK_BACKEND=false
      - VITE_API_BASE_URL=http://backend:5000
    depends_on:
      backend:
        condition: service_healthy

networks:
  default:
    name: maestro-network
```

### 6E.3 Create docker-compose.dev.yml

- [ ] Create development-specific compose file
- [ ] Enable hot reload
- [ ] Mount source code

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: maestro-backend-dev
    ports:
      - "5000:5000"
    volumes:
      # Mount source for hot reload
      - ./backend/src:/app/src:ro
      - ./blocks:/app/blocks:rw
      - ./.maestro:/app/.maestro:rw
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - DOTNET_WATCH_RESTART_ON_RUDE_EDIT=1

# Inherits from base docker-compose.yml
```

### 6E.4 Configure CORS

- [ ] Add CORS configuration to `Program.cs`
- [ ] Allow frontend development server
- [ ] Configure for production

```csharp
// backend/src/Maestro.Api/Program.cs
builder.Services.AddCors(options =>
{
    options.AddPolicy("Development", policy =>
    {
        policy.WithOrigins(
            "http://localhost:5173",  // Vite dev server
            "http://localhost:3000"   // Alternative port
        )
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();  // Required for SignalR
    });

    options.AddPolicy("Production", policy =>
    {
        policy.WithOrigins(
            builder.Configuration["Cors:AllowedOrigins"]?.Split(',') ?? Array.Empty<string>()
        )
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();
    });
});

// Use CORS
if (app.Environment.IsDevelopment())
{
    app.UseCors("Development");
}
else
{
    app.UseCors("Production");
}
```

### 6E.5 Environment-Based Configuration

- [ ] Create `appsettings.Docker.json`
- [ ] Configure paths for Docker environment
- [ ] Document environment variables

```json
// backend/src/Maestro.Api/appsettings.Docker.json
{
  "Blocks": {
    "SearchPaths": [
      "/app/blocks",
      "/app/.maestro/blocks",
      "/root/.maestro/blocks"
    ]
  },
  "LLM": {
    "DefaultProvider": "OpenAI",
    "Providers": {
      "OpenAI": {
        "ApiKey": "${OPENAI_API_KEY}"
      },
      "Anthropic": {
        "ApiKey": "${ANTHROPIC_API_KEY}"
      }
    }
  },
  "Cors": {
    "AllowedOrigins": "http://localhost:5173,http://frontend:5173"
  }
}
```

### 6E.6 Test CLI with Docker Backend

- [ ] Start Docker backend
- [ ] Run CLI commands against Docker backend
- [ ] Verify all operations work

```bash
# Start backend in Docker
docker-compose up -d backend

# Wait for healthy
docker-compose ps

# Test CLI
cd tools/maestro-cli
node index.js --api-url http://localhost:5000 list blocks
node index.js --api-url http://localhost:5000 run commit-generator

# Or using environment variable
export MAESTRO_API_URL=http://localhost:5000
node index.js list blocks
```

### 6E.7 Test MCP with Docker Backend

- [ ] Configure MCP to use Docker backend URL
- [ ] Test tool discovery
- [ ] Test tool execution

```bash
# Set environment variable
export MAESTRO_API_URL=http://localhost:5000

# Start MCP server (for testing)
cd tools/maestro-mcp
node index.js

# MCP should connect to Docker backend for all operations
```

### 6E.8 Test Frontend with Docker Backend

- [ ] Start Docker backend
- [ ] Start frontend with real backend config
- [ ] Verify all operations work

```bash
# Terminal 1: Start backend
docker-compose up backend

# Terminal 2: Start frontend
cd frontend
VITE_USE_MOCK_BACKEND=false VITE_API_BASE_URL=http://localhost:5000 npm run dev

# Navigate to http://localhost:5173
# Verify:
# - Blocks load from backend
# - CRUD operations work
# - SignalR events work
```

### 6E.9 Documentation

- [ ] Create `docs/docker-deployment.md`
- [ ] Document volume mounts
- [ ] Document environment variables
- [ ] Add troubleshooting section

```markdown
# Docker Deployment Guide

## Quick Start

```bash
# Start backend only
docker-compose up -d backend

# Start with frontend (development)
docker-compose up

# View logs
docker-compose logs -f backend
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `ASPNETCORE_ENVIRONMENT` | Environment name | Production |

## Volume Mounts

| Host Path | Container Path | Description |
|-----------|----------------|-------------|
| `./blocks` | `/app/blocks` | Global blocks |
| `./.maestro` | `/app/.maestro` | Project blocks |
| `~/.maestro/blocks` | `/root/.maestro/blocks` | User blocks |

## Troubleshooting

### Backend not starting
Check logs: `docker-compose logs backend`

### CLI cannot connect
Ensure MAESTRO_API_URL is set: `export MAESTRO_API_URL=http://localhost:5000`
```

### 6E.10 CI/CD Integration (Optional)

- [ ] Add GitHub Actions workflow for Docker build
- [ ] Add image tagging
- [ ] Push to container registry

```yaml
# .github/workflows/docker-build.yml
name: Docker Build

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'docker-compose.yml'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker-compose build backend
      
      - name: Test Docker image
        run: |
          docker-compose up -d backend
          sleep 10
          curl -f http://localhost:5000/api/discovery/health
```

## Files to Create

- `backend/Dockerfile`
- `backend/Dockerfile.dev`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `backend/src/Maestro.Api/appsettings.Docker.json`
- `docs/docker-deployment.md`
- `.github/workflows/docker-build.yml` (optional)

## Files to Modify

- `backend/src/Maestro.Api/Program.cs` - Add CORS configuration
- `.gitignore` - Add Docker-related ignores
- `README.md` - Add Docker quick start section

## Acceptance Criteria

1. [ ] `docker-compose up` starts backend successfully
2. [ ] Health endpoint returns healthy status
3. [ ] CLI can connect to Docker backend
4. [ ] MCP can connect to Docker backend
5. [ ] Frontend can connect to Docker backend
6. [ ] Blocks are persisted via volume mounts
7. [ ] Hot reload works in development mode
8. [ ] Documentation is complete

## Security Considerations

1. **API Keys**: Never commit API keys. Use environment variables.
2. **Volume Permissions**: Ensure proper file permissions on mounted volumes.
3. **Network**: In production, use proper network isolation.
4. **CORS**: Restrict allowed origins in production.

## Future Considerations

- **Kubernetes**: Create Helm chart for K8s deployment
- **Multi-container**: Add Redis for caching, PostgreSQL for execution history
- **Sandboxed Execution**: Run tool blocks in separate containers

---

**Related Issues:**
- Phase 6C: [CLI/MCP Migration](phase-6c-cli-mcp-api-clients.md)
- Phase 6D: [Frontend Real Integration](phase-6d-frontend-real-integration.md)
