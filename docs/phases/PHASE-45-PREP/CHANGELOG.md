# Phase 45-PREP Changelog

## 2026-03-02 — Bug Fixes Post-Dogfooding (6 bugs)

### Bug 3 (CRITICAL): Conversation Persistence
**Problem:** Agent lost ALL conversation context between invocations. Each workflow run created a new IConversationManager conversation, then cleaned it up at the end. Multi-turn interactions (plan → confirm → execute) were completely broken.

**Fix:** Deterministic conversation ID based on `sessionId:blockId`. The same agent in the same session now reuses its conversation across invocations. Cleanup is skipped for persistent conversations.

**Files:**
- `apps/backend/src/Maestro.Application/Interfaces/IConversationManager.cs` — Added `CreateOrGetConversation(string conversationId, string? systemPrompt)` method
- `apps/backend/src/Maestro.Infrastructure/Context/InMemoryConversationManager.cs` — Implemented `CreateOrGetConversation` with `ConcurrentDictionary.TryAdd`
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — Uses deterministic ID when `sessionId` is in context, skips history seeding for existing conversations, skips cleanup for persistent conversations (3 cleanup sites updated)

### Bug 4 (CRITICAL): Security Path Validation Blocks Agent Reads
**Problem:** `PathValidator.IsPathUnderRoot` was applied to ALL filesystem operations (read, write, list, edit). An agent in a Cantante session couldn't read Maestro files (e.g., block definitions, CLI code) because they're outside the session root.

**Fix:** Wired existing `ContextPermissions.AllowedPaths` from session domain entity into `ToolBlockExecutor`. Read/list operations outside workingDir are now allowed if the path matches `AllowedPaths`. Write/edit operations outside workingDir are ALWAYS blocked. Sessions default to `ContextPermissions.Full` (AllowedPaths=["*"]).

Added session permissions API endpoint and CLI command so the agent can request permission changes (with user confirmation per system prompt rules).

**Security model:**
- Write/edit outside workingDir → ALWAYS rejected
- Read/list outside workingDir → allowed only if path is in `AllowedPaths`
- Agent CAN modify permissions via `session permissions add-path` CLI command, but this requires user confirmation (confirmation rule)
- Permissions are a domain property on `ContainerSession`, not a session variable — cannot be changed via `session vars set`

**Files:**
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — Passes `session.GetEffectivePermissions().AllowedPaths` to execution context as `_permissions_allowedPaths`
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` — Checks AllowedPaths for read operations outside workingDir. Added `ExecutionContext` parameter to `HandleFilesystemOperationAsync`
- `apps/backend/src/Maestro.Api/Controllers/SessionsController.cs` — Added `GET/PUT /api/sessions/{id}/permissions` endpoints
- `packages/maestro-cli/cli.ts` — Added `session permissions [list|add-path|remove-path]` subcommand
- `content/system/blocks/system/maestro-assistant/system-prompt.md` — Added permissions CLI reference

**Tests added:**
- `FileRead_OutsideWorkingDir_AllowedByWildcardPaths` — read succeeds with AllowedPaths=["*"]
- `FileWrite_OutsideWorkingDir_BlockedEvenWithWildcardPaths` — write blocked even with wildcard
- `FileRead_OutsideWorkingDir_BlockedWithEmptyAllowedPaths` — read blocked with empty paths
- `FileRead_OutsideWorkingDir_AllowedBySpecificPath` — read succeeds with specific allowed dir

### Bug 1 (HIGH): Template Import Fails on Null Values
**Problem:** `maestro-assistant.session.json` had `"_activeConversation": null`. The API's `SetVariableRequest` has `required object Value` which rejects null with HTTP 400. The CLI `importSessionTemplate` crashed silently.

**Fix:** Migrated `null` → `""` in template. CLI now warns visibly when encountering null values during import and skips them instead of crashing.

**Files:**
- `content/system/templates/sessions/maestro-assistant.session.json` — Changed `"_activeConversation": null` → `"_activeConversation": ""`
- `packages/maestro-cli/cli.ts` — Added null check with warning in `importSessionTemplate` loop

### Bug 2 (HIGH): Conditional Evaluates Empty String as "Not Null"
**Problem:** Workflow condition `{{_activeConversation}} != null` failed because missing variables resolve to `""` (empty string) via `ResolveTemplate`. String comparison `"" != "null"` → True, so conversation creation was skipped even when no conversation existed.

**Fix:** Changed condition to `!= ""` which correctly handles both missing variables and empty strings.

**File:**
- `content/system/blocks/workflows/maestro-assistant-workflow.block.json` — Changed condition from `{{_activeConversation}} != null` to `{{_activeConversation}} != `

### Bug 5 (CRITICAL): Agent Re-greets Every Turn
**Problem:** Agent presented itself from scratch on every user message instead of continuing the conversation.

**Fix:** No separate fix needed — this was a symptom of Bug 3. With conversation persistence, the agent sees all prior messages and continues naturally.

### Bug 6 (LOW): Third-Person Summaries
**Problem:** `step-complete` summaries sometimes used third person ("Informed the user that..." instead of "J'ai cree le workspace X").

**Fix:** Added rule 14 to system prompt requiring direct address in summaries.

**File:**
- `content/system/blocks/system/maestro-assistant/system-prompt.md` — Added rule 14

---

## 2026-03-02 — Sub-phases A-E

See `checkpoint.md` for detailed sub-phase results. Summary:
- **A (Security):** PathValidator, workingDir validation, 10 security tests
- **B (TUI Scroll + Errors):** Error display, agent error state
- **C (Conversations):** Persistent conversation history, /new, /clear
- **D (Slash Commands):** /status, enriched /help
- **E (Agent Quality):** System prompt rewrite (2.9k → 9.1k chars, orchestrator identity)
- **F (Dogfooding):** 1h10 session, score 3.2/5, 6 bugs found, all now fixed
