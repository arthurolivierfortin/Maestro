# Analyse Profonde — L'Agent Maestro Code comme Bloc avec Tools

**Date** : 2026-02-27
**Contexte** : Feedback utilisateur — "ça devrait être un agent qu'on crée qui a des tools qui lui permet de naviguer et d'utiliser Maestro"

---

## 1. Le Problème Fondamental

### Ce qu'on a construit (faux)

```
User tape "Salut"
  → App.ts crée une SESSION
  → Importe un TEMPLATE (project-autonomous ou jarvis)
  → Démarre la session
  → Invoque un ENTRY POINT
  → Poll le backend toutes les 2s
  → Session se termine
  → Résultat affiché

User tape "Crée un fichier"
  → NOUVELLE SESSION (l'ancienne est jetée)
  → Re-importe le template
  → Re-démarre
  → Re-invoque
  → ...
```

Chaque message = nouvelle session, nouveau template, nouveau contexte. **Aucune continuité.** C'est un lanceur de tâches, pas un agent.

### Ce qu'on devrait avoir (correct)

```
Au démarrage : maestro-code crée UN agent (bloc) avec des tools
L'agent VIVE et attend des messages

User tape "Salut"
  → Message envoyé à l'agent
  → Agent répond "Salut ! Que puis-je faire pour toi ?"
  → 2 secondes

User tape "Quels projets sont en cours?"
  → Agent utilise tool: list-sessions
  → Agent utilise tool: list-workspaces
  → Agent répond avec les données
  → 5 secondes

User tape "Crée formatTime.ts dans Cantante"
  → Agent utilise tool: run-block(dev-orchestrator, {task: "...", repoPath: "C:\Cantante"})
  → dev-orchestrator fait son workflow complet
  → Agent résume le résultat
  → 60-120 secondes

TOUTE la conversation est continue. L'agent se souvient de tout.
```

### Pourquoi c'est exactement le but de Maestro

La philosophie Maestro dit :

> *"Un agent est un bloc composite (isAtomic: false) avec la même interface qu'un bloc d'inférence (prompt → response). Son implémentation interne est une boîte noire."*

> *"Les tools sont des blocs. Un agent les invoque par nom via tool dispatch."*

> *"Tout est un bloc. Il n'y a pas d'entité Agent séparée."*

maestro-code devrait simplement être **l'interface TUI vers un agent Maestro**. L'agent est un bloc. Ses tools sont des blocs. Le TUI ne fait que :
1. Afficher les messages
2. Envoyer les messages de l'utilisateur
3. Montrer l'état de l'agent

---

## 2. Ce Qui Existe Déjà

### Exécution de blocs sans session

```
POST /api/blocks/{id}/execute
Body: { inputs: { message: "Salut" } }
→ ExecutionContext.Create() (pas de session)
→ BlockExecutorRegistry.Get(blockType)
→ executor.ExecuteAsync(block, context, inputs)
→ Résultat
```

**Ça marche déjà.** Un agent peut s'exécuter sans session. `AgentBlockExecutor` crée un `IConversationManager` en mémoire, fait sa boucle agentique, dispatche les tools via block discovery.

### Le bloc `jarvis` existe

```json
{
  "id": "jarvis",
  "blockType": "agent",
  "isAtomic": false,
  "config": {
    "systemPromptFile": "system-prompt.md",
    "context": { "strategy": "sliding-window", "maxTokens": 32768, "keepLastN": 20 },
    "nodes": [{ "id": "reasoning", "blockRef": "inference", "config": { "model": "claude-sonnet-4-6" } }]
  }
}
```

Ses tools actuels (déclarés dans `system-prompt.md`) :
- `file-read`, `file-write`, `file-edit`
- `directory-list`
- `shell-execute`
- `run-block` — **peut invoquer n'importe quel autre bloc**
- `step-complete`

### 19 blocs tools disponibles

