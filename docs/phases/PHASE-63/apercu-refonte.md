# Apercu visuel — TUI apres la refonte Chat-First

---

## Ecran principal : le chat (toujours visible)

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  ● Connected  claude-sonnet-4-6  session:a1b2c3d4                            │
│                                                                               │
│  14:32:15  ❯ Cree un workspace pour Cantante avec un agent de dev            │
│                                                                               │
│  14:32:16  ◆ Je vais creer un workspace pour Cantante et lancer              │
│            │ une session de dev. Voici le plan :                               │
│            │ 1. Creer le workspace "Cantante Dev"                             │
│            │ 2. Creer une session avec le template dev-orchestrator            │
│            │ 3. Lancer l'agent                                                │
│            │                                                                  │
│            │ Confirmez-vous ? (oui/non)                                       │
│                                                                               │
│  14:32:20  ❯ oui                                                             │
│                                                                               │
│  14:32:21  ✓ Workspace cree : Cantante Dev (ws-789)                          │
│            ✓ Session lancee : Dev Session (s-456)                             │
│                                                                               │
│                                                                               │
│                                                                               │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:32  $0.00 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## /status — System health + sessions actives

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:35:00  ❯ /status                                                         │
│                                                                               │
│  ┌─ System Status ──────────────────────────────────────────────────────┐    │
│  │ Backend: ● Connected (12ms)    LLM: ● claude-sonnet-4-6 (online)    │    │
│  │ Providers: 2    Models: 4    Sessions: 3 (1 running)                │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌─ Active Sessions ───────────────────────────────────────────────────┐    │
│  │ ● Dev Session              s-456   running   $0.52   1h 23m  [+2]  │    │
│  │ ◆ Foundry Session          s-345   idle      $0.31   45m           │    │
│  │ ✓ Test Session             s-012   done      $0.08   12m           │    │
│  │                                                                     │    │
│  │ [j/k] navigate  [Enter] details  [d] delete                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:35  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## /spaces — Sessions / Workspaces / Repos (3 tabs)

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:36:00  ❯ /spaces                                                         │
│                                                                               │
│  ┌─ Spaces ─────────────────────────────────────────────────────────────┐   │
│  │ [1] Sessions  [2] Workspaces  [3] Repos          [r] Running | All  │   │
│  │                                                                      │   │
│  │ 3 session(s)                                                         │   │
│  │                                                                      │   │
│  │ ▶ ● Dev Session              s-456   running   $0.52  1h23m  [+2]   │   │
│  │   ▼                                                                  │   │
│  │     id: 71a01f9a-7d1b-496c-95b4-e27f26cac125                        │   │
│  │     children:                                                        │   │
│  │       ✓ agent-creator    c-789   done   $0.12   8m                   │   │
│  │       ✓ test-designer    c-012   done   $0.08   5m                   │   │
│  │     fitness: ██████████░░░░░ 68%                                     │   │
│  │     workflow: block-forge                                            │   │
│  │     entry: create-agent, run-tests                                   │   │
│  │                                                                      │   │
│  │   ◆ Foundry Session          s-345   idle      $0.31  45m           │   │
│  │   ✓ Test Session             s-012   done      $0.08  12m           │   │
│  │                                                                      │   │
│  │ [j/k] navigate  [Enter] open  [d] delete  [1/2/3] tabs  [Esc] close│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:36  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## /session \<id\> — Session Monitor (multi-panel, mode-aware)

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:37:00  ❯ /session s-456                                                  │
│                                                                               │
│  ┌─ Session: Dev Session (s-456) ● running  1h 23m  $0.52 ─────────────┐   │
│  │                                                                       │   │
│  │ ┌─ EXECUTION ──────────────────┐ ┌─◆ PERMISSIONS ────────────────┐  │   │
│  │ │ [✓] file-read contract.json  │ │                               │  │   │
│  │ │ [✓] file-write agent.block   │ │ Parent: workspace ws-789      │  │   │
│  │ │ [→] inference...             │ │                               │  │   │
│  │ │                              │ │ ○ file-read                   │  │   │
│  │ │ Iter: 3/12  Cost: $0.04     │ │ ○ file-write                  │  │   │
│  │ └──────────────────────────────┘ │ ○ step-complete               │  │   │
│  │                                  │ · file-edit                   │  │   │
│  │ ┌─ EXECUTION LOG ─────────────┐ │ · shell-execute               │  │   │
│  │ │ 14:35:01 [ok] blockRef      │ │ · directory-list              │  │   │
│  │ │ 14:35:03 [ok] inference     │ │                               │  │   │
│  │ │ 14:35:05 [ok] file-write    │ │ Rules:                        │  │   │
│  │ │ 14:35:06 [→]  inference...  │ │ ✗ shell-execute (security)    │  │   │
│  │ └──────────────────────────────┘ └───────────────────────────────┘  │   │
│  │                                                                       │   │
│  │ [Tab] panels  [z] zoom  [↑↓] navigate  [Esc] close                   │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:37  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## /models — Status des modeles et providers

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:38:00  ❯ /models                                                         │
│                                                                               │
│  ┌─ Models ─────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │ Status: ● Online    Providers: 2    Models: 4    Device: cuda        │   │
│  │ Requests: 342  Tokens: 1.2M  Latency p50: 230ms  Errors: 0.1%      │   │
│  │                                                                       │   │
│  │ ▶ ● claude-sonnet-4-6     [anthropic]   active                       │   │
│  │   ● claude-haiku-4-5      [anthropic]                                │   │
│  │   ● claude-opus-4-6       [anthropic]                                │   │
│  │   ○ llama-3-70b           [local]       offline                      │   │
│  │                                                                       │   │
│  │ [j/k] navigate  [Enter] details  [P] playground                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:38  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## /catalog — Block catalog avec fitness

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:39:00  ❯ /catalog agents                                                 │
│                                                                               │
│  ┌─ Catalog — Agents ───────────────────────────────────────────────────┐   │
│  │ [1] All  [2] Workflows  [3] Agents  [4] Tools                        │   │
│  │                                                                       │   │
│  │ 5 block(s)                                                            │   │
│  │                                                                       │   │
│  │ ▶ [AGENT] agent-creator         agent-creator       68%  structured.. │   │
│  │   ▼                                                                   │   │
│  │     Description: Creates agent blocks from a contract definition      │   │
│  │     version: 1.0.0  atomic: no                                        │   │
│  │     fitness: ██████████░░░░░ 68%                                      │   │
│  │     capabilities: [structured-output] [tool-calling]                  │   │
│  │                                                                       │   │
│  │   [AGENT] test-designer         test-designer       72%  structured.. │   │
│  │   [AGENT] maestro-assistant     maestro-assistant    45%  conversation │   │
│  │   [AGENT] dev-orchestrator      dev-orchestrator      -  tool-calling │   │
│  │   [AGENT] research-agent        research-agent        -  conversation │   │
│  │                                                                       │   │
│  │ [j/k] navigate  [Space] expand  [Enter] details  [T] test  [Tab] type│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:39  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## /foundry — My blocks

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:40:00  ❯ /foundry                                                        │
│                                                                               │
│  ┌─ Foundry — My Blocks ───────────────────────────────────────────────┐    │
│  │                                                                      │    │
│  │ 3 block(s)  (1 workflow, 1 agent, 1 tool)                           │    │
│  │                                                                      │    │
│  │ ▶ [WORKFLOW] block-forge        block-forge-v2     │    │
│  │   [AGENT]    code-reviewer      code-reviewer-v1   │    │
│  │   [TOOL]     json-validator     json-validator     │    │
│  │                                                                      │    │
│  │ [j/k] navigate  [Space] expand  [Enter] details                     │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:40  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## /block \<id\> — Block detail avec Tools Requis

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:41:00  ❯ /block agent-creator                                            │
│                                                                               │
│  ┌─ Block: agent-creator ───────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │ ┌─ INFO ───────────────────────┐ ┌─ TOOLS REQUIS ────────────────┐  │   │
│  │ │ Type: agent  Atomic: no      │ │                               │  │   │
│  │ │ Version: 1.0.0               │ │ Ce block utilise :            │  │   │
│  │ │ Contract: agent-creator      │ │ ○ file-read                   │  │   │
│  │ │ Capabilities:                │ │ ○ file-write                  │  │   │
│  │ │  [structured-output]         │ │ ○ step-complete               │  │   │
│  │ │  [tool-calling]              │ │                               │  │   │
│  │ │ Model: claude-sonnet-4-6     │ │ La session doit autoriser     │  │   │
│  │ │ Max iterations: 12           │ │ ces tools pour que ce block   │  │   │
│  │ └─────────────────────────────┘ │ fonctionne correctement.      │  │   │
│  │                                  └───────────────────────────────┘  │   │
│  │ ┌─ FITNESS ────────────┐ ┌─ SESSIONS ────────────────────────────┐ │   │
│  │ │ Score: 68% ██████░░  │ │ Used in 3 sessions                    │ │   │
│  │ │ Perf:  75% ███████░  │ │ ● Dev Session        $0.12            │ │   │
│  │ │ Spec:  62% ██████░░  │ │ ● Foundry Session    $0.08            │ │   │
│  │ └─────────────────────┘ └─────────────────────────────────────────┘ │   │
│  │                                                                       │   │
│  │ [Esc] close                                                           │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:41  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## /workspace \<id\> — Workspace avec permissions (ceiling)

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:42:00  ❯ /workspace ws-789                                               │
│                                                                               │
│  ┌─ Workspace: Cantante Dev (ws-789) ───────────────────────────────────┐   │
│  │                                                                       │   │
│  │ ┌─ SESSIONS ──────────────────────┐ ┌─ PERMISSIONS (ceiling) ────┐  │   │
│  │ │ ● Dev Session      $0.52  [+2]  │ │                            │  │   │
│  │ │   ├─ agent-creator  $0.12  Done  │ │ ○ file-read               │  │   │
│  │ │   └─ test-designer  $0.08  Done  │ │ ○ file-write              │  │   │
│  │ │ ◆ Foundry Session   $0.31       │ │ ○ file-edit               │  │   │
│  │ │                                  │ │ ○ shell-execute           │  │   │
│  │ │                                  │ │ ○ directory-list          │  │   │
│  │ │ Settings:                        │ │ ○ step-complete           │  │   │
│  │ │  Max concurrent: 3              │ │ ○ json-validator          │  │   │
│  │ │  Auto-promote: on               │ │                            │  │   │
│  │ │  Min fitness: 0.50              │ │ AllowedBlocks: *           │  │   │
│  │ └──────────────────────────────────┘ └────────────────────────────┘  │   │
│  │                                                                       │   │
│  │ [j/k] navigate  [Enter] open session  [Esc] close                    │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:42  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## /permissions \<id\> — Diff visuel parent/enfant

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:43:00  ❯ /permissions c-789                                              │
│                                                                               │
│  ┌─ Permissions: agent-creator (c-789) ─────────────────────────────────┐   │
│  │                                                                       │   │
│  │ Parent: Dev Session (s-456)                                           │   │
│  │                                                                       │   │
│  │ Effective blocks:                                                     │   │
│  │   ○ file-read                                                         │   │
│  │   ○ file-write                                                        │   │
│  │   ○ step-complete                                                     │   │
│  │   · file-edit              (filtre — parent a, pas cette session)     │   │
│  │   · shell-execute          (filtre — parent a, pas cette session)     │   │
│  │   · directory-list         (filtre — parent a, pas cette session)     │   │
│  │   · json-validator         (filtre — parent a, pas cette session)     │   │
│  │                                                                       │   │
│  │ Block rules:                                                          │   │
│  │   ✗ shell-execute          Denied (security)                          │   │
│  │                                                                       │   │
│  │ Pour modifier: maestro session restrict c-789 --allow file-edit       │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:43  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## /model \<id\> — Model detail avec playground

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:44:00  ❯ /model claude-sonnet-4-6                                        │
│                                                                               │
│  ┌─ Model: claude-sonnet-4-6 ──────────────────────────────────────────┐    │
│  │                                                                      │    │
│  │ ┌─ HEALTH ────────────────┐ ┌─ USAGE ────────────────────────────┐ │    │
│  │ │ Status: ● Online        │ │ Requests: 342                      │ │    │
│  │ │ Provider: Anthropic     │ │ Avg latency: 230ms                 │ │    │
│  │ │ Device: cuda            │ │ Error count: 2                     │ │    │
│  │ │ Uptime: 2d 3h           │ │ Tokens in: 890K                   │ │    │
│  │ │ Load: low               │ │ Tokens out: 310K                  │ │    │
│  │ └────────────────────────┘ └──────────────────────────────────────┘ │    │
│  │                                                                      │    │
│  │ [P] playground  [Esc] close                                         │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:44  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## L'agent injecte des widgets dans ses reponses

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  14:50:00  ❯ Quels modeles sont disponibles ?                                │
│                                                                               │
│  14:50:01  ◆ Voici les modeles actuellement configures :                     │
│                                                                               │
│  ┌─ Models ─────────────────────────────────────────────────────────────┐   │
│  │ ● claude-sonnet-4-6     [anthropic]   active                         │   │
│  │ ● claude-haiku-4-5      [anthropic]                                  │   │
│  │ ● claude-opus-4-6       [anthropic]                                  │   │
│  │ ○ llama-3-70b           [local]       offline                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│            │ Le modele actif est claude-sonnet-4-6 via Anthropic.             │
│            │ llama-3-70b est offline — le GPU n'est pas demarre.             │
│            │ Voulez-vous changer de modele ou lancer le GPU local ?           │
│                                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ / _                                                                           │
│ ● connected  12ms  14:50  $0.52 today     /help commands  ? help  q quit      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Help overlay (? key) — mis a jour

