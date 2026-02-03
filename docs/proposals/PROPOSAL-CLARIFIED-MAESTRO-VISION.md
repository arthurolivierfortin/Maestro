# Proposition: Vision Clarifiée de Maestro

> Document créé le 2026-02-02 suite à une analyse approfondie

---

## 1. Le Problème Actuel

### Ce qui s'est passé

```
VISION ORIGINALE (claire)
├── Foundry Session = Labo de recherche pour créer des agents
├── Project Session = Utiliser les agents sur de vrais repos
└── Pipeline clair: Foundry → Catalogue → Project

        ↓ Ajouts successifs ↓

ÉTAT ACTUEL (confus)
├── Sessions composables (flexibles mais abstraites)
├── System Blocks (testing, documentation)
├── Knowledge Base (données structurées)
├── Model Testing (où ça va?)
├── Documentation auto-générée
└── Pipeline flou: Qui fait quoi? Où?
```

### Sources de confusion identifiées

| Ajout | Intention | Effet |
|-------|-----------|-------|
| System Blocks | Permettre l'override des fonctions internes | Mélange "ce que Maestro fait" et "ce que l'utilisateur fait" |
| Sessions composables | Flexibilité pour futurs utilisateurs | Perte de clarté sur le but de chaque type |
| Knowledge Base | Structurer les données pour le frontend | Ajout d'un layer qui n'existait pas dans la vision originale |
| Model Testing | Évaluer les modèles disponibles | Pas clair si c'est Foundry, Project, ou autre |

---

## 2. La Vision Clarifiée

### Principe Fondamental

