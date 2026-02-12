# Maestro Philosophy V2: Fitness-Driven Autonomous Training

> **Version 2.0** - Extension de la philosophie Maestro pour intégrer le modèle de fitness et l'équipe de recherche autonome.

---

## 1. Vision Fondamentale (Rappel)

Maestro remplace l'utilisation d'un seul LLM puissant et coûteux par un **réseau orchestré de blocks spécialisés** utilisant des LLMs plus petits et économiques.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    APPROCHE MAESTRO                                     │
│                                                                         │
│                    ┌─────────────────┐                                  │
│                    │  Orchestrateur  │                                  │
│                    │  (petit LLM)    │                                  │
│                    └────────┬────────┘                                  │
│           ┌─────────────────┼─────────────────┐                         │
│           │                 │                 │                         │
│    ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐                 │
│    │ Agent       │   │ Agent       │   │ Agent       │                 │
│    │ Spécialisé  │   │ Spécialisé  │   │ Spécialisé  │                 │
│    │ (petit LLM) │   │ (petit LLM) │   │ (petit LLM) │                 │
│    └─────────────┘   └─────────────┘   └─────────────┘                 │
│                                                                         │
│    Petites tâches + Petit contexte + Orchestration = Performance        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Nouveau: Le Modèle de Fitness

### 2.1 Philosophie du Fitness

> **Maximiser l'intelligence par unité d'énergie**, pas la taille brute du modèle.

Le modèle de fitness est une **métrique évolutionnaire** qui pénalise:
- La taille des modèles
- Le coût économique
- La demande matérielle
- La généralité inutile

Et récompense:
- La performance sur des tâches ciblées
- La spécialisation
- La composabilité dans des workflows

### 2.2 Formule du Fitness (Modèle Unique)

```
                    P × S × W
ModelFitness = ─────────────────────────
               (C_norm × C_compute × C_hw)^λ
```

| Dimension | Description | Calcul |
|-----------|-------------|--------|
| **P** (Performance) | Succès réel sur la tâche ciblée | Tests passés, formats respectés [0-1] |
| **S** (Spécialisation) | Récompense la focalisation | P / entropie_des_tâches |
| **W** (Composabilité) | Intégration dans workflows | 1 - hallucination_rate |
| **C_norm** | Coût économique normalisé | coût / coût_baseline |
| **C_compute** | Taille cognitive | log(params) × FLOPs/token |
| **C_hw** | Friction infrastructure | α·VRAM + β·RAM + γ·GPU |
| **λ** | Pénalisation non-linéaire | > 1 (recommandé: 1.5) |

### 2.3 Fitness d'un Workflow

Un workflow = graphe de modèles spécialisés.

```
                    Σ (ModelFitness_i × contribution_i)
WorkflowFitness = ───────────────────────────────────────
                              Σ (coûts_i)
```

**Bonus Pipeline** (optionnel):
```
PipelineBonus = log(nombre_de_modèles) × diversité
```

Appliqué seulement si les modèles sont réellement spécialisés.

### 2.4 Effets Recherchés

| Effet | Description |
|-------|-------------|
| ✅ Gros modèles défavorisés | Un gros modèle "one-shot" devient mathématiquement inefficient |
| ✅ Petits modèles favorisés | Les petits modèles spécialisés gagnent |
| ✅ Décomposition encouragée | Diviser les tâches est récompensé |
| ✅ Workflows émergents | L'orchestration devient naturelle |
| ✅ Open-source avantagé | Local + open-source = avantage structurel |

---

## 3. Architecture Hybride

### 3.1 Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MAESTRO CORE (Générique)                         │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Blocks     │  │   Sessions   │  │   Workflows  │                  │
│  │   Engine     │  │   Manager    │  │   Executor   │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Training   │  │   Metrics    │  │   FITNESS    │  ← NOUVEAU       │
│  │   System     │  │   Collector  │  │   ENGINE     │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│   SYSTEM BLOCKS   │    │   USER BLOCKS     │    │  EXTERNAL REPOS   │
│                   │    │                   │    │                   │
│ • fitness-eval    │    │ • custom-agents   │    │ • research-team   │
│ • trainer-agent   │    │ • domain-tools    │    │ • domain-specific │
│ • tester-agent    │    │ • workflows       │    │ • specialized     │
│ • documenter      │    │                   │    │   training        │
│ • researcher      │    │                   │    │                   │
│ • publisher       │    │                   │    │                   │
└─────────┬─────────┘    └─────────┬─────────┘    └─────────┬─────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   ▼
                    ┌───────────────────────────┐
                    │       WORKSPACES          │
                    │                           │
                    │  • Training Workspace     │
                    │  • Production Workspace   │
                    │  • Research Workspace     │
                    └───────────────────────────┘
