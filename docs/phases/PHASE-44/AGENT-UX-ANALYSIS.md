# Analyse Profonde — Agent UX : De l'Outil de Dev au Vrai Assistant

**Date** : 2026-02-26
**Contexte** : Résultats du dogfooding Phase 44
**Auteur** : Claude (session dogfooding)

---

## 1. Constat : Ce qui manque

Après 7 scénarios de dogfooding, un pattern est clair : **maestro-code est un lanceur de tâches dev, pas un agent conversationnel.**

### Problèmes fondamentaux identifiés

| # | Problème | Impact | Gravité |
|---|----------|--------|---------|
| 1 | **Chaque message = nouvelle session** | Aucune continuité conversationnelle. "Salut" lance un workflow dev complet de 2-3 min | Critique |
| 2 | **Agent hardcodé sur un repo** | `repoPath` fixé au lancement. L'agent ne peut pas travailler sur plusieurs projets | Majeur |
| 3 | **Pas d'historique de conversations** | Les conversations sont éphémères (in-memory). Après fermeture, tout est perdu | Majeur |
| 4 | **Pas de sélection de session** | L'utilisateur ne peut pas reprendre une session précédente ou voir l'historique | Majeur |
| 5 | **Pas de mode conversation** | Tout passe par le template `project-autonomous` → workflow 7 phases dev | Majeur |
| 6 | **Complétion hors vue** | "Task completed" et réponses agent scrollent au-dessus du viewport | Mineur |

### Comparaison avec les attentes d'un agent

| Fonctionnalité | ChatGPT/Claude Chat | maestro-code actuel |
|----------------|---------------------|---------------------|
| Conversation libre | Oui | Non — lance un workflow dev |
| Historique conversations | Sidebar avec toutes les conversations | Aucun |
| Reprendre une conversation | Clic sur une conversation | Impossible |
| Mémoire cross-session | Oui (projets, préférences) | Non |
| Multi-projet | Via contexte | Hardcodé au lancement |
| Réponse immédiate | < 2s pour une question simple | 60-180s (workflow complet) |

---

## 2. Architecture Actuelle — Pourquoi c'est ainsi

### Le flux actuel (simplifié)

```
Utilisateur tape "Salut"
    ↓
App.ts handleSubmit() → Branch 3 (nouvelle session)
    ↓
SessionManager.submitTask("Salut")
    ├── createSession(repoPath: "C:\Cantante")
    ├── importTemplate("project-autonomous")
    ├── startSession()
    └── invoke("dev") → autonomous-development block
         ↓
    AgentBlockExecutor: agentic loop (7 phases)
    Agent: "Hmm, pas de tâche dev... There was no software task to complete"
    Durée: ~130s
```

### Pourquoi chaque message crée une session

`SessionManager.submitTask()` (ligne 68) crée TOUJOURS une nouvelle session. Il n'y a pas de concept de "continuer la conversation". La seule branche alternative (ligne 394) envoie un `_userMessage` variable, mais elle ne fonctionne que si `busy === true` (agent en cours d'exécution).

### Pourquoi le repo est fixé

`SessionManager` reçoit `repoPath` dans son constructeur (ligne 62) et l'utilise pour TOUTES les sessions. C'est un choix de design initial : maestro-code était conçu pour être lancé DANS un projet (`cd mon-projet && maestro code`).

### Pourquoi les conversations ne persistent pas

`InMemoryConversationManager` utilise `ConcurrentDictionary` en mémoire. Les conversations sont nettoyées après chaque exécution d'agent. Le backend n'a pas de mécanisme de persistance de conversation.

---

## 3. Vision Cible — L'Agent Maestro

### 3.1 Modes d'interaction

L'agent devrait supporter **trois modes** automatiquement détectés :

