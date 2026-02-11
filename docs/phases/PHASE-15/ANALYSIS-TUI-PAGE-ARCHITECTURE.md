# Phase 15 — Analyse : Architecture des Pages TUI & Frontend

**Date** : 2026-02-11
**Statut** : Analyse approfondie
**Requête source** : `docs/phases/PHASE-15/request2.md`

---

## Table des matières

1. [Constat de l'existant](#1-constat-de-lexistant)
2. [Les trois couches d'interface](#2-les-trois-couches-dinterface)
3. [Architecture des pages — Proposition unifiée](#3-architecture-des-pages--proposition-unifiée)
4. [Décision : Repos / Workspaces / Sessions](#4-décision--repos--workspaces--sessions)
5. [Décision : Foundry vs Catalog](#5-décision--foundry-vs-catalog)
6. [Page globale du TUI](#6-page-globale-du-tui)
7. [Création depuis le TUI](#7-création-depuis-le-tui)
8. [Shell CLI : Composants visuels inline](#8-shell-cli--composants-visuels-inline)
9. [Plan d'implémentation](#9-plan-dimplémentation)

---

## 1. Constat de l'existant

### 1.1 Frontend — 9 pages de navigation

Le frontend expose actuellement ces pages dans la TopBar :

| Page | Route | Contenu |
|------|-------|---------|
| Home | `/` | Welcome + feature cards |
| Projects | `/projects` | Projets Docker-style (bind to filesystem) |
| Workspaces | `/workspaces` | Conteneurs de sessions/blocks |
| Sessions | `/sessions` | Liste des sessions avec status |
| Foundry | `/foundry` | Blocks/Agents/Tools/Templates (tabs) |
| Training | `/training` | Sessions d'entraînement |
| Testing | `/testing` | Test runs |
| Monitoring | `/monitoring` | Monitoring temps réel |
| Models | `/models` | Configuration LLM |

**Problème** : Trop de pages de premier niveau. L'utilisateur doit naviguer entre 9 onglets, dont certains se chevauchent conceptuellement (Projects ≈ Workspaces, Training ≈ Sessions, Monitoring ≈ Sessions).

### 1.2 TUI Monitor — 2 écrans

Le TUI n'a actuellement que deux écrans :

| Écran | Composant | Contenu |
|-------|-----------|---------|
| Global | `GlobalMonitor` | Liste de sessions (rien d'autre) |
| Session | `SessionMonitor` | Détail d'une session (3 modes: descriptor/execution/idle) |

**Problème** : La page "globale" n'est qu'une liste de sessions. Pas d'accès aux modèles, blocks, projets, ou autres fonctionnalités.

### 1.3 Document de décision Projects/Workspaces introuvable

La discussion mentionnée dans `request2.md` concernant le renommage de la page Projects pour inclure Sessions + Workspaces n'a pas de document formel. La décision n'a probablement été prise que verbalement ou dans des messages de commit. **Ce document propose une décision formelle.**

---

## 2. Les trois couches d'interface

La philosophie Maestro définit trois niveaux d'interface terminal, du plus léger au plus complet :

```
┌─────────────────────────────────────────────────────────────────┐
│  Shell CLI (maestro>)                                          │
│  ─ Commandes textuelles + visuels inline rapides               │
│  ─ Style Claude Code : spinners, tables colorées, aperçus      │
│  ─ L'utilisateur FAIT des choses (create, invoke, set-var)     │
│  ─ Composants monitor réutilisés pour les aperçus              │
├─────────────────────────────────────────────────────────────────┤
│  TUI Monitor (maestro monitor)                                 │
│  ─ Fullscreen, keyboard-first, multi-panneaux                  │
│  ─ L'utilisateur OBSERVE et NAVIGUE                            │
│  ─ Même pages/données que le frontend, optimisé clavier        │
│  ─ Prototypage rapide de concepts UI                           │
├─────────────────────────────────────────────────────────────────┤
│  Frontend Web (localhost:5173)                                  │
│  ─ Souris + clavier, canvas visuel, IDE-like                   │
│  ─ L'utilisateur CRÉE, CONFIGURE, et OBSERVE                   │
│  ─ Expérience la plus complète (canvas, drag-drop, formulaires) │
└─────────────────────────────────────────────────────────────────┘
```

**Règle clé** : Les trois couches partagent la **même architecture de pages** et accèdent aux **mêmes données** via la même API. Seule la présentation diffère.

---

## 3. Architecture des pages — Proposition unifiée

### 3.1 Problème : Trop de pages de premier niveau

9 onglets = surcharge cognitive. Beaucoup de concepts se chevauchent :
- **Projects** et **Workspaces** sont deux façons de "grouper du travail"
- **Training** et **Testing** sont des types de sessions — pas des domaines fonctionnels distincts
- **Monitoring** est une vue sur des sessions en cours

### 3.2 Proposition : 5 pages de premier niveau

Regroupement en **5 domaines fonctionnels** :

```
┌──────────┬────────────┬──────────┬──────────┬──────────┐
│  Home    │  Spaces    │  Foundry │ Catalog  │  Models  │
│          │            │          │          │          │
│ Dashboard│ Repos      │ Blocks   │ System   │ Local    │
│ Quick    │ Workspaces │ Agents   │ User     │ Remote   │
│ Actions  │ Sessions   │ Tools    │ Community│ Config   │
│ Activity │            │ Templates│ Search   │ Metrics  │
│          │            │ Canvas   │ Ratings  │          │
└──────────┴────────────┴──────────┴──────────┴──────────┘
```

| Page | Rôle | Contient |
|------|------|----------|
| **Home** | Dashboard, point d'entrée | Status global, sessions actives, actions rapides, activité récente |
| **Spaces** | Tout ce qui est "exécution/organisation" | Repos, Workspaces, Sessions (avec tabs) |
| **Foundry** | Création et édition de blocks | Blocks, Agents, Tools, Templates, Canvas editor |
| **Catalog** | Découverte et consultation | Catalog system, catalog user, futur catalog communautaire |
| **Models** | Gestion LLM | Modèles locaux, modèles distants, configuration, métriques |

### 3.3 Pourquoi cette structure

1. **Home** — Nécessaire dans le TUI comme dans le frontend. L'utilisateur arrive et voit immédiatement l'état du système. Le TUI actuel balance directement sur la liste de sessions, ce qui est disorienting.

2. **Spaces** — Fusionne Repos + Workspaces + Sessions en une seule page avec des tabs. Training, Testing et Monitoring ne sont **pas** des tabs séparés — ce sont simplement des sessions. Le système de fitness multi-dimensionnel (Phase 14) gère uniformément l'évaluation de tous les types de sessions. Un compliance test est une session. Un training run est une session. Leur distinction se fait par le template et les variables, pas par la navigation.

3. **Foundry** — Reste tel quel. C'est l'atelier de création. Blocks, agents, tools, templates, et le canvas visuel.

4. **Catalog** — Séparé de Foundry. Foundry = "je crée", Catalog = "je découvre". Même dans un magasin physique, l'atelier et la vitrine sont séparés. Le catalog contient :
   - **System** : blocks system livrés avec Maestro
   - **User** : blocks publiés par l'utilisateur
   - **Community** (futur) : blocks partagés par d'autres utilisateurs

5. **Models** — Séparé car c'est un domaine orthogonal. La gestion des LLM ne fait pas partie de la création de blocks ni de l'exécution de sessions.

---

## 4. Décision : Repos / Workspaces / Sessions

### 4.1 Renommage : Projects → Repos

Le concept de "Project" dans Maestro est un bind vers un chemin filesystem avec un container runtime. C'est exactement ce que fait un **repo** (repository). Le terme "Repo" est plus clair et plus intuitif :

| Ancien terme | Nouveau terme | Pourquoi |
|-------------|---------------|----------|
| Project | **Repo** | Un "project" peut signifier beaucoup de choses. Un "repo" est clairement un dossier/repository connecté au système. L'utilisateur comprend immédiatement que c'est le lien vers son code. |

La logique interne ne change pas — seul le label visible (UI, CLI, docs) change.

### 4.2 Les trois concepts

| Concept | Définition | Utilisé pour |
|---------|-----------|-----|
| **Repo** | Bind to filesystem path + container runtime | Connecter une codebase au système Maestro |
| **Workspace** | Conteneur logique (Research/Training/Staging/Production) | Organiser du travail par contexte/purpose |
| **Session** | Unité d'exécution avec variables et entry points | Exécuter un workflow |

La hiérarchie naturelle est : **Repo** > **Workspace** > **Session**
- Un Repo pointe vers un dossier/repository
- Un Workspace est un contexte de travail dans un repo (ou standalone)
- Une Session est une exécution dans un workspace (ou standalone)

### 4.3 Décision : Page unique "Spaces" avec 3 tabs

```
Spaces
├── Tab: Repos       → Repos connectés avec leurs workspaces et sessions
├── Tab: Workspaces  → Workspaces (standalone ou liés à un repo)
└── Tab: Sessions    → Toutes les sessions avec filtres (status: running/idle/completed)
```

**Pas de tabs Training / Testing / Monitoring** :

L'analyse Phase 14 (`ANALYSIS-FITNESS-AND-DOCS.md`) définit un système de fitness uniformisé à trois niveaux (Block, Task, Value). Ce système évalue **toutes** les sessions de la même manière. Un compliance test, un training run, un experiment — ce sont tous des sessions qui utilisent différents templates et workflows. Leur différence est dans les **données** (template, variables, workflow), pas dans l'**infrastructure**.

Créer des tabs ou filtres "Training" / "Testing" reviendrait à mettre de la logique spécifique dans l'infrastructure — exactement ce que la règle cardinale interdit. Si demain un utilisateur crée un nouveau type de session "benchmarking", il faudrait ajouter un tab ? Non.

Les sessions se filtrent par des attributs **génériques** :
- **Status** : running, idle, completed, error
- **Repo** : lié à quel repo (ou standalone)
- **Workspace** : dans quel workspace
- **Recherche texte** : nom, type de template

### 4.4 Impact sur le frontend existant

- **Supprimer** : les pages séparées Projects, Workspaces, Sessions, Training, Testing, Monitoring
- **Créer** : une page `SpacesPage` avec 3 tabs (Repos, Workspaces, Sessions)
- **Renommer** : Project → Repo partout (API labels, UI, CLI help text)
- **Conserver** : les pages de détail existantes
- Les routes de détail : `/spaces/repo/:id`, `/spaces/workspace/:id`, `/spaces/session/:id`

### 4.5 La page SessionMonitor du TUI reste inchangée

La page de détail d'une session (SessionMonitor) avec ses 3 modes (descriptor/execution/idle), le panel focus, le tree nav, le zoom — tout ça reste tel quel. C'est le style et le fonctionnement qui plaît. Seule la navigation **vers** cette page change (on y accède depuis le tab Sessions de Spaces au lieu du GlobalMonitor actuel).

---

## 5. Décision : Foundry vs Catalog

### 5.1 Analyse

Actuellement, la page Foundry fait **deux choses** :
1. **Création** : L'utilisateur crée et édite des blocks, agents, tools, templates
2. **Consultation** : L'utilisateur browse les blocks existants (système + user)

C'est comme si un magasin avait l'atelier et la vitrine dans la même pièce.

### 5.2 Décision recommandée : Séparer Foundry et Catalog

**Foundry** = L'atelier de l'utilisateur
- Mes blocks (créés par moi)
- Mes agents
- Mes tools
- Mes templates
- Canvas editor
- Actions : Create, Edit, Delete, Test, Publish (vers Catalog)

**Catalog** = La vitrine
- Blocks système (livrés avec Maestro) — lecture seule, "Install" pour copier dans User
- Blocks utilisateur publiés — avec fitness scores, métriques, documentation
- Recherche et filtres (par type, par fitness, par tags)
- Futur : blocks communautaires avec ratings
- Actions : Browse, Search, Install, Rate (futur)

### 5.3 Pourquoi séparer

1. **Clarté d'intention** : "Je veux créer" → Foundry. "Je veux trouver" → Catalog.
2. **Scalabilité** : Le catalog grandira avec la communauté. Le garder dans Foundry deviendrait chaotique.
3. **Phase 14 alignment** : L'analyse Phase 14 définit déjà des `index.json` de catalog séparés (`content/system/catalog/`, `content/user/catalog/`).
4. **TUI friendly** : Dans le TUI, un catalogue est une liste navigable (naturel). Un atelier est plus complexe (formulaires, canvas).

### 5.4 Workflow : Foundry → Catalog

```
[Foundry]                              [Catalog]
  Create block  ──────────────────────→  Visible dans "My Blocks"
  Test block (via session)                Fitness score mis à jour
  Publish block  ─────────────────────→  Visible dans "User Catalog"
                                          Futur: "Community Catalog"

[Catalog]                              [Foundry]
  Browse system blocks
  "Install" / "Fork"  ───────────────→  Copié dans mes blocks
  Customize  ─────────────────────────→  Éditable dans Foundry
```

---

## 6. Page globale du TUI

### 6.1 Structure de navigation du TUI

```
maestro monitor
    │
    ├─ [Home]     ← Page par défaut (dashboard)
    │   ├─ System status (API, LLM, services)
    │   ├─ Sessions actives (miniature)
    │   ├─ Activité récente
    │   └─ Actions rapides (raccourcis)
    │
    ├─ [Spaces]   ← Tab S
    │   ├─ Tab: Repos / Workspaces / Sessions
    │   ├─ Filtres sessions: Running / Idle / Completed / All
    │   └─ Enter → Session detail (SessionMonitor existant, inchangé)
    │
    ├─ [Foundry]  ← Tab F
    │   ├─ Mes blocks / agents / tools / templates
    │   ├─ Enter → Block detail (nouveau composant)
    │   └─ Limité : pas de canvas dans le TUI
    │
    ├─ [Catalog]  ← Tab C
    │   ├─ Browse system + user blocks
    │   ├─ Recherche (/ pour search)
    │   └─ Enter → Block detail + fitness + métriques
    │
    └─ [Models]   ← Tab M
        ├─ Modèles disponibles (local + remote)
        ├─ Modèle actif
        ├─ Configuration
        └─ Métriques (tokens, latence, coût)
```

### 6.2 Navigation inter-pages

**Raccourcis globaux** (fonctionnent partout) :

| Touche | Action |
|--------|--------|
| `g` puis `h` | Go to Home (vim-style "gh") |
| `g` puis `s` | Go to Spaces |
| `g` puis `f` | Go to Foundry |
| `g` puis `c` | Go to Catalog |
| `g` puis `m` | Go to Models |
| `1-5` | Quick navigation (pages 1-5) |
| `Escape` | Retour (détail → liste → Home) |
| `q` | Quit |
| `?` | Aide |

**Alternative plus simple** : Tab/Shift-Tab pour cycler entre les pages globales, comme des onglets de navigateur.

### 6.3 Implémentation technique

Le `App.js` actuel route entre `GlobalMonitor` (null sessionId) et `SessionMonitor` (sessionId set). Il faut étendre ce routing :

```
App.js
  ├── currentPage === 'home'     → HomeScreen
  ├── currentPage === 'spaces'   → SpacesScreen (remplace GlobalMonitor)
  │   └── selectedSession        → SessionMonitor (existant)
  ├── currentPage === 'foundry'  → FoundryScreen
  ├── currentPage === 'catalog'  → CatalogScreen
  └── currentPage === 'models'   → ModelsScreen
```

Chaque `*Screen` est un composant de premier niveau qui gère sa propre navigation interne (tabs, listes, détails) et ses propres raccourcis.

### 6.4 HomeScreen — Le dashboard

La page Home est la première chose que l'utilisateur voit. Elle doit répondre à **"Qu'est-ce qui se passe ?"** en un coup d'oeil.

```
┌─ MAESTRO ─────────────────────────────────────────────────────┐
│  ● Backend: Connected  ● LLM: SmolLM2-1.7B  ● 3 sessions    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ACTIVE SESSIONS                     QUICK ACTIONS            │
│  ┌─────────────────────────┐        [N] New session           │
│  │ ▶ gen-commit  running   │        [S] Spaces                │
│  │   Phase 2/4  0.85 fit   │        [F] Foundry               │
│  │ ■ compliance  idle      │        [C] Catalog               │
│  │   Completed   0.95 fit  │        [M] Models                │
│  └─────────────────────────┘        [?] Help                  │
│                                                               │
│  RECENT ACTIVITY                                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 14:32  gen-commit     Phase "optimization" started      │  │
│  │ 14:30  gen-commit     Iteration 3 fitness: 0.85         │  │
│  │ 14:25  compliance     Session completed (6/6 phases)    │  │
│  │ 14:20  [system]       LLM model switched to SmolLM2     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
├─ [S]paces [F]oundry [C]atalog [M]odels  ──── ? Help  q Quit ─┤
└───────────────────────────────────────────────────────────────┘
```

---

## 7. Création depuis le TUI

### 7.1 La question

> "Est-ce que ça va être possible de faire en sorte que la création soit simple par le keyboard et mettre une page de création dans le monitor?"

### 7.2 Réponse : Oui, avec des formulaires séquentiels

Le TUI ne peut pas avoir un formulaire avec 15 champs à remplir simultanément (c'est le job du frontend web). Par contre, il **peut** avoir des **wizard séquentiels** très efficaces au clavier.

**Exemple : Créer une session depuis le TUI**

```
Step 1/4 — Session Type
  > foundry-default       ← cursor ici, ↑↓ pour naviguer
    compliance-tester
    custom

Step 2/4 — Name
  Session name: my-training-session█    ← input texte

Step 3/4 — Template
  Import template?
  > foundry-default.session.json     ← auto-sélectionné basé sur type
    compliance.session.json
    (none)

Step 4/4 — Confirm
  Type:     foundry-default
  Name:     my-training-session
  Template: foundry-default.session.json

  [Enter] Create  [Esc] Cancel
```

### 7.3 Ink supporte ce pattern

Ink 6.7.0 + React permet de construire des wizards séquentiels avec :
- `useState` pour tracker l'étape courante
- `TextInput` (du package `ink-text-input`) pour les champs texte
- Listes navigables (notre `SessionList` pattern) pour les sélections
- `useKeyboard` pour Enter (valider) et Escape (annuler/retour)

### 7.4 Ce qui est faisable dans le TUI vs ce qui reste au frontend

| Opération | TUI (wizard séquentiel) | Frontend (formulaire visuel) |
|-----------|------------------------|------------------------------|
| Créer une session | Oui — wizard 3-4 étapes | Oui — formulaire modal |
| Importer un template | Oui — sélection dans liste | Oui — dropdown |
| Set variables | Oui — key/value input | Oui — JSON editor |
| Invoquer entry point | Oui — sélection dans liste | Oui — bouton |
| Éditer un block (atomique) | Partiellement — texte brut | Oui — éditeur riche |
| Canvas (workflow visuel) | Non — trop complexe | Oui — drag-drop |
| Configurer un modèle | Oui — wizard | Oui — formulaire |

**Règle** : Le TUI permet de faire **tout ce que le CLI peut faire**, mais avec une interface visuelle guidée au lieu de commandes textuelles. Le canvas/éditeur visuel reste exclusif au frontend.

### 7.5 Implémentation : Composant `Wizard`

Un composant réutilisable `Wizard` qui accepte des étapes :

```javascript
const steps = [
  { type: 'select', label: 'Session Type', options: [...] },
  { type: 'text', label: 'Name', placeholder: 'my-session' },
  { type: 'select', label: 'Template', options: [...] },
  { type: 'confirm', label: 'Create session?', summary: {...} },
];

// Usage:
h(Wizard, { steps, onComplete: handleCreate, onCancel: handleBack });
```

Ce composant est réutilisable pour toute opération de création (session, block, workspace, project).

---

## 8. Shell CLI : Composants visuels inline

### 8.1 La vision

> "L'utilisateur peut avoir tous les mêmes visuels dans le shell user mais dans le style Claude Code, et si il veut un monitor plus complet, il lance le monitor."

### 8.2 Architecture de réutilisation

Les composants Ink du monitor sont des fonctions React pures. Ils peuvent être réutilisés dans deux contextes :

1. **Monitor fullscreen** — Rendu permanent dans le terminal entier (usage actuel)
2. **Shell inline** — Rendu one-shot dans le flux de sortie du shell

```
┌─ Shell CLI ──────────────────────────────────────────────────┐
│                                                              │
│  maestro> session info abc123                                │
│                                                              │
│  ┌─ SESSION abc123 ────────────────────────────────────────┐ │
│  │ Name: gen-commit  Status: running  Phase: 2/4          │ │
│  │ Fitness: 0.85  Iterations: 12  Duration: 4m30s         │ │
│  │                                                         │ │
│  │ Phases:                                                 │ │
│  │  ✓ creation      0.75  (3 iter)                        │ │
│  │  ▶ optimization  0.85  (9 iter)                        │ │
│  │  ○ validation    -                                      │ │
│  │  ○ publish       -                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  maestro> _                                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.3 Comment réutiliser les composants

**Option A : Ink one-shot render** (recommandée)

Ink peut faire un rendu non-interactif ("static render") qui s'insère dans le flux stdout :

```javascript
import { render } from 'ink';

// Dans le shell, pour afficher un aperçu de session :
const { unmount } = render(
  h(SessionSummary, { session: data }),
  { stdout: process.stdout }
);
// Le composant se rend une fois et unmount
unmount();
```

**Option B : Ink `render` + `Static`**

Le composant `Static` d'Ink ajoute du contenu qui ne se re-rend pas (logs style). Utile pour les aperçus dans le shell.

### 8.4 Composants réutilisables shell <-> monitor

| Composant | Monitor (fullscreen) | Shell (inline) |
|-----------|---------------------|----------------|
| `SessionCard` | Dans `SessionList` | `session list` (mini cards) |
| `PhaseList` | Panel dans `SessionMonitor` | `session info <id>` |
| `MetricsPanel` | Panel dans `SessionMonitor` | `session metrics <id>` |
| `WorkflowTree` | Panel avec expand/collapse | `session tree <id>` (condensé) |
| `ModelInfo` | Panel dans `ModelsScreen` | `models status` |
| `BlockCard` | Dans `FoundryScreen` | `block info <id>` |

### 8.5 Le "peek" live

Pour un mini-monitor inline dans le shell (auto-refresh) :

```
maestro> session peek abc123 --live
```

Ceci lancerait un rendu Ink interactif (avec polling) mais dans une zone limitée du terminal (pas fullscreen). L'utilisateur appuie sur `Escape` pour revenir au prompt. C'est un entre-deux entre le shell et le monitor.

---

## 9. Plan d'implémentation

### Phase 15-A : Restructuration TUI (cette itération)

```
1. Refactorer App.js : routing multi-pages (home/spaces/foundry/catalog/models)
2. Créer HomeScreen : dashboard avec status, sessions actives, actions rapides
3. Renommer GlobalMonitor → SpacesScreen, ajouter tabs (Repos/Workspaces/Sessions)
4. Navigation inter-pages : raccourcis globaux (g+h, g+s, etc.) ou Tab/Shift-Tab
5. Créer ModelsScreen : liste des modèles, modèle actif, configuration
6. StatusBar mise à jour : afficher la page courante + raccourcis contextuels
```

### Phase 15-B : Catalog + Foundry dans le TUI

```
7. Créer CatalogScreen : browse blocks système + user, recherche
8. Créer FoundryScreen : liste des blocks utilisateur, actions (create, edit, delete)
9. Block detail composant (réutilisable catalog + foundry)
10. Recherche dans le catalog (/ pour ouvrir, fuzzy match)
```

### Phase 15-C : Création (Wizards)

```
11. Composant Wizard réutilisable (steps: select/text/confirm)
12. Wizard "Create Session" (type → name → template → confirm)
13. Wizard "Create Block" (type → name → confirm)
14. Wizard "Switch Model" (select model → confirm)
15. Intégration : raccourci [N] depuis Home/Spaces pour lancer un wizard
```

### Phase 15-D : Shell inline + Réutilisation composants

```
16. Adapter les composants clés pour rendu one-shot (SessionCard, PhaseList, etc.)
17. Commande `session peek <id>` dans le shell (rendu Ink inline)
18. Commande `session peek <id> --live` (mini-monitor inline)
19. Commande `models status` (rendu inline)
20. Commande `catalog search <query>` (résultats formatés Ink)
```

### Phase future : Frontend alignment

```
21. Restructurer le frontend pour matcher les 5 pages (Home, Spaces, Foundry, Catalog, Models)
22. Renommer Projects → Repos, fusionner Repos + Workspaces + Sessions → SpacesPage avec 3 tabs
23. Séparer Foundry (création) et Catalog (consultation)
24. Mettre à jour les routes et la TopBar
```

---

## Annexe A : Mapping TUI <-> Frontend <-> Shell

| Fonctionnalité | Frontend | TUI Monitor | Shell CLI |
|----------------|----------|-------------|-----------|
| Dashboard | HomePage | HomeScreen | `maestro status` |
| Lister repos | SpacesPage > Repos tab | SpacesScreen > Repos tab | `repo list` |
| Lister workspaces | SpacesPage > Workspaces tab | SpacesScreen > Workspaces tab | `workspace list` |
| Lister sessions | SpacesPage > Sessions tab | SpacesScreen > Sessions tab | `session list` |
| Détail session | SessionDetailPage | SessionMonitor (inchangé) | `session info <id>` |
| Monitor live | SessionDetailPage | SessionMonitor (inchangé) | `session peek <id> --live` |
| Lister blocks | FoundryPage | FoundryScreen | `block list` / `list-blocks` |
| Détail block | BlockDetailPage | BlockDetail composant | `block info <id>` |
| Catalog browse | CatalogPage (nouveau) | CatalogScreen | `catalog list` |
| Catalog search | CatalogPage search | CatalogScreen `/` | `catalog search <q>` |
| Modèles | ModelsPage | ModelsScreen | `models` / `llm` |
| Créer session | Modal/Formulaire | Wizard séquentiel | `session create` |
| Créer block | Formulaire/Canvas | Wizard séquentiel | `block create` (à ajouter) |

## Annexe B : Continuité de style

Les nouvelles pages (HomeScreen, SpacesScreen, FoundryScreen, CatalogScreen, ModelsScreen) doivent respecter le style visuel existant :

- **Theme** : `theme.js` existant (couleurs, bordures, icônes) — pas de nouveau thème
- **Panel** : Composant `Panel.js` réutilisé tel quel pour tous les conteneurs
- **StatusBar** : `StatusBar.js` en bas, mise à jour pour afficher la page courante
- **Navigation clavier** : `useKeyboard` + `useTreeNav` + `usePanelFocus` — mêmes hooks
- **Souris** : `useMouse` pour clic focus et scroll — même pattern
- **SessionMonitor** : **Inchangé** — les 3 modes (descriptor/execution/idle), le tab cycling, le zoom, le tree nav, tout reste identique
- **Convention** : `createElement as h`, pas de JSX, functional components

Les nouvelles pages s'ajoutent comme des **frères** de SessionMonitor dans le routing, pas comme des remplacements. Le style est cohérent avec ce qui existe.

---

## Annexe C : Respect du Cardinal Rule

Cette architecture respecte la séparation générique/spécifique :

- **Infrastructure (TUI composants, routing, navigation)** = GÉNÉRIQUE
  - `Wizard`, `SpacesScreen`, `CatalogScreen` ne connaissent pas les types de sessions
  - Les données viennent de l'API, la présentation est générique

- **Contenu (types de sessions, templates, blocks)** = SPÉCIFIQUE
  - Défini dans les session templates JSON
  - Le catalog lit les `index.json` et `manifest.json`
  - Aucun `if (type === 'foundry')` dans le code TUI

- **Litmus test** : Un nouveau type de session ou de block apparaît automatiquement dans Spaces et Catalog sans changement de code TUI. ✓
