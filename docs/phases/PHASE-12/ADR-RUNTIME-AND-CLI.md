# ADR: Isolation Runtime & Interface Agent CLI

**Date**: 9 février 2026
**Statut**: Accepté
**Auteurs**: Architecture Maestro

---

## Contexte

Maestro utilise un système de sessions hiérarchiques (Workspace > Session > sous-sessions) où chaque session peut exécuter du code, des workflows, et des appels LLM. Deux questions architecturales critiques se posent :

1. **Comment isoler les sessions les unes des autres ?**
   - Docker container par session (isolation OS-level) ?
   - Backend comme autorité unique (isolation logique) ?

2. **Comment les agents interagissent-ils avec Maestro ?**
   - Un seul outil CLI avec commandes textuelles ?
   - Serveur MCP avec tools structurés ?
   - CLI avec mode JSON ?

Ces décisions impactent les ressources, la sécurité, la transparence et la scalabilité du système.

---

## Décision 1: Runtime — Hybride Backend-first

### Options considérées

#### Option A: Docker container par session

Chaque session reçoit son propre container Docker. L'agent pourrait exécuter des commandes directement dans le container. Le backend ne ferait que provisionner le container avec les outils nécessaires.

```
Workspace
├── Session A → Container Docker A (node:20-alpine)
│   ├── Session A.1 → Container Docker A.1
│   └── Session A.2 → Container Docker A.2
├── Session B → Container Docker B (python:3.12)
└── Session C → Container Docker C (dotnet:8.0)
```

**Pour :**
- Isolation "gratuite" au niveau OS (réseau `--network none`, FS `--read-only`, limites CPU/mémoire)
- Sécurité par défaut — même du code malveillant est confiné
- Pas besoin de coder la logique de sandboxing

**Contre :**
- **Ressources** : un Workspace avec 5 sessions = 5 containers. Avec imbrication, ça explose exponentiellement
- **Latence** : créer/démarrer un container = 2-5 secondes par session
- **Redondance** : l'agent ne parle PAS directement au container — il passe par CLI → API → backend → `docker exec`. Le backend est déjà le gatekeeper
- **Complexité opérationnelle** : gestion du cycle de vie, images, volumes, nettoyage, orphelins
- **Dev local** : obliger Docker pour développer est un frein significatif
- **Chaque container aurait besoin d'une version simplifiée du backend** — effort de duplication massif

#### Option B: Backend comme autorité unique (Process)

Le backend gère toute l'isolation logiquement. Les commandes s'exécutent via `ProcessContainerRuntime` (processus OS direct, pas de Docker).

```
Backend (autorité unique)
├── Session A → Process (working dir: /projects/a, permissions: read-only)
│   ├── Session A.1 → Process (working dir: /projects/a/sub, permissions: restricted)
│   └── Session A.2 → Process (working dir: /projects/a/sub2, permissions: restricted)
├── Session B → Process (working dir: /projects/b, permissions: controlled)
└── Session C → Process (working dir: /projects/c, permissions: full)
```

**Pour :**
- **Léger** : 50 sessions imbriquées = 50 objets en mémoire, pas 50 containers
- **Rapide** : pas de latence de provisionnement
- **Déjà fonctionnel** : `ProcessContainerRuntime` existe et marche
- **Permission hierarchy déjà implémentée** : `ContextPermissions.Intersect()` assure que l'enfant ne dépasse jamais le parent