```
┌─────────────────────────────────────────────────────────────────┐
│ Mode 1: CONVERSATION — Réponse directe (< 5s)                  │
│   "Salut", "Quels projets sont en cours?", "Montre-moi les     │
│   dernières sessions", "Quel est le status du backend?"         │
│                                                                 │
│ Mode 2: COMMANDE — Action ciblée (5-30s)                        │
│   "Crée un bloc validator dans le projet Cantante"              │
│   "Lance les tests sur Meastro"                                 │
│   "Montre-moi le fichier App.ts"                                │
│                                                                 │
│ Mode 3: TÂCHE DEV — Workflow complet (30s-5min)                 │
│   "Implémente le formatTime.ts avec tests"                      │
│   "Refactore le module d'authentification"                      │
│   "Ajoute le dark mode à l'app"                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Routing des intents

Le bloc `jarvis` existe déjà comme "intent router". La solution est de l'utiliser AVANT de créer une session dev :

```
Utilisateur tape un message
    ↓
Jarvis (rapide, ~2-5s) classifie l'intent :
    ├── conversation → Réponse directe via LLM, PAS de session
    ├── query → Interroge l'API Maestro, renvoie les données
    ├── command → Crée une session ciblée (pas project-autonomous)
    └── dev-task → Crée une session project-autonomous (workflow complet)