```

### 3.2 Composants Principaux

#### A. Maestro Core (Générique)

Le core reste un **framework d'orchestration** sans logique métier spécifique:

| Composant | Rôle |
|-----------|------|
| Block Engine | Chargement, validation, exécution des blocks |
| Session Manager | Gestion des sessions Foundry et Project |
| Workflow Executor | Orchestration des workflows |
| Training System | Infrastructure de training et itérations |
| Metrics Collector | Collecte et agrégation des métriques |
| **Fitness Engine** | Calcul du fitness selon la formule |

#### B. System Blocks (Natifs, Overridables)

Blocks fournis par défaut, marqués `isSystem: true`:

```
blocks/system/
├── fitness-evaluator/
│   └── definition.json     # Évalue le fitness d'un agent
├── trainer-agent/
│   └── definition.json     # Orchestre l'entraînement
├── tester-agent/
│   └── definition.json     # Exécute les tests structurés
├── documenter-agent/
│   └── definition.json     # Génère la documentation
├── researcher-agent/
│   └── definition.json     # Recherche et amélioration
└── publisher-agent/
    └── definition.json     # Publie au catalogue
```

**Caractéristiques**:
- Chargés automatiquement au démarrage
- Overridables par l'utilisateur dans `blocks/user/`
- Utilisent la même infrastructure que les blocks utilisateur
- Peuvent s'auto-améliorer via le training

#### C. User Blocks

Blocks créés par l'utilisateur:
- Agents spécialisés pour un domaine
- Tools personnalisés
- Workflows métier

#### D. External Repos (Optionnel)

Pour des cas avancés, un repo externe peut être bindé:
- Équipe de recherche spécialisée
- Entraînement domain-specific
- Documentation et tests custom

### 3.3 Workspaces

Un **Workspace** regroupe des ressources liées:

```typescript
interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  sessions: SessionId[];      // Sessions Foundry
  projects: ProjectId[];      // Projets
  catalog: CatalogRef;        // Catalogue associé
  settings: WorkspaceSettings;
  isolation: WorkspaceIsolation;  // Configuration d'isolation
}

enum WorkspaceType {
  Training,     // Entraînement et amélioration
  Production,   // Exécution sur vrais projets
  Research,     // Recherche et expérimentation
  Custom        // Défini par l'utilisateur
}
```

**Training Workspace** (pré-configuré):
- Sessions Foundry pour développement
- Tests automatisés avec system:tester-agent
- Métriques fitness en temps réel
- Publication automatique vers catalogue

### 3.4 Isolation des Workspaces

#### Pourquoi l'Isolation?

Les workspaces peuvent être **optionnellement isolés** pour:

| Raison | Description |
|--------|-------------|
| **Sécurité** | Empêcher un workspace Research d'accéder directement à Production |
| **Multi-tenant** | Séparer les environnements de différentes équipes |
| **Ressources** | Limiter CPU/RAM par workspace |
| **Communication contrôlée** | Permettre uniquement des interactions explicites entre workspaces |

#### Configuration d'Isolation

```typescript
interface WorkspaceIsolation {
  enabled: boolean;

  // Isolation réseau Docker
  network: {
    name: string;                    // Nom du réseau Docker dédié
    subnet?: string;                 // Ex: "172.20.0.0/16"
    allowInterWorkspace: boolean;    // Communication entre workspaces
    allowedWorkspaces?: string[];    // Liste blanche si allowInterWorkspace=true
  };

  // Limites de ressources
  resources: {
    maxCpuPercent: number;           // Ex: 50 = 50% du CPU
    maxMemoryMB: number;             // Ex: 8192 = 8GB
    maxStorageMB: number;            // Stockage max
  };

