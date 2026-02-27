# Analyse Ultra-Profonde — L'Agent maestro-code et la Philosophie Maestro

**Date** : 2026-02-27
**Question** : "Ça devrait être un agent qu'on crée qui a des tools qui lui permet de naviguer et d'utiliser Maestro. Est-ce que ça suit la philosophie Maestro ?"

---

## 1. Les Principes Fondamentaux (citations directes)

### Principe 1 : Tout est un Bloc

> *"There is no Agent entity. There is no Tool entity. There are only Blocks with different types."*
> — ADR PHASE-18

> *"Le type d'un block definit son interface, pas son implementation."*
> — PHASE-26 ADR

Un agent est un bloc. Ses tools sont des blocs. Quand on dit "un agent avec des tools", on dit "un bloc composite (`isAtomic: false`) dont le prompt système déclare quels autres blocs il peut invoquer."

**Verdict** : L'idée d'un "agent avec des tools" EST la philosophie Maestro. C'est exactement ainsi que `jarvis`, `dev-orchestrator`, et tous les agents fonctionnent déjà.

### Principe 2 : Infrastructure Générique, Contenu Spécifique

> *"L'infrastructure est generique, le contenu est specifique. C'est la force de Maestro."*
> — MAESTRO-PHILOSOPHY.md

> *"Can a new session type be created with ONLY JSON changes? If the answer is no, the architecture is violated."*
> — CLAUDE.md

L'infrastructure (C# backend, CLI, TUI) ne doit pas contenir de logique spécifique à un type de session. Le comportement vient des templates (JSON) et des blocs.

**Verdict** : Le TUI ne devrait pas hardcoder "si c'est un message dev, template X; sinon template Y". Le routing devrait être dans un bloc.

### Principe 3 : CLI-First

> *"An agent has ONE tool: the maestro-cli block. Through this block, it can do EVERYTHING."*
> — docs/system/README.md

> *"ALL operations go through the CLI — for humans AND agents."*
> — CLAUDE.md

Toute opération passe par le CLI. L'agent utilise le CLI pour interagir avec Maestro.

### Principe 4 : Les Sessions sont les Contextes d'Exécution

> *"Sessions are the runtime execution contexts in Maestro."*
> — docs/system/architecture/sessions.md

> *"Sessions carry their own behavior entirely through variables and template data."*
> — CLAUDE.md

Les sessions fournissent : variables persistantes, monitoring (`_executionTree`), historique, pause/resume, permissions, binding au filesystem.

### Principe 5 : Self-Describing Sessions

> *"The infrastructure reads these — it NEVER creates them. If a variable is missing, log a warning and continue with empty/default display. Don't invent data."*
> — CLAUDE.md

Les sessions portent leur propre configuration via les variables. Le backend lit et exécute — il ne décide jamais.

---

## 2. Analyse de l'Architecture Proposée (AGENT-ARCHITECTURE-ANALYSIS.md)

Mon analyse précédente proposait :

```
TUI → POST /api/blocks/maestro-assistant/execute → Agent → Tools → Résultat
(PAS de session)
```

### Ce qui est CORRECT dans cette proposition

| Aspect | Alignement |
|--------|-----------|
| L'agent est un bloc | ✅ Philosophie respectée |
| Les tools sont des blocs | ✅ Philosophie respectée |
| Le routing d'intent est dans l'agent (pas le TUI) | ✅ Contenu dans le bloc, pas dans l'infra |
| L'agent peut invoquer d'autres agents via `run-block` | ✅ Composition de blocs |

### Ce qui est FAUX dans cette proposition

| Aspect | Violation |
|--------|-----------|
| **Pas de session** | ❌ Les sessions SONT les contextes d'exécution. Sans session, on perd le monitoring, la persistance, l'historique |
| **TUI maintient l'historique** | ❌ L'état devrait être dans les variables de session, pas dans le TUI |
| **POST /api/blocks/{id}/execute** | ❌ Perd `_executionTree`, `_executionLog`, `_llmActivity`. Le TUI ne peut plus montrer la progression |
| **Pas de monitoring** | ❌ L'utilisateur voit un écran vide pendant 60-120s pour un dev task |

### Preuve technique : ce que perd l'exécution sans session

En analysant `BlocksController.Execute()` vs `SessionsController.Invoke()` :

**Avec session (invoke)** :
- `EntryPointExecutor` crée un `ExecutionContext` lié à la session
- Chaque étape met à jour `session.SetVariable("_executionTree", tree)`
- Le TUI poll `GET /api/sessions/{id}` et voit la progression
- Les variables persistent entre invocations
- L'historique de commandes est tracké

