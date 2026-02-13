# Maestro — Installation Guide (Windows)

## Prerequisites

- **Node.js** 18+ ([nodejs.org](https://nodejs.org))
- **.NET 8 SDK** ([dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/8.0))
- **Git** ([git-scm.com](https://git-scm.com))
- (Optional) **Python 3.10+** with CUDA for local LLM provider

## Quick Install

### 1. Clone the repository

```bash
git clone https://github.com/your-org/maestro.git
cd maestro
```

### 2. Install dependencies

```bash
# CLI dependencies
cd maestro-cli && npm install && cd ..

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Start all services

```powershell
powershell -File dev-scripts/dev-start.ps1
```

This starts:
- **Backend** on `http://localhost:5000`
- **Frontend** on `http://localhost:5173`
- **LLM Provider** on `http://localhost:8000` (if available)

### 4. Verify

```bash
cd maestro-cli
node index.js health
```

You should see `Status: healthy`.

## First-Time Setup

### API Key (Production)

In production mode (`Security.Enabled: true`), create an admin key:

```bash
node index.js auth setup
```

Store the key securely. Set it as an environment variable:

```bash
set MAESTRO_API_KEY=mst_your_key_here
```

Or in your config:

```bash
# Edit ~/.maestro/config.json
{
  "apiKey": "mst_your_key_here"
}
```

### Development Mode

Development mode (`appsettings.Development.json`) disables security.
No API key is needed for local development.

## Directory Structure

After first run, Maestro creates:

```
~/.maestro/
  config.json     — User configuration
  keys.json       — API key hashes (never plaintext)
  logs/
    audit.jsonl   — Audit log
  config/         — Additional config
  blocks/         — User blocks
  cache/          — Cache data
```

## Stopping Services

```powershell
powershell -File dev-scripts/dev-start.ps1 -Stop
```

## Troubleshooting

### Backend won't start (port in use)

```powershell
taskkill /F /IM Maestro.Api.exe
```

### DLL locked during build

```powershell
taskkill /F /IM Maestro.Api.exe
dotnet build backend
```

### LLM Provider not starting

Ensure Python and CUDA dependencies are installed. Check:
```
http://localhost:8000/health
```