  // Permissions inter-workspace
  permissions: {
    canReadFromWorkspaces: string[];   // Peut lire depuis ces workspaces
    canWriteToWorkspaces: string[];    // Peut écrire vers ces workspaces
    canPromoteToWorkspaces: string[];  // Peut promouvoir des agents vers
  };
}
```

#### Architecture avec Isolation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAESTRO HOST                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         WORKSPACE MANAGER                               │ │
│  │                    (gère isolation + communication)                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         │                          │                          │             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ WORKSPACE: Research │  │ WORKSPACE: Staging  │  │ WORKSPACE: Prod     │ │
│  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │ │
│  │ │ Docker Network  │ │  │ │ Docker Network  │ │  │ │ Docker Network  │ │ │
│  │ │ net-research    │ │  │ │ net-staging     │ │  │ │ net-prod        │ │ │
│  │ │                 │ │  │ │                 │ │  │ │                 │ │ │
│  │ │ ┌───┐ ┌───┐    │ │  │ │ ┌───┐ ┌───┐    │ │  │ │ ┌───┐ ┌───┐    │ │ │
│  │ │ │S1 │ │S2 │    │ │  │ │ │S3 │ │S4 │    │ │  │ │ │S5 │ │S6 │    │ │ │
│  │ │ └───┘ └───┘    │ │  │ │ └───┘ └───┘    │ │  │ │ └───┘ └───┘    │ │ │
│  │ └─────────────────┘ │  │ └─────────────────┘ │  │ └─────────────────┘ │ │
│  │                     │  │                     │  │                     │ │
│  │ Permissions:        │  │ Permissions:        │  │ Permissions:        │ │
│  │ • canPromoteTo:     │  │ • canReadFrom:      │  │ • canReadFrom:      │ │
│  │   [staging]         │  │   [research]        │  │   [staging]         │ │
│  │                     │  │ • canPromoteTo:     │  │                     │ │
│  │                     │  │   [prod]            │  │                     │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                              │
│         │                          │                          │             │
│         └──────────────────────────┼──────────────────────────┘             │
│                                    ▼                                         │
│                    ┌───────────────────────────────┐                        │
│                    │     WORKSPACE GATEWAY         │                        │
│                    │  (API pour communication      │                        │
│                    │   inter-workspace contrôlée)  │                        │
│                    └───────────────────────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Communication Inter-Workspace

Les sessions dans un workspace isolé ne peuvent **pas** communiquer directement avec d'autres workspaces. La communication passe par le **Workspace Gateway**:

```typescript
interface WorkspaceGateway {
  // Promouvoir un agent d'un workspace à un autre
  promoteAgent(
    sourceWorkspace: string,
    targetWorkspace: string,
    agentId: string,
    version: string
  ): Promise<PromotionResult>;

  // Lire des métriques d'un autre workspace (si autorisé)
  readMetrics(
    sourceWorkspace: string,
    targetWorkspace: string,
    query: MetricsQuery
  ): Promise<Metrics>;

