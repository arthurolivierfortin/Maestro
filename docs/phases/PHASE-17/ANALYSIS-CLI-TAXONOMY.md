# Analyse : Taxonomie CLI vs Monitor — Refonte des commandes

## 1. Constat : Deux systèmes déconnectés

### Le Monitor (5 domaines clairs)

| Page | Raccourci | Domaine | Ressources affichées |
|------|-----------|---------|---------------------|
| **Home** | H | Tableau de bord | Statut système, sessions actives, actions rapides |
| **Spaces** | S | Infrastructure | Repos, Workspaces, Sessions (3 onglets) |
| **Foundry** | F | Blocs utilisateur | Workflows, Agents, Tools (édition) |
| **Catalog** | C | Découverte | Blocs système + utilisateur, fitness, recherche |
| **Models** | M | LLM | Modèles disponibles, santé, switch, config |

Cohérent, hiérarchique, 5 domaines orthogonaux.

### Le CLI (30+ commandes éclatées)

```
health, llm, blocks, workflows, block, info, children, search, block-info,
session, sessions, templates, projects, workspace, monitor, run, execute,
validate, training, fitness, foundry, agents, tools, test, system,
orchestrator, experiment, research, approval, docs, catalog, metrics,
runs, config, schema
```

**Problèmes identifiés :**

| Problème | Exemples |
|----------|----------|
| **Doublons** | `blocks` vs `block info` vs `block-info` vs `info` — 4 façons d'accéder à la même info |
| **Doublons verbes** | `run` = `execute` (alias silencieux) |
| **Incohérence singulier/pluriel** | `session` = `sessions`, `template` = `templates`, mais `block` ≠ `blocks` |
| **Commandes orphelines** | `children`, `search`, `info`, `validate` — commandes top-level qui devraient être des sous-commandes de `block` |
| **Pas de `models`** | Le monitor a une page Models, le CLI n'a que `llm` (statut seulement) |
| **Domaines éclatés** | `training` + `experiment` + `research` + `fitness` = 4 commandes pour le même domaine |
| **`use` cryptique** | Définit un contexte session implicite — concept non standard, non évident |
| **`foundry` vs `agents`/`tools`** | Le monitor les regroupe sous Foundry ; le CLI les sépare en 3 commandes |

---

## 2. Analyse de `use`

### Ce que `use` fait aujourd'hui

```bash
maestro> use abc12345       # Mémorise l'ID de session
maestro [abc12345]> vars list   # Équivaut à "session vars abc12345 list"
maestro [abc12345]> invoke start  # Équivaut à "session invoke abc12345 start"
maestro [abc12345]> monitor       # Ouvre le monitor pour cette session
maestro [abc12345]> unuse         # Efface le contexte
```

### Problèmes avec `use`

1. **Nom non-intuitif** — "use" quoi ? Un utilisateur ne devine pas que c'est un raccourci de session
2. **Scope limité** — Ne fonctionne que pour les sessions, pas les workspaces, projets, etc.
3. **Implicite** — L'injection d'ID est invisible, source de confusion ("pourquoi ça marche sans ID ?")
4. **Pas de pattern standard** — Les CLI modernes (kubectl, docker, gh) utilisent `context` ou `namespace`

### Recommandation

Renommer en `select <resource> <id>` avec support multi-ressource :

```bash
maestro> select session abc123   # ou juste: select abc123 (auto-détection)
maestro [session:abc123]> vars list
maestro [session:abc123]> select workspace w456
maestro [workspace:w456]> info
maestro> deselect                # efface le contexte
```

---

## 3. Proposition : Taxonomie alignée Monitor ↔ CLI

### Principe directeur

```
<ressource> <verbe> [cible] [options]
```

Chaque page du monitor = un groupe de commandes CLI. Verbes uniformes :
- `list` — lister les ressources
- `info <id>` — détail d'une ressource
- `create` — créer
- `delete <id>` — supprimer
- `start/stop/pause/resume <id>` — lifecycle
- `search <query>` — rechercher