**Contre :**
- Pas d'isolation au niveau OS — un processus mal contrôlé peut accéder au FS hôte
- Il faut coder la logique de sandboxing (chemins autorisés, variables d'environnement)
- Moins sécurisé pour l'exécution de code non-fiable (code généré par un LLM)

#### Option C: Hybride — Backend par défaut, Docker pour le non-fiable

Le backend est toujours l'autorité. `ProcessContainerRuntime` est le mode par défaut. `DockerContainerRuntime` est activé uniquement pour les sessions qui exécutent du code non-fiable.

```
Backend (autorité unique)
├── Session A → Process (code fiable, rapide)
├── Session B → Process (code fiable, rapide)
└── Session C → Docker (code généré par LLM, isolé)
                └── Container partagé "sandbox" (pas un container par session)
```

### Décision retenue : Option C — Hybride Backend-first

**Justification :**

1. **Le backend est déjà le gatekeeper.** Toutes les requêtes passent par CLI → API → Backend, que le runtime soit Docker ou Process. L'isolation Docker est une couche *supplémentaire*, pas la couche *primaire*.

2. **L'architecture supporte déjà les deux.** `ContainerRuntimeFactory` choisit Docker ou Process selon `RuntimeConfiguration.Type`. Aucun changement structurel nécessaire.

3. **Le coût de Docker par session est disproportionné.** Un Workspace avec 10 sessions imbriquées créerait 10 containers. Avec Process, c'est 10 objets en mémoire.

4. **Un container Docker partagé suffit pour le code non-fiable.** Plutôt qu'un container par session, un seul container "sandbox" tourne en permanence. Le backend y envoie les commandes via `docker exec` avec des working directories différents. 80% de l'isolation pour 10% du coût.

5. **L'idée originale d'agents qui parlent directement au container est abandonnée.** Elle contredit le principe CLI-first et rendrait les actions invisibles au système de métriques, logging et audit.

### Conséquences

| Aspect | Implication |
|--------|-------------|
| **Sécurité** | Renforcer la validation côté `ProcessContainerRuntime` : chemins, env vars, timeouts |
| **Configuration** | `RuntimeConfiguration.Type` dans le template de session décide du runtime |
| **Ressources** | Réduction massive — pas de container par session |
| **Dev local** | Docker n'est plus requis pour développer |
| **Code non-fiable** | Container sandbox partagé pour les cas critiques |

### Ce qui doit être renforcé dans ProcessContainerRuntime

Le `ProcessContainerRuntime` actuel est fonctionnel mais nécessite des améliorations pour être le mode par défaut en sécurité :

1. **Validation de chemins** — Empêcher les traversals (`../../etc/passwd`). Vérifier que le working directory est sous le `RepositoryPath` de la session.
2. **Variables d'environnement contrôlées** — Ne pas exposer les secrets du backend au processus enfant. Liste blanche explicite.
3. **Working directory forcé** — Toujours forcer le cwd au `RepositoryPath`, ignorer les demandes de changement.
4. **Timeout strict** — Déjà partiellement implémenté via `ResourceLimits.TimeoutSeconds`, s'assurer qu'il est toujours appliqué.
5. **Capture de sortie bornée** — Limiter stdout/stderr pour éviter qu'un processus malveillant ne sature la mémoire.

---

## Décision 2: Interface Agent — CLI avec mode JSON

### Options considérées

#### Option A: CLI unique avec commandes textuelles (actuel)

L'agent a un seul tool block `maestro-cli` et compose des commandes en texte libre :

```bash
node index.js session create --type foundry --name "Test"
node index.js session invoke abc123 start
node index.js session set-var abc123 currentFitness 0.85
```

**Pour :**
- Un seul point d'entrée — audit et logging centralisés
- Humain et agent utilisent exactement la même interface
- Ajouter une capacité = ajouter une commande CLI, aucune reconfiguration de l'agent

**Contre :**
- Les LLMs doivent **composer des strings** — c'est ce qu'ils font le moins bien (15-30% d'erreurs de syntaxe sur CLI libre vs 2-5% sur function calling structuré)
- Pas de validation avant exécution — l'erreur arrive au runtime seulement
- La description du tool doit lister toutes les sous-commandes → consomme du contexte
- Le LLM ne sait pas ce qui est *disponible* — il doit deviner la syntaxe

#### Option B: Serveur MCP (Model Context Protocol) — pour les agents internes

Maestro expose un serveur MCP. Les agents internes (blocks) découvrent dynamiquement les tools :

```
MCP Server Maestro
├── session/create    (params: type, name)
├── session/invoke    (params: id, entryPoint)
├── session/set-var   (params: id, key, value)
├── block/list        (params: filter?)
├── block/execute     (params: id, inputs)
└── monitor/status    (params: sessionId)
```

**Pour :**
- Découverte dynamique des tools disponibles
- Paramètres typés avec JSON Schema — validation avant exécution
- Standard ouvert (fonctionne avec Claude, GPT, etc.)
- Le backend peut exposer des tools différents selon le contexte/permissions

**Contre (comme interface pour les agents internes / blocks) :**
- **Viole "everything is a block"** — les appels MCP contournent le système de blocks. L'agent interne ne passe plus par un tool block, il appelle le MCP server directement
- **Perte de transparence** — les appels MCP ne sont pas des noeuds dans l'execution tree. Le workflow ne montre pas "l'agent a appelé session.create", il ne montre... rien
- **Infrastructure supplémentaire** — un processus serveur MCP à maintenir en plus du backend
- **Double standard** — les humains utilisent le CLI, les agents internes utilisent MCP. Deux interfaces pour le même système = divergence inévitable

**Note importante : MCP est rejeté ici comme interface pour les agents *internes* (blocks Maestro). Il sera adopté dans une future phase comme interface pour les agents *externes* (IDE). Voir la section "MCP Server pour agents externes" plus bas.**

#### Option C: CLI avec mode JSON

Le CLI reste l'interface unique, mais accepte du JSON structuré en entrée et retourne du JSON en sortie :

**Entrée :**
```bash
# Humain (mode texte, inchangé) :
node index.js session create --type foundry --name "Test"

# Agent (mode JSON, structuré) :
node index.js --json '{"command":"session.create","params":{"type":"foundry","name":"Test"}}'

# Agent (stdin pour gros payloads) :
echo '{"command":"session.set-var","params":{"id":"abc","key":"_phases","value":[...]}}' | node index.js --json
```

**Sortie :**
```json
{
  "status": "ok",
  "data": {
    "sessionId": "abc-123",
    "name": "Test",
    "type": "foundry"
  }
}
```

```json
{
  "status": "error",
  "code": "SESSION_NOT_FOUND",
  "message": "Session 'xyz' does not exist"
}
```

**Pour :**
- **Préserve "everything is a block"** — le CLI tool block reste l'interface, chaque appel est un noeud dans l'execution tree
- **Transparence totale** — le workflow montre exactement ce que l'agent a envoyé et reçu
- **Structuré** — JSON en entrée réduit les erreurs de syntaxe de l'agent
- **Validable** — le CLI peut valider le JSON contre un schéma avant d'exécuter
- **Une seule interface** — humain en mode texte, agent en mode JSON, même code CLI, même audit
- **Pas d'infrastructure supplémentaire** — pas de serveur MCP, pas de processus en plus

**Contre :**
- Le LLM ne découvre pas dynamiquement les commandes (mais le schéma peut être exposé via `node index.js --schema`)
- Légèrement plus verbeux que du function calling natif

#### Option D: Tools multiples typés

L'agent reçoit N tools avec des paramètres structurés (un tool par opération) :

```json
{"name": "maestro_session_create", "params": {"type": "string", "name": "string"}}
{"name": "maestro_session_invoke", "params": {"sessionId": "string", "entryPoint": "string"}}
{"name": "maestro_block_execute", "params": {"blockId": "string", "inputs": "object"}}
```

**Pour :**
- Chaque tool a des paramètres typés — optimal pour les LLMs
- Validation JSON Schema native

**Contre :**
- **Explosion du nombre de tools** (20-30+ tools par agent)
- **Contourne le système de blocks** — comme MCP, les tools sont externes au workflow
- **Couplage fort** — ajouter une commande CLI = modifier les définitions de tous les agents
- **Pas CLI-first** — deux systèmes parallèles à maintenir

#### Option E: Hybride — quelques tools groupés par domaine

4-5 tools regroupant les opérations :

```
maestro_session   → create | start | stop | invoke | set-var
maestro_blocks    → list | get | execute
maestro_monitor   → status | logs | tree
```

**Contre :**
- Paramètres conditionnels mal supportés par les LLMs (si `action=create` il faut `name`, si `action=invoke` il faut `entryPoint`)
- Compromis qui n'a les avantages complets d'aucune approche

### Décision retenue : Option C — CLI avec mode JSON

**Justification :**

1. **Cohérence architecturale.** Le CLI est déjà l'interface universelle. Ajouter un mode JSON préserve cette cohérence au lieu de créer un canal parallèle (MCP) qui contourne le système de blocks.

2. **Transparence des workflows.** Chaque appel CLI depuis un agent est un noeud dans l'execution tree. Le monitor montre l'input JSON et l'output JSON. Rien n'est invisible. Avec MCP, les appels seraient opaques au workflow.

3. **"Everything is a block".** Le maestro-cli est un tool block. L'agent utilise ce tool block. L'appel est visible, métriqué, loggé. MCP crée un canal hors-block qui viole ce principe fondamental.

4. **Réduction des erreurs.** JSON structuré élimine les erreurs de syntaxe CLI (flags mal formés, quotes manquantes, arguments positionnels inversés) tout en gardant l'interface unique.

5. **Zéro infrastructure supplémentaire.** Pas de serveur MCP à démarrer, monitorer, et maintenir. Le CLI est le même binaire qu'avant, avec un flag `--json` en plus.

### Flux complet : Agent → CLI → Backend

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW (execution tree)                         │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Agent Block (observe → think → act)                                │ │
│  │                                                                     │ │
│  │  L'agent décide d'appeler le CLI avec :                             │ │
│  │  {"command":"session.invoke","params":{"id":"x","entryPoint":"go"}} │ │
│  │                                                                     │ │
│  │  ┌──────────────────────────────────────────────────────────────┐   │ │
│  │  │  Tool Block: maestro-cli                                     │   │ │
│  │  │                                                              │   │ │
│  │  │  1. Reçoit le JSON                                           │   │ │
│  │  │  2. Valide contre le schéma                                  │   │ │
│  │  │  3. Route vers la commande                                   │   │ │
│  │  │  4. Appelle l'API backend                                    │   │ │
│  │  │  5. Retourne {"status":"ok","data":{...}}                    │   │ │
│  │  │                                                              │   │ │
│  │  │  → Noeud visible dans l'execution tree                       │   │ │
│  │  │  → Input/output loggés                                       │   │ │
│  │  │  → Durée mesurée                                             │   │ │
│  │  │  → Erreurs capturées                                         │   │ │
│  │  └──────────────────────────────────────────────────────────────┘   │ │
│  │                                                                     │ │
│  │  L'agent lit la réponse et décide de la prochaine action            │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Schéma CLI dynamique

Le CLI peut exposer son schéma de commandes disponibles :

```bash
# L'agent peut interroger les commandes disponibles
node index.js --schema

# Retourne :
{
  "commands": {
    "session.create": {
      "description": "Create a new session",
      "params": {
        "type": {"type": "string", "enum": ["foundry", "project"], "required": true},
        "name": {"type": "string", "required": true},
        "workspaceId": {"type": "string", "required": false}
      }
    },
    "session.invoke": {
      "description": "Invoke a session entry point",
      "params": {
        "id": {"type": "string", "required": true},
        "entryPoint": {"type": "string", "required": true}
      }
    },
    "session.set-var": {
      "description": "Set a session variable",
      "params": {
        "id": {"type": "string", "required": true},
        "key": {"type": "string", "required": true},
        "value": {"type": "any", "required": true}
      }
    }
  }
}
```

Ce schéma peut être :
- **Statique** : toutes les commandes du CLI
- **Contextuel** : filtré selon la session active (une session Foundry n'expose pas les mêmes entry points qu'une session Project)
- **Stocké en variable de session** : `_cliSchema` — la session décrit elle-même ce qui est disponible

### Coexistence des deux modes

```
┌───────────────────┐      ┌───────────────────┐
│   Humain          │      │   Agent LLM       │
│   (terminal)      │      │   (tool block)    │
└────────┬──────────┘      └────────┬──────────┘
         │                          │
  mode texte                  mode JSON
  (args positionnels)         (--json flag)
         │                          │
         └──────────┬───────────────┘
                    │
            ┌───────▼───────┐
            │   CLI Parser  │
            │               │
            │  texte → cmd  │
            │  JSON  → cmd  │
            │               │
            │  (même code   │
            │   en dessous) │
            └───────┬───────┘
                    │
            ┌───────▼───────┐
            │   API Client  │
            │  (HTTP calls) │
            └───────┬───────┘
                    │
            ┌───────▼───────┐
            │    Backend    │
            │  (autorité)   │
            └───────────────┘
```

L'humain tape `session create --type foundry --name "Test"`.
L'agent envoie `{"command":"session.create","params":{"type":"foundry","name":"Test"}}`.
Le CLI parse les deux formats et appelle la même fonction. La sortie est formatée en texte pour l'humain, en JSON pour l'agent (`--json` active aussi la sortie JSON).

---

## Résumé des décisions

| Question | Décision | Raison principale |
|----------|----------|-------------------|
| Isolation runtime | Hybride: Process par défaut, Docker pour code non-fiable | Ressources et latence disproportionnées pour Docker par session |
| Container par session | Non | Un workspace avec N sessions imbriquées créerait N containers |
| Agent direct dans le container | Non | Viole CLI-first, rend les actions invisibles à l'audit |
| Backend comme autorité | Oui | Toutes les requêtes passent déjà par le backend |
| Interface agent | CLI avec mode JSON (`--json`) | Préserve "everything is a block" et la transparence des workflows |
| Serveur MCP pour agents internes | Non | Crée un canal hors-block, perte de transparence |
| Serveur MCP pour agents externes (IDE) | Futur | Permet aux agents IDE (Claude Code, Copilot) d'accéder à Maestro |
| Tools multiples | Non | Contourne le système de blocks, couplage fort |
| Schéma dynamique | Oui (`--schema`) | L'agent peut découvrir les commandes disponibles sans doc statique |

---

## Litmus test

> Peut-on ajouter un nouveau type de session avec UNIQUEMENT des changements JSON ?

**Runtime :** Oui — le template de session définit `RuntimeConfiguration.Type` ("process" ou "docker"). Le `ContainerRuntimeFactory` route automatiquement.

**CLI :** Oui — les commandes CLI sont génériques (`session.create`, `session.invoke`, `session.set-var`). Un nouveau type de session n'ajoute pas de commandes CLI. Le schéma contextuel (`_cliSchema`) est défini dans le template de session.

**Aucun changement C# nécessaire.** L'architecture reste fidèle au principe cardinal.

---

## Prochaines étapes d'implémentation

### Phase 12.1: Renforcement de ProcessContainerRuntime
1. Validation de chemins (anti-traversal)
2. Variables d'environnement en liste blanche
3. Working directory forcé
4. Capture de sortie bornée (limite stdout/stderr)

### Phase 12.2: Mode JSON du CLI
1. Flag `--json` pour entrée/sortie JSON
2. Routage JSON → commande existante (même code en dessous)
3. Sortie JSON structurée (`{"status","data","error"}`)
4. Validation JSON contre schéma avant exécution

### Phase 12.3: Schéma CLI dynamique
1. Commande `--schema` pour exposer les commandes disponibles
2. Schéma contextuel optionnel via variable `_cliSchema`
3. Documentation auto-générée depuis le schéma

### Phase 12.4: Container sandbox partagé (futur)
1. Un seul container Docker "sandbox" provisionné au démarrage
2. Commandes routées via `docker exec` avec working directory isolé
3. Activé par `RuntimeConfiguration.Type = "docker"` dans le template

---

## Clarification : MCP Server pour agents externes (phase future)

### Deux types d'agents, deux interfaces

La décision de cette ADR concerne les **agents internes** — les blocks agent de Maestro qui s'exécutent dans des workflows. Pour ces agents, le CLI JSON est l'interface correcte car il préserve la transparence du système de blocks.

Il existe cependant un deuxième cas d'usage : les **agents externes** qui vivent dans les IDE des utilisateurs (Claude Code, GitHub Copilot, Cursor, etc.). Ces agents ne sont pas des blocks Maestro — ils sont des outils tiers que l'utilisateur possède déjà via ses propres abonnements.

```
AGENTS INTERNES (blocks Maestro)          AGENTS EXTERNES (IDE)
  │                                          │
  │ Interface: CLI JSON (--json)             │ Interface: MCP Server
  │ Visibilité: dans l'execution tree        │ Visibilité: dans les logs API
  │ Métriques: par block                     │ Métriques: par requête
  │ Exécution: dans un workflow              │ Exécution: hors workflow
  │                                          │
  └──────────────┬───────────────────────────┘
                 │
          ┌──────▼──────┐
          │   Backend   │
          │  (autorité) │
          └─────────────┘
```

### Pourquoi MCP pour les agents externes

Un utilisateur qui a Claude Code ou Copilot dans son IDE veut pouvoir :
- Lister ses sessions Maestro
- Invoquer un entry point
- Lire les variables d'une session
- Voir le statut d'un workflow

Sans MCP, l'utilisateur devrait quitter son IDE, ouvrir un terminal, et taper des commandes CLI. Avec MCP, son agent IDE découvre automatiquement les outils Maestro et peut les utiliser directement.

```
┌──────────────────────────────────────────────────────────────┐
│  VS Code / Cursor / IDE                                      │
│                                                              │
│  Claude Code (agent IDE)                                     │
│  ├── Discovers MCP tools from Maestro server                │
│  ├── session/list → "Tu as 3 sessions actives"              │
│  ├── session/invoke → "J'ai lancé ton workflow"              │
│  └── session/get-var → "Le fitness actuel est 0.87"         │
│                                                              │
│  L'utilisateur utilise SON abonnement Claude Code,           │
│  pas un agent Maestro interne.                               │
└──────────────────────────────────────────────────────────────┘
         │
    MCP Protocol
         │
┌────────▼─────────────────────────────────────────────────────┐
│  Maestro MCP Server                                          │
│  (expose les mêmes opérations que le CLI/API)                │
│                                                              │
│  ├── Authentification par token                              │
│  ├── Permissions par session (même hiérarchie)              │
│  └── Logging des requêtes (audit)                            │
└────────┬─────────────────────────────────────────────────────┘
         │
    API interne
         │
┌────────▼─────────┐
│     Backend      │
└──────────────────┘
```

### Ce que le MCP server N'est PAS

- **Pas un remplacement du CLI** — les agents internes utilisent toujours le CLI JSON
- **Pas un canal entre blocks** — les blocks communiquent via le workflow, pas via MCP
- **Pas une obligation** — le MCP server est optionnel. Tout fonctionne sans lui.

### Ce que le MCP server EST

- **Une porte d'entrée externe** — au même titre que l'API REST ou le CLI
- **Un pont vers les IDE** — permet aux agents IDE existants d'interagir avec Maestro
- **Un moyen de réutiliser les abonnements** — l'utilisateur n'a pas besoin d'un LLM dédié Maestro pour les opérations simples

### Phase future (non planifiée en Phase 12)

Le MCP server sera implémenté dans une phase ultérieure. Il appellera les mêmes endpoints API que le CLI et l'interface REST. Aucun chemin d'accès privilégié — trois portes d'entrée, un seul backend, mêmes permissions.
