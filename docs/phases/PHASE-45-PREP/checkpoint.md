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
**Sub-phase F** : DONE (first dogfooding: 3.2/5, 6 bugs fixed)
**Sub-phase F Retest** : DONE — Round 1: 1.1/5 (BUG-1), Round 2: 1.3/5 (BUG-5), **Round 3: 3.5/5 (PASS)**
**Post-gate bug fixes** : DONE — BUG-2/3/4 + truncation fixed and verified (Round 4)
**Gate** : **PASS** — Score 3.5/5, all bugs fixed, all pages functional, agent responses visible.
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

## Post-Gate Bug Fixes (2026-03-02)

Bugs BUG-2, BUG-3, BUG-4, + Truncation fixes applied immediately after gate pass.

| Bug | Fix | Files |
|-----|-----|-------|
| BUG-2: /help blank | HelpOverlay as page replacement (removes position:absolute) | `HelpOverlay.ts`, `App.ts` |
| BUG-3: Spaces blank | Remove duplicate `a` key, `r` toggle filter | `SpacesScreen.ts` |
| BUG-4: Pages no content | Resolved by BUG-2 fix (HelpOverlay position) | verified via visual gate |
| Truncation | Removed `.slice(0,20)` and `.slice(0,10)` limits | `SessionManager.ts` |

**Verification Round 4** : All pages verified via TuiDriver PTY
- Spaces: 40 lines, 5 sessions with status/fitness/duration
- Home: SYSTEM STATUS + ACTIVE SESSIONS + QUICK ACTIONS
- Foundry: MY BLOCKS — 12 blocks by type
- Catalog: BLOCK CATALOG — 12 blocks with fitness scores
- Models: MODEL STATUS + 6 available models (cloud/local)
- /help: 33 lines in real mode (full keyboard shortcuts + commands)
- BUG-5: Still fixed (Agent: prefix, no metadata, real content)

**Tests** : 70/70 maestro-code (tsc + vitest + visual gate + real-demo-check)

---

## 45-PREP-F Retest : Dogfooding Gate (Checkpoint etendu)

### Round 1 (pre-fix) — BLOQUE (1.1/5)
**Statut** : BUG-1 bloquait toute conversation
**Cause** : `EvaluateSimpleComparison` dans `EntryPointExecutor.cs` : `idx > 0` au lieu de `idx >= 0`
**Fix** : 1 ligne changee. Build OK. 93 tests backend passent.

### Round 2 (post-fix) — BLOQUE (UX 1.3/5, backend 4.2/5)
**Date** : 2026-03-02
**Testeur** : Agent externe (premier contact, boite noire)
**Outil** : TuiDriver PTY (mode real)
**Duree** : ~1h15 (2 rounds)
**Taches completees** : 5/5 backend OK, 0/5 visibles dans TUI

### Scoring Post-Fix (perspective utilisateur TUI)

| Dimension | Score | Justification |
|-----------|-------|---------------|
| Conversation | 1/5 | Reponses invisibles dans TUI — agent muet |
| Confirmation | 1/5 | "Ca te va ?" invisible — utilisateur ne sait pas qu'on attend sa reponse |
| Understanding | 1/5 | Aucune preuve visible de comprehension |
| Maestro knowledge | 1/5 | Connaissance invisible = inexistante pour l'UX |
| Operation sequencing | 2/5 | Logs ✓/✗ visibles — seule chose fonctionnelle |
| Completeness | 1/5 | Aucune tache n'aboutit visuellement |
| Error handling | 2/5 | ✗ visibles, mais explication agent invisible |
| Speed | 2/5 | 30-105s pour un resultat invisible |
| Communication | 1/5 | Agent communique parfaitement — mais TUI ne transmet rien |
| Daily use | 1/5 | Inutilisable |
| **MOYENNE UX** | **1.3 / 5** | |
| **MOYENNE BACKEND** | **~4.2 / 5** | (verifie via curl — reponses excellentes) |

**Dimension la plus haute** : Operation sequencing, Error handling, Speed = 2/5
**Dimension la plus basse** : 7 dimensions a 1/5
**Ecart UX/backend** : 2.9 points — entierement du a BUG-5 (reponses non affichees)

### Comparaison vs CLI Manuel

| Methode | Temps | Resultat |
|---------|-------|----------|
| Agent maestro-code | 105s | Plan correct, attend confirmation |
| CLI manuel | 30s | Execution directe |

Agent meilleur pour : questions, decouverte, gestion d'erreurs. CLI meilleur pour : execution directe, operations repetitives.

### Bugs (cumules)