```
┌─ maestro code ───────────────────────────────────────────────────────────────┐
│                                                                               │
│  ┌─ Help ───────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │ NAVIGATION                                                            │   │
│  │   /           Focus input bar                                         │   │
│  │   Esc         Close widget / return to chat                           │   │
│  │   Ctrl+C      Cancel task or quit                                     │   │
│  │   ?           Toggle this help                                        │   │
│  │   q           Quit                                                    │   │
│  │   j/k         Scroll chat                                             │   │
│  │                                                                       │   │
│  │ SLASH COMMANDS                                                        │   │
│  │   /status          System health + active sessions                    │   │
│  │   /spaces          Sessions, workspaces, repos                        │   │
│  │   /foundry         My blocks                                          │   │
│  │   /catalog         Block catalog with fitness                         │   │
│  │   /models          LLM models + providers                             │   │
│  │   /session <id>    Session monitor                                    │   │
│  │   /block <id>      Block details                                      │   │
│  │   /model <id>      Model details                                      │   │
│  │   /workspace <id>  Workspace details                                  │   │
│  │   /permissions <id> Session permissions diff                          │   │
│  │   /playground      Model playground                                   │   │
│  │   /create-agent    Create agent via block-forge                       │   │
│  │   /costs           View/set cost limits                               │   │
│  │   /new             New conversation                                   │   │
│  │   /clear           Clear conversation                                 │   │
│  │   /stop            Cancel current task                                │   │
│  │   /purge           Delete idle sessions                               │   │
│  │   /help            Show this help                                     │   │
│  │   /quit            Quit                                               │   │
│  │                                                                       │   │
│  │ WIDGET SHORTCUTS (quand un widget interactif est ouvert)              │   │
│  │   j/k         Navigate list                                           │   │
│  │   Enter       Open / expand                                           │   │
│  │   Space       Toggle expand                                           │   │
│  │   Tab         Cycle panels (session monitor)                          │   │
│  │   z           Zoom panel (session monitor)                            │   │
│  │   d           Delete (sessions)                                       │   │
│  │   r           Toggle filter (sessions)                                │   │
│  │   T           Run contract test (catalog)                             │   │
│  │   P           Playground (models)                                     │   │
│  │   1/2/3/4     Switch tabs / filters                                   │   │
│  │   Esc         Close widget                                            │   │
│  │                                                                       │   │
│  │ [Esc] or [?] to close                                                 │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```
