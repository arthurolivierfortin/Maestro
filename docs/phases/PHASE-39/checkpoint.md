# Phase 39 — Checkpoint

## 39-A : `maestro adapt`
**Statut** : DONE
**Commande** : `maestro adapt <workflow-or-block-id> --sandbox <id> [options]`
**Options** : `--threshold <0-1>` (default 0.80), `--dry-run`, `--save`, `--checkpoints`, `--input-key`, `--input`, `--json`
**Flow** : extractManifest → detectModels → display availability → testSubstitutions → generateTier
**Model override** : Uses `inputs["model"]` override (ResolveModelId checks inputs first), no variant block needed
**Manifest extraction** : Recursive traversal of config.model (atomic) + config.nodes[].config.model (composite) + blockRef (workflows)
**Handles** : circular refs (visited set), missing blocks (graceful unknown), nested control flow (while, conditional, for-each)
**E2E verified** : OUI — dry-run shows manifest + availability, full run tests 7 blocks with 7 substitutions accepted (100%)
**Tests** : 12 (extractManifest: 5, flattenModels: 2, collectModelBlocks: 2, detectModels: 3)

## 39-B : `maestro optimize`
**Statut** : DONE
**Commande** : `maestro optimize <block-id> --sandbox <id> [options]`
**Options** : `--strategy <name>` (default model-downgrade), `--threshold`, `--recursive`, `--checkpoints`, `--save`, `--input`, `--json`
**Strategies** : `model-downgrade` (test cheaper models via input override), `temperature-tuning` (test temp values via filesystem variant)
**Recursive mode** : `--recursive` extracts manifest, sorts bottom-up, optimizes each leaf block
**withBlockVariant** : Filesystem-based — writes .block.json co-located with original, waits for FileSystemWatcher discovery (5s polling), runs test, cleans up in finally
**Critical fix** : Must delete `config.path` from variant JSON before writing — System.Text.Json deserializes strings as JsonElement, and `GetBlockPath()` checks `p is string` which fails for JsonElement. Without this, variant blocks can't find companion files (system-prompt.md).
**E2E verified** : OUI — model-downgrade tested 5 models, recommended haiku (100%); temperature-tuning tested 4 temps, all 100%
**Tests** : 4 (withBlockVariant: 3, STRATEGIES: 1)

## Architecture Decisions
- **CLI-side orchestration** (like batchTestBlock), NOT backend workflow blocks
- **Model substitution via input override** (ResolveModelId at LLMBlockExecutorBase.cs:91-100 checks inputs["model"] first)
- **Temperature/config changes via filesystem variant** (no input override available for temperature)
- **Co-location strategy** for variants: written next to original block file so companion files (system-prompt.md) are found
- **No backend changes** — all logic in CLI TypeScript

## Dette architecturale (honnete — ajoute 2026-02-23)

### Strategies ne sont PAS des blocs
Le README planifiait : "Les strategies sont des BLOCS" et "Ajouter une strategie = creer un .block.json".
La realite : `STRATEGIES` est un objet TypeScript dans `adapt-optimize.ts:899-902` mappant des noms vers des fonctions.
Ajouter une strategie = modifier du TypeScript, pas creer un JSON.
**Raison** : transformer en blocs necessite un nouveau type d'executor cote backend — hors scope Phase 39.
**Cible** : Phase 42+ (catalogue communautaire, ou les strategies doivent etre partageables).

### Evaluateur heuristique (Niveau 1) non implemente
Le README planifiait : "L'evaluateur heuristique (Niveau 1) fonctionne sans LLM".
La realite : `detectModels()` requiert le service LLM-Provider actif. Pas de fallback heuristique.
La mesure de fitness utilise `batchTestBlock()` (Phase 38) qui execute reellement le bloc — plus fiable qu'une heuristique, mais requiert un LLM.
**Raison** : le batch testing via sandbox est superieur a une heuristique naive. L'heuristique serait utile comme fallback offline.
**Cible** : Phase 40-D (beta testing revelera si des utilisateurs sans LLM local en ont besoin).

## Files
| File | Status | Lines |
|------|--------|-------|
| `packages/maestro-cli/adapt-optimize.ts` | NEW | ~1015 |
| `packages/maestro-cli/cli.ts` | MODIFIED | +60 (adapt/optimize command dispatch + help) |
| `packages/maestro-cli/tests/adapt-optimize.test.ts` | NEW | ~375 |

## Test Summary
- **Unit tests** : 16/16 passing
- **Sandbox tests** : 22/22 passing (no regression)
- **E2E adapt dry-run** : OK (manifest + model availability display)
- **E2E adapt full** : OK (7 blocks, 7 substitutions accepted)
- **E2E optimize model-downgrade** : OK (5 models tested, haiku recommended)
- **E2E optimize temperature-tuning** : OK (4 temps tested, all 100%)
