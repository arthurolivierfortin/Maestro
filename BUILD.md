# Building and Running B-One Maestro

This document explains how to build and run the B-One Maestro application.

## Prerequisites

### Backend (.NET)
- .NET 10 SDK or later
- Any C# IDE (Visual Studio, VS Code with C# extension, Rider)

### Frontend (TypeScript)
- Node.js 18+ and npm
- Any code editor (VS Code recommended)

## Project Structure

```
Meastro/
├── backend/                # .NET Backend (Clean Architecture)
│   ├── Maestro.sln        # Solution file
│   └── src/
│       ├── Maestro.Domain/           # Pure domain logic (no dependencies)
│       ├── Maestro.Application/      # Use cases and interfaces
│       ├── Maestro.Infrastructure/   # Implementations (LLM, persistence, monitoring)
│       ├── Maestro.Api/              # REST API + SignalR
│       └── Maestro.Agents/           # Agent implementations
│
├── frontend/              # TypeScript + React Frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API clients
│   │   ├── types/        # TypeScript types
│   │   └── styles/       # CSS
│   └── package.json
│
├── .maestro/              # Maestro runtime and artifacts
│   ├── artifacts/        # User scripts and tools
│   └── config.json       # Configuration
│
└── workflows/             # Workflow definitions (JSON, versioned in Git)
```

## Building the Backend

### Option 1: Command Line

```bash
cd backend
dotnet restore
dotnet build
```

### Option 2: Visual Studio / Rider
Open `backend/Maestro.sln` and build the solution (Ctrl+Shift+B).

### Verify Build
```bash
cd backend
dotnet build
# Should output: Build succeeded
```

## Running the Backend

```bash
cd backend/src/Maestro.Api
dotnet run
```

The API will start at:
- HTTPS: `https://localhost:5001`
- HTTP: `http://localhost:5000`

### Test the API
```bash
curl https://localhost:5001/api/workflows/hello --insecure
```

Expected response:
```json
{
  "message": "Hello from B-One Maestro API",
  "architecture": "Clean Architecture",
  "layers": ["Domain", "Application", "Infrastructure", "Presentation"]
}
```

## Building the Frontend

### Install Dependencies
```bash
cd frontend
npm install
```

### Run Development Server
```bash
npm run dev
```

The frontend will start at: `http://localhost:5173`

### Build for Production
```bash
npm run build
```

## Architecture Validation

This initial setup validates:

### ✅ Backend (Clean Architecture)
- **Domain Layer**: Pure C# entities (Workflow, Node) with no external dependencies
- **Application Layer**: Interfaces (ILLMGateway, IExecutionMonitor) and DTOs
- **Infrastructure Layer**: Implementations (JsonWorkflowRepository, LLMGateway, ExecutionMonitor)
- **Presentation Layer**: API controllers with dependency injection
- **Agents Layer**: Placeholder for specialized agents

### ✅ Frontend (TypeScript)
- React 18 with TypeScript strict mode
- Component structure (WorkflowEditor, Execution, Monitoring)
- Type-safe API client
- No business logic (presentational only)

### ✅ Project Structure
- Clean Architecture boundaries enforced via project references
- SOLID principles (dependency inversion via interfaces)
- Model-agnostic design (ILLMGateway abstraction)
- Monitoring infrastructure (IExecutionMonitor)
- Artifact detection (.maestro directory)

## Next Steps

This is a **minimal "Hello World"** to validate the architecture. No feature logic has been implemented.

To add features:
1. Implement domain entities and business rules in `Maestro.Domain`
2. Create use cases and commands in `Maestro.Application`
3. Implement infrastructure concerns in `Maestro.Infrastructure`
4. Add API endpoints in `Maestro.Api`
5. Build UI components in `frontend/src/components`

**Remember**: Always maintain Clean Architecture boundaries and SOLID principles.

## Troubleshooting

### Backend won't build
- Ensure .NET 10 SDK is installed: `dotnet --version`
- Restore dependencies: `cd backend && dotnet restore`
- Check project references are correct

### Frontend won't start
- Ensure Node.js 18+ is installed: `node --version`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check port 5173 is not in use

### Can't connect frontend to backend
- Ensure backend is running on `https://localhost:5001`
- Check CORS is configured in `backend/src/Maestro.Api/Program.cs`
- Verify `VITE_API_BASE_URL` in frontend environment variables

## Documentation

- [README.md](./README.md) - Project vision and architecture
- [PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md) - Detailed folder structure
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [ADRs](./docs/adr/) - Architecture Decision Records
