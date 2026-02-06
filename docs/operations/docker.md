# Docker Deployment Guide

This guide explains how to run Maestro in Docker containers for development and production.

## Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- (Optional) API keys for LLM providers

### Start Backend Only

```bash
# Create .env file from template
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or code .env

# Start backend
docker-compose up -d backend

# Check health
curl http://localhost:5000/api/discovery/health

# View logs
docker-compose logs -f backend
```

### Start with Frontend (Development)

```bash
# Start backend and frontend together
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Access frontend at http://localhost:5173
# Backend API at http://localhost:5000
```

## Architecture

```
┌────────────────────────────────────────────────────┐
│               Docker Host                          │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │          Maestro Network                     │ │
│  │                                              │ │
│  │  ┌─────────────────┐  ┌──────────────────┐  │ │
│  │  │  Backend (API)  │  │  Frontend (Dev)   │  │ │
│  │  │  Port: 5000     │◄─┤  Port: 5173      │  │ │
│  │  └────────┬────────┘  └──────────────────┘  │ │
│  │           │                                  │ │
│  │           ▼                                  │ │
│  │  ┌───────────────────┐                      │ │
│  │  │  Volume Mounts    │                      │ │
│  │  │  ./blocks         │                      │ │
│  │  │  ./.maestro       │                      │ │
│  │  │  ~/.maestro       │                      │ │
│  │  └───────────────────┘                      │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  External Access:                                 │
│  - CLI/MCP: http://localhost:5000                 │
│  - Frontend: http://localhost:5173                │
└────────────────────────────────────────────────────┘
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://host.docker.internal:11434
LLM_DEFAULT_PROVIDER=OpenAI
ASPNETCORE_ENVIRONMENT=Production
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Environment Variable Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENAI_API_KEY` | OpenAI API key | - | No* |
| `ANTHROPIC_API_KEY` | Anthropic API key | - | No* |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://host.docker.internal:11434` | No |
| `LLM_DEFAULT_PROVIDER` | Default LLM provider | `OpenAI` | No |
| `ASPNETCORE_ENVIRONMENT` | ASP.NET environment | `Production` | No |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | `http://localhost:5173` | No |

*At least one LLM provider API key is required for workflow execution.

## Volume Mounts

| Host Path | Container Path | Access | Purpose |
|-----------|----------------|--------|---------|
| `./blocks` | `/app/blocks` | RW | Global project blocks |
| `./.maestro` | `/app/.maestro` | RW | Project-specific blocks |
| `~/.maestro/blocks` | `/root/.maestro/blocks` | RO | User blocks (read-only) |

### Creating Blocks

Blocks created via the API or frontend are saved to `/app/blocks` in the container, which maps to `./blocks` on the host.

```bash
# Create a block directory
mkdir -p ./blocks/my-tool

# Add block.json
cat > ./blocks/my-tool/block.json << 'EOF'
{
  "id": "my-tool",
  "name": "My Custom Tool",
  "type": "tool",
  "description": "A custom tool",
  "version": "1.0.0"
}
EOF

# Backend will automatically discover it
```

## CLI and MCP Integration

### CLI with Docker Backend

Set the backend URL:

```bash
export MAESTRO_API_URL=http://localhost:5000

cd tools/maestro-cli
node index.js blocks                    # List blocks
node index.js info git-diff-tool       # Get block details
node index.js search "commit"          # Search blocks
node index.js health                   # Check backend health
```

Or use the `--api-url` flag:

```bash
node index.js --api-url http://localhost:5000 blocks
```

### MCP Server with Docker Backend

Configure MCP to use the Docker backend:

```bash
export MAESTRO_API_URL=http://localhost:5000

cd tools/maestro-mcp
node index.js
```

The MCP server will connect to the Docker backend for all block operations.

## Development Mode

### Hot Reload for Backend

