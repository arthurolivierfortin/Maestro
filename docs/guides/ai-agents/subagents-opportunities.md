# Opportunités — Sub-agents Claude Code pour Maestro

> Source analysée : https://code.claude.com/docs/fr/sub-agents
> Date : 2026-03-03

## Résumé exécutif

La documentation sub-agents révèle **8 fonctionnalités sous-utilisées** qui pourraient améliorer significativement notre workflow. La plus impactante : la mémoire persistante (`memory`), qui permettrait à nos agents de s'améliorer automatiquement entre sessions. En second : l'isolation `worktree` pour les agents de code, qui éliminerait le risque de corruption de l'arbre de travail.

Notre seul agent actuel (`.claude/agents/e2e-tester.md`) est bien conçu mais manque de 4 fonctionnalités clés qui doubleraient sa valeur.

---

## État actuel

```
.claude/agents/
└── e2e-tester.md   ← le seul agent projet existant
```

L'`e2e-tester` utilise correctement : `tools` restreints, `disallowedTools`, `mcpServers` inline. Il manque : `memory`, `hooks`, `maxTurns`, `background`.

---

## Opportunité 1 — Mémoire persistante sur e2e-tester

**Priorité : HAUTE. Effort : 5 min.**

Sans mémoire, chaque session dogfood repart de zéro. L'agent redécouvre les mêmes bugs, les mêmes patterns de navigation, les mêmes fragilités visuelles. Avec `memory: project`, il accumule une base de connaissances sur le TUI entre chaque session.

```yaml
---
name: e2e-tester
description: E2E tester...
memory: project   # ← ajouter cette ligne
tools: Read, Grep, Glob
---
```

Ce que l'agent accumulerait automatiquement :
- Bugs récurrents avec leur évidence (frames capturées)
- Patterns de régression (quels composants cassent le plus souvent)
- Score UX historique — tendance sur les phases
- Comportements flaky (tests instables par timing)

La mémoire serait stockée dans `.claude/agent-memory/e2e-tester/` et versionnable avec le projet.

**Instruction à ajouter dans le prompt** :
```markdown
Before starting, read your memory for known issues and past UX scores.
After completing, update your memory with new bugs found, patterns observed,
and the UX score delta from last session.
```

---

## Opportunité 2 — Hooks PostToolUse sur e2e-tester

**Priorité : HAUTE. Effort : 30 min.**

Actuellement, si l'agent oublie d'appeler `tui_frame()` après une action, on perd de la visibilité. Un hook `PostToolUse` peut automatiquement déclencher des validations après chaque interaction TUI.

```yaml
hooks:
  PostToolUse:
    - matcher: "tui_press|tui_type"
      hooks:
        - type: command
          command: "echo 'TUI action completed' >> .claude/agent-logs/e2e-tester.log"
  Stop:
    - hooks:
        - type: command
          command: "node scripts/notify-dogfood-complete.js"
```

Usage plus avancé : valider que le TUI est stable après chaque commande avant de continuer.

---

## Opportunité 3 — Agents spécialisés pour le workflow de développement

**Priorité : HAUTE. Effort : 2-3h.**

On crée des phases manuellement avec des tâches répétitives. Les sub-agents suivants couvrent les gaps.

### 3a — `phase-coder` : Agent de code avec isolation worktree

```markdown
---
name: phase-coder
description: Implements code changes for a Maestro phase. Use when implementing
  a specific sub-task from a phase plan. Works in an isolated worktree to prevent
  corrupting the main working tree.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
permissionMode: acceptEdits
isolation: worktree
maxTurns: 40
memory: project
---

You are a Maestro backend/frontend developer. You implement specific,
scoped tasks from phase plans.

BEFORE STARTING: Read your memory for architectural patterns, known pitfalls,
and solutions to past problems.

RULES:
- NEVER use @ts-nocheck
- NEVER add Co-Authored-By in commits
- NEVER add legacy compatibility code — clean breaks only
- Read CLAUDE.md pitfalls before any infrastructure change
- Run `dotnet build` or `npx tsc --noEmit` after changes to verify

AFTER COMPLETING: Update your memory with the patterns you used, files you
modified, and any gotchas you discovered.
```

L'isolation `worktree` est critique : si l'agent fait une erreur destructive, le worktree est isolé. Le code principal n'est pas touché.

### 3b — `test-runner` : Agent de tests ciblé

```markdown
---
name: test-runner
description: Runs the test suite and reports only failures. Use proactively
  after any code change. Returns a concise summary, not raw output.
tools: Bash, Read, Glob
model: haiku
maxTurns: 10
---

Run the relevant tests for the changed files and report ONLY:
1. Number of tests: X passed, Y failed
2. For each failure: test name + error message (first 5 lines only)
3. Whether failures are pre-existing or new

Commands:
- maestro-code: cd packages/maestro-code && npm test
- backend: cd apps/backend && dotnet test
- integration: cd packages/maestro-integration-tests && npm test
```

Haiku est suffisant pour exécuter des commandes et parser la sortie. Économise des tokens vs Sonnet.

### 3c — `doc-checker` : Vérifie la cohérence docs/code