| ID | Severite | Description | Statut |
|----|----------|-------------|--------|
| BUG-1 | BLOQUANT | `Conversation '' not found.` | **FIXE** (`idx > 0` → `idx >= 0`) |
| BUG-2 | Mineur | /help ecran blanc | OUVERT |
| BUG-3 | Majeur | Page Spaces ecran blanc | OUVERT |
| BUG-4 | Majeur | Pages Home/Foundry/Catalog/Models sans contenu | OUVERT |
| BUG-5 | MAJEUR | Reponses agent invisibles dans TUI (visible uniquement via curl) | **NOUVEAU** |

### Decision (Round 2)

**Score moyen UX 1.3 < 3.0 → BLOQUE**

BUG-1 corrige (conversation fonctionne). BUG-5 decouverte (reponses invisibles dans TUI).
Backend excellent (~4.2/5). UX inutilisable (1.3/5). Corriger BUG-5 puis re-dogfood.

### Round 3 (post-BUG-5 fix) — PASS (3.5/5)
**Date** : 2026-03-02
**Bug corrige** : BUG-5 — `SessionManager.ts` reecrit pour prioriser le noeud `execute-agent` et filtrer les metadonnees
**Session** : 6f576083 (fresh)
**Taches** : 5/5 completees sans erreur. 3/5 reponses clairement visibles dans les frames PTY captures.
**Reponse visible Task 1** : "Salut ! Toujours la. Qu'est-ce que je peux faire pour toi ?"
**Reponse visible Task 2** : Plan 5 etapes + "Ca te va ?" (confirmation avant action)
**Reponse visible Task 3** : Liste categorisee de blocks (backend-developer, frontend-developer, etc.)

### Scoring Round 3

| Dimension | Score |
|-----------|-------|
| Conversation | 4/5 |
| Confirmation | 4/5 |
| Understanding | 4/5 |
| Maestro knowledge | 4/5 |
| Operation sequencing | 3/5 |
| Completeness | 3/5 |
| Error handling | 3/5 |
| Speed | 3/5 |
| Communication | 4/5 |
| Daily use | 3/5 |
| **MOYENNE** | **3.5 / 5** |

### Progression

| Round | Score | Bloqueur |
|-------|-------|----------|
| Round 1 | 1.1/5 | BUG-1 (conversation crash) |
| Round 2 | 1.3/5 | BUG-5 (reponses invisibles) |
| **Round 3** | **3.5/5** | Aucun bloqueur critique |

### Decision Finale

**Score moyen 3.5 >= 3.5 → CONDITIONAL PASS**

Le gate est atteint. L'agent est fonctionnel : repond visiblement, confirme avant d'agir, connait Maestro.
Bugs ouverts non-bloquants : BUG-2 (/help blanc), BUG-3 (Spaces blanc), BUG-4 (pages sans contenu).
Ces bugs ont ete fixes immediatement apres (voir section ci-dessous).

### Notes

`docs/phases/PHASE-45-PREP/dogfood-notes-retest.md` — rapport complet (700+ lignes, 3 rounds)

---

## Post-Gate Bug Fixes (2026-03-02)

Bugs BUG-2, BUG-3, BUG-4, + Response Truncation fixes applied immediately after gate pass.

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| BUG-2: `/help` blank | `HelpOverlay.ts` used `position: 'absolute'` which doesn't overlay in Ink terminal | Rendered HelpOverlay as page replacement (when `showHelp=true`, replaces `pageComponent` in switch); removed `position: 'absolute'` + `height: '100%'`, added `flexGrow: 1` |
| BUG-3: Spaces blank | `SpacesScreen.ts` duplicate `a` key — navigation spread overrides `a: setStatusFilter('all')` | Removed dead filter `a`, made `r` toggle between all/running, updated StatusFilter UI to single `[r]` toggle |
| BUG-4: Other pages Agent layout | Symptom of BUG-2 — HelpOverlay absolute positioning consumed layout space on all pages | Resolved by BUG-2 fix (verified by visual gate test: all 6 pages render correctly) |
| Truncation: 20-line cap | `SessionManager.ts` `.slice(0, 20)` + `.slice(0, 10)` hardcoded limits | Removed both limits; ConversationLog already handles scrolling |

**Files modified** :
- `packages/maestro-code/components/HelpOverlay.ts` — remove position:absolute, flexGrow:1, update spaces shortcut
- `packages/maestro-code/App.ts` — HelpOverlay as page replacement; hide TaskInputBar when showHelp
- `packages/maestro-code/components/SpacesScreen.ts` — remove dead `a` filter, `r` toggle, updated StatusFilter
- `packages/maestro-code/services/SessionManager.ts` — removed `.slice(0,20)` and `.slice(0,10)` truncation
- `packages/maestro-code/tests/visual-gate.test.ts` — updated Spaces filter assertion to match new `[r]` display

**Tests** : 70/70 maestro-code passants (tsc + vitest + visual gate + real-demo-check)
