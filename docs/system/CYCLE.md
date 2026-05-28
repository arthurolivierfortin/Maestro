# Maestro `/cycle` — Discipline et Anti-Patterns

> **Status** : 2026-05-22 — version initiale, adaptée du modèle Marcel/TODO mature.
> **Ne PAS modifier sans ajouter d'ADR.** Chaque règle vient d'un incident réel.

## Pourquoi `/cycle` existe

`/cycle` orchestre le développement de **Maestro lui-même**. C'est le contraire de "utiliser Maestro" (sessions sur projets cibles). Voir CLAUDE.md section "Developing Maestro vs Using Maestro".

Avant `/cycle`, le développement Maestro souffrait de :
- **PRs marquées "done" qui revenaient 1-2 semaines plus tard** ("done but not done")
- **Bugs invisibles aux gates statiques** (build vert, tests verts, mais runtime cassé)
- **Scope creep silencieux** — un fix de 3 lignes devenait un refactor de 200
- **Tests bidons** (`expect(true).toBe(true)`)
- **Vérifications hallucinées** — Claude rapporte "tests pass" sans les avoir lancés
- **Sessions ouvertes pour développer Maestro** (alors que les sessions servent à UTILISER Maestro sur un projet cible)

`/cycle` encode dans la procédure les leçons apprises pour éviter ces patterns.

## Les deux skills

### `/cycle-start` — démarrer une nouvelle feature
- Brainstorm dans le thread principal (PAS dans un subagent)
- Dispatch `spec-writer` qui produit `spec.md` + `checklist.md` machine-readable (`[SPEC-N]`, `[TEST-N]`, `[DB-N]`, `[GATE-N]`)
- Création de l'issue GitHub avec liens vers spec + checklist
- HARD GATE : utilisateur approuve la spec avant création de l'issue

### `/cycle` — exécuter une feature existante
- Ne fait JAMAIS le travail lui-même. Orchestrateur pur.
- Pick une issue (ad-hoc P:high > R:phase-<N>/todo)
- Dispatch `researcher` → plan
- Dispatch `builder` → TDD per [SPEC-N], gates, PR
- Dispatch `judge` 2-stage → review_verdict
- Dispatch `tui-verifier` si UI/TUI touchée (utilise `tui-dogfood` MCP)
- Merge rebase + delete branch + close issue
- Cap retry **2x** sur changes_requested. Au-delà, REJECT et issue retourne à `todo`.

## Anti-patterns documentés (chaque règle vient d'un incident)

### 1. NEVER do the work in the orchestrator

**Incident** : par le passé, "je vais juste faire ce petit fix" a dérivé en refactor.
**Règle** : `/cycle` dispatche, lit les verdicts JSON, décide. Il n'écrit JAMAIS de code applicatif.

### 2. Brainstorming JAMAIS en subagent

**Incident** : les subagents n'ont pas de contexte conversationnel — brainstormer en subagent produit des specs déconnectées de l'intention utilisateur.
**Règle** : `/cycle-start` Phase 1 (brainstorm) reste dans le thread principal. `spec-writer` n'est dispatché qu'après approbation utilisateur.

### 3. Sandbox output mandatory dans le verdict du judge

**Incident** : le judge approuvait à l'œil sans relancer les gates. Builder pouvait mentir.
**Règle** : `data/review_verdict_pr<N>.json` DOIT contenir le tail (20 lignes) de chaque gate. Si la section `sandbox` est manquante ou vide → l'orchestrateur **rejette le verdict** et re-dispatche le judge.

### 4. Stage 2 GATED par Stage 1 (judge 2-stage)

**Incident** : judge approuvait code propre sans vérifier la conformité à la spec.
**Règle** : Stage 1 = spec compliance (chaque `[SPEC-N]` a file:line + un `[TEST-N]` réel). Stage 2 = quality (sandbox + qualité). Stage 2 ne s'exécute QUE si Stage 1 est `approved`.

### 5. Tests "bidons" rejetés

**Incident** : `expect(true).toBe(true)` cochait un `[TEST-N]`.
**Règle** : le judge vérifie que chaque test exerce réellement la behavior du SPEC, pas juste "compile".

### 6. No date-bombs

**Incident** : un test contenait `expect(date).toEqual("2026-04-01")` qui a cassé le 2 avril.
**Règle** : tests utilisent `vi.setSystemTime` + dates relatives. Le judge cherche les dates absolues hardcodées et rejette.

### 7. Symmetry rule dans spec-writer

**Incident** : un PR centralisait UNE read path mais oubliait 5 write paths correspondants.
**Règle** : `spec-writer` re-vérifie symétrie read/write, success/error, multi-layer enums avant d'émettre la checklist.

### 8. Cap retry 2x

**Incident** : builder→judge boucle infinie sur des nits cosmétiques.
**Règle** : max 2 retries `changes_requested`. Au-delà, REJECT, issue retourne à `todo`, humain décide.

### 9. NEVER squash merge

**Incident** : squash perdait l'historique des commits atomiques per `[SPEC-N]`.
**Règle** : `gh pr merge --rebase --delete-branch`. Préserve un commit par SPEC.

### 10. real-demo-check.cjs MANDATORY pour TUI

**Incident** : vitest passait alors que la TUI réelle était cassée (incident 2026-03-03, missing props invisibles au compiler).
**Règle** : tout PR touchant `packages/maestro-code/**/*.ts` DOIT inclure `[GATE-N]` qui exécute `node packages/maestro-code/real-demo-check.cjs`. Le judge le re-run en sandbox.

### 11. Cardinal Rule litmus test

**Référence** : `CLAUDE.md` section "The Cardinal Rule: Generic Infrastructure, Specific Content"
**Règle** : le judge applique le litmus test sur tout PR qui ajoute du code C# ou TypeScript :
> "Can a new session type be created with ONLY JSON changes?"
Si la réponse est non → REJECT comme `important` violation architecturale.

