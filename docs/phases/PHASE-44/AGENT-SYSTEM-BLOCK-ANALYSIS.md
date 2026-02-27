# Analyse — L'Agent maestro-code comme System Block

**Date** : 2026-02-27
**Contexte** : Le user a clarifié la vision architecturale de l'agent qui pilote `maestro-code`. Ce document analyse cette vision et propose une implémentation concrète.

---

## 1. La Vision du User (reformulée)

> "Cet agent est un peu spécial [...] c'est un block system [...] le principe qu'on utilise maestro pour construire maestro."

Points clés :

1. **L'agent est un system block** (`isSystem: true`, `overridable: true`) — il fait partie de l'infrastructure Maestro, livré avec le produit
2. **Maestro construit Maestro** — l'agent utilise le système de blocs Maestro pour piloter Maestro lui-même
3. **L'agent contrôle le TUI** — ce n'est pas juste un répondeur dans un panneau; il peut naviguer, demander des choses à l'utilisateur, changer de page
4. **Les tools sont des blocs** — `maestro-cli`, `ask-user`, `change-page` sont des blocs-outils que l'agent invoque via son prompt système
5. **La session fournit les permissions** — le contexte de session détermine ce que l'agent peut faire (filesystem, réseau, code, etc.)
6. **L'utilisateur peut l'overrider** — comme tout system block `overridable: true`, l'utilisateur peut personnaliser le prompt, les tools, le modèle

C'est exactement le pattern **jarvis dans Cantante** : un agent embarqué dans l'app, qui contrôle l'app, créé avec les mêmes outils que l'app utilise.

---

## 2. Validation contre la Philosophie Maestro

### 2.1 Tout est un Bloc — **RESPECTÉ**

L'agent EST un bloc. Ses outils SONT des blocs. L'agent est composite (`isAtomic: false`), ses outils sont atomiques (`isAtomic: true`). Il n'y a pas d'entité spéciale "TUI Agent" — c'est un `BlockDefinition` comme tous les autres.

```
maestro-assistant.agent.block.json    ← System block, overridable
├── config.nodes[0] → inference       ← LLM reasoning (claude-sonnet-4-6)
├── tools déclarés dans system-prompt.md :
│   ├── system:maestro-cli            ← Existing system block (overridable: false)
│   ├── ask-user                      ← New tool block
│   ├── change-page                   ← New tool block
│   ├── show-widget                   ← New tool block
│   ├── file-read                     ← Existing tool block
│   ├── file-write                    ← Existing tool block
│   ├── file-edit                     ← Existing tool block
│   ├── shell-execute                 ← Existing tool block
│   ├── directory-list                ← Existing tool block
│   ├── run-block                     ← Existing meta-tool
│   └── step-complete                 ← Existing termination signal
```

### 2.2 Infrastructure Générique, Contenu Spécifique — **RESPECTÉ**

L'infrastructure (TUI `maestro-code`, backend C#) reste générique :
- Le TUI ne sait pas QUEL agent tourne — il crée une session, invoque un entry point, affiche le résultat
- Le routing d'intent (`looksLikeDevTask()` actuellement hardcodé dans `App.ts`) **disparaît** du TUI — l'agent décide lui-même
- Le backend exécute le bloc mécaniquement — il ne sait pas que c'est "l'agent du TUI"

Le contenu spécifique (prompt, tools, comportement) vit dans le bloc JSON + `system-prompt.md`.

**Litmus test** : Peut-on changer le comportement de l'assistant en modifiant SEULEMENT le JSON et le prompt ?
**Réponse** : Oui. Override le system block, change le modèle, ajoute/retire des tools, modifie le prompt. Zéro changement C# ou TypeScript.

### 2.3 CLI-First — **RESPECTÉ**

L'agent utilise `system:maestro-cli` comme outil principal. Toutes les opérations Maestro passent par le CLI. Les nouveaux outils TUI (`change-page`, `ask-user`) ne sont PAS des appels API directs — ils passent par le mécanisme de session variables (`_widgetRequest`/`_widgetResponse` et de nouvelles variables comme `_tuiCommand`).

### 2.4 Sessions comme Contextes d'Exécution — **RESPECTÉ (Option C)**

L'agent vit dans UNE session persistante :
- Créée au démarrage du TUI
- Réutilisée pour chaque message de l'utilisateur (multi-invoke sur la même session)
- Fournit : monitoring (`_executionTree`), permissions, variables persistantes, historique
- L'`_executionTree` est visible dans le TUI pendant l'exécution