```markdown
---
name: doc-checker
description: Checks that documentation matches implementation. Use after
  completing a phase to verify no doc rot. Read-only, fast.
tools: Read, Grep, Glob
model: haiku
maxTurns: 15
---

Compare the implementation against relevant documentation. Check:
1. Do API contracts in docs/system/architecture/ match actual endpoints?
2. Do CLI commands in docs/tools/cli/ match packages/maestro-cli/?
3. Are new blocks listed in relevant docs?

Report mismatches only. Ignore minor wording differences.
```

---

## Opportunité 4 — Agent user-level : `maestro-context`

**Priorité : MOYENNE. Effort : 1h.**

Un agent utilisateur (dans `~/.claude/agents/`) disponible dans TOUS les projets, qui connaît Maestro en profondeur et peut répondre à des questions de contexte instantanément.

```markdown
---
name: maestro-context
description: Maestro architecture expert. Use when asked about Maestro's
  architecture, conventions, how to create blocks, or what a specific component does.
  Answers from docs, never invents.
tools: Read, Grep, Glob
model: haiku
memory: user
---

You are the Maestro architecture expert. You have deep knowledge of:
- Block system and execution engine
- Session/workspace model
- CLI conventions
- TUI component structure

Answer questions by reading the actual docs and code. Never invent.
Start with docs/system/ for architecture questions.
```

Utile : quand on travaille sur Cantante et qu'on veut des précisions sur Maestro sans quitter le contexte.

---

## Opportunité 5 — `maxTurns` sur e2e-tester

**Priorité : MOYENNE. Effort : 1 min.**

Sans limite, un dogfood peut tourner longtemps et consommer beaucoup de tokens si l'agent se perd. Ajouter `maxTurns: 60` force un résumé au bout d'un temps raisonnable.

```yaml
maxTurns: 60   # ~20 min à vitesse normale
```

---

## Opportunité 6 — Sub-agents via CLI flag pour les phases

**Priorité : MOYENNE. Effort : script simple.**

La documentation montre qu'on peut passer des agents via `--agents` en JSON. Utile pour lancer un agent de phase temporaire sans créer de fichier :

```bash
claude --agents '{
  "phase-47-worker": {
    "description": "Worker for Phase 47 integration tests. Use for all test writing.",
    "prompt": "You are implementing Phase 47 integration tests. Read docs/phases/PHASE-47/README.md first. Follow testing-strategy.md.",
    "tools": ["Read", "Edit", "Write", "Bash", "Grep", "Glob"],
    "model": "sonnet",
    "maxTurns": 50
  }
}'
```

L'agent n'existe que pour la session — pas de pollution dans `.claude/agents/`.

---

## Opportunité 7 — Hooks `SubagentStart/Stop` dans settings.json

**Priorité : BASSE. Effort : 30 min.**

On peut configurer des hooks globaux qui s'exécutent quand UN sub-agent démarre ou s'arrête. Exemple concret pour Maestro : logger automatiquement les sessions dogfood.

```json
{
  "hooks": {
    "SubagentStart": [
      {
        "matcher": "e2e-tester",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$(date) — dogfood session started\" >> C:\\Meastro\\docs\\phases\\dogfood-log.txt"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "e2e-tester",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$(date) — dogfood session ended\" >> C:\\Meastro\\docs\\phases\\dogfood-log.txt"
          }
        ]
      }
    ]
  }
}
```

---

## Opportunité 8 — `skills` préchargées dans les agents de code

**Priorité : BASSE. Effort : 15 min.**

Les agents peuvent recevoir des skills préchargées dans leur contexte au démarrage — pas juste disponibles, mais injectées. Pour `phase-coder` :

```yaml
skills:
  - simplify           # skill existante dans le projet
```

Si on crée des skills pour `common-pitfalls` et `testing-strategy`, l'agent les aurait intégrées sans avoir à les chercher.

---

## Plan d'action recommandé

| Priorité | Action | Fichier | Effort |
|----------|--------|---------|--------|
| 1 | Ajouter `memory: project` + `maxTurns: 60` à e2e-tester | `.claude/agents/e2e-tester.md` | 5 min |
| 2 | Ajouter instruction mémoire au prompt e2e-tester | `.claude/agents/e2e-tester.md` | 10 min |
| 3 | Créer `phase-coder` avec `isolation: worktree` | `.claude/agents/phase-coder.md` | 30 min |
| 4 | Créer `test-runner` (haiku, maxTurns: 10) | `.claude/agents/test-runner.md` | 20 min |
| 5 | Créer `maestro-context` user-level | `~/.claude/agents/maestro-context.md` | 30 min |
| 6 | Ajouter `doc-checker` | `.claude/agents/doc-checker.md` | 20 min |

**Gain attendu** : les phases 48+ bénéficient d'un `phase-coder` qui ne casse pas l'arbre principal, d'un `test-runner` qui ne consomme pas de tokens Sonnet, et d'un `e2e-tester` qui s'améliore avec chaque session dogfood.

---

## Note sur l'architecture Maestro

Ces sub-agents Claude Code sont distincts des **blocks Maestro**. Les blocks Maestro sont exécutés par le moteur d'exécution backend (C#, `EntryPointExecutor`). Les sub-agents Claude Code sont des configurations pour le CLI interactif (cet outil). Les deux coexistent sans conflit — ils opèrent dans des couches différentes.