**Sans session (execute)** :
- `BlocksController` crée un `ExecutionContext` jetable
- Pas de `_executionTree` → le TUI ne voit rien
- Pas de persistance → chaque appel est isolé
- Pas d'historique → aucune traçabilité
- L'agent termine (`step-complete`) → tout est perdu

**Conclusion** : L'exécution sans session viole le principe "Sessions are the runtime execution contexts."

---

## 3. L'Architecture Correcte

### Le Pattern : UNE Session Persistante

```
Démarrage du TUI :
  → Créer UNE session "assistant"
  → Importer template "maestro-assistant"
  → Démarrer la session
  → La session VIVE pour toute la durée du TUI

Message 1 : "Salut, comment vas-tu ?"
  → invoke("chat", { message: "Salut..." })
  → Agent répond directement (pas de run-block)
  → step-complete
  → Session reste active

Message 2 : "Quels projets sont en cours ?"
  → invoke("chat", { message: "Quels projets...", history: [...msg1...] })
  → Agent utilise tool: shell-execute("node index.js session list")
  → Agent résume les résultats
  → step-complete

Message 3 : "Crée formatTime.ts dans Cantante"
  → invoke("chat", { message: "Crée...", history: [...msg1, msg2...] })
  → Agent utilise tool: run-block("dev-orchestrator", { task: "...", repoPath: "C:\Cantante" })
  → dev-orchestrator fait son workflow (le TUI voit _executionTree)
  → Agent résume le résultat
  → step-complete

TOUTE la conversation est continue. La session persiste l'état.
```

### Pourquoi ça respecte TOUS les principes

| Principe | Comment c'est respecté |
|----------|----------------------|
| Tout est un bloc | L'agent `maestro-assistant` EST un bloc. Ses tools SONT des blocs |
| Infrastructure générique | Le TUI ne sait pas ce que l'agent fait. Il envoie des messages et affiche des résultats |
| CLI-first | L'agent utilise `shell-execute` + CLI pour administrer Maestro |
| Sessions = contextes | La session fournit le monitoring, la persistance, l'historique |
| Self-describing | Le template `maestro-assistant` définit les phases, le layout, les entry points |
| Contenu dans les blocs | Le routing d'intent est dans le prompt de l'agent, pas dans le code TUI |

### Le Template `maestro-assistant.session.json`

```json
{
  "id": "maestro-assistant",
  "name": "Maestro Assistant",
  "type": "project",
  "entryPoints": {
    "chat": "maestro-assistant"
  },
  "variables": {
    "sessionMode": "assistant",
    "_conversationHistory": [],
    "_phases": [
      { "id": "listening", "name": "Listening", "status": "active" },
      { "id": "processing", "name": "Processing", "status": "pending" }
    ],
    "_monitorDescriptor": {
      "layout": { "mode": "split-horizontal" },
      "components": [
        { "id": "exec-tree", "type": "execution-tree", "zone": "top" },
        { "id": "exec-log", "type": "log-panel", "zone": "bottom" }
      ]
    },
    "_executionTree": [],
    "_executionLog": [],
    "_llmActivity": [],
    "_blockOutputs": {}
  }
}
```

### Le Bloc `maestro-assistant`

```json
{
  "id": "maestro-assistant",
  "blockType": "agent",
  "isAtomic": false,
  "config": {
    "systemPromptFile": "system-prompt.md",
    "maxIterations": 30,
    "wallClockTimeoutSeconds": 600,
    "context": {
      "strategy": "sliding-window",
      "maxTokens": 32768,
      "keepLastN": 20
    },
    "nodes": [{
      "id": "reasoning",
      "blockRef": "inference",
      "config": { "model": "claude-sonnet-4-6", "maxTokens": 4096 }
    }]
  }
}
```

Le prompt système déclare les tools :

