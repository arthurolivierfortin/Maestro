# Maestro + LLM-Provider Integration Setup

This document describes the integration setup between Maestro and LLM-Provider for the Maestro-Test-Repo project.

## Overview

Maestro now integrates with LLM-Provider to enable AI-powered workflow execution. This setup includes:
- LLMProviderGateway implementation for connecting to LLM-Provider
- Project binding system (`.maestro` folder structure)
- Git commit message generation workflow

## Changes Made

### 1. Backend Changes

#### New Files
- `backend/src/Maestro.Infrastructure/LLMGateway/LLMProviderGateway.cs`
  - Implements `ILLMGateway` interface
  - Connects to LLM-Provider FastAPI server (http://localhost:8000)
  - Supports retry with exponential backoff
  - Configurable via `LLMProviderSettings`

#### Modified Files
- `backend/src/Maestro.Api/Program.cs`
  - Registers `LLMProviderGateway` with HttpClient factory
  - Configures LLM Provider settings from appsettings.json

- `backend/src/Maestro.Api/appsettings.json`
  - Added `LLMProvider` configuration section

- `backend/src/Maestro.Infrastructure/Maestro.Infrastructure.csproj`
  - Added `Microsoft.Extensions.Options` package
  - Added `Microsoft.Extensions.Http` package

- `backend/src/Maestro.Domain/Entities/Project.cs`
  - Added `GetWorkflowsFolderPath()` method

- `backend/src/Maestro.Infrastructure/Projects/FileSystemProjectRepository.cs`
  - Creates `workflows/` folder when saving project

- `backend/src/Maestro.Api/Controllers/ProjectsController.cs`
  - Added `POST /api/projects/bind` endpoint for binding existing directories

- `backend/src/Maestro.Application/DTOs/ProjectRequests.cs`
  - Added `BindProjectRequest` DTO

### 2. CLI Changes

- `tools/shared/api-client.js`
  - Added `bindProject()` method

- `tools/maestro-cli/index.js`
  - Added `projects bind` command
  - Updated help documentation

### 3. Block Definitions

#### Git Tools (in `blocks/tools/`)
- `git-diff.tool.block.json` - Get staged/unstaged git changes
- `git-status.tool.block.json` - Get repository status
- `git-log.tool.block.json` - Get recent commit history

#### Inference Block (in `blocks/inference/`)
- `commit-message-generator.inference.block.json` - Generate conventional commit messages

#### Workflow (in `blocks/workflows/`)
- `generate-commit-message.workflow.block.json` - Complete workflow for commit message generation
- `generate-commit-message/` - Folder structure for legacy CLI mock execution

### 4. Test Project Setup

Located at `C:/Maestro-Test-Repo/`:

```
Maestro-Test-Repo/
├── .git/
├── .maestro/
│   ├── project.json          # Project configuration
│   ├── blocks/               # Project-specific blocks
│   └── workflows/            # Project-specific workflows
└── README.md                 # Test file
```

## Configuration

### LLM Provider Settings (appsettings.json)

```json
{
  "LLMProvider": {
    "BaseUrl": "http://localhost:8000",
    "DefaultModel": "deepseek-ai/deepseek-coder-1.3b-instruct",
    "TimeoutSeconds": 300,
    "MaxRetries": 3,
    "InitialRetryDelayMs": 200,
    "MaxNewTokens": 512,
    "Temperature": 0.7,
    "DoSample": true,
    "TopP": 0.95,
    "SystemPrompt": null
  }
}
```

### Environment Variables

```bash
# Required for block discovery
export MAESTRO_GLOBAL_BLOCKS_PATH="/c/Meastro/blocks"
export MAESTRO_REPO_ROOT="/c/Meastro"
```

## Usage

### 1. Start LLM-Provider

```bash
cd /c/LLM-Provider
python -m uvicorn api.server:app --host 0.0.0.0 --port 8000
```

### 2. Start Maestro Backend

```bash
cd /c/Meastro/backend/src/Maestro.Api
export MAESTRO_GLOBAL_BLOCKS_PATH="/c/Meastro/blocks"
export MAESTRO_REPO_ROOT="/c/Meastro"
dotnet run --urls=http://localhost:5000
```

### 3. Bind a Project

```bash
cd /c/Meastro/tools/maestro-cli
node index.js projects bind --path /c/Maestro-Test-Repo --name "My Project" -u http://localhost:5000
```

### 4. List Blocks and Workflows

```bash
node index.js blocks -u http://localhost:5000
node index.js workflows -u http://localhost:5000
```

### 5. Execute Workflow (Mock Mode)

```bash
node index.js execute generate-commit-message --mock --input workingDir=/c/Maestro-Test-Repo
```

## Commit Message Format

The workflow generates commit messages following Conventional Commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Formatting changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `POST /api/projects/bind` - Bind existing directory
- `POST /api/projects/open` - Open existing project
- `GET /api/projects/{id}` - Get project details
- `DELETE /api/projects/{id}` - Delete project

### Blocks
- `GET /api/blocks` - List all blocks
- `GET /api/blocks/{id}` - Get block details

### Workflows
- `POST /api/workflows/{id}/execute` - Execute workflow
