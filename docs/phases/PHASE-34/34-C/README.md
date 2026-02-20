# Phase 34-C : Agents Specialistes + Workflow Orchestrateur v4

**Statut** : A faire
**Prerequis** : Phase 34-B COMPLETE (tool blocks et state manager fonctionnels)
**Objectif** : Creer tous les agents specialistes (comprendre, planifier, implementer, verifier, reviewer, livrer) et le workflow orchestrateur qui les coordonne.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi le lire |
|---------|-----------------|
| `docs/phases/PHASE-34/AGENT-V4-SPEC.md` | Les definitions exactes de chaque bloc (system prompts, inputs/outputs, modeles) |
| `docs/phases/PHASE-34/PHASE-34-B.md` + checkpoint | Quels tool blocks sont disponibles |
| `content/system/blocks/agents/project-preparer/` | L'agent v3.1 existant — point de depart pour project-analyzer |
| `content/system/blocks/agents/task-planner/` | Le planner v3.1 — point de depart pour task-planner v3 |
| `content/system/blocks/agents/implement-single-step/` | L'implementeur v3.1 — point de depart pour backend-developer et frontend-developer |
| `content/system/blocks/workflows/autonomous-development/` | Le workflow v3.1 — point de depart pour v4 |
| `content/system/templates/sessions/project-autonomous.session.json` | Le template session existant |
| `docs/guides/ai-agents/creating-blocks.md` | Convention de creation de blocs |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Creer les agents de la phase COMPRENDRE
- `project-analyzer` (v2 de project-preparer) — analyse stack, conventions, architecture
- `task-architect` (NOUVEAU) — design high-level, decoupe en modules
- `research-agent` (NOUVEAU) — recherche web pour docs, exemples, meilleures pratiques

Chaque agent : `*.block.json` + `system-prompt.md` + tests individuels

### Etape 2 : Creer les agents de la phase PLANIFIER
- `task-planner` (v3) — plan d'implementation ameliore
- `plan-validator` (v2 de json-validator) — validation structurelle et semantique du plan

### Etape 3 : Creer les agents de la phase IMPLEMENTER
- `backend-developer` (NOUVEAU — split de implement-single-step) — C#, API, DB
- `frontend-developer` (NOUVEAU — split) — React, TypeScript, components
- `styling-developer` (NOUVEAU) — CSS, Tailwind, animations, Framer Motion
- `step-validator` (v2) — verification filesystem
- `compilation-checker` (deja cree en 34-B comme tool) — utilise comme noeud dans le workflow

### Etape 4 : Creer les agents de la phase VERIFIER
- `test-writer` (NOUVEAU) — ecrit les tests unitaires
- `test-runner` (v2 de test-executor) — execute les tests
- `e2e-tester` (NOUVEAU) — Playwright headless, teste les flows utilisateur
- `ui-reviewer` (NOUVEAU) — screenshots + LLM vision pour analyser le UI
- `accessibility-checker` (NOUVEAU) — WCAG via arbre d'accessibilite

### Etape 5 : Creer les agents de la phase REVIEWER
- `code-reviewer` (v3) — plus strict, anti-leniency renforce
- `security-reviewer` (NOUVEAU) — OWASP top 10, injection, XSS
- `architecture-reviewer` (NOUVEAU) — coherence avec l'architecture du projet

### Etape 6 : Creer les agents de la phase LIVRER
- `git-committer` (v3) — commit conventionnel ameliore
- `changelog-writer` (NOUVEAU) — mise a jour du changelog
- `summary-reporter` (NOUVEAU) — rapport final de ce qui a ete fait

### Etape 7 : Creer le workflow orchestrateur v4
- `maestro-agent-v4` (workflow) — config.nodes avec toutes les phases
- Utilise `for-each` pour les steps d'implementation
- Utilise `while` pour la boucle d'iteration review → fix
- Utilise `decision` pour les conditions (review score, tests passing)
- Cree le session template `project-autonomous-v4.session.json`

### Etape 8 : Tester le workflow end-to-end (sans interaction handler)
- Executer sur un projet test simple
- Verifier que chaque phase s'execute correctement
- Verifier que la boucle d'iteration fonctionne