```markdown
# Maestro Assistant

Tu es l'assistant principal de Maestro Code. Tu aides l'utilisateur avec
n'importe quelle tâche : questions, navigation, développement, administration.

## Tools disponibles

### Conversation
- Réponds directement aux questions simples
- Lis l'historique dans `history` (input) pour le contexte

### Fichiers
- file-read: lire un fichier
- file-write: écrire un fichier
- file-edit: modifier un fichier
- directory-list: lister un répertoire

### Exécution
- shell-execute: exécuter une commande shell

### Maestro (via shell-execute + CLI)
- Sessions: shell-execute("node /path/cli session list")
- Blocs: shell-execute("node /path/cli list-blocks")
- Santé: shell-execute("node /path/cli health")

### Développement (via run-block)
- run-block("dev-orchestrator", {task, repoPath}): workflow dev complet
- run-block("task-planner", {task, context}): planifier une tâche
- run-block("test-executor", {workingDir}): exécuter les tests
- run-block("code-reviewer", {filePaths, context}): revoir du code

### Mémoire
- memory-read: lire la mémoire projet
- memory-write: sauvegarder des informations

### Fin
- step-complete: quand tu as terminé

## Règles
1. Pour les questions simples → répondre directement, JAMAIS de run-block
2. Pour les tâches dev → run-block("dev-orchestrator", ...)
3. Pour l'admin Maestro → shell-execute + CLI
4. TOUJOURS step-complete quand terminé
```

### Le Flux dans le TUI

```typescript
// Au démarrage du TUI
class AgentSession {
  private sessionId: string | null = null;
  private conversationHistory: { role: string; content: string }[] = [];

  async initialize(client, importTemplate) {
    // Créer UNE session au démarrage
    const session = await client.createSession({
      authority: 'human',
      name: 'Maestro Assistant',
    });
    this.sessionId = session.id;
    await importTemplate(session.id, 'maestro-assistant');
    await client.startSession(session.id);
  }

  async sendMessage(message: string, addLine, setBusy) {
    setBusy(true);
    this.conversationHistory.push({ role: 'user', content: message });

    // Invoquer le MÊME entry point sur la MÊME session
    await client._fetch('POST',
      `/api/sessions/${this.sessionId}/invoke/chat`,
      { body: { inputs: {
        message,
        history: JSON.stringify(this.conversationHistory),
      }}}
    );

    // Poller pour le résultat (comme aujourd'hui)
    this.startPolling(addLine, setBusy);
  }
}
```

**Différences clés vs l'architecture actuelle** :
- UNE session créée au démarrage (pas une par message)
- La session est réutilisée pour tous les messages
- L'historique est passé en input à chaque invocation
- L'agent décide du routing (pas le TUI)
- Le TUI reste de l'infrastructure pure

---

## 4. Comparaison : Les 3 Options

### Option A : Sans Session (ma proposition précédente) ❌

```
TUI → POST /api/blocks/{id}/execute → résultat
```

- ❌ Perd le monitoring (`_executionTree`)
- ❌ Perd la persistance
- ❌ Viole "sessions = contextes d'exécution"
- ✅ Simple
- ✅ Rapide pour les questions simples

### Option B : Session Par Message (architecture actuelle) ❌

```
Message → nouvelle session → template → start → invoke → poll → jetée
```

- ❌ Aucune continuité
- ❌ Overhead énorme (création + import + start par message)
- ❌ L'agent ne se souvient de rien
- ✅ A le monitoring
- ✅ A la persistance (mais inutile — session jetée)

### Option C : Session Persistante (correct) ✅

```
Démarrage → UNE session → réutilisée pour tous les messages
```

- ✅ Continuité conversationnelle
- ✅ Monitoring complet
- ✅ Persistance de l'état
- ✅ L'agent est un bloc avec des tools
- ✅ Le routing est dans l'agent (pas dans le TUI)
- ✅ Respecte TOUS les principes de la philosophie
- ⚠️ Nécessite que `invoke()` fonctionne plusieurs fois sur la même session

---

## 5. Question Technique : `invoke()` Multiples sur la Même Session

L'architecture actuelle d'`EntryPointExecutor` est conçue pour UNE invocation par session. Chaque `invoke()` :
1. Crée un nouvel `ExecutionContext`
2. Construit un nouvel `_executionTree`
3. Exécute le workflow

**Question** : Peut-on invoquer plusieurs fois le même entry point sur la même session ?

**Analyse du code** (`EntryPointExecutor.cs`) :
- L'executor lit les entry points de la session → OK, ils persistent
- Il crée un nouveau `ExecutionContext` à chaque invocation → OK
- Il écrase `_executionTree` et `_executionLog` → ⚠️ perd l'historique de l'invocation précédente

**Impact** : À chaque nouveau message, l'ancien `_executionTree` est remplacé. Le TUI ne voit que l'exécution en cours. C'est acceptable — on veut voir l'exécution actuelle, pas l'ancienne.

