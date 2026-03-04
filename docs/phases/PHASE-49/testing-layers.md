# Phase 49 — Couches de tests

> Reference pour l'implementation de Phase 49. Chaque livrable doit etre valide par TOUTES les couches applicables.

---

## Couche 1 : Type Check (obligatoire pour TOUT changement)

**But** : Aucune regression de typage. Attrape les props manquantes, les imports casses, les interfaces incompatibles.

```bash
# maestro-code
cd packages/maestro-code && npx tsc --noEmit

# maestro-client (si modifie)
cd packages/maestro-client && npx tsc --noEmit

# maestro-sidecar (si modifie)
cd packages/maestro-sidecar && npx tsc --noEmit

# backend (si modifie)
cd apps/backend && dotnet build
```

**Regle** : JAMAIS de `@ts-nocheck`. Incident 2026-03-03 : `@ts-nocheck` a masque des props manquantes → first-run casse en production.

---

## Couche 2 : Tests unitaires (vitest)

**But** : Logique metier isolee — composants, services, utilitaires.

### Ce qui existe et doit continuer a passer

| Package | Commande | Tests |
|---------|----------|-------|
| maestro-code | `npm test` | ~69 (fast + visual) |
| maestro-client | `npm test` | 19 |
| maestro-sidecar | `npm test` | 5 |
| maestro-cli | `npm run test:all` | 16 |
| tui | `npx vitest run tests/` | 40 |
| maestro-monitor | `npx vitest run tests/` | 4 |

### Tests unitaires a CREER pour Phase 49

| Sous-phase | Composant | Tests a ecrire |
|------------|-----------|----------------|
| 49-A | `HardwareDetectScreen` | Render avec GPU detecte, render sans GPU, render CPU-only avec warning |
| 49-A | `ModelSelectScreen` | Render avec modeles recommandes, render vide (aucun modele compatible), selection + navigation j/k |
| 49-A | `AgentSelectScreen` | Render avec cloud+local, render local-only, pre-selection correcte |
| 49-A | `ProviderSetupScreen` (modifie) | Flow complet : hardware → providers → models → agent (en mode demo/mock) |
| 49-B | Schema capabilities | Validation JSON des capabilities dans les blocks |
| 49-C | `MetricsPanel` | Render avec donnees, render sans donnees (loading), render avec erreurs |
| 49-C | `QueuePanel` | Render avec queue active, render vide |
| 49-C | `ModelsScreen` (enrichi) | Layout 5 panels, download trigger, capabilities affichees |

**Pattern de test maestro-code** :
```typescript
import { createElement as h } from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
// JAMAIS h('ink:text', ...) — toujours h(Text, null, ...)
```

---

## Couche 3 : Visual Gate (PTY)

**But** : Valider le rendu REEL du TUI dans un vrai terminal. vitest ≠ app reelle.

```bash
cd packages/maestro-code && npm run test:visual
```

### Ce que le visual gate verifie