### Structure proposée

#### HOME → `status`

```bash
status                  # Dashboard (santé backend + LLM + sessions actives)
status health           # Juste le backend
status llm              # Juste le LLM provider
```

Remplace : `health`, `llm`

#### SPACES → `session`, `workspace`, `project`

```bash
# Sessions (inchangé, déjà bien structuré)
session list [--status running] [--recent 5]
session info <id>
session create [--project <id>] [--template <name>] [--start]
session start <id>
session stop <id>
session invoke <id> [entry-point]
session vars <id> list|get|set|remove
session entry-points <id> list|add|remove
session exec <id> "<cmd>"
session events <id>
session delete <id>

# Workspaces
workspace list
workspace info <id>
workspace create <name>
workspace delete <id>
workspace add-session <id> <session-id>
workspace topology

# Projects
project list
project info <id>
project create [--name <n>] [--path <p>]
project delete <id>
project start/stop/restart <id>
project logs <id>
project blocks <id>

# Templates
template list
template info <name>
```

Remplace : `sessions`, `projects`, `templates`
Changements : `projects` → `project` (singulier uniforme)

#### FOUNDRY → `block`, `agent`, `tool`

```bash
# Blocs (unifié)
block list [--type workflow|agent|tool]
block info <id>
block search <query>
block children <id> [--recursive]
block run <id> [--input key=val]
block validate <id>
block publish <id>
block approve <id>
block reject <id> [--reason "..."]

# Agents
agent list [--category <c>]
agent info <id>
agent create [--name <n>] [--block <id>]
agent delete <id>
agent metrics <id>

# Tools
tool list [--category <c>]
tool info <id>
tool create [--name <n>] [--block <id>]
tool delete <id>
tool test <id>
tool metrics <id>
```

Remplace : `blocks`, `workflows`, `info`, `children`, `search`, `run`, `execute`, `validate`, `block-info`, `approval`, `foundry`
Changements :
- Toutes les commandes orphelines (`search`, `children`, `info`, `validate`, `run`) deviennent sous-commandes de `block`
- `foundry` CLI disparaît (le domaine = block+agent+tool)
- `approval` intégré dans `block publish/approve/reject`
- `agents` → `agent`, `tools` → `tool` (singulier)

#### CATALOG → `catalog`, `docs`

```bash
catalog list [--type workflow|agent|tool]
catalog info <id>
catalog search <query>

docs list [--category <c>]
docs show <topic>
docs search <query>
docs generate
```

Inchangé, déjà correct.

#### MODELS → `model` (NOUVEAU)

```bash
model list                    # Modèles disponibles
model info <name>             # Détail d'un modèle
model switch <name>           # Changer le modèle actif
model status                  # Santé du LLM provider (= ancien `llm`)
model config                  # Config (temperature, max_tokens)
model profile <name>          # Profil fitness du modèle
model leaderboard             # Classement fitness des modèles
```

Remplace : `llm`, `fitness profiles`, `fitness profile`, `fitness leaderboard`
Nouveau : `model switch`, `model config`

#### TRAINING → `training`, `experiment`

```bash
# Training
training list                 # Configs de training
training info <id>
training create
training start <id>
training runs [--status <s>]
training run-info <id>

# Experiments
experiment list [--workspace <id>]
experiment info <id>
experiment create
experiment start <id>
experiment stop <id>
experiment compare <id1> <id2>
experiment strategies
```

Remplace : `training`, `experiment`
Changements : `research` intégré comme sous-type d'experiment ou maintenu séparé

#### SYSTEM → `system`, `orchestrator`