  // Déclencher une action dans un autre workspace
  triggerAction(
    sourceWorkspace: string,
    targetWorkspace: string,
    action: WorkspaceAction
  ): Promise<ActionResult>;
}
```

---

## 3.5 Agent Orchestrateur Inter-Workspace

### Cas d'Usage Principal

Un **Agent Orchestrateur** automatise le cycle de vie des agents entre workspaces:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATEUR (system:orchestrator)                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         WORKFLOW DE PROMOTION                          │ │
│  │                                                                         │ │
│  │   RESEARCH          STAGING           PRODUCTION                       │ │
│  │   Workspace         Workspace         Workspace                        │ │
│  │                                                                         │ │
│  │   ┌─────────┐       ┌─────────┐       ┌─────────┐                      │ │
│  │   │ Agent   │       │ Agent   │       │ Agent   │                      │ │
│  │   │ v1.0    │──────►│ v1.0    │──────►│ v1.0    │  (actuel)           │ │
│  │   │ training│       │ testing │       │ deployed│                      │ │
│  │   └─────────┘       └─────────┘       └─────────┘                      │ │
│  │        │                 │                                              │ │
│  │        ▼                 ▼                                              │ │
│  │   ┌─────────┐       ┌─────────┐                                        │ │
│  │   │ Agent   │       │ Agent   │                                        │ │
│  │   │ v1.1    │──────►│ v1.1    │───────► (en attente de promotion)     │ │
│  │   │ improved│       │ testing │                                        │ │
│  │   └─────────┘       └─────────┘                                        │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Responsabilités:                                                            │
│  • Surveiller les fitness scores dans Research                              │
│  • Promouvoir automatiquement les agents qui dépassent le threshold         │
│  • Exécuter des tests d'intégration dans Staging                           │
│  • Mettre à jour les sessions Production avec les nouveaux agents          │
│  • Rollback automatique si dégradation détectée                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Définition de l'Agent Orchestrateur

```yaml
# blocks/system/orchestrator-agent/definition.json
{
  "id": "system:orchestrator",
  "name": "Workspace Orchestrator",
  "blockType": "agent",
  "isSystem": true,
  "overridable": true,

  "description": "Automatise la promotion d'agents entre workspaces basé sur le fitness",

  "capabilities": [
    "cross-workspace-communication",
    "agent-promotion",
    "fitness-monitoring",
    "rollback-management"
  ],

  "config": {
    "promotionRules": [
      {
        "from": "research",
        "to": "staging",
        "conditions": {
          "minFitness": 0.7,
          "minIterations": 50,
          "allTestsPass": true
        }
      },
      {
        "from": "staging",
        "to": "production",
        "conditions": {
          "minFitness": 0.85,
          "integrationTestsPass": true,
          "approvalRequired": false  // ou true pour validation humaine
        }
      }
    ],
    "rollbackRules": {
      "fitnessDropThreshold": 0.1,  // Rollback si fitness baisse de 10%
      "errorRateThreshold": 0.05,   // Rollback si erreurs > 5%
      "autoRollback": true
    },
    "monitoringInterval": "5m"  // Vérifie toutes les 5 minutes
  },

  "tools": [
    "workspace-gateway",
    "fitness-calculator",
    "test-runner",
    "session-manager"
  ]
}
```

### Workflow de l'Orchestrateur

```typescript
// Pseudo-code du workflow orchestrateur
async function orchestratorLoop() {
  while (true) {
    // 1. Scanner les workspaces Research pour nouveaux agents qualifiés
    const candidates = await scanResearchWorkspace({
      minFitness: 0.7,
      minIterations: 50
    });

    for (const agent of candidates) {
      // 2. Promouvoir vers Staging
      const stagingResult = await workspaceGateway.promoteAgent(
        'research', 'staging', agent.id, agent.version
      );

      // 3. Lancer tests d'intégration dans Staging
      const testSession = await createStagingSession(agent);
      const testResults = await runIntegrationTests(testSession);

      if (testResults.allPassed && testResults.fitness >= 0.85) {
        // 4. Promouvoir vers Production
        await workspaceGateway.promoteAgent(
          'staging', 'production', agent.id, agent.version
        );

        // 5. Mettre à jour les sessions Production
        await updateProductionSessions(agent);

        // 6. Surveiller la performance post-déploiement
        schedulePostDeploymentMonitoring(agent);
      }
    }

    // 7. Vérifier les agents en Production pour rollback si nécessaire
    await checkProductionHealth();

    await sleep(config.monitoringInterval);
  }
}
```

### Scénario Complet: Auto-Déploiement

```
Temps T0: Research Workspace
├── Agent "commit-generator" v1.0 déployé en Production
├── Research Team améliore l'agent
└── Agent "commit-generator" v1.1 créé avec fitness 0.82

Temps T1: Orchestrateur détecte v1.1
├── Fitness 0.82 > threshold 0.7 ✓
├── 50+ itérations de training ✓
└── Tous les tests passent ✓
    → PROMOTION vers Staging

Temps T2: Staging Workspace
├── Agent v1.1 déployé dans session de test
├── Tests d'intégration exécutés
├── Fitness en staging: 0.87
└── Tous les tests d'intégration passent ✓
    → PROMOTION vers Production

Temps T3: Production Workspace
├── Orchestrateur met à jour les sessions Production
├── Sessions Project utilisent maintenant v1.1
├── Monitoring post-déploiement activé
└── Fitness surveillé en continu

Temps T4: (Hypothétique) Problème détecté
├── Fitness drop de 0.87 → 0.75 (> 10% threshold)
└── ROLLBACK automatique vers v1.0
    → Alerte envoyée à l'équipe
```

### CLI pour l'Orchestrateur

```bash
# Voir le statut de l'orchestrateur
maestro orchestrator status

# Voir les promotions en attente
maestro orchestrator pending

# Forcer une promotion (bypass les règles)
maestro orchestrator promote <agent-id> --from research --to staging --force

# Déclencher un rollback manuel
maestro orchestrator rollback <agent-id> --workspace production --to-version 1.0

# Voir l'historique des promotions
maestro orchestrator history --workspace production --limit 20

# Configurer les règles de promotion
maestro orchestrator config set --min-fitness 0.8 --from research --to staging

# Activer/désactiver l'auto-promotion
maestro orchestrator auto-promote --enable
maestro orchestrator auto-promote --disable

# Voir les métriques cross-workspace
maestro orchestrator metrics --agent <agent-id>
```

### Permissions Requises

L'orchestrateur nécessite des permissions spéciales:

```typescript
interface OrchestratorPermissions {
  // Peut lire depuis tous les workspaces
  globalRead: true;

  // Peut promouvoir entre workspaces configurés
  promotionPaths: [
    { from: 'research', to: 'staging' },
    { from: 'staging', to: 'production' }
  ];

