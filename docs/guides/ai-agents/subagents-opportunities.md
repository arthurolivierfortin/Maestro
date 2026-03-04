# Opportunités — Sub-agents Claude Code pour Maestro

> Sources analysées :
> - https://code.claude.com/docs/fr/sub-agents
> - https://code.claude.com/docs/fr/mcp
> Date : 2026-03-04

## Résumé exécutif

L'analyse combinée sub-agents + MCP révèle **12 opportunités** pour améliorer la qualité de notre workflow Claude Code. Les deux axes majeurs :

1. **MCP comme couche d'intégration** : Notre serveur legacy (`apps/mcp/index.js`) a 25+ outils sur l'API Maestro, mais utilise un protocole custom (ligne-par-ligne JSON) au lieu du SDK MCP. Le migrer et l'exposer comme MCP server dans les sub-agents donnerait à chaque agent un accès direct aux sessions, blocks, workspaces — sans passer par Bash+curl.

2. **Sub-agents spécialisés avec mémoire** : La mémoire persistante (`memory`) et l'isolation `worktree` transformeraient les agents ponctuels en assistants qui s'améliorent et ne cassent rien.

**État actuel** :
- 1 sub-agent projet : `.claude/agents/e2e-tester.md` (utilise MCP inline pour TUI)
- 1 MCP server SDK : `packages/maestro-code/tests/tui-mcp-server.ts` (10 tools, @modelcontextprotocol/sdk)
- 1 MCP server legacy : `apps/mcp/index.js` (25+ tools, protocole custom — PAS le SDK)
- 1 config MCP projet : `.mcp.json` (uniquement tui-dogfood)

---

## PARTIE A — Opportunités MCP Server

### Inventaire MCP actuel

| Composant | Fichier | Protocole | Status |
|-----------|---------|-----------|--------|
| TUI Dogfood MCP | `packages/maestro-code/tests/tui-mcp-server.ts` | SDK officiel (`@modelcontextprotocol/sdk`) | Actif, utilisé par e2e-tester |
| Maestro API MCP | `apps/mcp/index.js` | Custom (readline JSON ligne-par-ligne) | Legacy, **pas compatible Claude Code** |
| Config projet | `.mcp.json` | — | Uniquement tui-dogfood |

**Le problème central** : `apps/mcp/index.js` expose 25+ outils sur l'API Maestro (blocks, sessions, workflows, containers, permissions, filesystem) mais utilise un protocole custom incompatible avec Claude Code. Aucun sub-agent ne peut l'utiliser. Le TUI MCP server prouve qu'on sait faire du SDK MCP propre — il suffit d'appliquer le même pattern.

---

### MCP-1 — Migrer `apps/mcp/index.js` vers le SDK MCP officiel

**Priorité : CRITIQUE. Effort : 2-3h. Impact : débloque MCP-2, MCP-3, MCP-4.**

Le serveur legacy utilise `readline` + JSON ligne-par-ligne :
```javascript
// Actuel — incompatible avec Claude Code
rl.on('line', async (line) => {
  const req = JSON.parse(line);
  const res = await handleRequest(req);
  process.stdout.write(JSON.stringify(res) + '\n');
});
```

Migration vers le SDK (même pattern que `tui-mcp-server.ts`) :
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "maestro-api", version: "1.0.0" });

server.registerTool("list-blocks", {
  description: "List all blocks, optionally filtered by type",
  inputSchema: { type: z.string().optional() },
}, async ({ type }) => {
  const blocks = await client.listBlocks(type ? { type } : undefined);
  return { content: [{ type: "text", text: JSON.stringify(blocks, null, 2) }] };
});

// ... 24 autres tools identiques à l'existant

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Avantage** : une fois migré, ce serveur devient utilisable par :
- Claude Code directement (via `.mcp.json` ou `claude mcp add`)
- Tous les sub-agents (via `mcpServers` dans leur frontmatter)
- VS Code Copilot (via `.vscode/mcp.json`)

**Les 25+ outils déjà implémentés** qu'on récupère gratuitement :
- `list-blocks`, `get-block`, `search-blocks` — explorer le catalog
- `list-workflows`, `get-workflow`, `execute-workflow` — lancer des workflows
- `list-projects`, `get-project`, `open-project` — gérer les projets
- `get-container-status`, `start-container`, `stop-container` — contrôler les containers
- `get-file-access-rules`, `update-file-access-rules` — permissions
- `health` — vérifier que le backend tourne
- Ressources MCP : `blocks://`, `workflows://`, `projects://`, `containers://`

---

### MCP-2 — Ajouter `maestro-api` comme MCP projet dans `.mcp.json`

**Priorité : HAUTE. Effort : 5 min (après MCP-1). Impact : disponible pour toute la session Claude Code.**

