# Guide: Agent Foundry Session

Ce guide explique comment utiliser les sessions Foundry pour développer, tester et améliorer des agents et outils dans Maestro.

## Table des matières

1. [Concepts clés](#concepts-clés)
2. [Démarrage rapide](#démarrage-rapide)
3. [Templates de session](#templates-de-session)
4. [Entry Points et Workflows](#entry-points-et-workflows)
5. [Variables de session](#variables-de-session)
6. [Monitoring et Widgets](#monitoring-et-widgets)
7. [Système d'approbation](#système-dapprobation)
8. [Exemples pratiques](#exemples-pratiques)
9. [Référence CLI](#référence-cli)

---

## Concepts clés

### Infrastructure Générique vs Contenu Spécifique

L'architecture Foundry distingue deux concepts :

| Aspect | Générique (Maestro) | Spécifique (Session) |
|--------|---------------------|----------------------|
| Variables | Mécanisme de stockage | Clés et valeurs définies par la session |
| Entry Points | Mécanisme de mappage | Workflows mappés aux noms |
| Widgets | Types (progress-bar, counter) | Configuration et placement |
| Permissions | Système de contrôle | Règles spécifiques à la session |

### Hiérarchie des Sessions

```
ContainerSession
    └── Session
        ├── ProjectSession (développement de projets)
        └── FoundrySession (développement de blocs)
```

---

## Démarrage rapide

### 1. Démarrer les services

```powershell
# Démarrer le backend et les services
powershell.exe -File C:\Meastro\scripts\dev-start.ps1
```

### 2. Vérifier la santé du système

```bash
cd C:\Meastro\tools\maestro-cli
node index.js health
```

### 3. Créer une session Foundry

```bash
# Créer une session avec le template par défaut
node index.js session create --name "Ma Session Foundry" --type foundry

# Ou avec un template spécifique
node index.js session create --name "Training Session" --template foundry-training
```

### 4. Démarrer la session

```bash
node index.js session start <session-id>
```

### 5. Lancer le shell interactif

```bash
node index.js
# Vous êtes maintenant dans le shell Maestro interactif
```

---

## Templates de session

### Template par défaut (`foundry-default`)

Session complète pour le développement avec tous les accès.

```bash
node index.js session create --template foundry-default --name "Dev Session"
```

**Caractéristiques :**
- Toutes les permissions activées
- 5 entry points configurés
- 5 widgets de monitoring
- Mode d'évaluation hybride

**Entry Points disponibles :**
- `improve-agent` - Amélioration itérative d'agents
- `create-tool` - Création de nouveaux outils
- `validate-block` - Validation complète de blocs
- `submit-approval` - Soumission au système d'approbation
- `run-training` - Exécution de training runs

### Template training (`foundry-training`)

Session optimisée pour l'entraînement intensif.

```bash
node index.js session create --template foundry-training --name "Training Run"
```

**Caractéristiques :**
- Permissions restreintes (lecture/exécution)
- Évaluation automatique
- Jusqu'à 100 itérations
- Exécution parallèle (2 workers)

### Template sandbox (`foundry-sandbox`)

Environnement isolé pour tester du code non vérifié.

```bash
node index.js session create --template foundry-sandbox --name "Test Sandbox"
```

**Caractéristiques :**
- Aucun accès réseau ou filesystem
- Limites de ressources strictes
- Monitoring de sécurité
- Timeout court (5 minutes)

---

## Entry Points et Workflows

Les entry points permettent d'invoquer des workflows par leur nom logique.

### Lister les entry points d'une session

```bash
node index.js session vars <session-id> list
# ou via l'API
curl http://localhost:5000/api/sessions/<session-id>/entry-points
```

### Invoquer un entry point

```bash
# Via CLI
node index.js session invoke <session-id> improve-agent --input agentId=my-agent

# Via API
curl -X POST http://localhost:5000/api/sessions/<session-id>/invoke/improve-agent \
  -H "Content-Type: application/json" \
  -d '{"agentId": "my-agent", "targetFitness": 0.9}'
```

### Workflows disponibles

#### 1. Agent Improvement Loop (`improve-agent`)

Améliore itérativement un agent jusqu'à atteindre le fitness cible.

```bash
node index.js session invoke <session-id> improve-agent \
  --input agentId=my-code-agent \
  --input targetFitness=0.85 \
  --input maxIterations=50
```

**Inputs :**
| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| agentId | string | requis | ID de l'agent à améliorer |
| targetFitness | number | 0.85 | Score fitness cible (0-1) |
| maxIterations | number | 50 | Nombre max d'itérations |
| testInputs | array | [] | Inputs de test personnalisés |
| autoApprove | boolean | false | Appliquer les améliorations automatiquement |

#### 2. Tool Creation (`create-tool`)

Crée un nouvel outil avec scaffolding automatique.

```bash
node index.js session invoke <session-id> create-tool \
  --input name=json-validator \
  --input description="Validates JSON against a schema" \
  --input category=validation
```

**Inputs :**
| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| name | string | requis | Nom de l'outil |
| description | string | requis | Description de l'outil |
| category | string | utility | Catégorie (utility, data, integration) |
| implementation | string | script | Type d'implémentation |

#### 3. Block Validation (`validate-block`)

Validation complète d'un bloc.

```bash
node index.js session invoke <session-id> validate-block \
  --input blockId=tools/my-tool \
  --input runTests=true \
  --input strictMode=true
```

#### 4. Submit for Approval (`submit-approval`)

Soumet un bloc au système d'approbation.

```bash
node index.js session invoke <session-id> submit-approval \
  --input blockId=agents/my-improved-agent \
  --input notes="Ready for production after 50 training iterations"
```

#### 5. Training Run (`run-training`)

Exécute une série d'itérations de training.

```bash
node index.js session invoke <session-id> run-training \
  --input blockId=agents/my-agent \
  --input iterations=20 \
  --input parallel=2
```

---

## Variables de session

Les variables permettent de stocker l'état de la session.

### Variables prédéfinies (template foundry-default)

| Variable | Type | Description |
|----------|------|-------------|
| sessionMode | string | Mode actuel (development, training, sandbox) |
| autoEvaluate | boolean | Évaluation automatique activée |
| targetFitness | number | Score fitness cible |
| maxIterations | number | Limite d'itérations |
| currentPhase | string | Phase actuelle (exploration, training, validation) |
| fitnessHistory | array | Historique des scores fitness |
| pendingApprovals | array | IDs des approbations en attente |

### Commandes CLI

```bash
# Lister toutes les variables
node index.js session vars <session-id> list

# Obtenir une variable
node index.js session vars <session-id> get targetFitness

# Définir une variable
node index.js session vars <session-id> set targetFitness 0.9

# Supprimer une variable
node index.js session vars <session-id> remove tempData
```

### API REST

```bash
# GET - Lister
curl http://localhost:5000/api/sessions/<id>/variables

# GET - Obtenir une variable
curl http://localhost:5000/api/sessions/<id>/variables/targetFitness

# PUT - Définir
curl -X PUT http://localhost:5000/api/sessions/<id>/variables/targetFitness \
  -H "Content-Type: application/json" \
  -d '{"value": 0.9}'

# DELETE - Supprimer
curl -X DELETE http://localhost:5000/api/sessions/<id>/variables/tempData
```

---

## Monitoring et Widgets

### Lancer le moniteur

```bash
node index.js monitor <session-id>
# Options:
#   --refresh 2      Rafraîchissement toutes les 2 secondes
#   --max-events 20  Afficher max 20 événements
```

### Widgets configurés (template foundry-default)

```
┌─────────────────────────────────────────────────────────────┐
│ TOP ZONE                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Training Progress  [████████████░░░░░░░░] 62%           │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────┬───────────────┤
│ MAIN ZONE                                   │ SIDEBAR       │
│                                             │               │
│   Fitness Score                             │ Iterations    │
│   1.0 ┤                    ╭─               │ 31 / 50       │
│   0.8 ┤         ╭─────────╯                 │               │
│   0.6 ┤    ╭───╯                            │ Pending       │
│   0.4 ┤───╯     Target: 0.85               │ Approvals     │
│   0.2 ┤                                     │ 2             │
│     0 └─────────────────────────            │               │
│         Iterations                          │               │
├─────────────────────────────────────────────┴───────────────┤
│ BOTTOM ZONE                                                 │
│ Recent Events:                                              │
│   14:32:15 [INFO] Iteration 31 completed - Score: 0.87      │
│   14:32:10 [INFO] Improvement applied: prompt optimization  │
│   14:31:45 [WARN] Score below threshold, retrying...        │
└─────────────────────────────────────────────────────────────┘
```

### Types de widgets disponibles

| Type | Description | Config |
|------|-------------|--------|
| `progress-bar` | Barre de progression | label, variable, max, showPercentage |
| `score-chart` | Graphique de scores | label, variable, targetLine, chartType |
| `counter` | Compteur numérique | label, variable, format, alertThreshold |
| `status-list` | Liste d'événements | label, variable, maxItems, showTimestamp |

### Enregistrer un widget personnalisé

```bash
# Via API
curl -X POST http://localhost:5000/api/sessions/<id>/widgets \
  -H "Content-Type: application/json" \
  -d '{
    "id": "custom-metric",
    "type": "counter",
    "zone": "sidebar",
    "config": {
      "label": "Custom Metric",
      "variable": "myMetric",
      "format": "{value} units"
    }
  }'
```

---

## Système d'approbation

Le système d'approbation permet de valider les blocs avant publication.

### Flux d'approbation

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Submit    │ ──> │   Pending   │ ──> │  Approved   │
│             │     │             │     │             │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                          v
                   ┌─────────────┐
                   │  Rejected   │
                   │             │
                   └─────────────┘
```

### Commandes CLI

```bash
# Lister les approbations en attente
node index.js approval list

# Voir les détails d'une approbation
node index.js approval info <approval-id>

# Soumettre un bloc pour approbation
node index.js approval submit <block-id> --session <session-id>

# Approuver un bloc
node index.js approval approve <approval-id>

# Rejeter un bloc
node index.js approval reject <approval-id> --reason "Needs more testing"
```

### Workflow complet

```bash
# 1. Créer et améliorer un agent
node index.js session invoke <session-id> improve-agent \
  --input agentId=my-agent --input targetFitness=0.85

# 2. Valider le bloc
node index.js session invoke <session-id> validate-block \
  --input blockId=my-agent --input strictMode=true

# 3. Soumettre pour approbation
node index.js approval submit my-agent --session <session-id>

# 4. (Reviewer) Examiner et approuver
node index.js approval info <approval-id>
node index.js approval approve <approval-id>
```

---

## Exemples pratiques

### Exemple 1: Créer et entraîner un nouvel agent

```bash
# 1. Créer une session Foundry
node index.js session create --template foundry-default --name "Agent Development"
# Résultat: Session ID = abc123

# 2. Démarrer la session
node index.js session start abc123

# 3. Créer un nouvel agent (via scaffold)
node index.js session invoke abc123 create-tool \
  --input name=code-reviewer \
  --input description="Reviews code for best practices" \
  --input category=development

# 4. Lancer le training
node index.js session invoke abc123 run-training \
  --input blockId=tools/code-reviewer \
  --input iterations=20

# 5. Surveiller le progrès
node index.js monitor abc123

# 6. Vérifier les métriques
node index.js session vars abc123 get fitnessHistory
```

### Exemple 2: Améliorer un agent existant

```bash
# 1. Créer une session training
node index.js session create --template foundry-training --name "Improve Code Agent"

# 2. Configurer le target
node index.js session vars <id> set targetFitness 0.9

# 3. Lancer l'amélioration
node index.js session invoke <id> improve-agent \
  --input agentId=agents/code-generator \
  --input targetFitness=0.9 \
  --input maxIterations=100

# 4. Surveiller (dans un autre terminal)
node index.js monitor <id> --refresh 5
```

### Exemple 3: Pipeline complet de validation

```bash
# 1. Session de développement
SESSION_ID=$(node index.js session create --template foundry-default --name "Validation Pipeline" --json | jq -r '.id')

# 2. Valider le bloc
node index.js session invoke $SESSION_ID validate-block \
  --input blockId=my-block \
  --input strictMode=true

# 3. Si validation OK, soumettre
node index.js approval submit my-block --session $SESSION_ID

# 4. Lister les approbations en attente
node index.js approval list

# 5. (Reviewer) Approuver
node index.js approval approve <approval-id>
```

### Exemple 4: Test en sandbox

```bash
# 1. Créer une session sandbox
node index.js session create --template foundry-sandbox --name "Test Unsafe Block"

# 2. Tester le bloc en isolation
node index.js session invoke <id> validate-block \
  --input blockId=untested-block \
  --input runTests=true

# 3. Vérifier les violations de sécurité
node index.js session vars <id> get safetyViolations
```

---

## Référence CLI

### Commandes Session

| Commande | Description |
|----------|-------------|
| `session list` | Lister toutes les sessions |
| `session create --name <n> --template <t>` | Créer une session |
| `session start <id>` | Démarrer une session |
| `session pause <id>` | Mettre en pause |
| `session resume <id>` | Reprendre |
| `session stop <id>` | Arrêter |
| `session info <id>` | Détails de la session |
| `session delete <id>` | Supprimer |
| `session invoke <id> <entry-point>` | Invoquer un entry point |
| `session vars <id> list/get/set/remove` | Gérer les variables |

### Commandes Approval

| Commande | Description |
|----------|-------------|
| `approval list` | Lister les approbations en attente |
| `approval info <id>` | Détails d'une approbation |
| `approval submit <block-id>` | Soumettre un bloc |
| `approval approve <id>` | Approuver |
| `approval reject <id> --reason "..."` | Rejeter |

### Commandes Monitor

| Commande | Description |
|----------|-------------|
| `monitor <session-id>` | Lancer le moniteur |
| `--refresh <sec>` | Intervalle de rafraîchissement |
| `--max-events <n>` | Nombre max d'événements |

---

## Dépannage

### La session ne démarre pas

```bash
# Vérifier le statut
node index.js session info <id>

# Vérifier les logs backend
node index.js health
```

### Les widgets ne s'affichent pas

```bash
# Vérifier que les variables sont définies
node index.js session vars <id> list

# S'assurer que le moniteur a les bonnes permissions
node index.js session info <id> | grep permissions
```

### L'approbation est bloquée

```bash
# Vérifier le statut
node index.js approval info <id>

# Voir les erreurs de validation
node index.js session invoke <session-id> validate-block \
  --input blockId=<block-id> --input strictMode=true
```

---

## Ressources

- **Templates**: `data/foundry/templates/`
- **Workflows**: `blocks/workflows/foundry/`
- **API Docs**: `http://localhost:5000/swagger` (si activé)
- **Logs**: `logs/maestro-api.log`
