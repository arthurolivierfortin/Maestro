# Proposition : Refonte CLI Maestro

## Contexte

Le CLI a 30+ commandes top-level héritées de phases de développement successives.
Le monitor a 5 pages cohérentes. L'objectif : aligner les deux.

Ce document répond aux questions du product owner et propose une taxonomie finale.

---

## Questions et réponses

### Q1 : `training` et `experiment` sont-ils vraiment des choses distinctes ?

**Réponse : Non.** La philosophie Maestro (V2, Section 3.5) est claire :

> *"L'infrastructure est générique, le contenu est spécifique."*

Training et experiments sont des **patterns de sessions**, pas des systèmes indépendants :
- Un "training" = une Foundry Session avec le template `foundry-training`
- Un "experiment" = une Foundry Session comparant des stratégies

Le backend a des controllers dédiés (`TrainingController`, `ExperimentsController`) mais
conceptuellement, tout passe par des sessions qui invoquent des workflows.

**Recommandation :** Garder les commandes mais les **regrouper sous session** comme
raccourcis de workflow :
```
session create --template foundry-training --start    # = "lancer un training"
session list --template foundry-training              # = "voir mes trainings"
```

Les commandes `training` et `experiment` peuvent rester comme **aliases de confort**
qui wrappent des `session create/list` avec les bons filtres. Mais elles sortent du help
principal et vont dans un help avancé.

---

### Q2 : C'est quoi `orchestrator` ?

**Réponse :** C'est le système de **promotion d'agents entre workspaces**. Pensez CI/CD
pour agents :

```
workspace:dev → [tests pass, fitness > 0.8] → workspace:staging → workspace:prod
```

L'orchestrateur surveille les métriques et peut auto-promouvoir des agents quand
ils atteignent un seuil de fitness.

**Recommandation :** Garder mais déplacer dans une section avancée. La plupart des
utilisateurs n'en ont pas besoin au quotidien. Renommer en :

```
promote status           # État des promotions
promote agent <id>       # Promouvoir un agent
promote rollback <id>    # Revenir en arrière
promote history          # Historique
```

Plus intuitif que `orchestrator` comme nom.

---

### Q3 : `metrics` et `fitness` sont-ils utiles en standalone ?

**Réponse mixte :**

- **Fitness** opère sur des **modèles** (pas des blocs). C'est un score composite
  (performance, spécialisation, coût, VRAM) calculé par modèle LLM.
  → Devrait être sous `model fitness` ou `model leaderboard`

- **Metrics** opère sur des **exécutions** de blocs. C'est de l'observabilité.
  → Pourrait être `block metrics <id>` pour un bloc spécifique,
  ou rester `metrics` pour les métriques globales/agrégées.

**Recommandation :**
```
model leaderboard             # Fitness classement (= fitness leaderboard)
model profile <name>          # Profil fitness d'un modèle (= fitness profile)
block metrics <id>            # Métriques d'exécution d'un bloc
metrics                       # Vue globale agrégée (raccourci avancé)
```

`fitness` comme commande top-level disparaît. Ses fonctions migrent vers `model` et
`block`.

---

### Q4 : `status llm` → `llm-provider` ?

**Excellente suggestion.** Le terme "LLM" seul crée une confusion :
- `model` = le modèle IA (SmolLM2, Qwen, etc.)
- `llm-provider` = le serveur qui héberge les modèles (vLLM, Ollama, llama.cpp)

**Recommandation :**
```
status                        # Vue globale (backend + provider + sessions actives)
status backend                # Santé du backend Maestro
status provider               # Santé du LLM provider (= ancien `llm`)
```

Ou en tant que sous-commande de model :
```
model provider                # Santé du fournisseur LLM
model list                    # Modèles disponibles
model switch <name>           # Changer le modèle actif
```

Le terme `provider` est clair et évite toute ambiguïté.

---

### Q5 : `projects` → `repo` comme dans le monitor ?

**Réponse nuancée.** Le backend appelle ça `Project` (avec `ProjectsController`).
Un Project encapsule un repo + container + config. Le monitor montre "Repos" comme
onglet dans Spaces, mais fetch en réalité des workspaces et des sessions.

Le concept est :
```
Repo (dossier git) ←→ Project (config Maestro) ←→ Session (exécution)
```

**Recommandation :** Utiliser `repo` dans le CLI car c'est ce que l'utilisateur
pense manipuler :