### 2.5 System Block avec Override — **RESPECTÉ**

L'agent est un system block :
- Découvert par `FileSystemBlockDiscoveryService` dans `content/system/blocks/system/`
- `isSystem: true` — fait partie de l'infrastructure Maestro
- `overridable: true` — l'utilisateur peut créer un override dans `content/system/blocks/user/`
- L'override est **mergé** par le discovery service : le user change le prompt ou le modèle, les propriétés système sont préservées

```
content/system/blocks/system/maestro-assistant.agent.block.json   ← Livré avec Maestro
content/system/blocks/user/maestro-assistant.agent.block.json     ← Override utilisateur (optionnel)
```

---

## 3. Architecture Proposée

### 3.1 Le Bloc Agent

```
content/system/blocks/system/
├── maestro-assistant.agent.block.json    ← Le bloc agent
├── maestro-assistant/
│   └── system-prompt.md                  ← Prompt système (tools, comportement)
├── maestro-cli.tool.block.json           ← Existe déjà
├── ui/
│   ├── ask-user.tool.block.json          ← Nouveau : widget interactif → user
│   ├── change-page.tool.block.json       ← Nouveau : navigation TUI
│   └── show-widget.tool.block.json       ← Nouveau : afficher info/progress dans TUI
```

### 3.2 Le Template Session

```json
{
  "id": "maestro-assistant",
  "name": "Maestro Assistant",
  "type": "project",
  "permissions": {
    "allowedCommands": ["*"],
    "allowedTools": ["*"],
    "canAccessFilesystem": true,
    "canExecuteCode": true,
    "canAccessNetwork": false
  },
  "entryPoints": {
    "message": "system:maestro-assistant"
  },
  "variables": {
    "sessionMode": "assistant",
    "_phases": [],
    "_blockOutputs": {},
    "_llmActivity": [],
    "_executionLog": [],
    "_executionTree": []
  }
}
```

**Point important** : un seul entry point `message`. Chaque message de l'utilisateur invoque `message` avec `{ message: "texte", context: "..." }`. L'agent décide quoi faire.

### 3.3 Les Tools TUI (nouveaux blocs)

#### `ask-user` — Poser une question à l'utilisateur

**Mécanisme** : L'agent écrit dans `_widgetRequest` (mécanisme existant). Le TUI affiche le widget interactif et attend la réponse via `_widgetResponse`.

```json
{
  "id": "system:ask-user",
  "name": "Ask User",
  "blockType": "tool",
  "isSystem": true,
  "overridable": false,
  "description": "Ask the user a question via the TUI. Blocks until user responds.",
  "config": {
    "executorType": "session-variable",
    "variable": "_widgetRequest",
    "responseVariable": "_widgetResponse",
    "timeout": 120000
  },
  "inputs": {
    "question": { "type": "string", "required": true },
    "options": { "type": "array", "required": false, "description": "If provided, show as selectable options" },
    "type": { "type": "string", "required": false, "description": "Widget type: confirmation, text-input, option-select" }
  }
}
```

**Comment ça marche concrètement** :
1. L'agent appelle `{"tool":"ask-user","args":{"question":"Quel framework utiliser?","options":["React","Vue","Svelte"]}}`
2. L'executor `ToolBlockExecutor` écrit dans `_widgetRequest` :
   ```json
   {"widget":{"type":"option-select","content":"Quel framework utiliser?","params":{"options":["React","Vue","Svelte"]},"id":"widget-xxx","interactive":true}}
   ```
3. Le TUI (SessionManager.widgetPolling) détecte le widget → l'affiche
4. L'utilisateur choisit "React"
5. Le TUI écrit `_widgetResponse = {"response":"React","widgetId":"widget-xxx"}`
6. L'executor poll `_widgetResponse` → retourne `{"response":"React"}` à l'agent
7. L'agent continue avec le choix

**C'est le mécanisme existant.** Le `interaction-handler` workflow fait déjà exactement ça. La différence : ici c'est un tool block réutilisable, pas un workflow hardcodé.

#### `change-page` — Naviguer dans le TUI

**Mécanisme** : L'agent écrit dans une nouvelle variable `_tuiCommand`. Le TUI poll cette variable et exécute la commande.