| Catégorie | Tools |
|-----------|-------|
| Fichiers | `file-read`, `file-write`, `file-edit`, `directory-list` |
| Exécution | `shell-execute` |
| Git | `git-status`, `git-log`, `git-diff` |
| Mémoire | `memory-read`, `memory-write` |
| État | `state-manager` |
| Web | `web-search` |
| Validation | `json-validator` |
| Browser | `playwright-screenshot`, `playwright-interact`, `playwright-accessibility` |
| Audio | `speech-to-text`, `text-to-speech` |
| Composition | `run-block` (built-in dans l'executor) |

### 17 agents spécialisés disponibles (via `run-block`)

| Agent | Rôle |
|-------|------|
| `dev-orchestrator` | Orchestre le développement complet |
| `task-planner` | Décompose en étapes atomiques |
| `task-architect` | Design architecture |
| `project-analyzer` | Analyse le projet |
| `backend-developer` | Implémente le backend |
| `frontend-developer` | Implémente le frontend |
| `test-writer` | Écrit les tests |
| `test-executor` | Exécute les tests |
| `code-reviewer` | Revue de code |
| `git-committer` | Commits git |
| `research-agent` | Recherche web |

---

## 3. Ce Qui Manque

### 3.1 Persistance de conversation

**Problème** : `InMemoryConversationManager` ne persiste pas. Quand l'agent termine son exécution (`step-complete`), la conversation est perdue. Au prochain message, c'est une conversation vide.

**Ce qu'il faut** : Un mécanisme pour :
1. Sauvegarder la conversation quand l'agent attend un message
2. La restaurer quand l'utilisateur envoie un nouveau message
3. Le tout sans créer de nouvelle session

**Solutions possibles** :

#### Option A — Conversation persistée côté TUI (simple, rapide)
```
TUI maintient l'historique des messages localement.
À chaque message, l'agent est invoqué via POST /api/blocks/jarvis/execute
avec l'historique complet dans les inputs.
L'agent reçoit le contexte et répond.
```

Avantages : Simple, pas de changement backend, fonctionne maintenant.
Inconvénients : L'historique est dans les inputs (pas dans la conversation de l'agent), taille limitée.

#### Option B — Agent persistant côté backend (correct, plus complexe)
```
POST /api/agents/maestro-code/start → crée une conversation persistée
POST /api/agents/maestro-code/message → ajoute un message et continue l'agent
GET /api/agents/maestro-code/state → état de la conversation
```

Le backend maintient l'agent en vie (ou le reprend) avec sa conversation complète.

Avantages : Architecture propre, conversation gérée par le backend, mémoire automatique.
Inconvénients : Nécessite de nouveaux endpoints backend et un `PersistentConversationManager`.

#### Option C — Session unique réutilisée (compromis)
```
Au démarrage, créer UNE session "agent".
L'agent vit dans cette session.
Chaque message est envoyé via PUT /api/sessions/{id}/variables/_userMessage
L'interaction-handler (qui existe déjà) traite le message.
```

Avantages : Utilise l'infra existante (interaction-handler, session variables).
Inconvénients : L'agent est lié à une session (mais c'est une seule session, pas une par message).

### 3.2 Tools Maestro (navigation)

Le jarvis actuel a des tools de fichiers et shell. Il lui manque des tools spécifiques à Maestro :

| Tool manquant | Ce qu'il fait |
|---------------|---------------|
| `maestro-sessions` | Liste/cherche les sessions (GET /api/sessions) |
| `maestro-blocks` | Liste/cherche les blocs (GET /api/blocks) |
| `maestro-workspaces` | Liste les workspaces |
| `maestro-health` | Check la santé des services |
| `maestro-models` | Liste les modèles disponibles |

**MAIS** : Ces tools peuvent être remplacés par `shell-execute` + CLI :
```json
{"tool":"shell-execute","args":{"command":"node /c/Meastro/packages/maestro-cli/index.js session list"}}
```

Ou par des appels API directs via `shell-execute` + `curl`.

**La question est : créer des blocs tools dédiés ou utiliser shell-execute ?**

Réponse : Pour un premier MVP, `shell-execute` + CLI suffit. L'agent sait utiliser le CLI. Plus tard, des tools dédiés seraient plus propres et plus rapides.

### 3.3 Prompt système enrichi

Le prompt de jarvis est minimal. Pour être un vrai assistant Maestro, il doit savoir :
- Qu'il EST l'agent de maestro-code
- Quels projets existent (via tools)
- Qu'il peut déléguer le dev à `dev-orchestrator` via `run-block`
- Qu'il peut lire/écrire la mémoire projet via `memory-read`/`memory-write`
- Qu'il doit répondre directement aux questions simples (pas de workflow)
- Comment utiliser le CLI Maestro pour administrer

---

## 4. Architecture Cible

### Vue d'ensemble