```
repo list                     # Liste les repos liés (= projects list)
repo info <id>                # Détails
repo bind <path>              # Lier un repo existant (= projects bind)
repo open <path>              # Ouvrir un repo (= projects open)
repo start/stop <id>          # Gérer le container
```

Le terme `project` reste dans l'API et le backend, mais l'interface utilisateur
dit `repo`.

---

### Q6 : `template` comme verbe plutôt que ressource ?

**Bonne idée.** Un template n'est pas une ressource CRUD — on ne crée pas de
templates via le CLI, on les liste et on les applique. C'est un **verbe sur session** :

```
session template list                  # = templates list
session template show <name>           # = templates show <name>
session create --template <name>       # Déjà existant
```

Ou encore plus simple, `template` comme filtre de `session create` :
```
session list-templates                 # templates disponibles
session create --template foundry-default --start
```

**Recommandation :** `template` devient une sous-commande de `session` :
```
session template list
session template info <name>
```

---

### Q7 : `agent` et `tool` comme filtres de `block` ?

**Attention :** Le backend a des registries séparées (`AgentsController`,
`ToolsController`) avec leurs propres endpoints, métriques et versions.
Agents et Tools ne sont PAS des filtres sur `/api/blocks` — ce sont des
**entités promues** depuis des blocs via le Foundry.

Le flux est :
```
block (workflow/agent/tool type) → foundry promote → agent/tool registry
```

Un Agent a des métriques, un score, des relations tool, une version — choses
qu'un Block n'a pas.

**Cependant**, du point de vue UX, l'utilisateur pense en termes de blocs.
Les deux approches sont viables :

**Option A — Séparés (reflète le backend) :**
```
block list                    # Tous les blocs
agent list                    # Agents promus
tool list                     # Tools promus
```

**Option B — Unifiés sous block (reflète le mental model) :**
```
block list                    # Tous les blocs
block list --promoted         # Seulement les agents/tools promus
block list --type agent       # Filtre par type
block promote <id>            # Promouvoir un bloc → agent/tool
block metrics <id>            # Métriques (fonctionne pour block, agent, tool)
```

**Recommandation : Option A** pour les commandes courantes, avec `block` comme
parent conceptuel. Le Foundry du monitor montre blocks+agents+tools ensemble,
donc on peut grouper dans le help :

```
Foundry:
  block list/info/search/run       Blocs (tout type)
  agent list/info/create           Agents promus
  tool list/info/create            Tools promus
```

---

### Q8 : Slash commands comme Claude Code ?

**Analyse :**

Claude Code utilise `/help`, `/clear`, `/compact`, `/review`, etc. comme
commandes système rapides. Dans Maestro, le shell a déjà `help`, `exit`, `clear`
comme commandes spéciales.

Les slash commands seraient utiles pour **distinguer les commandes shell** des
**commandes Maestro** :

```
/help                         # Aide du shell
/clear                        # Effacer l'écran
/select abc123                # Sélectionner une session
/deselect                     # Désélectionner
/monitor                      # Ouvrir le monitor
/theme                        # Changer le thème
/keybindings                  # Configurer les raccourcis

session list                  # Commande Maestro normale
block info abc                # Commande Maestro normale
```

