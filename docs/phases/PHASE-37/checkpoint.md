# Phase 37 : Checkpoint

**Derniere mise a jour** : 2026-02-23 (cree retroactivement — ce checkpoint manquait)
**Sous-phase en cours** : TOUTES COMPLETEES
**Agent** : Checkpoint retro-ecrit a partir de CHANGELOG.md, code source, et tests

---

## 37-A : SDK client npm (@maestro/client)
**Statut** : DONE
**Date** : 2026-02-22
**Ce qui a ete fait** :
- Cree `packages/maestro-client/` — package npm complet
- `MaestroClient` class avec 16 modules domaine (health, blocks, sessions, variables, workspaces, projects, templates, llm, metrics, foundry, workflows, training, testing, runs, auth, filesystem)
- `HttpTransport` avec retry, timeout, auth headers
- `ApiError`, `ConnectionError`, `TimeoutError` — types d'erreur
- `ClientBlockRegistry` pour execution client-side de blocs
- `SignalRClient` pour events real-time (peer dep optionnel)
- 40+ types TypeScript exportes
**Verification** :
- Tests : 19/19 passing (`packages/maestro-client/tests/client.test.ts`)
- Build : TypeScript compile sans erreur
**Problemes** : Aucun

## 37-B : Mode sidecar (@maestro/sidecar)
**Statut** : DONE
**Date** : 2026-02-22
**Ce qui a ete fait** :
- Cree `packages/maestro-sidecar/` — process manager pour embedding Maestro
- `MaestroSidecar` class : start/stop backend + LLM-Provider comme child processes
- `findFreePort()` — allocation dynamique de port
- `waitForHealth()` — polling avec backoff exponentiel
- `detectMaestroRoot()` — auto-detection (env > relative > explicit)
- `tree-kill` pour cleanup process tree Windows
**Verification** :
- Tests : 5/5 passing (`packages/maestro-sidecar/tests/`)
**Problemes** : Aucun

## 37-C : Blocks audio (STT + TTS)
**Statut** : DONE
**Date** : 2026-02-22
**Ce qui a ete fait** :
- Cree `content/system/blocks/tools/speech-to-text/speech-to-text.tool.block.json`
- Cree `content/system/blocks/tools/text-to-speech/text-to-speech.tool.block.json`
- Ajoute executor generique `client-side` dans `ToolBlockExecutor.cs` (~10 lignes)
- Tout block avec `config.executorType: "client-side"` retourne `_clientSideExecution: true`
- L'app embedding implemente le handler via `ClientBlockRegistry` du SDK
**Verification** :
- Blocs decouverts par `FileSystemBlockDiscoveryService` : OUI
- Backend build : 0 erreurs
**Problemes** : Aucun
**Limitation connue** : Provider V1 = Web Speech API seulement. Whisper/piper-tts en Phase 41+.

## 37-D : Mode vocal dans maestro code
**Statut** : DONE
**Date** : 2026-02-22
**Ce qui a ete fait** :
- Ajoute `voice.toggle: 'Ctrl+v'` dans `packages/tui/keybindings/keybindings.ts`
- Ajoute state `voiceMode` et handler Ctrl+V dans `packages/maestro-code/App.ts`
- Cree `packages/maestro-code/audio/types.ts` — interface `AudioAdapter` + `NoopAudioAdapter`
- Cree `packages/maestro-code/components/VoiceIndicator.ts` — badge VOICE magenta
- StatusBar affiche "VOICE" quand actif, InputPrompt montre "Listening..."
**Verification** :
- Tests maestro-code : 31/32 passing (1 failure pre-existante dans headless.test.ts, non liee)
- Toggle compile et s'affiche dans le TUI
**Problemes** : Aucun
**Limitation connue** : V1 = UI state seulement (placeholder). Pas de capture audio reelle en Node.js terminal. La capture micro reelle viendra avec Electron en Phase 41.

## 37-E : Agent Jarvis (template generique)
**Statut** : DONE
**Date** : 2026-02-22
**Ce qui a ete fait** :
- Cree `content/system/blocks/agents/jarvis/jarvis.agent.block.json` — agent composite (`isAtomic: false`)
- Cree `content/system/blocks/agents/jarvis/system-prompt.md` — router d'intentions generique
- Cree `content/system/templates/sessions/jarvis.session.json` — template session avec entrypoint `ask`
- Suit le pattern dev-orchestrator : `config.nodes` avec child block inference (claude-sonnet-4-6)
- Tools dans le system prompt : file-read, directory-list, shell-execute, file-write, file-edit, run-block, step-complete
**Verification** :
- Block JSON valide et decouvert par backend
- Template JSON valide
**Problemes** : Aucun
**Limitation connue** : Pas teste en dispatch reel sur une tache. Le test d'integration viendra en Phase 41 avec Cantante.

---

## Migration CLI
**Ce qui a ete fait** :
- Cree `packages/maestro-cli/api-client.ts` — adapter type wrappant @maestro/client
- Modifie `packages/maestro-cli/cli.ts` — import depuis `api-client.ts`
- Supprime `packages/maestro-cli/api-client.js` (885 lignes de JS non type)
- Ajoute `@maestro/client` comme dependance CLI

---

## Fichiers crees (26)
- `packages/maestro-client/` — 20 fichiers (SDK)
- `packages/maestro-sidecar/` — 10 fichiers (sidecar)
- `content/system/blocks/agents/jarvis/` — 2 fichiers
- `content/system/blocks/tools/speech-to-text/` — 1 fichier
- `content/system/blocks/tools/text-to-speech/` — 1 fichier
- `content/system/templates/sessions/jarvis.session.json`
- `packages/maestro-code/audio/types.ts`
- `packages/maestro-code/components/VoiceIndicator.ts`
- `packages/maestro-cli/api-client.ts`

## Fichiers modifies (4)
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` — executor client-side
- `packages/tui/keybindings/keybindings.ts` — voice.toggle binding
- `packages/maestro-code/App.ts` — voice mode state + Ctrl+V handler
- `packages/maestro-cli/cli.ts` — changement d'import

## Fichiers supprimes (1)
- `packages/maestro-cli/api-client.js` — remplace par @maestro/client SDK type

---

## Resume des tests
| Package | Tests | Resultat |
|---------|-------|----------|
| @maestro/client | 19 | 19/19 pass |
| @maestro/sidecar | 5 | 5/5 pass |
| @maestro/tui | 40 | 40/40 pass |
| @maestro/monitor | 4 | 4/4 pass |
| maestro-code | 32 | 31/32 pass (1 pre-existant) |
| Backend C# | — | 0 erreurs, 0 warnings |

---

## Note retroactive
Ce checkpoint a ete cree le 2026-02-23 lors d'un audit de completion des phases 35-39.
Il manquait a l'origine — violation du protocole agent (AGENT-PROTOCOL.md Regle 3).
Le CHANGELOG.md existait et contenait toutes les informations factuelles.