- Assertions structurelles par page (NavBar, panels, StatusBar)
- Detection de crash (stack traces dans la sortie)
- Regression clavier (touches de nav ne leakent pas dans l'input)
- Comparaison golden files (soft — warning, pas fail)

### Mises a jour necessaires pour Phase 49

| Changement | Action visual gate |
|------------|--------------------|
| Nouveaux ecrans de setup (hardware, model select, agent select) | Les ecrans de setup ne sont PAS testes par le visual gate (mode demo skip le setup). Pas de changement necessaire. |
| Page Models enrichie (MetricsPanel, QueuePanel) | **Mettre a jour les assertions structurelles** de la page Models : ajouter patterns pour METRICS, QUEUE panels |
| Golden file models.golden | **Regenerer** apres les changements : `npx tsx tests/update-golden.ts` |

---

## Couche 4 : Real Demo Check (module resolution)

**But** : Verifier que le vrai path d'import CJS → ESM fonctionne. Attrape les bugs invisibles a vitest.

```bash
cd packages/maestro-code && node tests/real-demo-check.cjs
```

### Quand l'executer pour Phase 49

- Apres TOUT ajout de nouveau composant (`HardwareDetectScreen.ts`, `ModelSelectScreen.ts`, etc.)
- Apres toute modification de `App.ts`
- Apres toute modification d'imports

**Pas de changement au script necessaire** — il teste le mode demo qui skip le setup.

---

## Couche 5 : Tests d'integration (backend reel)

**But** : Valider les endpoints API et les workflows de bout en bout avec un vrai backend.

```bash
cd packages/maestro-integration-tests && npm test
```

### Tests existants (31) qui doivent continuer a passer

- Level 1 (API) : health, sessions, variables, blocks, templates
- Level 2 (Workflow) : new-conversation, clear-conversation, variable propagation
- Level 3 (Pipeline) : first-message, new-then-message, second-message

### Tests d'integration a CREER pour Phase 49

| Sous-phase | Test | Niveau | Description |
|------------|------|--------|-------------|
| 49-A | `hardware-capabilities.test.ts` | L1 | `GET /api/v1/system/capabilities` retourne GPU/RAM/CPU |
| 49-A | `recommended-models.test.ts` | L1 | `GET /api/v1/models/recommended` retourne des modeles filtres |
| 49-A | `model-download.test.ts` | L1 | `POST /api/v1/models/download` accepte un model_id (mock — pas de vrai download en CI) |
| 49-B | `block-capabilities.test.ts` | L1 | Les blocks `maestro-assistant` et `maestro-assistant-compact` ont `metadata.capabilities` |
| 49-C | `llm-stats.test.ts` | L1 | `GET /api/v1/stats` retourne des metriques valides |
| 49-C | `llm-queue.test.ts` | L1 | `GET /api/v1/stats/queue` retourne des stats de queue |

**Note** : Les tests d'integration pour les endpoints LLM-Provider dependent du Python server. Si le Python server ne demarre pas (pas de Python/torch installe), ces tests doivent etre **skipped gracefully**, pas fail.

---

## Couche 6 : E2E Dogfooding (MCP tui-dogfood)

**But** : Validation de l'experience utilisateur complete. Un agent interagit avec le vrai TUI, prend des notes, produit un rapport.

### Outils MCP disponibles

| Outil | Usage |
|-------|-------|
| `tui_spawn` | Lancer le TUI en mode demo ou real |
| `tui_frame` | Capturer l'ecran actuel |
| `tui_press` | Envoyer une touche |
| `tui_type` | Taper du texte |
| `tui_wait` | Attendre qu'un texte apparaisse |
| `tui_stable` | Attendre que l'ecran se stabilise |
| `tui_check` | Verifier la presence d'un texte |
| `tui_note` | Enregistrer une observation |
| `tui_report` | Generer le rapport de dogfooding |
| `tui_kill` | Arreter le TUI |

### Scenarios de dogfooding pour Phase 49

| Scenario | Mode | Ce qu'on verifie |
|----------|------|-------------------|
| **First-run flow** | real (apres suppression `.maestro/`) | Hardware detecte, providers proposes, modele propose, agent selectionne, premier message fonctionne |
| **Page Models enrichie** | demo | Panels METRICS et QUEUE visibles, hardware dans STATUS, navigation j/k, touche [D] |
| **Capabilities affichees** | demo | Tags de capabilities dans AgentPanel, tags dans la liste de modeles |
| **CPU-only experience** | real (machine sans GPU) | Warning "slow", modeles CPU proposes, agent compact pre-selectionne |

### Quand dogfooder

- **Apres 49-C** : Page Models enrichie (quick win, demo mode suffit)
- **Apres 49-A** : First-run flow complet (real mode, supprimer `.maestro/`)
- **Apres 49-B** : Capabilities visibles (demo + real)

---

## Matrice : quel test pour quel changement

| Changement | Type check | Unit | Visual gate | Demo check | Integration | E2E dogfood |
|------------|:----------:|:----:|:-----------:|:----------:|:-----------:|:-----------:|
| Nouveau composant TUI | ✓ | ✓ | - | ✓ | - | ✓ |
| Modifier composant TUI existant | ✓ | ✓ | ✓ | ✓ | - | ✓ |
| Modifier App.ts / setup flow | ✓ | ✓ | ✓ | ✓ | - | ✓ |
| Nouveau endpoint LLM-Provider .NET | - | - | - | - | ✓ | - |
| Modifier Python server | - | - | - | - | ✓ | ✓ |
| Modifier block JSON | - | - | - | - | ✓ | - |
| Modifier SDK client | ✓ | ✓ | - | - | ✓ | - |
| Modifier ModelsScreen | ✓ | ✓ | ✓ | ✓ | - | ✓ |

---

## Ordre d'execution des tests

Apres chaque sous-phase, executer dans cet ordre :

```bash
# 1. Type check (30s)
cd packages/maestro-code && npx tsc --noEmit

# 2. Tests unitaires (1-2min)
cd packages/maestro-code && npm test

# 3. Real demo check (15s)
cd packages/maestro-code && node tests/real-demo-check.cjs

# 4. Visual gate (30s)
cd packages/maestro-code && npm run test:visual

# 5. Integration (si backend modifie, 2min)
cd packages/maestro-integration-tests && npm test

# 6. Dogfooding (apres chaque sous-phase complete, 15-30min)
# Via MCP tui-dogfood ou manuellement
```

**Regle** : Ne JAMAIS declarer une sous-phase DONE si les couches 1-4 ne passent pas. La couche 5 est requise si le backend a ete modifie. La couche 6 est requise a la fin de chaque sous-phase.
