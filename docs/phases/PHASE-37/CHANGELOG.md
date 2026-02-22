# Phase 37 — Maestro Runtime & SDK

## Summary

Transforms Maestro from a development tool into a runtime platform. Third-party apps can embed Maestro via SDK + sidecar process.

## Sub-phases

### 37-E: Jarvis Agent
- Created `content/system/blocks/agents/jarvis/jarvis.agent.block.json` — composite agent (`isAtomic: false`)
- Created `content/system/blocks/agents/jarvis/system-prompt.md` — generic intent router
- Created `content/system/templates/sessions/jarvis.session.json` — session template with `ask` entry point
- Pattern: follows dev-orchestrator, uses `config.nodes` with inference child block

### 37-A: @maestro/client SDK
- Created `packages/maestro-client/` — full TypeScript SDK for Maestro API
- Domain-based architecture: `client.blocks.list()`, `client.sessions.create()`, etc.
- 16 domain modules: health, blocks, sessions, variables, workspaces, projects, templates, llm, metrics, foundry, workflows, training, testing, runs, auth, filesystem
- `HttpTransport` with retry, timeout, auth headers
- `ApiError`, `ConnectionError`, `TimeoutError` error types
- `ClientBlockRegistry` for client-side block execution
- `SignalRClient` for real-time events (optional peer dep)
- 19 tests passing

### 37-C: Audio Block Definitions + Client-Side Executor
- Created `content/system/blocks/tools/speech-to-text/speech-to-text.tool.block.json`
- Created `content/system/blocks/tools/text-to-speech/text-to-speech.tool.block.json`
- Added generic `client-side` executor type in `ToolBlockExecutor.cs` (~10 lines)
- Any block with `config.executorType: "client-side"` returns `_clientSideExecution: true`
- `ClientBlockRegistry` in SDK for embedding apps to register handlers

### 37-B: @maestro/sidecar
- Created `packages/maestro-sidecar/` — process manager for embedding Maestro
- `MaestroSidecar` class: start/stop backend + LLM-Provider as child processes
- `findFreePort()` for dynamic port allocation
- `waitForHealth()` with exponential backoff
- `detectMaestroRoot()` auto-detection (env > relative > explicit)
- Uses `tree-kill` for Windows process tree cleanup
- 5 tests passing

### 37-D: Voice Mode in TUI
- Added `voice.toggle: 'Ctrl+v'` to keybindings
- Added `voiceMode` state and Ctrl+V handler in `App.ts`
- Created `packages/maestro-code/audio/types.ts` — `AudioAdapter` interface + `NoopAudioAdapter`
- Created `packages/maestro-code/components/VoiceIndicator.ts` — VOICE badge
- StatusBar shows "VOICE" when active, InputPrompt shows "Listening..."
- V1 is UI-only — real audio capture comes with Electron in Phase 41

### CLI Migration
- Created `packages/maestro-cli/api-client.ts` — typed adapter wrapping @maestro/client
- Updated `cli.ts` import from `api-client.js` to `api-client.ts`
- Deleted `packages/maestro-cli/api-client.js` (885 lines of untyped JS)
- Added `@maestro/client` as CLI dependency

## Files Created (26)
- `packages/maestro-client/` — 20 files (SDK)
- `packages/maestro-sidecar/` — 10 files (sidecar)
- `content/system/blocks/agents/jarvis/` — 2 files
- `content/system/blocks/tools/speech-to-text/` — 1 file
- `content/system/blocks/tools/text-to-speech/` — 1 file
- `content/system/templates/sessions/jarvis.session.json`
- `packages/maestro-code/audio/types.ts`
- `packages/maestro-code/components/VoiceIndicator.ts`
- `packages/maestro-cli/api-client.ts`

## Files Modified (4)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` — client-side executor
- `packages/tui/keybindings/keybindings.ts` — voice.toggle binding
- `packages/maestro-code/App.ts` — voice mode state + Ctrl+V handler
- `packages/maestro-cli/cli.ts` — import path change

## Files Deleted (1)
- `packages/maestro-cli/api-client.js` — replaced by typed @maestro/client SDK

## Test Results
- @maestro/client: 19/19 pass
- @maestro/sidecar: 5/5 pass
- TUI toolkit: 40/40 pass
- Monitor: 4/4 pass
- Maestro-code: 31/32 pass (1 pre-existing failure in headless.test.ts)
- Backend: builds clean (0 errors, 0 warnings)