**Maestro a UN SEUL BUT: Créer un écosystème auto-améliorant d'agents spécialisés.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MAESTRO: UN ÉCOSYSTÈME                             │
│                                                                              │
│                        ┌──────────────────────┐                             │
│                        │      CATALOGUE       │                             │
│                        │  (Agents publiés)    │                             │
│                        └──────────┬───────────┘                             │
│                                   │                                          │
│              ┌────────────────────┼────────────────────┐                    │
│              │                    │                    │                    │
│              ▼                    │                    ▼                    │
│   ┌─────────────────────┐        │         ┌─────────────────────┐         │
│   │   FOUNDRY           │        │         │   PROJECT           │         │
│   │   (Création)        │────────┼────────►│   (Utilisation)     │         │
│   │                     │  publie│  utilise│                     │         │
│   │ • Crée agents       │        │         │ • Travail réel      │         │
│   │ • Entraîne          │        │         │ • Sur vrais repos   │         │
│   │ • Évalue            │        │         │ • Commits réels     │         │
│   │ • Auto-améliore     │        │         │                     │         │
│   └─────────────────────┘        │         └─────────────────────┘         │
│              │                   │                    │                     │
│              └───────────────────┴────────────────────┘                     │
│                                  │                                          │
│                          Feedback loop                                      │
│                    (métriques de production                                 │
│                     alimentent l'amélioration)                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Les Deux Modes de Maestro

| Mode | But | Environnement | Durée | Output |
|------|-----|---------------|-------|--------|
| **FOUNDRY** | Créer/améliorer des agents | Sandbox ou Repo dédié | Long (heures/jours) | Agents publiés au catalogue |
| **PROJECT** | Utiliser des agents | Repo de travail | Court (minutes/heures) | Code, commits, PRs |

---

## 3. FOUNDRY: Le Laboratoire de Recherche

### Qu'est-ce que Foundry?

**Foundry est un environnement autonome qui fonctionne comme une équipe de recherche.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FOUNDRY WORKSPACE                                    │
│                                                                              │
│  Objectif: "Créer un agent de code review ultra-performant"                 │
│  Statut: En cours (72h d'exécution)                                         │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    ÉQUIPE DE RECHERCHE (Agents)                        │  │
│  │                                                                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │ Architecte  │  │ Développeur │  │ Testeur     │  │ Rédacteur   │  │  │
│  │  │             │  │             │  │             │  │             │  │  │
│  │  │ Conçoit les │  │ Implémente  │  │ Évalue les  │  │ Documente   │  │  │
│  │  │ prompts et  │  │ les blocks  │  │ résultats   │  │ les agents  │  │  │
│  │  │ architectures│  │             │  │             │  │ créés       │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │                                                                        │  │
│  │                    Orchestrés par un Supervisor Agent                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    ACCUMULATION DES RUNS                               │  │
│  │                                                                        │  │
│  │  Run 1: code-reviewer-v0.1 → Score: 45% (baseline)                    │  │
│  │  Run 2: code-reviewer-v0.2 → Score: 52% (+7%)                         │  │
│  │  Run 3: code-reviewer-v0.3 → Score: 61% (+9%)                         │  │
│  │  ...                                                                   │  │
│  │  Run 47: code-reviewer-v1.2 → Score: 89% ★ NOUVEAU BEST               │  │
│  │                                                                        │  │
│  │  [Auto-publication demandée pour v1.2]                                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    ARTIFACTS PRODUITS                                  │  │
│  │                                                                        │  │
│  │  foundry-workspace/                                                    │  │
│  │  ├── agents/                                                           │  │
│  │  │   ├── code-reviewer-v0.1.agent.block.json                          │  │
│  │  │   ├── code-reviewer-v1.2.agent.block.json  ← Current best          │  │
│  │  │   └── ...                                                           │  │
│  │  ├── runs/                                                             │  │
│  │  │   └── (historique de tous les runs)                                │  │
│  │  ├── docs/                                                             │  │
│  │  │   ├── code-reviewer.md                                             │  │
│  │  │   └── research-log.md                                              │  │
│  │  └── metrics/                                                          │  │
│  │      └── (données structurées pour analyse)                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Caractéristiques de Foundry

| Aspect | Description |
|--------|-------------|
| **Durée** | Long terme (heures, jours, semaines) |
| **Autonomie** | Fonctionne en background sans intervention |
| **Environnement** | Sandbox OU repo dédié à la recherche |
| **Objectif** | Créer des agents performants et économiques |
| **Output** | Agents publiés + documentation + métriques |
| **Auto-amélioration** | Le système peut améliorer ses propres agents |

### Pipeline Foundry

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   DÉFINIR    │────►│  DÉVELOPPER  │────►│   ÉVALUER    │────►│   AMÉLIORER  │
│   Objectif   │     │   Agent      │     │   Score      │     │   Prompt     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                       │
       ┌───────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   COMPARER   │────►│   PUBLIER    │────►│  DOCUMENTER  │
│   vs Best    │     │   si mieux   │     │   Agent      │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       │ Sinon, boucle
       └──────────────────────────────────────────────────►  DÉVELOPPER
```

---

## 4. PROJECT: L'Atelier de Production

### Qu'est-ce que Project?

**Project est un environnement pour accomplir du vrai travail avec les agents du catalogue.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROJECT WORKSPACE                                    │
│                                                                              │
│  Projet: "my-saas-app" (repo: github.com/user/my-saas-app)                  │
│  Statut: Session active                                                      │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    AGENTS DISPONIBLES (du Catalogue)                   │  │
│  │                                                                        │  │
│  │  ✓ code-reviewer@1.2        (Score: 89%, Coût: $0.002/task)           │  │
│  │  ✓ test-generator@2.0       (Score: 91%, Coût: $0.003/task)           │  │
│  │  ✓ doc-writer@1.5           (Score: 85%, Coût: $0.001/task)           │  │
│  │  ✓ bug-fixer@1.0            (Score: 78%, Coût: $0.004/task)           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    TÂCHE EN COURS                                      │  │
│  │                                                                        │  │
│  │  "Ajouter validation des emails dans le formulaire d'inscription"     │  │
│  │                                                                        │  │
│  │  Workflow:                                                             │  │
│  │  1. [✓] Analyser le code existant (code-reviewer)                     │  │
│  │  2. [✓] Implémenter la validation (bug-fixer)                         │  │
│  │  3. [►] Générer les tests (test-generator)                            │  │
│  │  4. [ ] Documenter (doc-writer)                                       │  │
│  │  5. [ ] Committer                                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    CHANGEMENTS EN COURS                                │  │
│  │                                                                        │  │
│  │  M src/components/SignupForm.tsx                                       │  │
│  │  A src/utils/validation.ts                                            │  │
│  │  A tests/validation.test.ts                                           │  │
│  │                                                                        │  │
│  │  [Voir Diff] [Lancer Tests] [Committer]                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Caractéristiques de Project

| Aspect | Description |
|--------|-------------|
| **Durée** | Court terme (minutes, heures) |
| **Autonomie** | Supervisé ou autonome selon configuration |
| **Environnement** | Repo Git réel (bind-mounted) |
| **Objectif** | Accomplir des tâches de développement |
| **Output** | Code, tests, documentation, commits |
| **Feedback** | Métriques de performance retournées au catalogue |

---

## 5. Le Catalogue: La Mémoire de Maestro

### Qu'est-ce que le Catalogue?

**Le Catalogue est la bibliothèque centrale des agents publiés.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CATALOGUE                                       │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    AGENTS PUBLIÉS                                      │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ code-reviewer@1.2.0                                     ★★★★☆  │  │  │
│  │  │                                                                 │  │  │
│  │  │ Score: 89% | Coût: $0.002/task | Utilisations: 1,247           │  │  │
│  │  │ Créé par: Foundry (auto) | Modèle: deepseek-coder-1.3b         │  │  │
│  │  │                                                                 │  │  │
│  │  │ [Utiliser] [Voir Détails] [Historique Versions]                │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │ test-generator@2.0.0                                    ★★★★★  │  │  │
│  │  │                                                                 │  │  │
│  │  │ Score: 91% | Coût: $0.003/task | Utilisations: 892             │  │  │
│  │  │ Créé par: Foundry (auto) | Modèle: smollm2-1.7b                │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    MÉTRIQUES GLOBALES                                  │  │
│  │                                                                        │  │
│  │  Total agents: 12 | Utilisations ce mois: 4,521                       │  │
│  │  Coût moyen: $0.0025/task | Taux de succès: 87%                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow de Publication

```
Foundry atteint nouveau best score
           │
           ▼
┌─────────────────────┐
│ Demande publication │  (automatique ou manuelle)
│ via CLI             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Validation          │
│ • Score > seuil     │
│ • Tests passent     │
│ • Documentation OK  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Publication         │
│ • Ajout au catalogue│
│ • Versioning        │
│ • Notification      │
└──────────┬──────────┘
           │
           ▼
     Disponible dans
     Project Sessions
```

---

## 6. Où Vont Les Features Existantes?

### Model Testing

**Problème**: Où mettre le testing de modèles?

**Solution**: C'est une **fonction interne de Foundry**, pas un type de session séparé.

```
Foundry Workspace
├── Objectif: Créer agent "code-reviewer"
├── Modèles à évaluer: [smollm2, deepseek-coder, phi-2]
│
└── AVANT de créer l'agent:
    └── Model Capability Test (intégré)
        ├── Teste chaque modèle
        ├── Identifie le meilleur pour cette tâche
        └── Recommande: deepseek-coder-1.3b
```

Le testing de modèles est un **outil** utilisé PAR Foundry, pas une destination en soi.

### System Blocks

**Problème**: Mélange entre fonctions internes et blocs utilisateur.

**Solution**: Clarifier la distinction mais garder le concept.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BLOCKS DANS MAESTRO                                   │
│                                                                              │
│  ┌─────────────────────────────────────┐                                    │
│  │         SYSTEM BLOCKS               │  ← Utilisés PAR Maestro            │
│  │         (blocks/system/)            │                                    │
│  │                                     │                                    │
│  │  • model-capability-tester          │  Évaluer les modèles disponibles   │
│  │  • documentation-agent              │  Générer la documentation          │
│  │  • training-evaluator               │  Évaluer les runs de training      │
│  │                                     │                                    │
│  │  Visibles, overridables, mais       │                                    │
│  │  font partie de l'infrastructure    │                                    │
│  └─────────────────────────────────────┘                                    │
│                                                                              │
│  ┌─────────────────────────────────────┐                                    │
│  │         USER BLOCKS                 │  ← Créés PAR l'utilisateur         │
│  │         (blocks/)                   │    ou Foundry                      │
│  │                                     │                                    │
│  │  • code-reviewer                    │  Agents créés par Foundry          │
│  │  • test-generator                   │                                    │
│  │  • mon-agent-custom                 │  Agents créés manuellement         │
│  │                                     │                                    │
│  │  C'est ce qu'on publie au catalogue │                                    │
│  └─────────────────────────────────────┘                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Documentation Auto-générée

**Problème**: Encore un layer de complexité.

**Solution**: Intégrer dans Foundry comme output naturel.

```
Foundry produit automatiquement:
├── L'agent (block JSON)
├── La documentation (Markdown)
├── Les métriques (JSON pour frontend)
└── L'historique (runs, comparaisons)

Tout dans le workspace Foundry, pas besoin d'un système séparé.
```

### Knowledge Base

**Problème**: Layer supplémentaire entre données et frontend.

**Solution**: Simplifier - les données vivent dans les workspaces.

```
AVANT (complexe):
  Execution → Knowledge Base → Frontend
                    ↓
              Documentation

APRÈS (simple):
  Foundry Workspace
  ├── runs/ (données structurées) → Frontend lit directement
  └── docs/ (markdown)            → Générés par Foundry

  Project Workspace
  ├── sessions/ (historique)      → Frontend lit directement
  └── logs/                       → Pour debugging
```

---

## 7. Sessions: Clarification

### Qu'est-ce qu'une Session?

**Une Session est une instance d'exécution dans un Workspace.**

```
Workspace = Contexte persistant (repo, objectif, configuration)
Session = Période d'activité dans ce workspace

Analogie:
  Workspace = Bureau (existe même quand vous n'y êtes pas)
  Session = Période de travail au bureau
```

### Types de Sessions (Simplifiés)

| Type | Workspace | Durée | But |
|------|-----------|-------|-----|
| **Foundry Session** | Foundry Workspace | Longue | Recherche et création d'agents |
| **Project Session** | Project Workspace | Courte | Travail sur un vrai repo |

C'est tout. Deux types. Clairs. Distincts.

### Pas de Sessions Composables

**Décision**: Revenir aux sessions hardcodées.

Pourquoi:
- Plus clair pour l'utilisateur
- Moins de configurations à comprendre
- Le but de chaque session est évident

```
// AVANT (confus)
Session {
  mode: 'sandbox' | 'repo',
  category: string,  // user-defined
  template: string,
  sandboxImage: string,
  // ... beaucoup d'options
}

// APRÈS (clair)
FoundrySession {
  workspaceId: string,
  objective: string,
  // configurations spécifiques au training
}

ProjectSession {
  projectId: string,  // le repo
  task: string,
  // configurations spécifiques au travail
}
```

---

## 8. Le Pipeline Complet (Clarifié)

### Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PIPELINE MAESTRO                                    │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  PHASE 1: FOUNDRY                                                      ║  │
│  ║                                                                        ║  │
│  ║  Objectif: Créer des agents performants et économiques                ║  │
│  ║                                                                        ║  │
│  ║  1. Créer un Foundry Workspace                                        ║  │
│  ║     maestro foundry create --name "Agent Research" --goal "..."       ║  │
│  ║                                                                        ║  │
│  ║  2. Configurer le workflow de recherche                               ║  │
│  ║     • Agents chercheurs (architect, developer, tester, writer)        ║  │
│  ║     • Critères d'évaluation                                           ║  │
│  ║     • Seuil de publication                                            ║  │
│  ║                                                                        ║  │
│  ║  3. Lancer (fonctionne en background)                                 ║  │
│  ║     maestro foundry start workspace-123                               ║  │
│  ║                                                                        ║  │
│  ║  4. Le système:                                                       ║  │
│  ║     • Crée des variantes d'agents                                     ║  │
│  ║     • Les entraîne (N itérations)                                     ║  │
│  ║     • Les évalue                                                      ║  │
│  ║     • Compare au best actuel                                          ║  │
│  ║     • Améliore et recommence                                          ║  │
│  ║     • Publie quand seuil atteint                                      ║  │
│  ║     • Documente tout                                                  ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                    │                                         │
│                                    ▼ Publication                             │
│                          ┌─────────────────┐                                │
│                          │    CATALOGUE    │                                │
│                          └─────────────────┘                                │
│                                    │                                         │
│                                    ▼ Utilisation                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  PHASE 2: PROJECT                                                      ║  │
│  ║                                                                        ║  │
│  ║  Objectif: Accomplir du vrai travail avec les agents publiés          ║  │
│  ║                                                                        ║  │
│  ║  1. Ouvrir/créer un Project                                           ║  │
│  ║     maestro project open /path/to/my-app                              ║  │
│  ║                                                                        ║  │
│  ║  2. Créer une session avec une tâche                                  ║  │
│  ║     maestro session create --project my-app \                         ║  │
│  ║       --task "Add email validation" \                                 ║  │
│  ║       --workflow code-improvement                                     ║  │
│  ║                                                                        ║  │
│  ║  3. Exécuter (supervisé ou autonome)                                  ║  │
│  ║     maestro session start sess-123                                    ║  │
│  ║                                                                        ║  │
│  ║  4. Valider et committer                                              ║  │
│  ║     maestro session diff sess-123                                     ║  │
│  ║     maestro session test sess-123                                     ║  │
│  ║     maestro session commit sess-123 --message "..."                   ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                    │                                         │
│                                    │ Métriques de production                 │
│                                    ▼                                         │
│                       ┌───────────────────────┐                             │
│                       │  Feedback à Foundry   │                             │
│                       │  (amélioration        │                             │
│                       │   continue)           │                             │
│                       └───────────────────────┘                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CLI Simplifié

```bash
# ===== FOUNDRY (Création d'agents) =====

# Créer un workspace de recherche
maestro foundry create \
  --name "Code Review Agent" \
  --goal "Créer un agent de code review ultra-performant" \
  --models "deepseek-coder,smollm2,phi-2" \
  --threshold 0.85

# Lancer le workspace (tourne en background)
maestro foundry start ws-123

# Voir le statut
maestro foundry status ws-123
# Output:
# Workspace: Code Review Agent
# Status: Running (48h elapsed)
# Current best: code-reviewer-v0.8 (score: 82%)
# Runs completed: 34
# Next milestone: 85% (publication threshold)

# Voir les runs
maestro foundry runs ws-123

# Forcer une publication
maestro foundry publish ws-123 --version "1.0.0"

# ===== PROJECT (Travail réel) =====

# Ouvrir un projet
maestro project open /path/to/my-app

# Créer une session
maestro session create \
  --project my-app \
  --task "Add input validation to signup form" \
  --authority human

# Démarrer
maestro session start sess-456

# Exécuter des commandes dans la session
maestro session exec sess-456 "ls src/"
maestro session exec sess-456 "agents run code-reviewer --task 'Review signup form'"

# Valider
maestro session diff sess-456
maestro session test sess-456

# Committer
maestro session commit sess-456 \
  --message "feat(auth): add input validation" \
  --push

# ===== CATALOGUE =====

# Voir les agents disponibles
maestro catalog list

# Détails d'un agent
maestro catalog show code-reviewer

# Historique des versions
maestro catalog versions code-reviewer
```

---

## 9. Ce Qui Change vs Maintenant

### On Garde

| Feature | Raison |
|---------|--------|
| Sessions (Project) | Fonctionnent, claires |
| System Blocks | Bonne idée, juste clarifier le rôle |
| CLI existant | Beaucoup de travail fait |
| Backend API | Solide |

### On Simplifie

| Feature | Changement |
|---------|------------|
| Sessions composables | → Retour à Foundry/Project hardcodés |
| Categories user-defined | → Supprimer, pas besoin |
| Templates de session | → Garder mais simplifier |
| Knowledge Base séparé | → Intégrer dans les workspaces |

### On Ajoute

| Feature | Description |
|---------|-------------|
| Foundry Workspace | Entité de haut niveau pour la recherche |
| Catalogue | Vue centralisée des agents publiés |
| Auto-publication | Foundry publie quand seuil atteint |
| Feedback loop | Métriques Project → Foundry |

---

## 10. Plan d'Action Proposé

### Phase 1: Clarification (1 semaine)
1. Décider si on adopte cette proposition
2. Documenter la décision (ADR)
3. Mettre à jour MAESTRO-PHILOSOPHY.md

### Phase 2: Simplification (2 semaines)
1. Retirer les sessions composables
2. Revenir à FoundrySession / ProjectSession
3. Simplifier le frontend Sessions Page

### Phase 3: Foundry Workspace (3 semaines)
1. Créer l'entité FoundryWorkspace
2. Implémenter le workflow de recherche autonome
3. Ajouter l'auto-publication

### Phase 4: Catalogue (2 semaines)
1. Vue catalogue dans le frontend
2. Versioning des agents
3. Métriques d'utilisation

### Phase 5: Feedback Loop (2 semaines)
1. Collecter métriques en Project
2. Retourner à Foundry
3. Amélioration continue

---

## 11. Questions Ouvertes

1. **Foundry en sandbox ou repo?**
   - Option A: Toujours sandbox (isolation pure)
   - Option B: Repo dédié (persistence des artifacts)
   - Option C: Au choix de l'utilisateur

2. **Qui lance le Foundry?**
   - Option A: Toujours l'utilisateur (manuellement)
   - Option B: Claude Code peut le lancer
   - Option C: Peut tourner automatiquement

3. **Publication automatique?**
   - Option A: Toujours demander confirmation
   - Option B: Auto si seuil atteint
   - Option C: Configurable

4. **Garder Knowledge Base?**
   - Option A: Supprimer, tout dans les workspaces
   - Option B: Garder mais simplifier
   - Option C: Garder tel quel

---

## 12. Conclusion

La vision de Maestro est **claire et puissante**:

> Un écosystème auto-améliorant qui crée des agents spécialisés performants et économiques, puis les utilise pour accomplir du vrai travail.

Les ajouts successifs (system blocks, sessions composables, knowledge base) étaient de **bonnes intentions** mais ont dilué cette clarté.

Cette proposition suggère de **revenir à l'essentiel**:
- **Foundry**: Crée les agents
- **Catalogue**: Stocke les agents
- **Project**: Utilise les agents

Tout le reste (model testing, documentation, métriques) sont des **outils au service de ces trois piliers**, pas des destinations en soi.

---

*Document créé par Claude Code - 2026-02-02*