```json
{
  "id": "system:change-page",
  "name": "Change Page",
  "blockType": "tool",
  "isSystem": true,
  "overridable": false,
  "description": "Navigate the TUI to a specific page.",
  "config": {
    "executorType": "session-variable",
    "variable": "_tuiCommand"
  },
  "inputs": {
    "page": { "type": "string", "required": true, "description": "Page to navigate to: agent, home, spaces, foundry, catalog, models" }
  }
}
```

**Comment ça marche** :
1. L'agent appelle `{"tool":"change-page","args":{"page":"home"}}`
2. L'executor écrit `_tuiCommand = {"action":"navigate","page":"home","id":"cmd-xxx"}`
3. Le TUI (SessionManager ou App.ts) poll `_tuiCommand` → exécute `onNavigate('home')`
4. Le TUI écrit `_tuiCommandAck = {"id":"cmd-xxx","status":"done"}`
5. L'executor retourne succès

#### `show-widget` — Afficher un widget non-interactif

Pour afficher un message, un progrès, ou un résultat formaté :

```json
{
  "id": "system:show-widget",
  "name": "Show Widget",
  "blockType": "tool",
  "isSystem": true,
  "overridable": false,
  "config": {
    "executorType": "session-variable",
    "variable": "_widgetRequest"
  },
  "inputs": {
    "type": { "type": "string", "required": true, "description": "Widget type: message, progress, plan-view, test-results" },
    "content": { "type": "string", "required": true },
    "params": { "type": "object", "required": false }
  }
}
```

---

## 4. Flux d'Exécution Complet

```
User tape "Crée un fichier formatTime.ts" dans TaskInputBar
                                    │
                                    ▼
              App.ts: handleSubmit()
              ├── sessionManager.submitTask("Crée un fichier...", overrides=null)
              │   ├── Première fois ? Crée session + import template "maestro-assistant"
              │   ├── Fois suivantes ? Réutilise la même session
              │   └── POST /api/sessions/{id}/invoke/message
              │         body: { inputs: { message: "Crée un fichier...", repoPath: "C:\Cantante" } }
              │
              ▼
         Backend: EntryPointExecutor
              ├── Résout entry point "message" → block "system:maestro-assistant"
              ├── Crée ExecutionContext
              ├── Exécute le bloc agent (AgentBlockExecutor)
              │
              ▼
         AgentBlockExecutor: boucle agentique
              ├── Itération 1: LLM reçoit prompt + message
              │   └── Agent répond: {"tool":"directory-list","args":{"path":"C:/Cantante/src/utils"}}
              │       → ToolBlockExecutor exécute, retourne résultat
              │
              ├── Itération 2: LLM reçoit résultat + contexte
              │   └── Agent répond: {"tool":"file-write","args":{"path":"C:/Cantante/src/utils/formatTime.ts","content":"..."}}
              │       → ToolBlockExecutor exécute, retourne succès
              │
              ├── Itération 3: LLM reçoit résultat
              │   └── Agent répond: {"tool":"step-complete","args":{"summary":"Created formatTime.ts with..."}}
              │       → Boucle terminée
              │
              ▼
         SessionManager.startPolling() détecte completion
              ├── Extrait output de l'agent (5 sources, comme avant)
              ├── Affiche réponse dans ConversationLog
              ├── agentState → 'completed'
              └── Prêt pour le prochain message
```

### Ce qui CHANGE par rapport à l'architecture actuelle :

| Aspect | Avant (actuel) | Après (proposé) |
|--------|----------------|-----------------|
| **Session** | Nouvelle session par message | UNE session persistante |
| **Template** | `project-autonomous` ou `jarvis` (routing hardcodé dans App.ts) | `maestro-assistant` (unique) |
| **Routing intent** | `looksLikeDevTask()` dans App.ts (infrastructure) | L'agent décide (contenu) |
| **Entry point** | `dev` ou `ask` (selon routing) | `message` (unique) |
| **Agent block** | `jarvis` ou `autonomous-development` | `system:maestro-assistant` |
| **Contrôle TUI** | Aucun — l'agent ne contrôle rien | Via tools : `change-page`, `ask-user`, `show-widget` |
| **Override** | Impossible | Override via `content/system/blocks/user/` |

---

## 5. Différence avec les Blocs "Réguliers"

Le user a raison : cet agent est **spécial**. Voici en quoi il diffère :

### 5.1 C'est un system block — pas un bloc utilisateur