---

## Fichiers a modifier/creer [OBLIGATOIRE]

### Agents (dans `content/system/blocks/agents/`)
| Fichier | Action |
|---------|--------|
| `project-analyzer/project-analyzer.block.json` + `system-prompt.md` | CREER |
| `task-architect/task-architect.block.json` + `system-prompt.md` | CREER |
| `research-agent/research-agent.block.json` + `system-prompt.md` | CREER |
| `task-planner/task-planner.block.json` + `system-prompt.md` | MODIFIER (v2 → v3) |
| `plan-validator/plan-validator.block.json` | CREER |
| `backend-developer/backend-developer.block.json` + `system-prompt.md` | CREER |
| `frontend-developer/frontend-developer.block.json` + `system-prompt.md` | CREER |
| `styling-developer/styling-developer.block.json` + `system-prompt.md` | CREER |
| `test-writer/test-writer.block.json` + `system-prompt.md` | CREER |
| `test-runner/test-runner.block.json` + `system-prompt.md` | CREER (v2 de test-executor) |
| `e2e-tester/e2e-tester.block.json` + `system-prompt.md` | CREER |
| `ui-reviewer/ui-reviewer.block.json` + `system-prompt.md` | CREER |
| `accessibility-checker/accessibility-checker.block.json` + `system-prompt.md` | CREER |
| `code-reviewer/code-reviewer.block.json` | MODIFIER (v2 → v3) |
| `security-reviewer/security-reviewer.block.json` + `system-prompt.md` | CREER |
| `architecture-reviewer/architecture-reviewer.block.json` + `system-prompt.md` | CREER |
| `git-committer/git-committer.block.json` | MODIFIER (v2 → v3) |
| `changelog-writer/changelog-writer.block.json` + `system-prompt.md` | CREER |
| `summary-reporter/summary-reporter.block.json` + `system-prompt.md` | CREER |

### Workflow + Template
| Fichier | Action |
|---------|--------|
| `content/system/blocks/workflows/maestro-agent-v4/maestro-agent-v4.block.json` | CREER |
| `content/system/templates/sessions/project-autonomous-v4.session.json` | CREER |

---

## Verification [OBLIGATOIRE]

```bash
# Verification 1 : Tous les blocs existent et sont valides
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks"
# Resultat attendu : tous les nouveaux blocs apparaissent dans la liste

# Verification 2 : Chaque agent s'execute individuellement
# (pour chaque agent, executer avec un input test)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run project-analyzer --input repoPath=C:\TestProject"
# Resultat attendu : output JSON valide

# Verification 3 : Le workflow v4 s'execute end-to-end
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js session create --type project --name 'Test Agent v4' --repo C:\TestProject --template project-autonomous-v4 --start"
# puis invoquer le dev entry point

# Verification 4 : La boucle while d'iteration fonctionne
# Verifier dans les logs qu'il y a eu au moins une iteration de correction

# Verification 5 : Backend compile toujours
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : Build succeeded
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS creer des agents generalistes — chaque agent a UNE specialite
- Ne PAS hardcoder des outils dans les agents — les outils sont dans le system prompt, pas dans le C#
- Ne PAS mettre du contenu specifique dans l'infrastructure — tout est dans les block.json et system-prompt.md
- Ne PAS oublier de creer les system prompts REELS — pas de "TODO: write prompt"
- Ne PAS tester uniquement avec un build success — tester l'execution reelle de chaque agent
- Ne PAS sauter les tests individuels et passer directement au workflow — chaque agent doit fonctionner seul

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 34-C : Agents Specialistes + Workflow v4
**Statut** : DONE / EN_COURS / BLOQUE
**Date** : YYYY-MM-DD
**Agents crees** : X / 19
**Agents testes individuellement** : X / 19
**Workflow v4 cree** : OUI / NON
**Workflow v4 teste end-to-end** : OUI / NON
**Session template v4 cree** : OUI / NON
**Boucle d'iteration fonctionnelle** : OUI / NON
**Backend build** : Build succeeded / FAIL
**Verification** : [copier les resultats]
**Problemes** : [si BLOQUE]
```
