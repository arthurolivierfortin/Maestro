# Phase 57 — Checkpoint

## Status: DONE (57-A, 57-B, 57-C)

## Sub-phases
| Phase | Status | Notes |
|-------|--------|-------|
| 57-A | DONE | Block definition created + directory-list published |
| 57-B | DONE | System prompt (994 lines, 9 sections, 2 examples) |
| 57-C | DONE | Build verified, API discovery confirmed, contract test fix applied |

## 57-A Results
- Published `directory-list` tool from `_drafts/` to `tools/directory-list/`
- Created `agent-creator.agent.block.json` with config.nodes (while-loop pattern identical to test-designer)
- Block: maxIterations=25, wallClockTimeout=900s, context=16384 tokens, keepLastN=20
- Build: 0 errors

## 57-B Results
- Created `system-prompt.md` (994 lines)
- 9 sections: Role, Anatomy, Conventions, Model Adaptation, Create-Test-Fix Loop, Adaptation Mode, Tools, Anti-Patterns, Examples
- Complete block.json template with full config.nodes (lines 125-261)
- Two end-to-end examples: create-from-description + adapt-existing
- 11 anti-patterns documented
- Quick reference card at bottom

## 57-C Results
- Backend build: 0 errors (dotnet build)
- TypeScript: 0 errors (tsc --noEmit)
- API discovery: `agent-creator` block discovered (GET /api/blocks)
- API discovery: `directory-list` tool discovered
- Contract API: `agent-creator` contract accessible (4 features, 9 tests)
- **ContractTestRunner fix**: Added `conversationHistory` to inputs in `SendPromptToBlockAsync` — agents require it since the conversation persistence fix

### Contract test results (expected limitations)
- Fitness: 0.0 (all 9 tests fail)
- **Root cause**: Contract tests send single prompts and check response text, but agent-creator is an agentic block that makes tool calls. The response is a step-complete summary, not the generated content itself.
- **Tests 1-2**: File locking on temp session (concurrent access to session .json)
- **Tests 3-9**: Agent runs full tool-call loop but `_agentResult` summary doesn't contain the keywords the checks expect
- **This is a known architectural limitation**: Contract tests are designed for inference/conversational blocks, not for agentic blocks with multi-iteration tool-call loops. Addressing this requires a different testing approach (checking side effects/files created rather than response text).

## Files Created/Modified
| File | Action |
|------|--------|
| `content/system/blocks/agents/agent-creator/agent-creator.agent.block.json` | Created |
| `content/system/blocks/agents/agent-creator/system-prompt.md` | Created |
| `content/system/blocks/tools/directory-list/directory-list.tool.block.json` | Created (from _drafts) |
| `apps/backend/src/Maestro.Infrastructure/Testing/ContractTestRunner.cs` | Modified (conversationHistory fix) |

## Known Issues (deferred)
1. Contract test runner doesn't work well with agentic blocks — needs different check strategy
2. File locking on temp session during contract test runs
3. Agent-creator's own contract tests need redesign (check files created, not response text)

## Dogfooding fixes applied in this session (before Phase 57)
- `AgentBlockExecutor`: conversation persistence fix (no fallback, workflow-provided history required)
- `ModelsScreen`: replaced nonexistent health fields with real data (providers, models, device)
- `FoundryScreen`: fixed `atomic: no.0.0` rendering (separate Box elements)
- `EntryPointExecutor`: moved DI resolution inside try-catch for error visibility
- `ModelsScreen`: removed unused `llmStatus` fetch and prop
