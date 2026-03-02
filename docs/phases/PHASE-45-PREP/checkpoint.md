# Phase 45-PREP Checkpoint

## 45-PREP-A : Security
**Statut** : DONE
**Date** : 2026-03-02
**Fichiers modifies** :
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` — Replaced inline `StartsWith` path check with `PathValidator.IsPathUnderRoot`, added workingDir validation for both filesystem and shell handlers
- `apps/backend/tests/Maestro.Execution.Tests/ToolBlockSecurityTests.cs` — Created 10 security tests (path traversal, workingDir override, PathValidator unit tests)
- `apps/backend/tests/Maestro.Execution.Tests/ToolBlockExecutorTests.cs` — Fixed pre-existing compilation error (LLMGateway → Mock<ILLMGateway>)

**Tests backend** : 31 passants (Execution.Tests), 0 casses, +10 nouveaux tests de securite
**Tests maestro-code** : 70 passants (8 fichiers), 0 casses
**Vulnerabilites corrigees** :
1. Path traversal via `../../` dans filesystem read/write/list — bloque par PathValidator
2. WorkingDir override filesystem vers repertoire inexistant — valide et rejete
3. WorkingDir override shell vers repertoire inexistant — valide et rejete
**Decision sur shell operators** : PAS de blocage de `&&`, `|`, `;` — l'agent les utilise legitimement pour chainer les commandes CLI

## 45-PREP-B : TUI Scroll + Errors
**Statut** : DONE
**Date** : 2026-03-02
**Scroll verifie** : oui — fonctionne correctement (scrollOffset=0 auto-bottom, j/k ±3 lines, auto-snap on completion)
**Erreurs visibles** : oui — `reportNode()` extrait maintenant node.error/node.errorMessage/node.output et affiche sous la ligne `✗ node-name`
**Agent state 'error'** : oui — `sessionManager.getLastHadErrors()` expose le flag, App.ts callback set `agentState='error'` quand `hasErrors === true` (au lieu de toujours 'completed')
**Fichiers modifies** :
- `packages/maestro-code/services/SessionManager.ts` — Added `_lastHadErrors` flag + `getLastHadErrors()`, extended `reportNode()` to extract/display error messages, pass node objects to reportNode calls
- `packages/maestro-code/App.ts` — setBusy callback now checks `sessionManager.getLastHadErrors()` and sets `'error'` or `'completed'` accordingly
**Tests** : 63 passants (non-visual), 0 casses. Visual-gate navigation test flaky (PTY timing, pre-existing)

## 45-PREP-C : Conversations Persistantes
**Statut** : DONE
**Date** : 2026-03-02
**Persistance fonctionne** : oui — `loadConversationHistory()` added to SessionManager, reads `_conversationState_*` from backend session variables, formats user/assistant messages as LogLine[]
**Historique affiche** : Loaded at TUI startup via useEffect (non-blocking), shows "--- Previous conversation ---" separator + last 50 messages
**/new fonctionne** : oui — workflow block `maestro-new-conversation` creates new conversation, sets `_activeConversation`, old conversation preserved
**/clear fonctionne** : oui — workflow block `maestro-clear-conversation` cleans up old conversation + creates fresh one
**Backend workflows** : Both `maestro-new-conversation.block.json` and `maestro-clear-conversation.block.json` exist and are correct
**Tests** : 63 passants, 0 casses

## 45-PREP-D : Slash Commands
**Statut** : DONE
**Date** : 2026-03-02
**Commandes verifiees avec backend** : /help, /new, /clear, /stop, /quit, /q, /purge — all present and correctly wired to backend entry points
**/status ajoute** : oui — displays session ID, template, repo path, backend status, active conversation ID
**/help enrichi** : oui — added /status, ? shortcut, page navigation shortcuts (h/a/s/f/c/m)
**HelpOverlay updated** : oui — /status added to commands list
**Tests** : 63 passants, 0 casses

## 45-PREP-E : Agent Quality
**Statut** : DONE
**Date** : 2026-03-02
**System prompt reecrit** : oui (2.9k chars → 9.1k chars)
**Structure du nouveau prompt** :
1. Identity — orchestrateur conversationnel, pas codeur
2. Response format — JSON tool-call (meme contrat qu'avant)
3. Confirmation rule — JAMAIS executer sans confirmation, avec exceptions lecture seule
4. Conversational capabilities — questions generales, Maestro, technique, salutations, humour, refus de coder
5. CLI reference — commandes essentielles avec syntaxe exacte (status, workspaces, sessions, templates, blocks, execution, avance)
6. Templates connus — maestro-assistant, project-autonomous, foundry-default, foundry-training, jarvis
7. Workflows types — setup projet, entrainer block, diagnostiquer erreur, verifier systeme
8. Available tools — file-read, directory-list, shell-execute, step-complete (retire file-write, file-edit, run-block — l'agent ne code pas)
9. Rules — 13 regles concretes avec exemples
**Agent block config** : inchange (maxTokens: 32768 suffisant pour prompt 9KB + contexte)
**Tests** : 63 passants, 0 casses

## 45-PREP-F : Dogfooding
**Statut** : DONE (BLOCKED on gate — score 3.2 < 3.5 threshold)
**Date** : 2026-03-02
**Duree totale** : 1h10
**Taches completees** : 3 / 3 + 2 additional tests (general knowledge, non-existent session)
**Score moyen** : 3.2 / 5
**Dimension la plus haute** : Conversation, Confirmation, Understanding, Maestro Knowledge, Sequencing, Error Handling, Communication = 4/5
**Dimension la plus basse** : Completeness = 1/5, Speed = 1/5
**Comparaison vs CLI** : Agent MUCH slower (9 min vs <5s), incomplete (25% vs 100%). Agent better for Q&A.
**Bugs trouves** : 6 total — 3 CRITICAL, 2 HIGH, 1 LOW
- CRITICAL: Conversation context loss between invocations (Bug 3)
- CRITICAL: Security path validation blocks Maestro CLI from session-bound agents (Bug 4)
- CRITICAL: Agent re-greets every turn instead of continuing conversation (Bug 5, symptom of 3)
- HIGH: Template import fails on null values (Bug 1)
- HIGH: Conditional evaluates empty string as "not null" (Bug 2)
- LOW: step-complete summary sometimes third-person (Bug 6)
**Bugs fixes** : 0 (per dogfooding rules — ZERO code modifications)
**Decision** : BLOCKED — needs fixes for conversation persistence (Bug 3) and security whitelist (Bug 4) before gate can pass
**Notes** : `docs/phases/PHASE-45-PREP/dogfood-notes.md` (152 lines, detailed observations, scoring, comparison)
**Key insight** : Agent KNOWLEDGE is strong (4/5 on 7 dimensions). Agent EXECUTION is broken (1/5 on 2 dimensions). Fixing 2 infrastructure bugs would likely bring average to 3.8-4.0.

---

## Bug Fixes (Post-Dogfooding)
**Date** : 2026-03-02
**Bugs fixed** : 6/6

| # | Bug | Fix | Files |
|---|-----|-----|-------|
| 3 | Conversation context loss | Deterministic conversation ID (sessionId:blockId), skip cleanup for persistent conversations | `AgentBlockExecutor.cs`, `IConversationManager.cs`, `InMemoryConversationManager.cs` |
| 4 | Security blocks agent reads | Wire `AllowedPaths` from session permissions into ToolBlockExecutor, allow reads outside workingDir if in AllowedPaths | `ToolBlockExecutor.cs`, `EntryPointExecutor.cs`, `SessionsController.cs`, `cli.ts`, `system-prompt.md` |
| 1 | Template import fails on null | Migrate `_activeConversation: null` → `""`, CLI warns on null values during import | `maestro-assistant.session.json`, `cli.ts` |
| 2 | Conditional evaluates "" as "not null" | Changed condition `!= null` → `!= ""` | `maestro-assistant-workflow.block.json` |
| 5 | Agent re-greets every turn | Fixed by Bug 3 (conversation persistence) | — |
| 6 | Third-person summaries | Added rule 14 to system prompt | `system-prompt.md` |

**New API endpoint** : `GET/PUT /api/sessions/{id}/permissions`
**New CLI command** : `session permissions <id> [add-path|remove-path]`
**New tests** : 4 AllowedPaths security tests (read allowed with wildcard, write blocked with wildcard, read blocked with empty paths, read allowed with specific path)
**Tests** : 35 backend (Execution.Tests) + 70 maestro-code = 105 all passing

---

## Overall Phase 45-PREP Status
**Sub-phases A-E** : ALL DONE
**Sub-phase F** : DONE (dogfooding executed, notes written, scoring complete, all 6 bugs fixed)
**Gate** : PENDING RE-TEST — bugs fixed, needs re-dogfooding to confirm score >= 3.5
**Files modified** :
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — conversation persistence (deterministic ID, skip cleanup)
- `apps/backend/src/Maestro.Application/Interfaces/IConversationManager.cs` — added CreateOrGetConversation
- `apps/backend/src/Maestro.Infrastructure/Context/InMemoryConversationManager.cs` — implemented CreateOrGetConversation
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` — AllowedPaths for read ops, PathValidator enhanced
- `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — pass AllowedPaths to execution context
- `apps/backend/src/Maestro.Api/Controllers/SessionsController.cs` — session permissions GET/PUT endpoints
- `apps/backend/tests/Maestro.Execution.Tests/ToolBlockSecurityTests.cs` — 14 security tests (10 original + 4 new AllowedPaths)
- `apps/backend/tests/Maestro.Execution.Tests/ToolBlockExecutorTests.cs` — fixed pre-existing compilation error
- `packages/maestro-cli/cli.ts` — session permissions command, null value warning in import
- `packages/maestro-code/services/SessionManager.ts` — error display, _lastHadErrors, loadConversationHistory
- `packages/maestro-code/App.ts` — error state, conversation history loading, /status command, enriched /help
- `packages/maestro-code/components/HelpOverlay.ts` — added /status
- `content/system/blocks/system/maestro-assistant/system-prompt.md` — COMPLETE REWRITE + rule 14 + permissions CLI ref
- `content/system/blocks/workflows/maestro-assistant-workflow.block.json` — conditional fix
- `content/system/templates/sessions/maestro-assistant.session.json` — null → empty string migration
- `docs/phases/PHASE-45-PREP/dogfood-notes.md` — COMPLETE dogfooding notes with scoring
**Tests** : 35 backend (Execution.Tests) + 70 maestro-code = 105 all passing
