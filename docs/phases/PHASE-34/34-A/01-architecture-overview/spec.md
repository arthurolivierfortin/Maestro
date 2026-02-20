# 1. Vue d'ensemble de l'architecture — Agent Maestro v4

## Philosophie : Equipe virtuelle, pas agent unique

L'agent v4 est une **equipe de specialistes coordonnee**, pas un generaliste. Chaque specialiste :
- A son propre system prompt optimise pour une seule responsabilite
- Recoit un **contexte frais et minimal** (pas le contexte cumulatif des etapes precedentes)
- Peut etre substitue independamment lors de la degradation en tiers
- A ses propres criteres fitness mesurables
- Utilise le modele optimal pour sa tache (routing par tier)

Cette approche s'inspire du **Leader Pattern** (Devin, Claude Code Swarms) et du **Ralph Loop** (fresh context per sub-task pour eviter la derive d'hallucination).

---

## Architecture en 7 phases

```
maestro-agent-v4 (workflow orchestrateur)
|
|=== PARALLELE: INTERACTION-HANDLER (agent composite) ===================|
|    Tourne en parallele du workflow.                                     |
|    Recoit les messages utilisateur, classifie l'intent,                |
|    peut pauser/resume/rewind le workflow via le state-manager.         |
|========================================================================|
|
|--- PHASE 1: COMPRENDRE
|    |-- project-analyzer      [agent, Sonnet]     Analyse stack, conventions, architecture
|    |-- task-architect         [agent, Opus]       Design high-level, decoupe en modules
|    |-- research-agent         [agent, Sonnet]     Cherche docs, exemples sur le web
|
|--- PHASE 2: PLANIFIER
|    |-- task-planner           [agent, Sonnet]     Plan d'implementation etape par etape
|    |-- plan-validator         [inference, Sonnet]  Valide le plan vs architecture + conventions
|
|--- PHASE 3: IMPLEMENTER (for-each module)
|    |-- decision: route vers backend-developer | frontend-developer | styling-developer
|    |-- backend-developer      [agent, Sonnet]     C#, API, DB, business logic
|    |-- frontend-developer     [agent, Sonnet]     React, TypeScript, components, state
|    |-- styling-developer      [agent, Sonnet]     CSS, Tailwind, animations, Framer Motion
|    |-- step-validator         [inference, Haiku]   Verifie que les fichiers existent
|    |-- compilation-checker    [agent, Haiku]       Build le projet, reporte les erreurs
|
|--- PHASE 4: VERIFIER
|    |-- test-writer            [agent, Sonnet]     Ecrit les tests unitaires
|    |-- test-runner            [agent, Sonnet]     Execute les tests, parse les resultats
|    |-- e2e-tester             [agent, Sonnet]     Playwright, teste les flows utilisateur
|    |-- ui-reviewer            [inference, Opus]    Screenshots + accessibilite, compare au design
|    |-- accessibility-checker  [inference, Sonnet]  WCAG, arbre d'accessibilite
|
|--- PHASE 5: REVIEWER
|    |-- code-reviewer          [inference, Opus]    Score qualite code (7 axes)
|    |-- security-reviewer      [inference, Opus]    Audit securite OWASP top 10
|    |-- architecture-reviewer  [inference, Opus]    Coherence avec l'architecture du projet
|
|--- PHASE 6: ITERER (while loop)
|    |-- condition: reviewScore < 0.8 AND iteration < 3
|    |-- Si true: retour a IMPLEMENTER avec le feedback des reviewers
|    |-- Si false ou max iterations: continuer
|
|--- PHASE 7: LIVRER
|    |-- git-committer          [agent, Sonnet]     Commit conventionnel
|    |-- changelog-writer       [inference, Sonnet]  Met a jour le changelog
|    |-- summary-reporter       [inference, Sonnet]  Rapport final
```

---

## Flux d'execution detaille

### Flux principal (happy path)

```
1. INIT
   - state-manager.set("status", "running")
   - state-manager.set("currentPhase", "comprendre")
   - Charger la memoire persistante depuis .maestro/memory/

2. COMPRENDRE
   - project-analyzer analyse le repo (5 tool calls max)
   - task-architect decompose la tache en modules de haut niveau
   - research-agent cherche sur le web si necessaire
   - state-manager.set("context", {project, task, research})
   - CHECKPOINT: sauvegarder results.comprendre

3. PLANIFIER
   - task-planner genere le plan detaille (steps atomiques)
   - plan-validator valide le plan vs conventions + architecture
   - Si plan invalide: task-planner re-planifie (max 2 iterations)
   - state-manager.set("plan", validatedPlan)
   - CHECKPOINT: sauvegarder results.planifier

4. IMPLEMENTER (for-each step in plan)
   Pour chaque step:
   a. decision: router vers backend-developer | frontend-developer | styling-developer
      selon step.domain (backend, frontend, styling)
   b. Le developpeur specialise implemente le step
   c. step-validator verifie que les fichiers existent
   d. compilation-checker build le projet
   e. Si compilation echoue: le developpeur corrige (max 2 retries)
   f. state-manager.set("results.implement.step-N", result)
   g. CHECKPOINT: sauvegarder apres chaque step

5. VERIFIER
   - test-writer ecrit les tests unitaires pour le code implemente
   - test-runner execute les tests
   - e2e-tester lance Playwright pour les tests end-to-end
   - ui-reviewer analyse les screenshots (accessibilite + visuel)
   - accessibility-checker verifie WCAG
   - state-manager.set("results.verify", {tests, e2e, ui, a11y})
   - CHECKPOINT: sauvegarder results.verifier

6. REVIEWER
   - code-reviewer: score qualite code (7 axes, seuil 0.8)
   - security-reviewer: audit securite (pass/fail + details)
   - architecture-reviewer: coherence architecturale (score)
   - Score combine = (code*0.5 + security*0.3 + architecture*0.2)
   - state-manager.set("reviewScore", combinedScore)
   - CHECKPOINT: sauvegarder results.reviewer

7. ITERER (while loop)
   - condition: reviewScore < 0.8 AND iteration < 3
   - Si true:
     - Construire le feedback combine des 3 reviewers
     - Retour a IMPLEMENTER avec feedback.issues comme contexte
     - Incrementer iteration
   - Si false: continuer

8. LIVRER
   - git-committer: commit conventionnel (staged, verified)
   - changelog-writer: met a jour CHANGELOG.md
   - summary-reporter: rapport final avec metriques
   - state-manager.set("status", "completed")
   - Sauvegarder les learnings dans .maestro/memory/
```