```bash
# Start with development configuration
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up backend

# Backend source is mounted and will reload on changes
# Edit files in backend/src/ and see changes automatically
```

### Hot Reload for Frontend

```bash
# Start frontend with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up frontend

# Frontend source is mounted
# Edit files in frontend/src/ and see changes in browser
```

## Production Deployment

### Build Production Images

```bash
# Build backend image
docker-compose build backend

# Or build both
docker-compose build
```

### Run in Production

```bash
# Create production .env file
cp .env.example .env
nano .env  # Add production API keys

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Health Checks

The backend includes a health check endpoint:

```bash
curl http://localhost:5000/api/discovery/health
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 12345,
  "blockCount": 42,
  "services": {
    "llm": "healthy",
    "database": "healthy",
    "filesystem": "healthy"
  }
}
```

## Troubleshooting

### Backend Not Starting

**Check logs:**
```bash
docker-compose logs backend
```

**Common issues:**
- Missing API key: Ensure `OPENAI_API_KEY` or other provider key is set
- Port conflict: Check if port 5000 is already in use
- Permission issues: Ensure Docker has access to mounted directories

### CLI Cannot Connect

**Error:** `Cannot connect to backend`

**Solution:**
1. Verify backend is running: `docker-compose ps`
2. Check health: `curl http://localhost:5000/api/discovery/health`
3. Verify `MAESTRO_API_URL`: `echo $MAESTRO_API_URL`
4. Check network: `docker network inspect maestro-network`

### Frontend Cannot Connect

**Error:** `Backend disconnected`

**Solution:**
1. Check `VITE_API_BASE_URL` in frontend `.env`
2. For containerized frontend, use `http://backend:5000`
3. For host frontend, use `http://localhost:5000`
4. Verify CORS settings allow frontend origin

### Volume Mount Permissions

**Issue:** Cannot write to block directories

**Solution on Linux:**
```bash
# Fix ownership
sudo chown -R $USER:$USER ./blocks ./.maestro

# Or run with user ID
docker-compose run --user $(id -u):$(id -g) backend
```

### Health Check Failing

**Error:** `Unhealthy` status in `docker-compose ps`

**Solution:**
1. Check if port 5000 is accessible: `curl localhost:5000/api/discovery/health`
2. View logs: `docker-compose logs backend`
3. Increase health check timeout in `docker-compose.yml`
4. Wait longer for `start_period` (default 15s)

## Stopping and Cleaning Up

```bash
# Stop services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all
```

## Advanced Configuration

### Custom Network

Modify `docker-compose.yml` to use external network:

```yaml
networks:
  default:
    external: true
    name: my-network
```

### Multiple Environments

Create environment-specific compose files:

```bash
# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

### Scaling (Future)

When backend supports horizontal scaling:

```bash
docker-compose up --scale backend=3
```

## Security Best Practices

1. **Never commit `.env`**: Add to `.gitignore`
2. **Use secrets**: For production, use Docker secrets or environment-specific tools
3. **Limit CORS origins**: Set `CORS_ALLOWED_ORIGINS` to specific domains
4. **Run as non-root**: Add `USER` directive in Dockerfile (future enhancement)
5. **Read-only mounts**: User blocks mounted read-only for safety

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Docker Build

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build backend
        run: docker-compose build backend
      
      - name: Test backend
        run: |
          docker-compose up -d backend
          sleep 15
          curl -f http://localhost:5000/api/discovery/health
          docker-compose down
```

## Next Steps

- [Frontend Integration Guide](../frontend/BACKEND-INTEGRATION.md)
- [CLI Documentation](../tools/maestro-cli/README.md)
- [MCP Server Documentation](../tools/maestro-mcp/README.md)
- [Phase 6E Issue](../docs/issues/phase-6e-docker-preparation.md)

---

**See Also**:
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [ASP.NET Core in Docker](https://docs.microsoft.com/en-us/aspnet/core/host-and-deploy/docker/)