**Conclusion** : Techniquement faisable. L'executor ne vérifie pas "est-ce que j'ai déjà été invoqué". Il crée un nouveau contexte et exécute.

---

## 6. Persistance de la Conversation

### Le Problème

`AgentBlockExecutor` utilise `IConversationManager` (in-memory). Chaque invocation crée une nouvelle conversation. L'agent ne se souvient pas des messages précédents.

### La Solution Conforme à la Philosophie

Passer l'historique dans les inputs de l'invocation :

```json
{
  "inputs": {
    "message": "Et les tests ?",
    "history": "[{\"role\":\"user\",\"content\":\"Crée formatTime.ts\"},{\"role\":\"assistant\",\"content\":\"Fichier créé\"}]"
  }
}
```

L'agent lit `history` et l'intègre dans son contexte. C'est le même pattern que les chat completions classiques.

**Alternative** : Stocker l'historique dans une variable de session `_conversationHistory`. Le TUI le lit/écrit via l'API :
```
PUT /api/sessions/{id}/variables/_conversationHistory
```

Mais c'est plus complexe et mélange les responsabilités. L'historique côté TUI est plus simple et suffisant.

---

## 7. Points de Tension avec la Philosophie

### Tension 1 : "CLI-first" vs Performance

La philosophie dit que l'agent utilise le CLI. Mais :
- `shell-execute("node index.js session list")` lance un nouveau process Node.js
- Le CLI parse les arguments, connecte au backend, fait l'opération, sérialise en JSON, quitte
- C'est 2-5s de overhead par appel CLI

Pour des questions simples ("quels projets ?"), l'agent ferait :
1. Tool call → shell-execute → CLI → backend API → JSON
2. Parse le JSON
3. Résume pour l'utilisateur

C'est correct architecturalement mais lent. L'alternative serait des tool blocs dédiés (`maestro-sessions`, `maestro-blocks`) qui appellent l'API directement. Mais ça ajoute des blocs.

**Recommandation** : Commencer avec `shell-execute` + CLI (conforme). Si c'est trop lent, créer des tool blocs dédiés plus tard. Le CLI reste le chemin canonique.

### Tension 2 : Session de longue durée vs "Sessions pour le vrai travail"

Le CLAUDE.md dit :
> *"NEVER create a session to 'test' Maestro infrastructure. Sessions are for real work on real projects."*

Et les noms doivent être descriptifs :
> *"Cantante - File Tree Module", not "Agent Test"*

Une session "Maestro Assistant" est-elle du "vrai travail" ? Oui — l'utilisateur travaille avec l'assistant. La session pourrait s'appeler `"Assistant - [date]"` ou `"[username] - Interactive Session"`.

### Tension 3 : Template pour un agent conversationnel

Les templates existants (`project-autonomous`, `foundry-default`) sont conçus pour des workflows avec phases. Un agent conversationnel n'a pas de "phases" au sens classique.

Mais le template peut définir des phases minimales :
```json
"_phases": [
  { "id": "listening", "name": "Ready", "status": "active" }
]
```

Ou même aucune phase — le `_monitorDescriptor` peut définir un layout sans phase-list.

---

## 8. Le Rôle du TUI dans Cette Architecture

### Ce que le TUI fait (infrastructure)

1. **Affiche** les messages (ConversationLog)
2. **Envoie** les messages (TaskInputBar → invoke)
3. **Poll** la session pour la progression (toutes les 2s)
4. **Montre** l'état de l'agent (AgentStatus)
5. **Navigue** entre les pages (Home, Spaces, etc. via API client)
6. **Maintient** l'historique de conversation localement

### Ce que le TUI NE fait PAS (contenu)

1. ~~Décide si c'est un dev task ou pas~~ → L'agent décide
2. ~~Choisit le template~~ → UN template, toujours le même
3. ~~Route vers différents entry points~~ → UN entry point : `chat`
4. ~~Parse la réponse de l'agent~~ → L'agent structure sa propre réponse
5. ~~Gère les phases~~ → Le backend met à jour `_executionTree`

**Le TUI devient PUREMENT de l'infrastructure.** Il ne sait rien du domaine. Il envoie des messages et affiche des résultats. C'est exactement ce que la philosophie demande.

---

## 9. Réponse à la Question

> "Ça devrait être un agent qu'on crée qui a des tools qui lui permet de naviguer et d'utiliser Maestro. Est-ce que ça suit la philosophie Maestro ?"

**OUI, à condition de :**