```json
{
  "mcpServers": {
    "tui-dogfood": { "..." : "existant" },
    "maestro-api": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "tsx", "apps/mcp/index.ts"],
      "env": {
        "MAESTRO_API_URL": "http://localhost:5000"
      }
    }
  }
}
```

Résultat : dans toute session Claude Code sur le projet Maestro, on peut dire :
- *"Liste tous les blocks de type agent"* → appelle `list-blocks` via MCP
- *"Vérifie que le backend est en santé"* → appelle `health` via MCP
- *"Cherche les blocks qui contiennent 'commit'"* → appelle `search-blocks` via MCP

Plus besoin de `curl http://localhost:5000/api/blocks` — l'outil MCP est natif.

---

### MCP-3 — Injecter `maestro-api` dans les sub-agents via `mcpServers`

**Priorité : HAUTE. Effort : 2 min par agent (après MCP-1).**

La fonctionnalité clé : les sub-agents peuvent déclarer des MCP servers inline dans leur frontmatter. Ça veut dire qu'un agent comme `phase-coder` peut interagir avec l'API Maestro directement :

```yaml
---
name: phase-coder
description: Implements code changes for a Maestro phase
mcpServers:
  maestro-api:
    type: stdio
    command: cmd
    args: ["/c", "npx", "-y", "tsx", "apps/mcp/index.ts"]
    env:
      MAESTRO_API_URL: "http://localhost:5000"
---
```

L'agent peut alors :
- Vérifier que le backend est up (`health`) avant de coder
- Lister les blocks existants (`list-blocks`) pour éviter les doublons
- Vérifier l'état des sessions (`get-container-status`) après un changement
- Ouvrir un projet (`open-project`) pour valider les chemins

**Cas d'usage concret** — l'agent `phase-coder` implémente une modification sur le block executor :
1. Il appelle `list-blocks` pour voir quels blocks seront affectés
2. Il code le changement
3. Il appelle `health` pour vérifier que le backend compile toujours
4. Il appelle `search-blocks` pour vérifier que rien n'est cassé

Tout ça sans Bash, sans curl, dans le flux naturel de l'agent.

---

### MCP-4 — Créer un MCP server `maestro-session` spécialisé pour l'orchestration

**Priorité : MOYENNE. Effort : 3-4h. Impact : V1 orchestration.**

Au-delà du serveur API généraliste, un MCP server spécialisé pour les sessions couvrirait le workflow complet de maestro-code :

```typescript
// Outils ciblés pour l'orchestration de sessions
server.registerTool("session-create", { ... });      // Créer une session
server.registerTool("session-invoke", { ... });       // Invoquer un entry point
server.registerTool("session-status", { ... });       // État en temps réel
server.registerTool("session-variables", { ... });    // Lire/écrire variables
server.registerTool("workspace-create", { ... });     // Créer un workspace
server.registerTool("workspace-add-session", { ... }); // Ajouter session au workspace
server.registerTool("monitor-launch", { ... });       // Lancer le monitor
```

Ce serveur serait le **bras exécutif** de l'agent maestro-code. Au lieu de shell-out vers `node index.js session create ...`, l'agent appelle directement les outils MCP.

**Pourquoi c'est mieux que Bash** :
- **Typage** : les inputs sont validés par Zod, les erreurs sont explicites
- **Pas de parsing** : la réponse est JSON structuré, pas du texte CLI à parser
- **Pas de shell** : pas de problèmes d'escaping, de quotes Windows, de PATH
- **Permissions** : le sub-agent n'a pas besoin de Bash — on peut restreindre à MCP only

---

### MCP-5 — MCP Resources pour le contexte automatique

**Priorité : BASSE. Effort : 1h (extension de MCP-1).**

Le protocole MCP supporte les **Resources** — des URIs qui fournissent du contexte en lecture. Le serveur legacy les implémente déjà (`blocks://`, `workflows://`, `projects://`, `containers://`). En les migrant vers le SDK, les agents pourraient accéder au contexte Maestro nativement :

```
blocks://                    → tous les blocks
block://commit-agent         → définition complète du block
workflows://                 → tous les workflows
sessions://                  → toutes les sessions actives
session://abc-123/variables  → variables d'une session
```

Les resources sont idéales pour le **pré-chargement de contexte** : au lieu de 3 appels API, l'agent lit `blocks://` une fois et a tout.

---

### MCP-6 — Dynamic Tool Updates (`list_changed`)

**Priorité : BASSE. Effort : 30 min.**

Le SDK MCP supporte les notifications `list_changed` : quand le backend change (nouveau block publié, session créée), le MCP server notifie Claude Code et les outils disponibles se mettent à jour automatiquement. Pas besoin de redémarrer.