  // Peut modifier les sessions dans ces workspaces
  sessionManagement: ['staging', 'production'];

  // Peut déclencher des rollbacks
  rollbackPermission: true;
}
```

---

## 4. Sessions: Repo vs Sandbox

### 4.1 Types de Sources

```typescript
interface SessionSource {
  type: 'sandbox' | 'repository';

  // Pour sandbox
  sandboxImage?: string;       // Image Docker isolée

  // Pour repository
  repositoryPath?: string;     // Chemin du repo
  dockerBindPath?: string;     // Montage Docker volume
  accessLevel?: AccessLevel;   // ReadOnly, Controlled, Full
}
```

### 4.2 Comportement

| Type | Isolation | Persistance | Cas d'usage |
|------|-----------|-------------|-------------|
| **Sandbox** | Complète (container) | Aucune | Tests, expérimentation |
| **Repository** | Partielle (volume bind) | Complète | Développement, production |

### 4.3 Configuration

```yaml
# Session Foundry avec sandbox
session:
  source:
    type: sandbox
    sandboxImage: "maestro/foundry-sandbox:latest"

# Session Foundry avec repo
session:
  source:
    type: repository
    repositoryPath: "C:/projects/my-research-team"
    dockerBindPath: "/workspace"
    accessLevel: controlled
```

---

## 5. L'Équipe de Recherche

### 5.1 Concept

L'**Équipe de Recherche** est un ensemble d'agents système qui travaillent ensemble pour:
- Évaluer les agents existants
- Identifier les améliorations possibles
- Entraîner de nouveaux agents
- Documenter les résultats
- Publier les agents performants

### 5.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RESEARCH TEAM WORKFLOW                           │
│                                                                         │
│  ┌────────────────┐                                                     │
│  │   Researcher   │ ─── Identifie opportunités d'amélioration           │
│  │   Agent        │                                                     │
│  └───────┬────────┘                                                     │
│          │                                                              │
│          ▼                                                              │
│  ┌────────────────┐                                                     │
│  │   Trainer      │ ─── Crée/améliore des agents avec training          │
│  │   Agent        │                                                     │
│  └───────┬────────┘                                                     │
│          │                                                              │
│          ▼                                                              │
│  ┌────────────────┐                                                     │
│  │   Tester       │ ─── Exécute tests structurés                        │
│  │   Agent        │                                                     │
│  └───────┬────────┘                                                     │
│          │                                                              │
│          ▼                                                              │
│  ┌────────────────┐                                                     │
│  │   Fitness      │ ─── Calcule le score fitness                        │
│  │   Evaluator    │                                                     │
│  └───────┬────────┘                                                     │
│          │                                                              │
│     ┌────┴────┐                                                         │
│     │         │                                                         │
│     ▼         ▼                                                         │
│  ┌──────┐  ┌──────────┐                                                │
│  │ Pass │  │  Fail    │ ─── Retour au Researcher pour itération         │
│  └──┬───┘  └──────────┘                                                │
│     │                                                                   │
│     ▼                                                                   │
│  ┌────────────────┐                                                     │
│  │   Documenter   │ ─── Génère documentation                            │
│  │   Agent        │                                                     │
│  └───────┬────────┘                                                     │
│          │                                                              │
│          ▼                                                              │
│  ┌────────────────┐                                                     │
│  │   Publisher    │ ─── Publie au catalogue                             │
│  │   Agent        │                                                     │
│  └────────────────┘                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Auto-Amélioration

L'équipe de recherche peut **s'améliorer elle-même**:

1. Le `researcher-agent` identifie que `trainer-agent` a un faible fitness
2. Il crée une session de training pour améliorer `trainer-agent`
3. Le nouveau `trainer-agent` remplace l'ancien s'il a un meilleur fitness
4. Le cycle continue

**C'est possible car**:
- Les agents système utilisent la même infrastructure que les agents utilisateur
- Le fitness est calculé de la même manière
- L'override permet de remplacer les agents système

---

## 6. Calcul du Fitness en Pratique

### 6.1 Collecte des Métriques

À chaque exécution d'un agent:

```typescript
interface ExecutionMetrics {
  // Performance (P)
  success: boolean;
  qualityScore: number;         // 0-1
  testsPassRate: number;        // 0-1

  // Coûts
  costUsd: number;              // C_norm
  inputTokens: number;
  outputTokens: number;

  // Compute (pour C_compute)
  modelId: string;
  durationMs: number;