```

### 3.3 Conversation persistante

```
┌─ CONVERSATIONS ─────────────────┐  ┌─ CHAT ──────────────────────┐
│ ● Active: Cantante - formatTime │  │ > Quels projets en cours?   │
│   il y a 5 min                  │  │                             │
│ ○ Cantante - ESLint setup       │  │ J'ai trouvé 3 projets :    │
│   hier 14:30                    │  │ 1. Cantante (12 sessions)   │
│ ○ Discussion générale           │  │ 2. Meastro (85 sessions)    │
│   hier 09:15                    │  │ 3. LLM-Provider (3 sess.)   │
│ ○ Meastro - Dark mode           │  │                             │
│   23 fév                        │  │ > Crée formatTime.ts dans   │
│                                 │  │   Cantante                  │
│ [N] New   [↑↓] Select          │  │                             │
│                                 │  │ Je lance la tâche...        │
│                                 │  │ Session: a3f7b2c1           │
│                                 │  │ … Prepare                   │
│                                 │  │ ✓ Plan                      │
│                                 │  │                             │
└─────────────────────────────────┘  └─────────────────────────────┘
```

### 3.4 Multi-projet

L'agent devrait pouvoir :

1. **Connaître tous les projets** — via l'API Maestro (workspaces, sessions)
2. **Switcher de contexte** — "Travaille sur Cantante" → change le repo actif
3. **Travailler sans repo** — pour les questions générales, l'admin Maestro

---

## 4. Implémentation Proposée

### Phase A : Routing conversationnel (impact maximal, effort minimal)

**Objectif** : Un "Salut" obtient une réponse en 3s, pas en 130s.

**Changements** :

1. **Nouveau template** : `conversational.session.json`
   - Pas de phases, pas de workflow dev
   - Entry point `chat` → bloc `jarvis` ou nouveau bloc `conversational-agent`
   - Réponse directe via LLM sans outils dev

2. **Intent detection dans `App.ts`** :
   ```ts
   // Avant de créer une session, classifier l'intent
   const isDevTask = looksLikeDevTask(input);
   const template = isDevTask ? 'project-autonomous' : 'conversational';
   const entryPoint = isDevTask ? 'dev' : 'chat';
   ```

3. **Heuristique `looksLikeDevTask()`** :
   - Mots-clés dev : "crée", "implémente", "ajoute", "fixe", "refactore", "teste"
   - Mention de fichiers : `.ts`, `.tsx`, `.js`, `.css`, `src/`, `tests/`
   - Sinon : conversation

**Fichiers modifiés** :
- `packages/maestro-code/App.ts` — routing avant submitTask
- `packages/maestro-code/services/SessionManager.ts` — accepter template/entryPoint dynamique
- `content/system/templates/sessions/conversational.session.json` — nouveau template
- `content/system/blocks/agents/conversational/` — nouveau bloc agent conversationnel

**Estimation** : ~2h de développement

---

### Phase B : Historique de conversations (sidebar)

**Objectif** : L'utilisateur peut voir et reprendre ses conversations précédentes.

**Architecture** :

1. **Stockage local** : Fichier `~/.maestro/conversations.json` ou `~/.maestro/conversations/`
   - Chaque conversation : `{ id, title, messages[], sessionIds[], lastActive, project? }`
   - Les messages TUI (LogLine[]) sont sérialisés localement
   - Les sessions backend sont référencées par ID

2. **Nouveau composant** : `ConversationHistory`
   - Sidebar gauche ou page dédiée accessible via hotkey `L` (list)
   - Affiche les conversations récentes avec titre et dernière activité
   - Clic/Enter → restaure les messages dans le ConversationLog

3. **Session continuation** :
   - Quand l'utilisateur sélectionne une ancienne conversation :
     - Les messages TUI sont restaurés
     - Un nouveau message crée une NOUVELLE session backend (mais dans la même conversation TUI)
     - L'historique visuel est continu même si les sessions backend changent

**Fichiers à créer** :
- `packages/maestro-code/services/ConversationStore.ts` — persistance locale
- `packages/maestro-code/components/ConversationHistory.ts` — sidebar UI

**Fichiers à modifier** :
- `packages/maestro-code/App.ts` — intégration sidebar, restauration état
- `packages/maestro-code/components/AgentScreen.ts` — layout avec sidebar

**Estimation** : ~4h de développement

---

### Phase C : Multi-projet et contexte

**Objectif** : L'agent travaille sur n'importe quel projet, pas juste celui du lancement.

**Changements** :

1. **`SessionManager` dynamique** :
   ```ts
   // Avant : repoPath fixé au constructeur
   this.repoPath = options.repoPath || process.cwd();

   // Après : repoPath modifiable par conversation
   setRepoPath(path: string) { this.repoPath = path; }
   ```

2. **Commandes slash** :
   - `/project Cantante` → switch le repo actif
   - `/projects` → liste les projets (via API workspaces)
   - `/sessions` → liste les sessions récentes

3. **Contexte agent** :
   - L'agent conversationnel a accès aux APIs Maestro
   - Peut répondre à "quels projets sont en cours?" en interrogeant `/api/workspaces`
   - Peut répondre à "dernière session?" en interrogeant `/api/sessions?orderBy=lastActive`

**Fichiers à modifier** :
- `packages/maestro-code/services/SessionManager.ts` — repoPath dynamique
- `packages/maestro-code/App.ts` — commandes slash
- `content/system/blocks/agents/conversational/system-prompt.md` — outils API

**Estimation** : ~3h de développement

---

### Phase D : Mémoire cross-session

**Objectif** : L'agent se souvient des conversations précédentes.

**Architecture** :

1. **`IMemoryManager` existe déjà** dans le backend (Phase 35)
   - `FileSystemMemoryManager` persiste en JSON
   - `MemoryBlockExecutor` supporte 6 opérations
   - `ContextAssembler` injecte les mémoires dans le prompt

2. **Intégration** :
   - Quand l'agent conversationnel répond, les faits importants sont stockés en mémoire
   - Les prochaines conversations incluent le contexte mémoire
   - La mémoire est par-projet ou globale selon le scope

**Fichiers à modifier** :
- Backend : configuration `IMemoryManager` pour persistance cross-session
- Bloc conversationnel : système prompt avec instructions de mémorisation

**Estimation** : ~2h (l'infra existe, c'est de la configuration)

---

## 5. Fixes pour les Scénarios PARTIAL

### Pattern commun : complétion hors vue

Les scénarios 4, 5, 6, 7 ont tous le même problème : quand il y a beaucoup de steps, les messages de complétion et la réponse agent scrollent au-dessus du viewport.

### Solution 1 : Badge de complétion persistant (recommandé)

Ajouter un indicateur dans AGENT STATUS qui montre le dernier résultat :

```
┌─ AGENT STATUS ──────────────────────────────────────────────────┐
│ ✓ Agent: completed   Session: a3f7b2c1   Last: "Changes applied" │
└─────────────────────────────────────────────────────────────────┘
```

**Changement** : `AgentStatus` component reçoit `lastOutput` prop, affiché quand `agentState === 'completed'`.

**Fichiers** :
- `components/AgentScreen.ts` — `AgentStatus` affiche `lastOutput`
- `App.ts` — passe `lastOutput` depuis la dernière ligne d'output

**Estimation** : ~30min

### Solution 2 : Auto-scroll to bottom on completion

Quand l'agent complète, forcer le scroll vers le bas pour montrer la réponse.

**Changement** : `AgentScreen.ts` reset `scrollOffset = 0` quand `agentState` passe à `completed`.

**Estimation** : ~15min

### Solution 3 : Résumé condensé post-complétion

Après complétion, ajouter une ligne séparateur + résumé au-dessus de l'input :

```
─── Task completed ✓ ──────────────────────
Changes applied: formatTime.ts created
────────────────────────────────────────────
Press / to type...
```

**Estimation** : ~1h

---

## 6. Priorités d'Implémentation

```
CRITIQUE (faire maintenant) :
  1. Phase A — Routing conversationnel     ~2h
  2. Fix PARTIAL — Auto-scroll + badge     ~45min