**Avantages :**
- Séparation claire entre shell meta-commands et commandes métier
- Pattern familier (vim, Claude Code, Discord, Slack)
- Pas de collision de noms (si un bloc s'appelle "help" par exemple)

**Inconvénients :**
- Ajout de friction (taper `/` avant chaque commande shell)
- Les commandes actuelles (`help`, `exit`, `clear`) sont déjà intuitives

**Recommandation : Hybride.** Supporter les deux formes :
- `help` et `/help` font la même chose
- Les nouvelles commandes shell utilisent le préfixe `/`
- Les commandes Maestro ne prennent jamais de `/`

```
# Shell (avec ou sans /)
help, /help                   # Aide
clear, /clear                 # Effacer
exit, /exit                   # Quitter
/select <id>                  # Sélectionner contexte
/deselect                     # Désélectionner
/monitor [id]                 # Ouvrir le TUI monitor
/theme [name]                 # Thème (futur)
/config                       # Configuration

# Maestro (jamais de /)
session list
block info <id>
model switch <name>
```

---

## Taxonomie finale proposée

### Tier 1 — Commandes quotidiennes

```
STATUS
  status                      Dashboard (backend + provider + sessions)
  status backend              Santé du backend
  status provider             Santé du LLM provider

SESSIONS  (= monitor page Spaces)
  session list [--status running] [--recent 5]
  session info <id>
  session create [--template <name>] [--start]
  session start/stop/pause/resume <id>
  session invoke <id> [entry-point]
  session vars <id> list|get|set|remove
  session entry-points <id> list|add|remove
  session exec <id> "<cmd>"
  session events <id>
  session delete <id>
  session template list|info <name>

REPOS  (= monitor page Spaces → onglet Repos)
  repo list
  repo info <id>
  repo bind <path>
  repo start/stop <id>

WORKSPACES  (= monitor page Spaces → onglet Workspaces)
  workspace list
  workspace info <id>
  workspace create <name>
  workspace delete <id>
  workspace topology

BLOCKS  (= monitor page Foundry + Catalog)
  block list [--type workflow|agent|tool]
  block info <id>
  block search <query>
  block children <id> [--recursive]
  block run <id> [--input key=val]
  block validate <id>
  block metrics <id>

AGENTS & TOOLS  (= monitor page Foundry, entités promues)
  agent list [--category <c>]
  agent info <id>
  agent create [--name <n>] [--block <id>]
  tool list [--category <c>]
  tool info <id>
  tool create [--name <n>] [--block <id>]

MODELS  (= monitor page Models)  *** NOUVEAU ***
  model list
  model info <name>
  model switch <name>
  model provider                Santé du LLM provider
  model leaderboard             Classement fitness
  model profile <name>          Profil détaillé

CATALOG  (= monitor page Catalog)
  catalog list [--type <t>]
  catalog info <id>
  catalog search <query>
```

### Tier 2 — Commandes avancées (help séparé)

```
PROMOTION  (ex-orchestrator)
  promote status
  promote agent <id> [--from <ws>] [--to <ws>]
  promote rollback <id>
  promote history

RESEARCH
  research start [--agent <id>] [--goal "..."]
  research status <cycle-id>
  research proposals
  research approve/reject <id>

SYSTEM
  system list                   Blocs système
  system override/restore <id>
  docs list|show|search
  metrics [--from <date>] [--to <date>]
  config keybindings
  schema
```

### Tier 3 — Aliases de confort (non affichés dans help, fonctionnent silencieusement)

```
# Ancien → Nouveau (avec warning de dépréciation)
health             → status backend
llm                → model provider
blocks             → block list
workflows          → block list --type workflow
projects           → repo list
templates          → session template list
info <id>          → block info <id>
search <q>         → block search <q>
children <id>      → block children <id>
run <id>           → block run <id>
execute <id>       → block run <id>
validate <id>      → block validate <id>
sessions           → session list
training           → session list --template foundry-training
experiment list    → session list --template foundry-training
fitness leaderboard → model leaderboard
foundry            → block list (dans le shell)
```

### Slash commands shell

```
# Meta-commandes shell (prefix / optionnel pour les classiques)
/help, help               Aide
/clear, clear             Effacer
/exit, exit               Quitter
/select [type] <id>       Sélectionner un contexte (session, workspace, repo)
/deselect                 Désélectionner
/monitor [id]             Ouvrir le TUI monitor
/config                   Configuration du shell
/history                  Historique des commandes
```

---

## Organisation du help

Le `help` du shell suit les pages du monitor :

```
╔══════════════════════════════════════════════════════════╗
║  Status & Models                         Home + Models  ║
║    status, model                                        ║
║                                                         ║
║  Spaces                                  Spaces         ║
║    session, workspace, repo                             ║
║                                                         ║
║  Foundry                                 Foundry        ║
║    block, agent, tool                                   ║
║                                                         ║
║  Catalog                                 Catalog        ║
║    catalog, docs                                        ║
║                                                         ║
║  Advanced                                               ║
║    promote, research, system, metrics, config            ║
║                                                         ║
║  Shell                                                  ║
║    /select, /deselect, /monitor, /help, /clear, /exit   ║
╚══════════════════════════════════════════════════════════╝
```

L'utilisateur voit immédiatement le lien avec les 5 pages du monitor.

---

## Résumé des décisions

| Question | Décision |
|----------|----------|
| training/experiment | Aliases de confort → `session` avec template filter |
| orchestrator | Renommé `promote` (plus intuitif) |
| metrics/fitness | Distribués : `model leaderboard`, `block metrics`, `metrics` global |
| status llm | `status provider` ou `model provider` |
| projects → repos | `repo` dans le CLI (= mental model utilisateur) |
| template comme verbe | `session template list\|info` |
| agent/tool vs block | Séparés (backend les distingue) mais groupés sous "Foundry" |
| Slash commands | Hybride : `/select`, `/monitor` + anciennes sans slash |