  // Composabilité (W)
  formatCompliance: number;     // 0-1
  hallucinationDetected: boolean;
}
```

### 6.2 Profils de Modèles

Stockés dans le catalogue:

```typescript
interface ModelProfile {
  modelId: string;
  provider: string;
  parameterCount: number;       // Ex: 7_000_000_000 pour 7B
  flopsPerToken: number;        // Estimé
  vramRequirementMB: number;
  ramRequirementMB: number;
  requiresGPU: boolean;
  costPer1kTokens: number;
  supportedTasks: string[];
}
```

### 6.3 Calcul Automatique

```typescript
async function calculateFitness(
  agentId: string,
  metrics: ExecutionMetrics,
  profile: ModelProfile
): Promise<FitnessScore> {
  // P: Performance
  const P = (metrics.qualityScore + metrics.testsPassRate) / 2;

  // S: Spécialisation
  const entropy = await getTaskEntropy(agentId);
  const S = P / Math.max(entropy, 0.1);  // Éviter division par 0

  // W: Composabilité
  const W = metrics.formatCompliance * (metrics.hallucinationDetected ? 0.5 : 1);

  // C_norm: Coût économique
  const baselineCost = 0.01;  // $0.01 baseline
  const C_norm = metrics.costUsd / baselineCost;

  // C_compute: Coût computationnel
  const C_compute = Math.log10(profile.parameterCount) * (profile.flopsPerToken / 1e9);

  // C_hw: Coût hardware
  const alpha = 0.001, beta = 0.0001, gamma = 1;
  const C_hw = alpha * profile.vramRequirementMB +
               beta * profile.ramRequirementMB +
               gamma * (profile.requiresGPU ? 1 : 0.1);

  // Lambda: Pénalisation
  const lambda = 1.5;

  // Fitness final
  const fitness = (P * S * W) / Math.pow(C_norm * C_compute * C_hw, lambda);

  return {
    performance: P,
    specialization: S,
    composability: W,
    economicCost: C_norm,
    computeCost: C_compute,
    hardwareCost: C_hw,
    lambda,
    totalFitness: fitness
  };
}
```

---

## 7. CLI pour le Fitness

### 7.1 Commandes Fitness

```bash
# Calculer le fitness d'un agent
maestro fitness calculate <agent-id> --task <task-type>

# Voir le profil d'un modèle
maestro fitness profile <model-id>

# Leaderboard par fitness
maestro fitness leaderboard --sort fitness --limit 20

# Comparer des agents
maestro fitness compare <agent-1> <agent-2> --task <task-type>
```

### 7.2 Commandes Workspace

```bash
# Créer un workspace simple
maestro workspace create --name "Research" --type training

# Créer un workspace avec isolation
maestro workspace create \
  --name "Research-Isolated" \
  --type training \
  --isolated \
  --network-name "net-research" \
  --max-cpu 50 \
  --max-memory 8192

# Lister les workspaces
maestro workspace list

# Voir les détails d'un workspace (incluant isolation)
maestro workspace info <workspace-id>

# Ajouter une session à un workspace
maestro workspace add-session <workspace-id> <session-id>

# Ajouter un projet à un workspace
maestro workspace add-project <workspace-id> <project-id>

# Configurer les permissions inter-workspace
maestro workspace permissions <workspace-id> \
  --can-promote-to staging,production \
  --can-read-from research

# Voir la topologie des workspaces
maestro workspace topology
```

### 7.3 Commandes Orchestrateur

```bash
# Statut de l'orchestrateur
maestro orchestrator status

# Promotions en attente
maestro orchestrator pending

# Forcer une promotion
maestro orchestrator promote <agent-id> \
  --from research \
  --to staging \
  --force

# Rollback manuel
maestro orchestrator rollback <agent-id> \
  --workspace production \
  --to-version 1.0

# Historique des promotions
maestro orchestrator history --workspace production --limit 20

# Configurer les règles
maestro orchestrator config set \
  --min-fitness 0.8 \
  --from research \
  --to staging

# Auto-promotion on/off
maestro orchestrator auto-promote --enable
maestro orchestrator auto-promote --disable

# Métriques cross-workspace
maestro orchestrator metrics --agent <agent-id>
```

### 7.4 Commandes System Blocks

```bash
# Lister les blocks système
maestro blocks --system

# Override un block système
maestro blocks override <system-block-id>

# Restaurer un block système
maestro blocks restore <system-block-id>
```

### 7.5 Training avec Fitness

```bash
# Créer un training avec fitness activé
maestro training create \
  --name "Fitness Training" \
  --workflow <workflow-id> \
  --iterations 50 \
  --fitness-enabled \
  --fitness-lambda 1.5 \
  --min-fitness 0.6 \
  --goal fitness  # Optimiser pour fitness