1. **L'agent est un bloc** (`maestro-assistant.agent.block.json`) — pas du code TypeScript
2. **Ses tools sont des blocs** (file-read, shell-execute, run-block, etc.) — déclarés dans le prompt, pas hardcodés
3. **Il vit dans une session** — UNE session persistante créée au démarrage du TUI
4. **Le routing d'intent est dans le prompt** — l'agent décide quoi faire, pas le TUI
5. **Le TUI est de l'infrastructure pure** — envoie des messages, affiche des résultats, poll la session
6. **Le template est générique** — `maestro-assistant.session.json` définit le layout et l'entry point

**Ce qui VIOLERAIT la philosophie :**

- ❌ Exécuter l'agent sans session (perd monitoring + persistance)
- ❌ Hardcoder le routing d'intent dans le TUI (contenu dans l'infra)
- ❌ Créer une session par message (overhead, pas de continuité)
- ❌ Mettre la logique de l'agent dans du code TypeScript (devrait être dans un bloc)

---

## 10. Plan d'Implémentation Conforme

### Phase 1 : Bloc `maestro-assistant` (2h)

Créer le bloc agent avec son prompt système. Le tester via CLI :
```bash
node index.js run maestro-assistant --input message="Salut"
node index.js run maestro-assistant --input message="Liste les sessions"
```

### Phase 2 : Template `maestro-assistant.session.json` (30min)

Template minimal : entry point `chat` → bloc `maestro-assistant`, pas de phases complexes.

### Phase 3 : Remplacer SessionManager (3h)

Nouveau `AgentSession` qui :
- Crée UNE session au démarrage
- Réutilise la session pour chaque message
- Passe l'historique de conversation en input
- Poll la session pour la progression (comme aujourd'hui)
- Extrait la réponse de l'agent

### Phase 4 : Nettoyage (1h)

- Supprimer `looksLikeDevTask()` du TUI (le routing est dans l'agent maintenant)
- Supprimer la sélection de template dans App.ts
- Le TUI ne connaît qu'UN template et UN entry point

---

## 11. Schéma Final

```
┌─── maestro-code TUI (Infrastructure) ──────────────────────┐
│                                                              │
│  ┌─ AgentSession ────────────────────────────────────────┐  │
│  │ sessionId: "abc-123" (créé au démarrage)              │  │
│  │ history: [{role, content}, ...]                        │  │
│  │                                                        │  │
│  │ sendMessage(msg) {                                     │  │
│  │   history.push({role: 'user', content: msg})           │  │
│  │   invoke("chat", { message: msg, history })            │  │
│  │   poll session for _executionTree                      │  │
│  │   extract response → history.push(response)            │  │
│  │ }                                                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ TUI Components ─────────────────────────────────────┐   │
│  │ NavBar │ AgentStatus │ ConversationLog │ TaskInputBar │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                          │
                    invoke("chat")
                          │
                          ▼
┌─── Backend (Infrastructure Générique) ──────────────────────┐
│                                                              │
│  EntryPointExecutor                                          │
│    → Lit entry point "chat" → bloc "maestro-assistant"      │
│    → Crée ExecutionContext                                   │
│    → AgentBlockExecutor.ExecuteAsync()                       │
│                                                              │
│  AgentBlockExecutor (boucle agentique)                       │
│    → Lit system-prompt.md                                    │
│    → Ajoute message + history au contexte                    │
│    → Boucle: LLM → tool call → dispatch bloc → résultat    │
│    → step-complete → fin                                     │
│                                                              │
│  Met à jour session variables:                               │
│    _executionTree, _executionLog, _llmActivity               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                          │
                    tool dispatch
                          │
                          ▼
┌─── Blocs (Contenu Spécifique) ──────────────────────────────┐
│                                                              │
│  maestro-assistant (agent) ─── le cerveau                    │
│    ├── file-read, file-write, file-edit (tools)             │
│    ├── shell-execute (tool) → CLI Maestro                    │
│    ├── run-block → dev-orchestrator (agent)                  │
│    │     ├── task-planner (agent)                            │
│    │     ├── backend-developer (agent)                       │
│    │     ├── test-executor (agent)                           │
│    │     └── git-committer (agent)                           │
│    ├── run-block → research-agent (agent)                    │
│    ├── memory-read, memory-write (tools)                     │
│    └── step-complete (built-in)                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

C'est Maestro qui fait tourner Maestro. L'agent utilise les blocs de Maestro pour accomplir des tâches. Le TUI est juste la vitre.
