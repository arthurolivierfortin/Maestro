# 60-T : Tests — Playground complet

---

## Lecture obligatoire

- `docs/system/TESTING-PROTOCOL.md` — 6 couches
- `packages/maestro-code/tests/` — patterns de tests existants
- `apps/backend/tests/Maestro.Execution.Tests/` — patterns tests backend

---

## Couches applicables

| Couche | Applicable | Description |
|--------|-----------|-------------|
| C1 — Type Check | OUI | `dotnet build` + `npx tsc --noEmit` |
| C2 — Unit tests | OUI | Parsing /playground, validators, SDK domain |
| C3 — Visual Gate | OUI | PlaygroundView render, Model Detail render |
| C5 — Integration | OUI | POST /api/playground avec modele reel |
| C6 — E2E Dogfooding | OUI | Verification visuelle MCP |

---

## Tests backend (10 tests)

`apps/backend/tests/Maestro.Execution.Tests/PlaygroundTests.cs`

| # | Test | Description |
|---|------|-------------|
| 1 | PlaygroundController retourne reponse | POST /api/playground avec prompt simple |
| 2 | PlaygroundController retourne tokens | promptTokens + completionTokens > 0 |
| 3 | PlaygroundController retourne cost | costUsd > 0 (si pricing configure) |
| 4 | PlaygroundController retourne latency | latencyMs > 0 |
| 5 | PlaygroundController modele invalide | Retourne 400 ou 404 |
| 6 | CapabilityTestDefinitions retourne 6 tests | GET /api/playground/tests |
| 7 | Validator JSON — valide | JSON valide avec champs requis → pass |
| 8 | Validator JSON — invalide | Texte non-JSON → fail |
| 9 | Validator contains — match | Reponse contient le texte attendu → pass |
| 10 | Validator tool-call — format correct | JSON avec tool/args → pass |

---

## Tests TUI (10 tests)

`packages/maestro-code/tests/PlaygroundSlash.test.ts`

| # | Test | Description |
|---|------|-------------|
| 1 | `/playground` parse sans modele | `{ action: 'select-model' }` |
| 2 | `/playground gpt-4o` parse avec modele | `{ action: 'playground', modelId: 'gpt-4o' }` |
| 3 | `/playground` dans /help | Visible dans la liste des commandes |
| 4 | PlaygroundView render initial | Affiche quick tests [1-6] et instruction / |
| 5 | PlaygroundView apres test | Affiche resultat ✓/✗ avec details |
| 6 | PlaygroundView custom prompt | Affiche prompt + reponse + tokens |
| 7 | Model Detail render | Affiche specs, pricing, usage, [T] |
| 8 | Models list affiche modeles | Au moins 1 modele visible |
| 9 | CLI --list-tests | 6 tests retournes |
| 10 | CLI --test-all format | Score X/6 affiche |

---

## Verification visuelle (OBLIGATOIRE, via MCP tui-dogfood)

| # | Scenario | Verification |
|---|----------|-------------|
| V1 | Page Models liste les modeles | Au moins 1 modele visible avec provider |
| V2 | Enter sur modele → Model Detail | Specs + pricing visibles |
| V3 | [T] dans Model Detail → Playground | Quick tests [1-6] visibles |
| V4 | [1] dans Playground → test structured output | Resultat ✓/✗ affiche |
| V5 | / dans Playground → custom prompt | Reponse affichee avec tokens + cout |
| V6 | /playground depuis Agent → Playground | Liste modeles puis playground |
| V7 | [M] dans Playground → changer modele | Nouveau modele selectionne |
| V8 | [Esc] dans Playground → retour | Retour a Model Detail ou Agent |

---

## Verification

```bash
# Build
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# 0 erreurs

# Type check TUI
cd C:\Meastro\packages\maestro-code && npx tsc --noEmit
# 0 erreurs

# Tests backend
dotnet test C:\Meastro\apps\backend\tests\Maestro.Execution.Tests\Maestro.Execution.Tests.csproj --filter "Playground"
# 10/10 pass

# Tests TUI
cd C:\Meastro\packages\maestro-code && npx vitest run tests/PlaygroundSlash.test.ts
# 10/10 pass

# Full suite
cd C:\Meastro\packages\maestro-code && npx vitest run
# Pas de regression

# Verification visuelle
# Via MCP tui-dogfood : scenarios V1-V8
```

---

## Checkpoint

```markdown
## 60-T : Tests playground
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Tests backend** : X/10 pass
**Tests TUI** : X/10 pass
**Verification visuelle** : X/8 scenarios valides
**Regression** : 0
```