# Voir les métriques fitness d'un run
maestro training run <run-id> --show-fitness
```

---

## 8. Cycle de Vie d'un Agent

### 8.1 Création

```
1. Draft → Définition initiale
2. Session Foundry → Développement itératif
3. Training → Amélioration via itérations
4. Fitness Evaluation → Score calculé
5. Pass threshold? → Publication au catalogue
```

### 8.2 Amélioration Continue

```
1. Agent déployé → Métriques collectées en production
2. Fitness tracker → Détecte dégradation
3. Research Team → Identifie améliorations
4. New Training → Version améliorée
5. A/B Test → Comparaison fitness
6. Promotion → Nouvelle version publiée
```

### 8.3 Auto-Amélioration

```
1. System Agent (ex: trainer-agent)
2. Research Team → Analyse son fitness
3. Training Session → Améliore le system agent
4. Fitness Compare → Nouveau > Ancien?
5. Override → Nouveau remplace l'ancien
6. Le cycle continue...
```

---

## 9. Principes de Design

### 9.1 Tout est un Block — Vraiment Tout

Agents, tools, workflows, inference, validators — **ce sont tous des blocks**.
Il n'existe pas d'entité "agent" ou "tool" séparée. Il existe des blocks avec
des types différents.

Conséquences concrètes :
- **Tout block a des métriques** : taux de succès, temps moyen, coût, score
- **Tout block a une version** : semver, tracking de l'évolution
- **Tout block a des relations** : quels blocks il utilise, qui l'utilise
- **Tout block peut être évalué** : fitness score, performance, composabilité
- **Un seul système de discovery** : `FileSystemBlockDiscoveryService`
- **Un seul format de fichier** : `*.block.json`
- **Une seule API** : `/api/blocks` avec filtres par type et désignation

Un block "agent" n'a pas plus de métriques qu'un block "inference" — les deux
en ont. La seule différence est leur complexité interne, invisible de l'extérieur.

### 9.2 Un Agent est un Inference Block Enrichi

Un agent expose **la même interface** qu'un inference block :
- **Entrée** : prompt, contexte, modèle (optionnel)
- **Sortie** : réponse, tokens consommés, score

La différence est interne :
- Un inference block = 1 appel LLM
- Un agent = un workflow interne (raisonnement + discovery de tools + exécution + validation)

```
Inference block:  prompt → [1 appel LLM] → réponse
Agent block:      prompt → [workflow: raisonnement → tools → validation] → réponse
                           ↑ invisible de l'extérieur ↑