```bash
# System blocks
system list
system info <id>
system override <id>
system restore <id>

# Orchestrator
orchestrator status
orchestrator promote
orchestrator rollback
orchestrator history

# Fitness (global)
fitness config
fitness calculate

# Metrics
metrics summary [--from <date>] [--to <date>]
metrics runs [--workflow <id>]

# Config
config keybindings [show|set|reset|edit]
schema
```

---

## 4. Tableau de migration

| Ancien | Nouveau | Raison |
|--------|---------|--------|
| `health` | `status health` | Groupé sous status |
| `llm` | `model status` | Aligné page Models |
| `blocks` | `block list` | Verbe explicite |
| `workflows` | `block list --type workflow` | Plus de commande séparée |
| `info <id>` | `block info <id>` | Sous-commande de block |
| `children <id>` | `block children <id>` | Sous-commande de block |
| `search <q>` | `block search <q>` | Sous-commande de block |
| `block-info <id>` | `block info <id>` | Doublon supprimé |
| `run <id>` | `block run <id>` | Sous-commande de block |
| `execute <id>` | `block run <id>` | Alias supprimé |
| `validate <id>` | `block validate <id>` | Sous-commande de block |
| `projects` | `project list` | Singulier + verbe |
| `templates` | `template list` | Singulier + verbe |
| `sessions` | `session list` | Déjà fonctionnel |
| `agents` | `agent list` | Singulier + verbe |
| `tools` | `tool list` | Singulier + verbe |
| `approval list` | `block list --pending` | Intégré dans block |
| `approval submit` | `block publish <id>` | Verbe plus clair |
| `foundry` | *(supprimé)* | Couvert par block+agent+tool |
| `use <id>` | `select [session] <id>` | Nom plus clair |
| `unuse` | `deselect` | Cohérent avec select |
| `fitness leaderboard` | `model leaderboard` | Aligné page Models |
| `fitness profiles` | `model profile list` | Aligné page Models |

---

## 5. Rétrocompatibilité

### Phase 1 : Aliases (zero breaking change)
Les anciennes commandes restent fonctionnelles mais affichent un hint :
```
⚠ "blocks" is deprecated, use "block list" instead.
```

### Phase 2 : Help mis à jour
Le `help` et `--help` n'affichent que la nouvelle taxonomie.

### Phase 3 : Suppression des aliases
Après 2-3 versions, les anciennes commandes sont retirées.

---

## 6. Impact sur le shell

### Prompt avec sélection multi-ressource

```
maestro>                              # Pas de contexte
maestro [session:abc123]>             # Session sélectionnée
maestro [workspace:w456]>             # Workspace sélectionné
```

### Tab completion mis à jour

Les ressources top-level suivent les pages du monitor :
```
session  workspace  project  block  agent  tool  catalog  model
training  experiment  system  orchestrator  research  docs
status  config  schema  monitor  select  deselect
```

### Help aligné sur le monitor

```
Status & Models                    ← Home + Models
  status, model

Spaces                             ← Spaces
  session, workspace, project, template

Foundry                            ← Foundry
  block, agent, tool

Catalog & Docs                     ← Catalog
  catalog, docs

Training & Research
  training, experiment, research

System
  system, orchestrator, fitness, metrics, config
```

---

## 7. Résumé des décisions

| Décision | Justification |
|----------|--------------|
| Singulier pour toutes les ressources | `block`, `session`, `project` — pas `blocks`, `sessions`, `projects` |
| `<ressource> <verbe>` uniforme | Pattern cohérent, prévisible, auto-documenté |
| Nouveau `model` command | Aligne CLI avec la page Models du monitor |
| `select`/`deselect` remplace `use`/`unuse` | Nom clair, extensible à toutes les ressources |
| Commandes orphelines → sous-commandes | `search`, `children`, `run`, `info` → sous `block` |
| `status` regroupe health + llm | Un seul point d'entrée pour le statut système |
| Suppression des doublons | `block-info`, `execute`, `workflows` supprimés |
| Help organisé par pages monitor | L'utilisateur retrouve la même logique partout |