Exemple : pendant une session foundry, un nouveau block est publié → l'outil `execute-workflow` peut maintenant l'utiliser, sans que l'agent relance quoi que ce soit.

---

## PARTIE B — Opportunités Sub-agents

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

### Phase 1 — Quick wins (30 min)

| # | Action | Fichier | Effort |
|---|--------|---------|--------|
| 1 | Ajouter `memory: project` + `maxTurns: 60` à e2e-tester | `.claude/agents/e2e-tester.md` | 5 min |
| 2 | Ajouter instruction mémoire au prompt e2e-tester | `.claude/agents/e2e-tester.md` | 10 min |
| 3 | Créer `test-runner` (haiku, maxTurns: 10) | `.claude/agents/test-runner.md` | 15 min |

### Phase 2 — MCP Migration (3h) — LE PLUS GROS GAIN

| # | Action | Fichier | Effort |
|---|--------|---------|--------|
| 4 | **Migrer `apps/mcp/index.js` vers SDK MCP** | `apps/mcp/index.ts` | 2-3h |
| 5 | Ajouter `maestro-api` dans `.mcp.json` | `.mcp.json` | 5 min |
| 6 | Injecter `maestro-api` dans les sub-agents existants | `.claude/agents/*.md` | 10 min |

### Phase 3 — Agents spécialisés (2h)

| # | Action | Fichier | Effort |
|---|--------|---------|--------|
| 7 | Créer `phase-coder` avec `isolation: worktree` + MCP | `.claude/agents/phase-coder.md` | 30 min |
| 8 | Créer `maestro-context` user-level avec `memory: user` | `~/.claude/agents/maestro-context.md` | 30 min |
| 9 | Créer `doc-checker` (haiku) | `.claude/agents/doc-checker.md` | 20 min |

### Phase 4 — Orchestration avancée (4h, post-V1)

| # | Action | Fichier | Effort |
|---|--------|---------|--------|
| 10 | Créer MCP server `maestro-session` | `apps/mcp/session-server.ts` | 3-4h |
| 11 | MCP Resources pour contexte auto | Extension de #4 | 1h |
| 12 | Dynamic tool updates (`list_changed`) | Extension de #4 | 30 min |

### Impact attendu par phase

| Phase | Gain principal |
|-------|---------------|
| 1 (quick wins) | e2e-tester accumule de l'intelligence, tests en Haiku = économie tokens |
| 2 (MCP) | **Tout agent peut interroger l'API Maestro nativement** — plus de curl, plus de Bash pour vérifier l'état du système. C'est le multiplicateur. |
| 3 (agents) | Code isolé en worktree, expert archi disponible partout, cohérence docs/code vérifiée |
| 4 (orchestration) | maestro-code agent orchestre les sessions via MCP au lieu de shell — plus fiable, plus typé, plus sécurisé |

---

## Synoptique : Comment les pièces s'assemblent

```
┌─────────────────────────────────────────────────────┐
│                  Claude Code Session                 │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  e2e-tester   │  │ phase-coder  │  │test-runner │ │
│  │  memory:proj  │  │ worktree     │  │ haiku      │ │
│  │  maxTurns:60  │  │ memory:proj  │  │ maxTurns:10│ │
│  └──────┬───────┘  └──────┬───────┘  └────────────┘ │
│         │                  │                          │
│  ┌──────▼───────┐  ┌──────▼───────┐                  │
│  │ tui-dogfood  │  │ maestro-api  │  ← MCP Servers   │
│  │ (TUI PTY)    │  │ (API REST)   │                  │
│  └──────────────┘  └──────┬───────┘                  │
│                           │                          │
└───────────────────────────┼──────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  Maestro Backend │
                   │   port 5000      │
                   │  (blocks, sessions│
                   │   workflows...)   │
                   └─────────────────┘
```

**Le MCP server `maestro-api` est le pont** : il connecte le monde Claude Code (sub-agents, .mcp.json, permissions) au monde Maestro (backend C#, blocks, sessions). Sans lui, les agents doivent passer par Bash pour parler au backend. Avec lui, c'est natif.

---

## Note sur l'architecture Maestro

Ces sub-agents Claude Code sont distincts des **blocks Maestro**. Les blocks Maestro sont exécutés par le moteur d'exécution backend (C#, `EntryPointExecutor`). Les sub-agents Claude Code sont des configurations pour le CLI interactif (cet outil). Les deux coexistent sans conflit — ils opèrent dans des couches différentes.

Le MCP server `maestro-api` est également distinct du `MaestroSidecar` : le sidecar **lance** les services (backend, LLM-Provider), tandis que le MCP server **parle** aux services une fois lancés. Le sidecar est déjà utilisé par `tui-mcp-server.ts` pour le démarrage en mode réel.
