# Maestro — Installation Guide (Windows)

## Prerequisites

| Requirement | Version | Check command |
|-------------|---------|---------------|
| .NET SDK | 10.0+ | `dotnet --version` |
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| Git | 2.40+ | `git --version` |

Optional (for local LLM):
- NVIDIA GPU with CUDA support
- Python 3.10+ with `pip`
- LLM-Provider (`llm-provider/` directory)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/maestro.git
cd maestro
```

### 2. Install backend dependencies

```powershell
cd apps/backend
dotnet restore
dotnet build
```

### 3. Install CLI dependencies

```powershell
cd packages/maestro-cli
npm install
```

### 4. Install frontend dependencies

```powershell
cd apps/desktop
npm install
```

### 5. Verify installation

```powershell
# Check backend builds
cd apps/backend
dotnet build

# Check CLI works
cd packages/maestro-cli
node index.js health
```

## Configuration

### Backend (API server)

Default config is at `apps/backend/src/Maestro.Api/appsettings.json`.

Key settings:
- **Port**: 5000 (default)
- **Kestrel binding**: `http://127.0.0.1:5000` (localhost only)
- **AllowRemote**: Set `Security:AllowRemote` to `true` for network access

### LLM Provider

Two options:

**Option A: Local LLM (GPU required)**
```powershell
powershell -File dev-scripts/dev-start.ps1
```
This starts the LLM-Provider on port 8000.

**Option B: Azure OpenAI**
```bash
cd packages/maestro-cli
node index.js config azure set --endpoint https://YOUR.openai.azure.com --api-key YOUR_KEY --deployment gpt-4
node index.js config azure test
```

### CLI global config

Config file: `~/.maestro/config.json`

```bash
node index.js config set backendUrl http://localhost:5000
node index.js config set apiKey YOUR_API_KEY  # Optional
```

## Starting Services

### Recommended: Use the dev script

```powershell
# Start all services (LLM + Backend + Frontend)
powershell -File dev-scripts/dev-start.ps1

# Backend only (no LLM)
powershell -File dev-scripts/dev-start.ps1 -SkipLLM

# Stop all services
powershell -File dev-scripts/dev-start.ps1 -Stop
```

### Manual start

```powershell
# Terminal 1: Backend
cd apps/backend/src/Maestro.Api
dotnet run --urls http://localhost:5000

# Terminal 2: Frontend
cd apps/desktop
npm run dev

# Terminal 3 (optional): LLM-Provider
cd llm-provider
python server.py
```

## Verify Everything Works

```bash
cd packages/maestro-cli

# Health check — shows all service statuses
node index.js health

# List available blocks
node index.js list-blocks

# List available session templates
node index.js templates
```

Expected health output:
```
Maestro Health Check
  Backend:  OK (http://localhost:5000)
  LLM:     OK | Not available
  Provider: local | azure
  Auth:     Enabled | Disabled
```

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.
