# 🎯 Feature : MAESTRO-000 – Add project scaffolding, docs, prompts, and pin .NET 10 SDK

## 🎯 Purpose
This PR introduces the initial project scaffolding for the B-One Maestro repository: a Clean Architecture-styled .NET backend, a TypeScript/React frontend scaffold, documentation and ADRs, developer helper scripts, and repository prompts/instructions for PR and commit generation. It also pins the repository to the .NET 10 SDK (`10.0.101`) via `global.json` to ensure consistent builds.

## 📋 Changes Summary
- Added backend solution and projects (Domain, Application, Infrastructure, Api, Agents) following Clean Architecture patterns.
- Added frontend scaffolding (Vite + React + TypeScript) with initial components for the Workflow editor and execution monitoring.
- Added repository-level documentation and guidelines including: README, BUILD.md, CONTRIBUTING.md, and ADRs under `docs/`.
- Added `.github` prompts and instructions for generating PR descriptions, commit messages, ADRs, and feature templates.
- Added helper scripts in `scripts/` and `.maestro/` artifacts for contributors.
- Added `global.json` to pin SDK to `10.0.101` and included an option to install the SDK locally via `dotnet-install.ps1`.

## 🏗️ Technical Details
- Backend: Introduces a Clean Architecture layout with the following projects:
  - `Maestro.Domain` — entities (`Workflow`, `Node`), value objects, and domain interfaces
  - `Maestro.Application` — use-case interfaces, DTOs, and application contracts (`ILLMGateway`, `IExecutionMonitor`)
  - `Maestro.Infrastructure` — LLM gateway placeholder, monitoring, and JSON persistence repository
  - `Maestro.Api` — minimal API wiring and `WorkflowsController` skeleton
  - `Maestro.Agents` — placeholder project for specialized agents
- Frontend: Vite + React with initial components:
  - `WorkflowEditor`, `ExecutionTimeline`, `TerminalOutput` and API client in `src/services/api.ts`
- Tooling & Scripts:
  - `global.json` pins SDK to `10.0.101` (rollForward: `latestFeature`) so contributors without system-wide .NET 10 can install a local SDK using `dotnet-install.ps1`.
  - Included `dotnet-install.ps1` for convenience (downloadable from Microsoft) and example scripts in `scripts/` and `.maestro/`.

## 🧪 Testing
- No automated tests are included yet. Manual verification performed:
  - `dotnet restore` and `dotnet build` for `backend/Maestro.sln` succeeded locally after installing SDK 10.0.101.
  - Frontend scaffold builds but `npm run dev` may require developer environment setup (Node version, local env vars).

## 📖 Documentation
- Added multiple guidance files under `.github/prompts/` and `.github/instructions/` describing commit/PR templates, clean architecture rules, code conventions, testing guidelines, and changelog/README modification policies.
- ADRs added under `docs/adr/` describing model-agnostic LLM gateway and persistence decisions.

## 🚀 Deployment Notes
- `global.json` requires an available SDK `10.0.101` to build. Developers can:
  - Install .NET SDK 10 system-wide via the official installer, or
  - Use `dotnet-install.ps1` to install a user-local SDK (example script included). This PR includes `global.json` so builds will fail fast if the SDK is not available.

## 🔄 Migration Guide
- No database or external migration steps in this PR.

## 📸 Screenshots/Examples
- N/A for this initial scaffolding PR.

## 🔗 Related Issues
- None referenced in commits; branch is named `copilot/create-readme-and-structure`.

## 👥 Review Notes
- Focus areas for review:
  - Architecture: Verify project layout and Clean Architecture boundaries.
  - `global.json`: Confirm SDK pinning policy is acceptable for the team.
  - Documentation: Typos, missing sections, or areas needing more detail.
  - Frontend: Check the initial component API boundaries and TypeScript types.

---

### Checklist for reviewers
- [ ] Builds successfully with pinned SDK (or instructions to install local SDK are clear)
- [ ] Documentation provides enough guidance to onboard new contributors
- [ ] No domain logic leaked into infrastructure or presentation layers
- [ ] Frontend scaffold compiles and runs locally
