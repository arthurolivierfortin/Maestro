# Plan : Phase 28-B — Mode `maestro code` + Système de Widgets

> Prérequis : Phase 28-A ✅ (Agent autonome avec state manager + interaction agent)
> Effort estimé : ~2 jours
> But : `maestro code` — un mode interactif TUI (comme Claude Code) où l'utilisateur entre, choisit un agent, et travaille.

---

## 1. Vision

L'utilisateur tape `maestro code` dans un repo. Il entre dans un **mode interactif** — pas une commande one-shot. C'est l'équivalent Maestro de Claude Code : un environnement persistant où l'on travaille avec un agent.

```
$ cd C:\Cantante
$ maestro code

  ┌─ Maestro Code ────────────────────────────────────────────┐
  │  Projet: Cantante (TypeScript / Electron)                  │
  │  Agent: autonomous-dev-v3                    [Tab] changer  │
  │                                                            │
  │  > Add a file-tree module with recursive listing           │
  │                                                            │
  │  ┌─ plan-view ────────────────────────────────────────────┐│
  │  │  ✅ 1. Create src/file-tree/types.ts                   ││
  │  │  ✅ 2. Create src/file-tree/index.ts                   ││
  │  │  🔄 3. Modify src/index.ts (adding export)             ││
  │  │  ⬜ 4. Create tests                                    ││
  │  │  ⬜ 5. Update package.json                             ││
  │  └────────────────────────────────────────────────────────┘│
  │                                                            │
  │  ┌─ diff-view ────────────────────────────────────────────┐│
  │  │  src/index.ts                                           ││
  │  │  + import { listDirectory } from './file-tree';         ││
  │  │  + export { listDirectory };                            ││
  │  └────────────────────────────────────────────────────────┘│
  │                                                            │
  │  Phase: IMPLEMENT (step 3/5)  ▶ Running                    │
  │                                                            │
  │  > Use tabs not spaces                                     │
  │  🤖 Noté. J'ai mis à jour CONVENTIONS.md et je reprends   │
  │     le step en cours avec des tabs.                        │
  │                                                            │
  │  >                                                         │
  └────────────────────────────────────────────────────────────┘
```

### Ce que le mode fait