| Propriété | Bloc régulier | `maestro-assistant` | `maestro-cli` |
|-----------|--------------|---------------------|---------------|
| `isSystem` | `false` | `true` | `true` |
| `overridable` | N/A | `true` | `false` |
| Emplacement | `content/system/blocks/agents/` | `content/system/blocks/system/` | `content/system/blocks/system/` |
| Livré avec Maestro | Non | **Oui** | **Oui** |
| L'utilisateur peut changer | Toujours | Via override | **Non** |

### 5.2 Il fait partie de l'infrastructure

L'agent est le **pont entre l'utilisateur et Maestro**. Sans lui, `maestro-code` n'est qu'un TUI vide. Il est autant "infrastructure" que le CLI ou le backend — mais son comportement est défini en contenu (prompt + tools), pas en code.

C'est la beauté du pattern : l'infrastructure (le TUI) est générique, mais elle a besoin d'un "cerveau" pour fonctionner. Ce cerveau est un bloc, pas du code.

### 5.3 Il utilise des tools TUI-spécifiques

Les tools `ask-user`, `change-page`, `show-widget` n'ont de sens que dans le contexte du TUI. Ils sont aussi des system blocks (`isSystem: true`) parce qu'ils font partie de l'infrastructure de communication agent↔TUI.

Mais un agent régulier (par ex. un agent qu'un utilisateur crée pour du data processing) ne les utilisera jamais. Ces tools sont dans le scope de la session `maestro-assistant` via les permissions, pas dans toutes les sessions.

### 5.4 Analogie avec jarvis dans Cantante

```
Cantante                              Maestro
──────────                            ──────────
jarvis (agent bloc)                   maestro-assistant (system block)
├── contrôle l'app Cantante           ├── contrôle le TUI maestro-code
├── tools: file-*, shell-*            ├── tools: file-*, shell-*, maestro-cli
├── session Cantante                  ├── session maestro-assistant
├── prompt: "Tu es l'assistant..."    ├── prompt: "Tu es l'assistant Maestro..."
└── créé PAR Maestro                  └── créé PAR Maestro, fait partie DE Maestro
                                           ↑
                                      "Maestro construit Maestro"
```

La seule différence : jarvis est un bloc régulier créé pour un projet utilisateur. `maestro-assistant` est un system block livré avec Maestro. Mais la mécanique est identique.

---

## 6. Le Prompt Système de l'Agent

Le prompt est le **seul endroit** où le comportement est défini. Voici une ébauche :

```markdown
# Maestro Assistant

You are the Maestro assistant, embedded in the maestro-code TUI.
You help users with their software development projects using the Maestro platform.

## Your Role

- You can read, write, and edit files in the user's project
- You can run shell commands
- You can use the Maestro CLI to manage sessions, blocks, and workflows
- You can ask the user questions when you need clarification
- You can navigate the TUI to show relevant pages
- You can display widgets to show progress or results

## Intent Routing

Based on the user's message, decide what to do:

1. **Development task** (create, fix, refactor, test, etc.)
   → Use file-read, file-write, file-edit, shell-execute, directory-list
   → For complex tasks, use run-block with a specialized workflow

2. **Question about the project**
   → Read relevant files, then step-complete with the answer

3. **Question about Maestro**
   → Use maestro-cli to get info, then answer

4. **Conversational** (greeting, thanks, etc.)
   → step-complete with a direct response

5. **Navigation request** ("show me the sessions", "go to foundry")
   → Use change-page to navigate

## Available Tools

[... tools listed here ...]
```

Le routing est dans le **contenu** (le prompt), pas dans l'**infrastructure** (App.ts). Le `looksLikeDevTask()` actuel dans App.ts disparaît.

---

## 7. Gestion de la Conversation (Multi-tour)

### Problème actuel
Chaque message crée une nouvelle session → pas de continuité.

### Solution avec l'architecture proposée

**La session est persistante.** Chaque `invoke/message` crée un nouveau `ExecutionContext` mais dans la même session. Les variables de session persistent.

Pour la continuité conversationnelle :

1. **Variable `_conversationHistory`** : L'agent stocke l'historique en variable de session
2. **Input enrichi** : À chaque invocation, le TUI envoie `{ message, conversationHistory }`
3. **L'agent reçoit le contexte** : Le prompt inclut les échanges précédents

```
Invoke 1: { message: "Crée formatTime.ts" }
  → Agent crée le fichier
  → Stocke: _conversationHistory = [{ role: "user", content: "Crée..." }, { role: "assistant", content: "Créé..." }]

Invoke 2: { message: "Ajoute un test", conversationHistory: [...] }
  → Agent a le contexte du tour 1
  → Sait que "un test" réfère à formatTime.ts
```

**Alternative** : Utiliser `IConversationManager` côté backend. Mais le manager actuel est in-memory et ne persiste pas entre invocations. Les variables de session, elles, persistent sur disque.

---

## 8. Implémentation — Phases Proposées

### Phase A : Créer le system block agent (le plus petit changement utile)

1. **Créer le bloc** : `content/system/blocks/system/maestro-assistant.agent.block.json`
   - `isSystem: true`, `overridable: true`
   - `config.nodes[0]` → inference avec `claude-sonnet-4-6`
   - Tools : les mêmes que jarvis (`file-read`, `file-write`, `file-edit`, `shell-execute`, `directory-list`, `run-block`, `step-complete`)
   - Prompt : adapté au contexte Maestro

2. **Créer le template session** : `content/system/templates/sessions/maestro-assistant.session.json`
   - Un entry point : `message` → `system:maestro-assistant`
   - Permissions : filesystem, code execution

3. **Modifier `App.ts`** :
   - Supprimer `looksLikeDevTask()` et le routing de templates
   - Créer UNE session au démarrage (ou au premier message)
   - Toujours invoquer `message` sur la même session
   - Garder le polling existant (il fonctionne déjà)

4. **Modifier `SessionManager.ts`** :
   - Supprimer le paramètre `overrides` (plus de routing template)
   - Ajouter `reuseSession: true` : ne pas recréer si session existe

**Résultat** : L'agent fonctionne comme jarvis, dans une session persistante, avec les tools de base. Pas encore de contrôle TUI, mais le routing d'intent est dans l'agent (pas le TUI).

### Phase B : Ajouter les tools TUI

1. **`ask-user`** : Utilise le mécanisme `_widgetRequest`/`_widgetResponse` existant
   - Backend : nouveau `executorType: "session-variable"` dans `ToolBlockExecutor`
   - Ou : implémentation directe en tant que tool handler (write variable → poll response)

2. **`change-page`** : Nouvelle variable `_tuiCommand`
   - Backend : écrit la variable de session
   - TUI : poll `_tuiCommand`, exécute la navigation, écrit `_tuiCommandAck`

3. **`show-widget`** : Réutilise `_widgetRequest` avec `interactive: false`
   - Déjà supporté par le SessionManager (`widget.interactive === false` → log only)

4. **Modifier `SessionManager.ts`** : Ajouter le polling de `_tuiCommand`

### Phase C : Conversation multi-tour

1. **Variable `_conversationHistory`** : Stocker l'historique en variable de session
2. **Input enrichi** : Envoyer l'historique avec chaque invoke
3. **Prompt** : Inclure les échanges précédents dans le contexte

### Phase D : Override et personnalisation

1. **API système** : Les endpoints `/api/blocks/system/` existent déjà
2. **CLI** : `node index.js system override maestro-assistant --config '{"model":"claude-opus-4-6"}'`
3. **Documentation** : Guide pour personnaliser l'assistant

---

## 9. Ce qui est Déjà Prêt vs Ce qui Manque

### Déjà prêt (backend)

| Composant | Statut | Notes |
|-----------|--------|-------|
| `FileSystemBlockDiscoveryService` | ✅ Existe | Three-pass loading, system → user → merge |
| `SystemBlockService` | ✅ Existe | CRUD pour overrides |
| `SystemBlocksController` | ✅ Existe | API `/api/blocks/system/*` |
| `AgentBlockExecutor` | ✅ Existe | Boucle agentique, tool dispatch |
| `EntryPointExecutor` | ✅ Existe | Multi-invoke sur même session |
| `ToolBlockExecutor` | ✅ Existe | Dispatch par tool name → block ID |
| Session variables | ✅ Existe | Persistance, polling, `_widgetRequest`/`_widgetResponse` |
| Widget system | ✅ Existe | 7 types, interactive/non-interactive |

### Déjà prêt (TUI)

| Composant | Statut | Notes |
|-----------|--------|-------|
| SessionManager.submitTask | ✅ Existe | Crée session, importe template, invoque, poll |
| SessionManager.widgetPolling | ✅ Existe | Poll `_widgetRequest`, affiche widgets |
| SessionManager.sendWidgetResponse | ✅ Existe | Envoie `_widgetResponse` |
| ConversationLog | ✅ Existe | Affiche les steps et réponses |
| AgentStatus | ✅ Existe | Affiche idle/working/completed |

### Manque

| Composant | Effort | Notes |
|-----------|--------|-------|
| `maestro-assistant.agent.block.json` | Petit | Créer le bloc (copier la structure de jarvis) |
| `system-prompt.md` pour l'assistant | Moyen | Rédiger un bon prompt |
| `maestro-assistant.session.json` | Petit | Template minimaliste |
| Session persistante dans App.ts | Petit | Réutiliser au lieu de recréer |
| `ask-user.tool.block.json` | Moyen | Nouveau tool, utilise widgets existants |
| `change-page.tool.block.json` | Moyen | Nouveau tool, nouvelle variable `_tuiCommand` |
| Polling `_tuiCommand` dans TUI | Petit | Similaire au widget polling |
| `_conversationHistory` | Moyen | Stocker/restaurer l'historique |
| Supprimer `looksLikeDevTask()` | Trivial | Supprimer du code |
| Backend executor `session-variable` | Moyen | Nouveau type d'executor OU handler dans ToolBlockExecutor |

---

## 10. Risques et Considérations

### 10.1 Performance de la boucle agentique

Chaque message passe par la boucle agentique (`AgentBlockExecutor`). Pour un simple "Salut", l'agent fait 1 itération (LLM call → step-complete). C'est ~2-5s, bien mieux que les 186s du workflow project-autonomous.

Pour une tâche dev complexe, l'agent fait N itérations (read files → plan → write → test → step-complete). C'est le comportement souhaité.

### 10.2 L'agent peut-il invoquer des workflows ?

Oui, via `run-block`. Si l'agent décide qu'une tâche complexe nécessite le workflow `autonomous-development`, il peut faire :
```json
{"tool":"run-block","args":{"blockId":"autonomous-development","inputs":{"task":"...","repoPath":"..."}}}
```
C'est la composition de blocs — l'agent orchestre.

### 10.3 L'agent peut-il lancer d'autres agents ?

Oui. `run-block` avec un agent block ID. L'agent maestro-assistant peut déléguer à un agent spécialisé.

### 10.4 `InMemoryConversationManager` ne persiste pas

Le `IConversationManager` actuel est in-memory. Si on re-invoke sur la même session, le `ConversationState` est perdu. Deux solutions :
- **Variable de session** : Stocker l'historique dans `_conversationHistory` (simple, fonctionne immédiatement)
- **Persistent ConversationManager** : Sérialiser en fichier ou en variable de session (plus propre, plus de travail)

La variable de session est suffisante pour commencer.

### 10.5 `_executionTree` est écrasé à chaque invoke

Chaque `EntryPointExecutor.invoke()` crée un nouvel `ExecutionContext` et écrase `_executionTree`. Le TUI ne verra que l'arbre de l'invocation courante.

**Ce n'est pas un problème** pour le ConversationLog (qui stocke les lines localement dans le TUI). C'est un problème pour le monitoring : on ne voit pas l'historique des invocations précédentes. Acceptable pour la Phase A.

---

## 11. Conclusion

La vision du user est **philosophiquement correcte** et **techniquement faisable** :

1. L'agent est un **system block** — il suit le pattern Maestro (tout est un bloc)
2. Il est **overridable** — l'utilisateur peut le personnaliser
3. Il utilise des **tools qui sont des blocs** — `maestro-cli`, `ask-user`, `change-page`
4. Il vit dans une **session persistante** — monitoring, permissions, variables
5. Le TUI reste **générique** — il ne sait pas quel agent tourne
6. Le routing d'intent est dans le **contenu** (prompt) — pas dans le code

C'est Maestro qui construit Maestro. L'infrastructure fournit les mécanismes (blocs, sessions, tools), et le contenu définit le comportement (prompt, routing, tools disponibles). Le même pattern qui permet de créer jarvis pour Cantante permet de créer l'assistant pour Maestro lui-même.

**Recommandation** : Commencer par la Phase A (le plus petit changement utile). Un agent fonctionnel avec les tools de base. Pas de session-par-message, pas de routing hardcodé. Ensuite itérer : tools TUI (Phase B), conversation (Phase C), override UX (Phase D).