### 12. No Legacy Support enforcement

**Référence** : `CLAUDE.md` section "No Legacy Support (MANDATORY)"
**Règle** : le judge cherche dans le diff : `// deprecated`, `// legacy`, `_isDeprecated`, fallback chains, `if (oldFormat)`. Si trouvé → `request_changes` avec demande de clean break.

### 13. JsonElement / DI / Agent quality pitfalls

**Référence** : `docs/guides/ai-agents/common-pitfalls.md`
**Règle** : `researcher` lit common-pitfalls.md AVANT de planifier. Les patterns connus (JsonElement corruption, DI circular dependency AgentBlockExecutor↔BlockExecutorRegistry, never add tool dispatch in AgentBlockExecutor, etc.) sont des `request_changes` automatiques si reproduits.

### 14. Tags SDK vs Code app (préparation soft split)

**Référence** : décision 2026-05-22 — soft split maintenant, hard split V2 Phase 71-72.
**Règle** : chaque `[SPEC-N]` doit tagger `[sdk]` ou `[code-app]` :
- `[sdk]` = `apps/backend/`, `llm-provider/`, `content/system/blocks/` génériques, `content/system/contracts/`
- `[code-app]` = `packages/maestro-code/`, blocks app-specific (à terme `packages/maestro-code/blocks/`), `packages/maestro-cli/` opérations user-facing
- Direction de dépendance : code-app peut importer SDK, JAMAIS l'inverse. Le judge rejette si un `[sdk]` SPEC importe du code-app.

### 15. Provider verification AVANT toute exécution agent (Infrastructure Before Models)

**Référence** : memory rule "Infrastructure Before Models (2026-03-17)"
**Règle** : tout PR qui modifie un workflow ou agent doit inclure un pre-flight check provider (1 API call, <5s) dans le `[GATE-N]`. Le judge re-run.

## Vérification gates Maestro (les 6 couches)

Référence : `docs/system/TESTING-PROTOCOL.md` (6 couches obligatoires)

| Layer | Commande | Quand |
|-------|----------|-------|
| 1. Type Check | `dotnet build` (backend) + `npx tsc --noEmit` (TS) | TOUJOURS |
| 2. Unit Tests | `dotnet test` + `npm test` (vitest) | TOUJOURS |
| 3. Visual Gate | TUI screenshots / snapshot tests | Si TUI touchée |
| 4. Real Demo Check | `node packages/maestro-code/real-demo-check.cjs` | Si TUI touchée (MANDATORY) |
| 5. Integration | Tests `Maestro.Infrastructure.Tests`, etc. | Si backend/blocks touchés |
| 6. E2E Dogfooding | `tui-verifier` agent via `tui-dogfood` MCP | Si UX impactée |

Le judge re-run TOUTES les couches applicables au PR (intersect avec ce qui a été modifié).

## Verdicts — schémas stricts

### `data/brainstorm.md` — sortie de Phase 1 de /cycle-start
Markdown libre — capture les décisions du brainstorm.

### `data/spec_verdict.json` — sortie de spec-writer
```json
{
  "spec_path": "docs/phases/PHASE-65/specs/2026-05-22-dashboard-pages-design.md",
  "checklist_path": "docs/phases/PHASE-65/specs/2026-05-22-dashboard-pages-checklist.md",
  "spec_count": 7,
  "test_count": 7,
  "db_count": 0,
  "gate_count": 5,
  "tags": ["code-app", "sdk"],
  "phase": "65",
  "status": "ready"
}
```
Ou `"status": "needs_decomposition"` avec `proposed_split` array.

### `data/plan_verdict.json` — sortie de researcher
```json
{
  "issue": 123,
  "spec_path": "...",
  "checklist_path": "...",
  "files_to_create": ["..."],
  "files_to_modify": ["..."],
  "common_pitfalls_checked": ["JsonElement", "DI circular", "AgentBlockExecutor tool dispatch"],
  "architectural_refs_read": ["docs/system/architecture/blocks.md"],
  "status": "approved"
}
```

### `data/build_verdict.json` — sortie de builder
```json
{
  "issue": 123,
  "pr_number": 456,
  "pr_url": "...",
  "items_completed": ["SPEC-1", "SPEC-2", "TEST-1", "TEST-2", "GATE-1", "GATE-2"],
  "items_skipped": [],
  "gates": {
    "type_check": "pass",
    "unit_tests": "pass",
    "real_demo_check": "pass"
  },
  "status": "pr_created"
}
```

### `data/review_verdict_pr<N>.json` — sortie de judge
Voir `judge.md` pour le schéma complet. Doit contenir `stage1_spec`, `stage2_quality.sandbox`, `verdict`.

### `data/tui_verdict_pr<N>.json` — sortie de tui-verifier
```json
{
  "pr_number": 456,
  "screens_tested": ["chat", "spaces", "catalog", "models"],
  "verdict": "approved" | "request_changes" | "needs_manual" | "skipped" | "error",
  "findings": [
    {"severity": "blocker", "screen": "spaces", "what": "...", "evidence": "frame_3.txt"}
  ]
}
```

## Migration depuis l'ancien workflow

L'ancien `/dev-cycle` + `/think` + `/build` + `/review` est **deprecated**. À supprimer dès que `/cycle` est validé sur 2-3 features.

Phases d'archivage :
1. `/cycle` créé et documenté (cette doc + skills + agents) — **DONE 2026-05-22**
2. Première utilisation sur un feature simple — TODO
3. Validation sur Phase 65 (dashboard split) — TODO
4. Suppression de `dev-cycle`, `think`, `build`, `review`, `dev-agent` — quand validé