1. Crée/réutilise une session sous le capot
2. Démarre l'agent choisi (default: `autonomous-dev-v3`)
3. Rend les widgets dynamiquement (l'agent les demande, le mode les affiche)
4. L'utilisateur peut taper à tout moment — ses messages vont à l'interaction agent
5. Quand la tâche est finie → prompt pour la prochaine tâche
6. `exit` ou Ctrl+D pour quitter

### Ce que le mode n'est PAS

- Pas un alias (ne lance pas un workflow et disparaît)
- Pas un wrapper sur `run-interactive` (c'est une TUI complète)
- Pas spécifique au code — l'architecture est réutilisable pour d'autres modes futurs

---

## 2. Système de widgets (générique, réutilisable)

### Principe

Les widgets sont des **composants TUI réutilisables**. N'importe quel agent peut demander n'importe quel widget. Le widget ne sait pas quel agent l'a demandé. L'agent ne sait pas comment le widget est rendu.

**Protocole** : L'agent (ou ses sous-blocs) demande un widget via le state manager ou une variable de session. Le mode lit la demande et rend le widget.

### 2A. Types de widgets

| Type | Usage | Interactif ? | Paramètres |
|------|-------|-------------|-----------|
| `option-select` | Choix parmi des options | Oui — attend une réponse | `question`, `options[]`, `default` |
| `text-input` | Entrée de texte libre | Oui — attend une réponse | `question`, `placeholder`, `multiline` |
| `confirmation` | Oui/Non | Oui — attend une réponse | `question`, `defaultYes` |
| `progress` | Barre de progression | Non — lecture seule | `label`, `current`, `total`, `steps[]` |
| `file-tree` | Arbre de fichiers | Non — lecture seule | `rootPath`, `highlighted[]`, `expanded[]` |
| `diff-view` | Diff de code coloré | Non — lecture seule | `filePath`, `hunks[]` |
| `table` | Données tabulaires | Non — lecture seule | `columns[]`, `rows[]`, `title` |
| `log-stream` | Log temps réel (FIFO) | Non — lecture seule | `entries[]`, `maxVisible` |
| `plan-view` | Plan d'étapes avec statuts | Non — lecture seule | `steps[]`, `currentStep` |
| `test-results` | Résultats de tests | Non — lecture seule | `passed`, `failed`, `total`, `details[]` |
| `message` | Message de l'agent | Non — lecture seule | `text`, `type: info\|success\|warning\|error` |

### 2B. Protocole de communication agent → widget

L'agent demande un widget en écrivant dans la session variable `_widgetRequest` :

```json
{
  "id": "wr-abc123",
  "type": "option-select",
  "params": {
    "question": "Le module doit-il être une classe ou des fonctions pures ?",
    "options": [
      { "label": "Classe", "value": "class" },
      { "label": "Fonctions pures", "value": "functions" }
    ],
    "default": "functions"
  },
  "requestedBy": "task-planner-v3",
  "requestedAt": "2026-02-20T14:30:00Z"
}
```

Pour les widgets **interactifs** (qui attendent une réponse), le mode écrit la réponse dans `_widgetResponse` :

```json
{
  "id": "wr-abc123",
  "value": "functions",
  "answeredAt": "2026-02-20T14:30:05Z"
}
```

Pour les widgets **lecture seule** (progress, diff-view, etc.), pas de réponse. Le widget est affiché tant que l'agent ne le remplace pas ou ne le ferme pas :

```json
{
  "id": "wr-def456",
  "type": "plan-view",
  "params": {
    "steps": [
      { "id": 1, "label": "Create types.ts", "status": "done" },
      { "id": 2, "label": "Create index.ts", "status": "done" },
      { "id": 3, "label": "Modify src/index.ts", "status": "in-progress" }
    ],
    "currentStep": 3
  },
  "persistent": true
}
```

### 2C. Widgets multiples simultanés

Le mode peut afficher **plusieurs widgets** en même temps. L'agent utilise `_activeWidgets` (liste) au lieu de `_widgetRequest` (unique) pour des affichages complexes :

```json
{
  "_activeWidgets": [
    { "id": "w1", "type": "plan-view", "zone": "top", "params": {...} },
    { "id": "w2", "type": "diff-view", "zone": "middle", "params": {...} },
    { "id": "w3", "type": "progress", "zone": "bottom", "params": {...} }
  ]
}
```

Le layout `zone` est flexible : `top`, `middle`, `bottom`, `sidebar`. Le mode arrange les widgets dans les zones disponibles selon la taille du terminal.

### 2D. Implémentation (composants Ink)

Chaque widget est un composant Ink dans `shared/tui/widgets/` :

```
shared/tui/widgets/
├── index.ts                    ← Barrel export
├── types.ts                    ← WidgetRequest, WidgetResponse interfaces
├── WidgetRenderer.ts           ← Dispatch: type → composant
├── OptionSelect.ts             ← Composant interactif
├── TextInput.ts                ← Composant interactif
├── Confirmation.ts             ← Composant interactif
├── Progress.ts                 ← Composant lecture seule
├── FileTree.ts                 ← Composant lecture seule
├── DiffView.ts                 ← Composant lecture seule
├── Table.ts                    ← Composant lecture seule
├── LogStream.ts                ← Composant lecture seule
├── PlanView.ts                 ← Composant lecture seule
├── TestResults.ts              ← Composant lecture seule
└── Message.ts                  ← Composant lecture seule
```

Le `WidgetRenderer` est le composant central :

```typescript
// shared/tui/widgets/WidgetRenderer.ts
function WidgetRenderer({ request, onResponse }) {
  switch (request.type) {
    case 'option-select': return h(OptionSelect, { ...request.params, onSelect: onResponse });
    case 'text-input': return h(TextInput, { ...request.params, onSubmit: onResponse });
    case 'diff-view': return h(DiffView, { ...request.params });
    case 'plan-view': return h(PlanView, { ...request.params });
    // ...
  }
}
```

### Étapes d'implémentation

| # | Étape | Détail | Vérification | Statut |
|---|-------|--------|--------------|--------|
| 1 | Créer `shared/tui/widgets/types.ts` | Interfaces WidgetRequest, WidgetResponse, WidgetType enum | Types compilent | ⬜ |
| 2 | Créer `WidgetRenderer.ts` | Dispatch type → composant | Renderer fonctionne | ⬜ |
| 3 | Implémenter widgets interactifs | OptionSelect, TextInput, Confirmation | 3 widgets fonctionnels | ⬜ |
| 4 | Implémenter widgets lecture seule | Progress, PlanView, DiffView, Message, Table | 5 widgets fonctionnels | ⬜ |
| 5 | Implémenter widgets avancés | FileTree, LogStream, TestResults | 3 widgets fonctionnels | ⬜ |
| 6 | Multi-widget layout | `_activeWidgets` avec zones (top, middle, bottom) | Layout flexible | ⬜ |
| 7 | Tests unitaires | Chaque widget avec snapshot tests Ink | Tests passent | ⬜ |

---

## 3. Mode `maestro code`

### 3A. Architecture du mode

Le mode est une application Ink (comme le monitor) qui gère trois flux :

```
┌─ maestro code ──────────────────────────────────────────┐
│                                                          │
│  ┌─ Session Manager ─────────────────────────────────┐  │
│  │  Crée/réutilise session + workspace               │  │
│  │  Gère le lifecycle (create, start, stop)          │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Agent Runner ────────────────────────────────────┐  │
│  │  Lance l'agent sélectionné (via session invoke)   │  │
│  │  Poll le state manager pour les mises à jour      │  │
│  │  Détecte les _widgetRequest pour les rendre       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ User Input Handler ─────────────────────────────┐  │
│  │  Prompt interactif permanent (>)                  │  │
│  │  Route les messages:                              │  │
│  │  ├─ Tâche (si pas d'agent actif) → démarre agent │  │
│  │  ├─ Message (si agent actif) → interaction agent  │  │
│  │  ├─ Réponse widget (si widget interactif) → route │  │
│  │  └─ Commande ("exit", "switch", etc.) → mode     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Widget Zone ─────────────────────────────────────┐  │
│  │  Rend les widgets actifs (_activeWidgets)         │  │
│  │  Layout dynamique selon les zones                 │  │
│  │  Met à jour en temps réel (poll 1s)               │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 3B. Flux de démarrage

```
1. maestro code [--repo <path>] [--agent <agent-id>]

2. Détection du projet :
   a. Si --repo → utiliser le chemin
   b. Sinon → CWD
   c. Vérifier que c'est un repo git
   d. Lire .maestro/docs/ si existant

3. Session :
   a. Chercher un workspace existant pour ce repo
   b. Si pas de workspace → en créer un automatiquement
   c. Créer une session projet liée au workspace
   d. Démarrer la session

4. Agent :
   a. Si --agent → utiliser l'agent spécifié
   b. Sinon → lister les agents disponibles (publiés)
   c. Afficher le sélecteur (Tab pour changer, Enter pour confirmer)
   d. Default: autonomous-dev-v3

5. Mode prêt :
   a. Afficher le header (projet, agent, session)
   b. Afficher le prompt (>)
   c. L'utilisateur tape sa première tâche
```

### 3C. Sélection d'agent

Comme Claude Code permet de choisir le modèle, `maestro code` permet de choisir l'agent :

```
$ maestro code

  Projet: Cantante (TypeScript / Electron)

  Agent disponibles:
  > autonomous-dev-v3    Full autonomous development agent
    code-reviewer-v3     Code review only
    test-writer-v3       Write tests only

  [↑↓] sélectionner  [Enter] confirmer  [Tab] passer (default)
```

L'agent peut être changé pendant la session avec la commande `switch` ou un raccourci.

### 3D. Flux d'une tâche

```
1. User tape: "Add a file-tree module"
2. Mode envoie le message au session invoke avec l'agent sélectionné
3. L'agent démarre:
   a. Le workflow interne commence (prepare → analyze → plan → ...)
   b. L'agent écrit des _activeWidgets au fur et à mesure
   c. Le mode poll et rend les widgets en temps réel

4. Pendant l'exécution, l'utilisateur peut taper:
   a. Une question → routée à l'interaction agent via session variable
   b. Un feedback → routé à l'interaction agent
   c. "pause" → l'interaction agent pause le workflow
   d. "resume" → l'interaction agent reprend
   e. "rewind plan" → l'interaction agent rewind à la phase plan

5. Si l'agent a besoin d'une réponse (ask-user):
   a. L'agent écrit un _widgetRequest de type interactif (option-select, text-input, etc.)
   b. Le mode le rend dans le terminal
   c. L'utilisateur répond
   d. Le mode écrit la réponse dans _widgetResponse
   e. L'agent continue

6. Workflow terminé:
   a. L'agent écrit un widget `message` type success avec le résumé
   b. Les widgets se ferment
   c. Retour au prompt (>) pour la prochaine tâche
```

### 3E. Messages utilisateur pendant l'exécution

L'input utilisateur est **toujours disponible**, même pendant que l'agent travaille. Le routage :

| Contexte | Input utilisateur | Routage |
|----------|------------------|---------|
| Pas d'agent actif | Texte | Nouvelle tâche → démarrer l'agent |
| Agent actif, pas de widget interactif | Texte | Message → interaction agent (via `_userMessage`) |
| Agent actif, widget interactif affiché | Choix/texte | Réponse au widget → `_widgetResponse` |
| Agent actif | "pause" | Commande mode → `_userMessage` avec intent=pause |
| Agent actif | "exit" | Commande mode → stopper la session, quitter |
| N'importe quand | "switch" | Commande mode → sélecteur d'agent |

### Étapes d'implémentation

| # | Étape | Détail | Vérification | Statut |
|---|-------|--------|--------------|--------|
| 1 | Commande CLI `maestro code` | `program.command('code')` avec options `--repo`, `--agent` | Help fonctionne | ⬜ |
| 2 | App Ink du mode | Composant principal `CodeMode.ts` avec les 4 zones (session, agent, input, widgets) | App Ink démarre | ⬜ |
| 3 | Session Manager | Auto-detect repo, create/reuse workspace+session | Session créée automatiquement | ⬜ |
| 4 | Agent Selector | Liste les agents publiés, permet la sélection | Sélection fonctionne | ⬜ |
| 5 | User Input Handler | Prompt permanent, routage des messages | Messages routés correctement | ⬜ |
| 6 | Agent Runner | Invoke l'agent, poll le state, détecte les widget requests | Agent lancé, widgets détectés | ⬜ |
| 7 | Widget integration | WidgetRenderer dans la zone widgets, mise à jour en temps réel | Widgets s'affichent et se mettent à jour | ⬜ |
| 8 | Interaction agent routing | Messages utilisateur → `_userMessage` → interaction agent les traite | Messages reçus et traités | ⬜ |
| 9 | Commandes mode | `pause`, `resume`, `exit`, `switch` | Commandes fonctionnent | ⬜ |

---

## 4. `maestro check`

Commande séparée du mode. Vérifie la compatibilité des modèles avant de lancer un agent.

| # | Étape | Détail | Vérification | Statut |
|---|-------|--------|--------------|--------|
| 1 | Commande CLI `check` | `program.command('check <agent>')` | Help fonctionne | ⬜ |
| 2 | Lire le manifeste | `metadata.manifest.requirements.models` du bloc publié | Manifeste lu | ⬜ |
| 3 | Détecter les modèles | Appeler `model-detector` (INFRA-5) | Modèles listés | ⬜ |
| 4 | Comparer et afficher | ✅/❌ par modèle, blocs affectés, suggestions | Rapport clair | ⬜ |
| 5 | Intégrer au mode `code` | Au démarrage du mode, check automatique. Si incompatible → widget `option-select` avec les options | Check intégré | ⬜ |

### Exemple de sortie

```
$ maestro check autonomous-dev-v3

  autonomous-dev-v3 requires:
  ✅ claude-sonnet       Available (Anthropic API)
  ✅ claude-haiku        Available (Anthropic API)
  ❌ Qwen2.5-Coder-1.5B Not available (local LLM provider down)

  5/7 blocks fully compatible
  2 blocks affected: test-executor-v3, git-committer-v3

  Options:
  [1] Continue anyway (2 blocks will use claude-haiku fallback)
  [2] Adapt: maestro adapt autonomous-dev-v3
  [3] Cancel
```

---

## 5. Fichiers créés / modifiés

### Nouveaux fichiers

```
shared/tui/widgets/
├── index.ts
├── types.ts
├── WidgetRenderer.ts
├── OptionSelect.ts
├── TextInput.ts
├── Confirmation.ts
├── Progress.ts
├── FileTree.ts
├── DiffView.ts
├── Table.ts
├── LogStream.ts
├── PlanView.ts
├── TestResults.ts
└── Message.ts

maestro-cli/modes/
├── code/
│   ├── CodeMode.ts             ← App Ink principale
│   ├── SessionManager.ts       ← Create/reuse sessions
│   ├── AgentSelector.ts        ← Sélecteur d'agent
│   ├── AgentRunner.ts          ← Lance l'agent, poll state
│   ├── UserInputHandler.ts     ← Prompt + routage
│   └── WidgetZone.ts           ← Zone de rendu des widgets
```

### Fichiers modifiés

```
maestro-cli/cli.ts              ← Ajouter commande 'code' et 'check'
shared/tui/hooks/               ← Hook useWidgetPolling pour poll _activeWidgets
```

---

## 6. Tests

| # | Test | Description | Critères de succès |
|---|------|-------------|-------------------|
| 1 | **Widget OptionSelect** | Render + sélection | Affichage correct, réponse retournée |
| 2 | **Widget TextInput** | Render + entrée texte | Texte capturé |
| 3 | **Widget DiffView** | Render un diff | Couleurs +/- correctes |
| 4 | **Widget PlanView** | Render un plan avec statuts | Steps avec ✅/🔄/⬜ |
| 5 | **WidgetRenderer dispatch** | Tous les types routés correctement | Pas de type inconnu |
| 6 | **Multi-widget layout** | 3 widgets simultanés dans 3 zones | Pas de chevauchement |
| 7 | **Mode startup** | `maestro code --repo C:\Cantante` | Session créée, agent prêt, prompt affiché |
| 8 | **Tâche E2E** | Taper une tâche, agent exécute, widgets se mettent à jour, résumé affiché | Flow complet |
| 9 | **Interaction pendant exécution** | Taper un message pendant que l'agent travaille → interaction agent répond | Message reçu et traité |
| 10 | **Pause/Resume** | "pause" → workflow pausé, "resume" → reprend | State manager reflète le changement |
| 11 | **Check au démarrage** | Modèle manquant → widget option-select avec les options | Avertissement affiché |

---

## 7. Gate 28-B

| Critère | Vérification | Statut |
|---------|--------------|--------|
| 11 widgets implémentés | Tous les types dans `shared/tui/widgets/` | ⬜ |
| Widgets réutilisables | Un autre agent (pas autonomous-dev) peut utiliser les mêmes widgets | ⬜ |
| `maestro code` entre dans le mode | TUI Ink avec prompt, widgets, header | ⬜ |
| Sélection d'agent | Lister les agents publiés, sélectionner | ⬜ |
| Session auto-gérée | Workspace + session créés automatiquement | ⬜ |
| Tâche exécutée E2E | Taper une tâche → agent travaille → widgets → résultat | ⬜ |
| Messages utilisateur routés | Taper pendant l'exécution → interaction agent traite | ⬜ |
| Widgets demandés par l'agent | L'agent écrit `_widgetRequest` → le mode le rend | ⬜ |
| `maestro check` fonctionne | Affiche compatibilité modèles vs agent | ⬜ |
| Pause/Resume via mode | "pause" et "resume" fonctionnent | ⬜ |
| Aucun widget spécifique à un agent | Grep dans widgets/ → 0 mention de "autonomous-dev" ou "code" | ⬜ |
| Litmus test générique | Un agent fictif qui utilise `option-select` + `table` fonctionne sans modification du mode | ⬜ |