```
┌─ maestro-code TUI ──────────────────────────────────────┐
│                                                          │
│  TaskInputBar: "Crée formatTime.ts dans Cantante"       │
│          ↓                                               │
│  Conversation locale (messages user + agent)             │
│          ↓                                               │
│  POST /api/blocks/maestro-assistant/execute              │
│    inputs: { message: "Crée formatTime.ts...",           │
│              history: [...messages précédents...],        │
│              context: { projects: [...], ... } }         │
│          ↓                                               │
│  Backend: AgentBlockExecutor                             │
│    → Agent lit le message                                │
│    → Détecte: tâche dev sur Cantante                     │
│    → Tool: run-block(dev-orchestrator,                   │
│            {task: "formatTime.ts", repoPath: "..."})     │
│    → dev-orchestrator fait son workflow                  │
│    → Agent reçoit le résultat                            │
│    → Tool: step-complete("Fichier créé avec succès")     │
│          ↓                                               │
│  TUI affiche la réponse dans ConversationLog             │
│                                                          │
│  User tape: "Et les tests?"                              │
│          ↓                                               │
│  POST /api/blocks/maestro-assistant/execute              │
│    inputs: { message: "Et les tests?",                   │
│              history: [...incluant échange précédent...] }│
│    → Agent comprend le contexte (formatTime)             │
│    → Tool: run-block(dev-orchestrator,                   │
│            {task: "tests pour formatTime.ts", ...})      │
│    → step-complete("Tests créés et passent")             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Le bloc `maestro-assistant`

Un nouveau bloc agent, basé sur jarvis mais enrichi :

```json
{
  "id": "maestro-assistant",
  "blockType": "agent",
  "isAtomic": false,
  "description": "Assistant principal de maestro-code. Répond aux questions, navigue dans Maestro, et délègue le développement aux agents spécialisés.",
  "inputs": [
    { "id": "message", "type": "string", "required": true },
    { "id": "history", "type": "string", "required": false, "description": "JSON array of previous messages" },
    { "id": "context", "type": "string", "required": false, "description": "Current project context" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "maxIterations": 30,
    "wallClockTimeoutSeconds": 600,
    "context": { "strategy": "sliding-window", "maxTokens": 32768, "keepLastN": 20 },
    "nodes": [
      { "id": "reasoning", "blockRef": "inference",
        "config": { "model": "claude-sonnet-4-6", "maxTokens": 4096, "temperature": 0.3 } }
    ]
  }
}
```

### Tools de l'assistant

```markdown
# system-prompt.md — Maestro Assistant

Tu es l'assistant de Maestro Code. Tu peux :

## Conversation
- Répondre aux questions de l'utilisateur
- Te souvenir du contexte de la conversation (via history dans inputs)

## Navigation Maestro
- shell-execute: node /path/to/cli session list → voir les sessions
- shell-execute: node /path/to/cli list-blocks → voir les blocs
- shell-execute: node /path/to/cli health → vérifier les services
- shell-execute: curl http://localhost:5000/api/sessions → API directe

## Développement (délégation)
- run-block: dev-orchestrator → workflow dev complet
- run-block: task-planner → planifier une tâche
- run-block: code-reviewer → revoir du code
- run-block: test-executor → exécuter les tests

## Fichiers
- file-read, file-write, file-edit, directory-list

## Mémoire
- memory-read: lire la mémoire projet
- memory-write: sauvegarder des infos

## Règles
1. Pour les questions simples → répondre directement, PAS de run-block
2. Pour les tâches dev → utiliser run-block(dev-orchestrator)
3. Pour l'admin Maestro → utiliser shell-execute + CLI
4. TOUJOURS step-complete quand fini
```

### Changements dans le TUI

```typescript
// SessionManager.ts — REMPLACÉ par AgentClient

class AgentClient {
  private history: { role: string; content: string }[] = [];
  private client: IApiClient;

  async sendMessage(
    message: string,
    addLine: (line: LogLine) => void,
    setBusy: (b: boolean) => void
  ): Promise<void> {
    // 1. Ajouter le message à l'historique local
    this.history.push({ role: 'user', content: message });

    // 2. Invoquer l'agent directement (PAS de session)
    setBusy(true);
    const result = await this.client._fetch('POST', '/api/blocks/maestro-assistant/execute', {
      body: {
        inputs: {
          message,
          history: JSON.stringify(this.history),
          context: JSON.stringify(this.getContext()),
        }
      }
    });

    // 3. Ajouter la réponse à l'historique
    const response = result.outputs?.result || result.outputs?.summary;
    this.history.push({ role: 'assistant', content: response });

    // 4. Afficher
    addLine({ text: 'Agent:', color: 'cyan', bold: true });
    addLine({ text: `  ${response}`, color: 'white' });
    setBusy(false);
  }
}
```

---

## 5. Plan d'Implémentation

### Phase 1 : Créer le bloc `maestro-assistant` (1-2h)

1. Créer `content/system/blocks/agents/maestro-assistant/maestro-assistant.agent.block.json`
2. Écrire `system-prompt.md` avec les tools appropriés
3. Tester via CLI : `node index.js run maestro-assistant --input message="Salut"`
4. Vérifier que `run-block(dev-orchestrator)` fonctionne comme tool

### Phase 2 : Remplacer SessionManager par AgentClient (2-3h)

1. Créer `services/AgentClient.ts` — invoque le bloc directement
2. Maintient l'historique localement
3. Modifier `App.ts` pour utiliser `AgentClient` au lieu de `SessionManager`
4. Plus de templates, plus d'import, plus de polling — juste envoyer/recevoir

### Phase 3 : Streaming et feedback en temps réel (2-3h)

Le problème : `POST /api/blocks/{id}/execute` est synchrone. L'agent peut prendre 60-120s pour un dev task. L'utilisateur ne voit rien pendant ce temps.

Solutions :
1. **Polling des logs** : L'agent écrit dans `_executionLog` via `state-manager` → le TUI poll
2. **SSE/WebSocket** : Le backend streame les événements d'exécution
3. **Exécution asynchrone** : `POST /api/blocks/{id}/execute-async` → retourne un `runId`, le TUI poll `GET /api/runs/{runId}/status`

La solution la plus pragmatique : **exécution asynchrone + polling**, car le TUI sait déjà poller.

### Phase 4 : Persistance conversation (1-2h)

1. Sauvegarder `history` dans `~/.maestro/conversations/`
2. Au démarrage, charger la dernière conversation
3. Permettre de choisir une ancienne conversation
4. Optionnel : envoyer l'historique au backend pour mémoire à long terme

---

## 6. Comparaison Avant / Après

| Aspect | Avant (SessionManager) | Après (AgentClient) |
|--------|----------------------|---------------------|
| Architecture | Lanceur de tâches | Agent avec tools |
| Message simple | 12-186s (session + template) | 2-5s (appel direct) |
| Tâche dev | 60-180s (session complète) | 60-180s (run-block) |
| Continuité | Aucune (nouvelle session) | Complète (historique) |
| Multi-projet | Hardcodé au lancement | L'agent choisit via tools |
| Admin Maestro | Impossible | shell-execute + CLI |
| Mémoire | Aucune | memory-read/memory-write |
| Template import | Obligatoire | Aucun |
| Polling | Toutes les 2s | Uniquement pour long tasks |

---

## 7. Risques et Considérations

### Le bloc execute endpoint est synchrone

`POST /api/blocks/{id}/execute` bloque jusqu'à la fin. Pour un `run-block(dev-orchestrator)` qui prend 2 min, le HTTP timeout pourrait expirer.

**Mitigation** : Augmenter le timeout HTTP du client, ou implémenter l'exécution asynchrone (Phase 3).

### L'historique dans les inputs a une limite de taille

Si la conversation est longue, le JSON `history` peut devenir énorme.

**Mitigation** : Le context strategy `sliding-window` avec `keepLastN: 20` gère ça côté agent. Le TUI peut aussi tronquer l'historique avant envoi.

### L'agent doit savoir qu'il est "l'assistant Maestro"

Le prompt système est crucial. Il doit être bien écrit pour que l'agent :
- Réponde directement aux questions simples
- Délègue au bon agent pour les tâches dev
- Utilise le CLI pour l'admin Maestro
- Ne lance pas un workflow dev pour "Salut"

### Pas de session = pas de monitoring

Sans session, le TUI monitor (`packages/maestro-monitor`) ne peut pas voir l'exécution. C'est acceptable car maestro-code EST le monitor dans ce cas.

---

## 8. Conclusion

L'utilisateur a raison : maestro-code devrait être **l'interface vers un agent Maestro**, pas un lanceur de sessions. L'architecture cible est simple :

```
TUI → Agent (bloc) → Tools (blocs) → Résultat
```

L'infra existe : blocs, executor, tools, run-block, conversation manager. Il manque :
1. Un bloc `maestro-assistant` avec le bon prompt
2. Un `AgentClient` dans le TUI qui remplace `SessionManager`
3. De la persistance de conversation (fichier local)
4. Du feedback pendant les longs tasks (polling ou async)

C'est exactement ce que Maestro a été conçu pour faire. Les blocs, les tools, la composition — tout est là. On avait juste mal câblé l'interface.
