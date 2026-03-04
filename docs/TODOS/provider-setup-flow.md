# Provider Setup Flow for `maestro code`

**Date**: 2026-03-03
**Status**: Planned
**Related**: `docs/TODOS/debug-maestro-code-agent.md`

## Problem

When a user installs Maestro globally (`npm install -g @maestro/cli`) and runs `maestro code`, the agent hangs silently in "processing" because:

1. **No provider setup flow** — `maestro code` never asks users to configure providers
2. **Claude Code auth not verified** — `IsAvailableAsync()` only checks `claude --version`, not `claude auth status`
3. **Config artificially single-provider** — `config.ts` stores one `provider.type` but the backend supports all 4 simultaneously
4. **No visible errors** — user sees infinite spinner with no indication of what's wrong

The `init-wizard.ts` and `config.ts` infrastructure exists but is **never triggered** by `maestro code`. The `isFirstRun` flag is detected (line 6327 of cli.ts) but completely ignored.

## Architecture Context

- The LLM Provider backend registers ALL 4 providers at startup (`Program.cs` lines 118-121)
- `LLMProviderFactory` discovers providers at runtime — uses whatever is configured and available
- Available providers: **Azure OpenAI**, **Azure AI Inference / GitHub Models**, **Claude Code (CLI)**, **Local (Python FastAPI)**
- Each provider has different setup requirements (API keys, CLI auth, server URL)

## Solution

### Step 1: Multi-provider config schema

**File**: `packages/maestro-cli/config.ts`

Change from single `provider: { type, ... }` to multi-provider map:

```typescript
providers?: {
  claudeCode?: { cliPath: string };
  azure?: { endpoint: string; apiKey: string; deployment: string };
  azureInference?: { endpoint: string; apiKey: string; model: string };
  local?: { url: string };
};
```

Update `getProviderEnvVars()` to emit env vars for ALL configured providers. Migrate old `provider` field on read.

### Step 2: Provider detection module

**File**: `packages/maestro-cli/provider-detect.ts` (NEW)

- `findClaudeCli()` — shared with init-wizard (currently duplicated)
- `getClaudeAuthStatus(cliPath)` — runs `claude auth status --output json`
- `runClaudeLogin(cliPath)` — runs `claude login` interactively (opens browser)
- `ensureProviders()` — main orchestrator:
  - If no config → interactive provider selection (multi-select)
  - For Claude Code: auto-detect CLI, auto-run `claude login` if not authenticated
  - For others: collect credentials interactively
  - Save all to `~/.maestro/config.json`
  - Fast path: existing config + Claude auth valid → return immediately

### Step 3: Wire into `maestro code`

**File**: `packages/maestro-cli/cli.ts` (line ~6326)

```
await ensureProviders();  // NEW — before TUI launch
await ensureBackend();    // then start sidecar with all provider env vars
```

### Step 4: Update init-wizard

**File**: `packages/maestro-cli/init-wizard.ts`

- Import `findClaudeCli` from `provider-detect.ts` (remove duplicate)
- Use new multi-provider config structure

### Step 5: Backend safety net

**File**: `llm-provider/dotnet/src/LLMProvider.ClaudeCodeProvider/ClaudeCodeLLMProvider.cs`

Enhance `IsAvailableAsync()` to check `claude auth status` — return false if not authenticated.

### Step 6: Surface errors in TUI

**File**: `packages/maestro-code/services/SessionManager.ts`

Display provider errors visibly in conversation panel instead of silent hang.

## Files

| File | Action |
|------|--------|
| `packages/maestro-cli/config.ts` | MODIFY — multi-provider schema |
| `packages/maestro-cli/provider-detect.ts` | CREATE — ensureProviders + claude helpers |
| `packages/maestro-cli/cli.ts` | MODIFY — call ensureProviders() |
| `packages/maestro-cli/init-wizard.ts` | MODIFY — use shared code + new schema |
| `llm-provider/.../ClaudeCodeLLMProvider.cs` | MODIFY — auth check in IsAvailableAsync |
| `packages/maestro-code/services/SessionManager.ts` | MODIFY — surface errors |

## Verification

1. Fresh install: `maestro code` prompts for provider selection
2. Claude Code: `claude login` runs automatically if not authed
3. Multi-provider: Claude Code + Azure selected → both env vars passed to sidecar
4. Existing config: skip setup in < 1s
5. End-to-end: after setup, "allo" in TUI → agent responds