IMPORTANT (faire ensuite) :
  3. Phase B — Historique conversations     ~4h
  4. Phase C — Multi-projet                ~3h

NICE-TO-HAVE (plus tard) :
  5. Phase D — Mémoire cross-session       ~2h
  6. Fix PARTIAL — Résumé condensé         ~1h
```

### Pourquoi Phase A en premier ?

L'impact est maximal pour l'effort minimal. Un "Salut" en 3s au lieu de 130s change fondamentalement l'expérience. C'est aussi le prérequis pour les phases B-D : l'historique et la mémoire n'ont de sens que si l'agent peut avoir une conversation.

---

## 7. Risques et Considérations

### Alignement avec la philosophie Maestro

La philosophie dit : *"Infrastructure générique, contenu spécifique."*

Tout ce qui est proposé ici respecte cette règle :
- Le routing d'intents est dans un bloc (`jarvis` ou `conversational-agent`), pas dans le code
- Les templates sont des fichiers JSON
- Le SessionManager reste générique (il accepte n'importe quel template)
- L'historique est local au client (pas dans le backend)

### Ce qui ne doit PAS changer

- Le backend reste stateless pour les conversations (sessions = unités de travail)
- Les sessions ne deviennent PAS des "chats" — elles restent des unités d'exécution
- L'infrastructure C# ne doit pas être modifiée pour ces features TUI

### Distinction session vs conversation

```
Session (backend) : unité d'exécution d'un workflow
  - Créée, exécutée, terminée
  - Variables, execution tree, logs
  - Liée à un template

Conversation (TUI) : fil de discussion avec l'utilisateur
  - Peut couvrir 0, 1, ou N sessions
  - Persiste localement
  - Inclut les messages utilisateur + réponses agent + status sessions
```

---

## 8. Résumé Exécutif

maestro-code fonctionne bien comme **lanceur de tâches dev** mais échoue comme **agent conversationnel**. Les utilisateurs s'attendent à pouvoir parler à l'agent, poser des questions, naviguer entre projets — comme avec ChatGPT ou Claude Chat.

Les 4 phases proposées (routing → historique → multi-projet → mémoire) transforment maestro-code d'un outil unidirectionnel en un vrai assistant interactif, tout en respectant l'architecture Maestro (blocs, templates, infrastructure générique).

La Phase A (routing conversationnel) est le changement le plus impactant et devrait être implémentée en premier. Elle débloque toutes les phases suivantes et résout le problème le plus frustrant : un "Salut" qui prend 2 minutes.