```

**Implication clé** : dans un workflow, un noeud peut pointer vers un inference block
OU un agent block de façon interchangeable. Le workflow ne voit que l'interface.
On peut remplacer un inference block par un agent (plus capable mais plus lent)
sans changer le workflow.

### 9.3 Les Tools sont Découverts, pas Déclarés

Un agent ne "possède" pas une liste fixe de tools. Les tools sont **découverts
dynamiquement** lors de l'exécution :

1. L'agent reçoit une tâche
2. Un inference block interne analyse la tâche
3. L'inference block sélectionne les tools pertinents parmi les blocks accessibles
4. Les tools sont exécutés
5. Les résultats sont agrégés

Le scope de discovery (quels blocks sont accessibles) est une propriété de la
**session** et du **workspace**, pas de l'agent. Cela permet :
- Un même agent avec des tools différents selon le workspace
- L'ajout de nouveaux tools sans modifier l'agent
- Le training de la sélection de tools (l'inference block apprend quels tools choisir)

### 9.4 Versioning Universel

Tout block se versionne (semver), pas seulement les agents :
- Un **workflow** changé = nouvelle version (ajout d'étapes, réordonnancement)
- Un **inference block** changé = nouvelle version (nouveau prompt, nouveau modèle)
- Un **tool** changé = nouvelle version (nouveau schéma I/O)
- Un **validator** changé = nouvelle version (nouveaux critères)

Le versioning universel permet :
- **Rollback** sur n'importe quel block
- **A/B testing** entre versions (comparer v1.0 inference vs v2.0 agent)
- **Promotion** = promouvoir un block à une version spécifique entre workspaces
- **Audit** complet de l'évolution de chaque composant
- **MCP** : exposer des tools versionnés aux IDEs

La promotion inter-workspace n'est pas "promouvoir un agent" — c'est
"promouvoir `block-name` v1.2 de research vers staging".

### 9.5 CLI-First

Tout doit être accessible via CLI :
- Un agent peut utiliser le CLI
- Un humain peut utiliser le CLI
- L'automatisation est native

### 9.6 Fitness comme Métrique Principale

Le fitness s'applique à **tout block**, pas seulement aux agents :
- Un inference block a un fitness (performance / coût)
- Un tool a un fitness (succès / temps / fiabilité)
- Un workflow a un fitness (agrégation des blocks internes)
- Un agent a un fitness (même formule, même échelle)

Le fitness remplace les métriques simples :
- Pas juste "success rate"
- Pas juste "cost"
- Une métrique holistique qui balance tout

### 9.7 Spécialisation sur Généralité

Le système favorise :
- Petits modèles spécialisés > Gros modèles généralistes
- Workflows orchestrés > Agents monolithiques
- Composition > Complexité interne

### 9.8 Overridable mais Opinionated

Les system blocks :
- Fournissent une implémentation par défaut
- Peuvent être overridés
- Mais la structure reste

---

## 10. Résumé

### 10.1 Ce qui Change (V1 → V2)

| Aspect | V1 | V2 |
|--------|----|----|
| Métrique principale | Quality Score | **Fitness Score** |
| Agents système | Non définis | **System Blocks** |
| Organisation | Sessions isolées | **Workspaces isolés** |
| Source session | Implicite | **Sandbox/Repository explicite** |
| Auto-amélioration | Vision future | **Research Team** |
| Optimisation | Manuelle | **Fitness-driven** |
| Déploiement | Manuel | **Orchestrateur automatique** |
| Communication | Directe | **Gateway contrôlé** |

### 10.2 Philosophie Résumée

> **"Maximiser l'intelligence par unité d'énergie."**

- Fitness pénalise les gros modèles
- Spécialisation récompensée
- Orchestration > Monolithique
- Auto-amélioration native
- Tout accessible via CLI
- **Isolation sécurisée entre environnements**
- **Promotion automatique basée sur le fitness**

### 10.3 Concepts Clés Ajoutés en V2

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUX COMPLET V2                                  │
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │  RESEARCH   │    │   STAGING   │    │ PRODUCTION  │                 │
│  │  Workspace  │    │  Workspace  │    │  Workspace  │                 │
│  │  (isolé)    │    │  (isolé)    │    │  (isolé)    │                 │
│  │             │    │             │    │             │                 │
│  │ • Training  │    │ • Tests     │    │ • Sessions  │                 │
│  │ • Research  │    │   intégr.   │    │   Project   │                 │
│  │ • Fitness   │    │ • Validation│    │ • Repos     │                 │
│  │   eval      │    │             │    │   bindés    │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                  │                         │
│         └────────┬─────────┴─────────┬────────┘                         │
│                  │                   │                                  │
│                  ▼                   ▼                                  │
│         ┌────────────────────────────────────┐                         │
│         │      ORCHESTRATOR AGENT            │                         │
│         │   (promotion automatique)          │                         │
│         │                                    │                         │
│         │  fitness > 0.7 → staging           │                         │
│         │  fitness > 0.85 → production       │                         │
│         │  fitness drop → rollback           │                         │
│         └────────────────────────────────────┘                         │
│                          │                                              │
│                          ▼                                              │
│         ┌────────────────────────────────────┐                         │
│         │       WORKSPACE GATEWAY            │                         │
│         │  (communication contrôlée)         │                         │
│         └────────────────────────────────────┘                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Prochaines Étapes

| Phase | Contenu | Priorité |
|-------|---------|----------|
| **Phase 1** | Fitness Engine dans le core | Haute |
| **Phase 2** | System Blocks initiaux | Haute |
| **Phase 3** | Workspaces avec isolation | Moyenne |
| **Phase 4** | Workspace Gateway | Moyenne |
| **Phase 5** | Orchestrator Agent | Moyenne |
| **Phase 6** | Research Team workflow complet | Basse |
| **Phase 7** | Auto-promotion en production | Basse |

### 10.5 Cas d'Usage Principal

**Entraînement et déploiement automatisé d'agents:**

1. **Research**: Agents entraînés avec fitness tracking
2. **Staging**: Tests d'intégration automatiques
3. **Production**: Déploiement automatique vers sessions Project bindées à des repos
4. **Monitoring**: Surveillance continue et rollback automatique si dégradation

**Tout cela orchestré par des agents, sans intervention humaine requise.**

---

*"Diviser pour mieux régner, spécialiser pour mieux performer, orchestrer pour accomplir, mesurer pour améliorer, automatiser pour scaler."*