### Flux d'interruption (interaction-handler)

A n'importe quel moment pendant le flux principal :

```
Utilisateur envoie un message via maestro code
  |
  v
interaction-handler recoit le message
  |-- classify-intent: question | feedback | change-request | override
  |-- decide-action: respond | pause-and-modify | rewind | inject | override
  |-- execute-action: modifie l'etat via state-manager
  |-- send-response: widget vers l'utilisateur
```

L'interaction-handler tourne dans un **noeud parallel** du workflow orchestrateur. Il partage le state-manager comme unique source de verite.

> **DEPENDANCE CRITIQUE** : Le block `parallel` est concu dans `DESIGN-CONTROL-FLOW-BLOCKS.md` mais **N'EST PAS implemente** dans `EntryPointExecutor.cs`. C'est un prerequis technique de Phase 34-B.

---

## Routing des modeles — Tier 1

Le routing de modeles suit le pattern **Three-tier model routing** du marche :

| Role | Modele | Justification |
|------|--------|---------------|
| **Architecte / Design** | Opus 4.6 | Raisonnement complexe, decomposition de problemes |
| **Review / Jugement** | Opus 4.6 | Evaluation nuancee, detection de subtilites |
| **Interaction** | Opus 4.6 | Comprehension d'intent, decision multi-facteurs |
| **UI Review (vision)** | Opus 4.6 | Analyse visuelle de screenshots, jugement esthetique |
| **Implementation** | Sonnet 4.6 | Bon ratio qualite/vitesse pour l'ecriture de code |
| **Testing** | Sonnet 4.6 | Ecriture de tests, parsing de resultats |
| **Validation simple** | Haiku 4.5 | Verification rapide de format, existence de fichiers |

**Principe** : Utiliser le modele le plus capable pour les decisions critiques (architecture, review, interaction), et le plus rapide pour l'execution repetitive (implementation, validation).

---

## Checkpointing

Chaque noeud du workflow sauvegarde son etat via le state-manager apres execution. Cela permet :

1. **Resume apres pause** : l'interaction-handler peut pauser le workflow et le reprendre exactement ou il etait
2. **Rewind** : revenir a une phase anterieure en effacant les resultats en aval
3. **Persistence** : si la session est interrompue (crash, fermeture), les resultats acquis sont conserves

### Structure de l'etat checkpointe

```json
{
  "status": "running|paused|completed|error",
  "currentPhase": "comprendre|planifier|implementer|verifier|reviewer|iterer|livrer",
  "currentNode": "project-analyzer",
  "iteration": 0,
  "maxIterations": 3,
  "results": {
    "comprendre": {
      "project": { "...": "..." },
      "task": { "...": "..." },
      "research": { "...": "..." }
    },
    "planifier": {
      "plan": [ "..." ],
      "validated": true
    },
    "implementer": {
      "step-1": { "success": true, "notes": "..." },
      "step-2": { "success": true, "notes": "..." }
    },
    "verifier": {
      "tests": { "passed": 12, "failed": 0 },
      "e2e": { "passed": 3, "failed": 0 },
      "ui": { "score": 0.9, "issues": [] },
      "accessibility": { "score": 0.95, "issues": [] }
    },
    "reviewer": {
      "code": { "score": 0.85, "details": {} },
      "security": { "pass": true, "issues": [] },
      "architecture": { "score": 0.9, "details": {} }
    }
  },
  "history": [
    { "time": "...", "event": "phase-start", "phase": "comprendre" },
    { "time": "...", "event": "node-complete", "node": "project-analyzer" }
  ],
  "userOverrides": {}
}
```

---

## Capacites differenciantes vs Claude Code brut

| Capacite | Claude Code brut | Maestro Agent v4 |
|----------|------------------|-------------------|
| **Agents specialises** | 1 agent generaliste | 21 specialistes avec prompts optimises |
| **Verification visuelle** | Non | Playwright screenshots + accessibility tree + LLM vision |
| **Iteration automatique** | 1 passage | Boucle while: review → fix, max 3 tours |
| **Interaction intelligente** | Context perdu a la pause | Interaction-handler dedie: pause/resume/rewind/inject |
| **Recherche web** | Non native | Block tool web-search via Playwright |
| **Memoire inter-sessions** | CLAUDE.md statique | .maestro/memory/ avec learnings auto-accumules |
| **Design/animations** | Non specialise | Agent styling dedie: Tailwind, Framer Motion, CSS animations |
| **Testing E2E** | Non | Playwright headless avec flows complets |
| **Review securite** | Non | Agent security dedie: OWASP top 10 |
| **Review architecture** | Non | Agent architecture dedie: coherence patterns |
| **Checkpointing** | Non | Etat sauvegarde a chaque noeud, resume exact |
| **Fresh context** | Context cumule (derive) | Context frais par specialiste (anti-hallucination) |
| **Routing modeles** | 1 modele pour tout | Opus/Sonnet/Haiku selon la tache |
