# Phase 14 — Analyse Approfondie : Fitness Multi-Dimensionnel & Double Pipeline Documentation

**Date** : 2026-02-10
**Branche** : `feat/MAESTRO-8-create-first-real-session`
**Statut** : Analyse complémentaire
**Document parent** : `docs/phases/PHASE-14/ANALYSIS.md`

> **Contrainte d'affichage Phase 14** : Toutes les features décrites dans ce document seront exposées via la **CLI** et le **TUI Monitor** uniquement. Le frontend React ne sera pas mis à jour dans cette phase. L'intégration frontend (catalogue UI, visualisation de docs, dashboard fitness) sera planifiée dans une phase ultérieure une fois les fondations CLI/Monitor stabilisées.

---

## Table des matières

1. [Problématique du fitness pour agents complexes](#1-problématique-du-fitness-pour-agents-complexes)
2. [Fitness multi-dimensionnel — trois niveaux](#2-fitness-multi-dimensionnel--trois-niveaux)
3. [Impact sur le manifest et le catalogue](#3-impact-sur-le-manifest-et-le-catalogue)
4. [Double pipeline documentation](#4-double-pipeline-documentation)
5. [Pipeline 1 — Métriques (déterministe)](#5-pipeline-1--métriques-déterministe)
6. [Pipeline 2 — Connaissances (LLM-powered)](#6-pipeline-2--connaissances-llm-powered)
7. [Architecture de l'encyclopédie](#7-architecture-de-lencyclopédie)
8. [Implémentation recommandée](#8-implémentation-recommandée)
9. [Décisions architecturales](#9-décisions-architecturales)

---

## 1. Problématique du fitness pour agents complexes

### La formule actuelle

La formule fitness Maestro V2 est :

```
                  P × S × W
ModelFitness = ─────────────────────────
             (C_norm × C_compute × C_hw)^λ
```

Où :
- **P** (Performance) : Taux de réussite des tests, conformité de format [0-1]
- **S** (Spécialisation) : P / entropie de tâche (pénalise les généralistes)
- **W** (Composabilité) : Conformité de format × (1 si pas d'hallucination)
- **C_norm** : Coût économique normalisé
- **C_compute** : Coût cognitif (paramètres × FLOPs)
- **C_hw** : Coût hardware (VRAM, RAM, GPU)
- **λ** : Pénalité non-linéaire (recommandé 1.5)

### Pourquoi ça fonctionne pour les blocks atomiques

Pour un tool, un validateur, ou une inférence unique, cette formule capture bien l'essentiel :
- Le résultat est binaire ou mesurable (JSON valide ? Score de qualité ?)
- Le coût est celui d'un seul appel
- La spécialisation est claire (un tool fait une chose)
- La composabilité se mesure par le format de sortie

### Pourquoi ça échoue pour les agents orchestrés

Prenons un exemple concret : un **agent de coding** qui orchestre 10 petits LLM + des tools pour programmer, comparé à un seul appel Claude Opus 4.5.

| Dimension | Agent orchestré (10 petits LLM) | Claude Opus 4.5 (1 appel) |
|-----------|--------------------------------|---------------------------|
| **P (Performance)** | Réussit 80% des tâches | Réussit 85% des tâches |
| **S (Spécialisation)** | **Pénalisé** — c'est un généraliste par design | **Pénalisé** — aussi généraliste |
| **W (Composabilité)** | Format variable (chaque sous-agent produit différemment) | Bon format mais monolithique |
| **C (Coût)** | Somme de 10 appels = cher en agrégé | 1 appel cher mais simple |
| **Fitness résultat** | Bas (coût élevé agrégé, spécialisation faible) | Potentiellement plus haut |

La formule dit "Opus est meilleur" alors que l'agent orchestré peut être :
- **Plus résilient** — si un sous-agent échoue, l'orchestrateur retente ou contourne
- **Plus explicable** — chaque décision est visible dans l'arbre d'exécution
- **Plus modulable** — on peut remplacer un sous-agent sans tout casser
- **Moins dépendant** — pas de single point of failure sur un provider
- **Plus évolutif** — chaque composant s'améliore indépendamment

### Ce que la formule actuelle ne capture pas

| Dimension manquante | Description | Exemple |
|---------------------|-------------|---------|
| **Raisonnement multi-étapes** | Capacité à décomposer un problème complexe | Divise "implémente l'auth" en 5 sous-tâches |
| **Résilience** | Capacité à récupérer d'erreurs partielles | Un sous-agent échoue → l'orchestrateur retente |
| **Explicabilité** | Traçabilité des décisions | Chaque nœud de l'arbre d'exécution est inspectable |
| **Modularité** | Remplacement de composants sans casser l'ensemble | Swap un modèle sans toucher au workflow |
| **Autonomie** | Capacité à décider quoi faire sans instruction explicite | L'agent choisit quelle approche utiliser |
| **Coût-efficacité comparée** | "Vaut-il le coup vs un single-model ?" | 10 petits LLM vs 1 gros : lequel est le meilleur investissement ? |

---

## 2. Fitness multi-dimensionnel — trois niveaux

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Niveau 1 : BLOCK FITNESS (existant)                           │
│  ───────────────────────────────────                           │
│  Pour : tools, inference, validators (blocks atomiques)         │
│  Formule : P × S × W / (C_norm × C_compute × C_hw)^λ          │
│  Usage : Comparer des blocks du même type entre eux             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Niveau 2 : TASK FITNESS (nouveau)                             │
│  ─────────────────────────────────                             │
│  Pour : agents, workflows (blocks composites)                   │
│  Mesure : Taux de réussite sur un benchmark de TÂCHES           │
│  Usage : Qualifier un agent sur sa capacité à accomplir         │
│          des tâches complexes end-to-end                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Niveau 3 : VALUE FITNESS (futur)                              │
│  ────────────────────────────────                              │
│  Pour : Comparer un agent orchestré vs un single-model          │
│  Mesure : "Est-ce que ça vaut le coup d'utiliser cet agent     │
│            plutôt que de juste appeler un gros modèle ?"        │
│  Usage : Aide à la décision dans le catalogue                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Niveau 1 : Block Fitness (existant, inchangé)

```
Scope      : Block atomique unique
Formule    : P × S × W / (C_norm × C_compute × C_hw)^λ
Entrées    : Résultats de tests unitaires, métriques d'inférence
Sortie     : Score [0-1]
Comparaison: Entre blocks du même type (tool vs tool, validator vs validator)
Exemple    : "Ce validateur JSON a un fitness de 0.92"
```

Ce niveau reste pertinent et ne change pas. Il mesure bien ce qu'il doit mesurer : la qualité d'un composant isolé.

### Niveau 2 : Task Fitness (nouveau)

```
Scope      : Agent ou workflow composite
Mesure     : Capacité à accomplir des tâches end-to-end
Entrées    : Résultats de benchmarks de tâches (pas de tokens, pas de format)
Sortie     : Score multidimensionnel
Comparaison: Entre agents qui résolvent le même type de problème
Exemple    : "Cet agent de coding a un task fitness de 0.78"
```

#### Dimensions du Task Fitness

| Dimension | Poids suggéré | Mesure | Comment l'évaluer |
|-----------|---------------|--------|-------------------|
| **Completion rate** | 0.35 | % de tâches réussies sur le benchmark | N tâches → combien résolues correctement |
| **Quality score** | 0.25 | Qualité moyenne du résultat produit | Évaluateur (LLM ou humain) note chaque résultat |
| **Cost efficiency** | 0.20 | Qualité obtenue / coût total | Fitness-like mais au niveau tâche |
| **Reliability** | 0.10 | 1 - variance des résultats sur N runs | Même tâche N fois → stabilité des résultats |
| **Resilience** | 0.10 | % de récupération après erreurs partielles | Injecter des pannes → l'agent récupère-t-il ? |

#### Formule proposée

```
TaskFitness = (Completion × 0.35) + (Quality × 0.25) + (CostEff × 0.20)
            + (Reliability × 0.10) + (Resilience × 0.10)
```

Chaque dimension est normalisée [0-1]. Les poids sont configurables par le benchmark.

#### Comment benchmarker ?

Un benchmark de tâches serait un **block de type workflow** (pas du code custom) :

```json
{
  "id": "benchmark:coding-tasks-v1",
  "type": "workflow",
  "description": "Benchmark de 20 tâches de coding",
  "config": {
    "tasks": [
      {
        "id": "task-01",
        "description": "Écrire une fonction de tri",
        "input": "...",
        "expectedOutput": "...",
        "evaluator": "validator:code-correctness"
      }
    ],
    "runs": 3,
    "measureResilience": true
  }
}
```

C'est du contenu (JSON), pas de l'infrastructure (C#). Respecte la règle cardinale.

### Niveau 3 : Value Fitness (futur, pour le catalogue)

```
Scope      : Comparaison entre approches (orchestré vs monolithique)
Mesure     : "Est-ce que l'orchestration apporte de la valeur ?"
Entrées    : Task Fitness de l'agent + Task Fitness d'un baseline single-model
Sortie     : Score de valeur ajoutée
Comparaison: Agent orchestré vs alternative simple
Exemple    : "Cet agent orchestré apporte +15% de qualité pour 2x le coût"
```

#### Dimensions du Value Fitness

| Dimension | Description | Calcul |
|-----------|-------------|--------|
| **Quality delta** | Amélioration de qualité vs single-model | TaskFitness(agent) - TaskFitness(baseline) |
| **Cost ratio** | Coût agent / coût baseline | Si > 1, l'agent coûte plus |
| **Resilience bonus** | L'agent survit à des pannes que le baseline ne survit pas | Tests de panne : score agent - score baseline |
| **Modularity bonus** | Composants remplaçables indépendamment | Nombre de composants swappables / total |
| **Vendor independence** | Dépendance à un seul provider | 1 - (% de coût sur le provider principal) |

#### Formule conceptuelle

```
ValueFitness = QualityDelta × (1 / CostRatio) × (1 + ResilienceBonus)
             × (1 + ModularityBonus) × (1 + VendorIndependence)
```

Un ValueFitness > 1.0 signifie "l'agent orchestré vaut le coup".
Un ValueFitness < 1.0 signifie "utilisez directement le gros modèle".

**Note** : Ce niveau est conceptuel pour Phase 14. L'implémentation viendrait dans une phase future quand le catalogue existe et que les utilisateurs comparent des approches.

### Tableau récapitulatif des trois niveaux

| | Block Fitness | Task Fitness | Value Fitness |
|--|---------------|-------------|---------------|
| **Pour** | Blocks atomiques | Agents/workflows | Comparaison d'approches |
| **Mesure** | Qualité d'un composant | Capacité à résoudre des tâches | Valeur ajoutée de l'orchestration |
| **Formule** | P×S×W / C^λ | Weighted multi-dim | Delta vs baseline |
| **Quand** | Chaque exécution | Sur benchmark | Au publish dans le catalogue |
| **Phase** | Existant | Phase 15-16 | Phase 17+ |
| **Complexité** | Simple | Moyenne | Élevée |

---

## 3. Impact sur le manifest et le catalogue

### Format manifest étendu

Le Block Manifest (défini dans `ANALYSIS.md`) doit supporter les trois niveaux sans les rendre obligatoires :

```json
{
  "schema": "maestro-block-manifest/1.0",
  "id": "user:coding-agent-v1",
  "type": "agent",
  "version": "1.0.0",

  "fitness": {
    "block": null,
    "task": {
      "score": 0.78,
      "dimensions": {
        "completion": 0.82,
        "quality": 0.75,
        "costEfficiency": 0.70,
        "reliability": 0.85,
        "resilience": 0.60
      },
      "benchmark": "benchmark:coding-tasks-v1",
      "runs": 3,
      "testedAt": "2026-02-10"
    },
    "value": null
  }
}
```

**Règle** : Un block atomique remplit `fitness.block`. Un agent/workflow remplit `fitness.task`. Le niveau `value` est optionnel et ajouté quand un baseline existe.

Quand le catalogue affichera ces entrées, il pourra :
- Trier les tools par `fitness.block.score`
- Trier les agents par `fitness.task.score`
- Afficher le `fitness.value` quand l'utilisateur compare des approches

### Affichage Phase 14 : CLI et TUI Monitor uniquement

> **Le frontend React ne sera pas mis à jour en Phase 14.** Toutes les visualisations de fitness se font via la CLI et le TUI Monitor. Le catalogue UI frontend sera planifié dans une phase ultérieure.

#### CLI : `maestro block info <block-id>`

```
$ maestro block info user:coding-agent-v1

  Block: user:coding-agent-v1
  Type:  agent | Version: 1.0.0
  ──────────────────────────────────────────

  Description: Agent de coding orchestré (10 sous-agents)

  Fitness:
    Block:  n/a (composite)
    Task:   0.78
      Completion:  ████████░░ 82%
      Quality:     ███████░░░ 75%
      Cost-Eff:    ███████░░░ 70%
      Reliability: ████████░░ 85%
      Resilience:  ██████░░░░ 60%
    Value:  n/a (pas de baseline)

  Requirements:
    RAM: 8GB | VRAM: 4GB | GPU: optional
    Models: SmolLM2-1.7B ×3, Qwen2.5-Coder ×2
    OS: windows, linux, macos

  Published: 2026-02-10 | Author: arthur
```

#### CLI : `maestro catalog list`

```
$ maestro catalog list

  ID                      Type    Fitness  Requires      Author
  ─────────────────────── ─────── ──────── ───────────── ──────
  user:coding-agent-v1    agent   T:0.78   8GB/4GB VRAM  arthur
  user:gen-commit         tool    B:0.95   8GB/4GB VRAM  arthur
  system:shell            tool    B:0.99   -             system

  3 blocks | B = Block Fitness, T = Task Fitness
```

#### TUI Monitor : widget fitness (dans le monitor descriptor)

Le TUI Monitor pourra afficher un widget fitness dans la zone de statut d'une session, si le `_monitorDescriptor` le définit :

```json
{
  "type": "fitness-summary",
  "zone": "sidebar",
  "dataBinding": "$.variables._latestFitness",
  "display": "compact"
}
```

Affichage compact dans le monitor :

```
┌─ Fitness ──────────┐
│ Block: 0.95        │
│ Task:  —           │
│ Value: —           │
└────────────────────┘
```

#### Futur : Frontend React (hors Phase 14)

Le frontend React intégrera ces visualisations dans une phase ultérieure :
- Page catalogue avec filtres, tri, recherche
- Dashboard fitness avec graphiques d'évolution
- Détail de block avec barres de progression par dimension
- Comparaison côte-à-côte (agent orchestré vs single-model)

L'affichage conceptuel du catalogue frontend est prévu comme suit (pour référence architecturale, **non implémenté en Phase 14**) :

```
┌──────────────────────────────────────────────────────┐
│ coding-agent-v1                           ★ Task 0.78│
│ Agent de coding orchestré (10 sous-agents)           │
│                                                      │
│ Completion: ████████░░ 82%                           │
│ Quality:    ███████░░░ 75%                           │
│ Cost-Eff:   ███████░░░ 70%                           │
│ Reliability:████████░░ 85%                           │
│ Resilience: ██████░░░░ 60%                           │
│                                                      │
│ Requires: 8GB RAM, 4GB VRAM                          │
│ Models: SmolLM2-1.7B × 3, Qwen2.5-Coder × 2, ...  │
│                                                      │
│ vs Claude Opus 4.5 direct: +15% quality, 2x cost    │
│ Value: 1.12 → L'orchestration vaut le coup           │
└──────────────────────────────────────────────────────┘
```

---

## 4. Double pipeline documentation

### Le constat fondamental

Il y a **deux natures de documentation** qui nécessitent des approches radicalement différentes :

| | Métriques | Connaissances |
|--|-----------|---------------|
| **Nature** | Données factuelles, chiffres, résultats | Observations, patterns, insights, synthèses |
| **Exemple** | "SmolLM2-1.7B : fitness 0.95, 4GB VRAM" | "Les prompts spécifiques surpassent les abstraits de 39%" |
| **Source** | Extraites automatiquement des sessions | Synthétisées par un observateur intelligent |
| **Maintenance** | Append-only (nouvelles données = nouvelle entrée) | Vivante (reformulée, consolidée, parfois invalidée) |
| **Péremption** | Jamais (un résultat de test reste vrai) | Possible (une observation peut être contredite par de nouvelles données) |
| **LLM nécessaire** | Non | Oui |
| **Analogie** | Un tableau de données dans un article scientifique | La discussion et les conclusions de l'article |

### Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                        SESSIONS                                 │
│                                                                 │
│  compliance-test  │  training-run  │  experiment-005  │  ...   │
│   _phaseMetrics   │  _phaseMetrics │  _phaseMetrics   │        │
│   _phases         │  _phases       │  _phases         │        │
│   _llmActivity    │  _llmActivity  │  _llmActivity    │        │
└────────┬──────────┴───────┬────────┴────────┬─────────┘        │
         │                  │                 │                   │
         ▼                  ▼                 ▼                   │
┌─────────────────────────────────────────────────────┐          │
│              PIPELINE 1 : MÉTRIQUES                 │          │
│              (déterministe, sans LLM)               │          │
│                                                     │          │
│  Scripts d'extraction → JSON structuré → Markdown   │          │
│  Rapide, fiable à 100%, pas de coût LLM            │          │
└────────────────────┬────────────────────────────────┘          │
                     │                                            │
                     ▼                                            │
         content/user/docs/metrics/                               │
         ├── sessions/                                            │
         ├── models/                                              │
         └── index.json                                           │
                     │                                            │
                     ▼                                            │
┌─────────────────────────────────────────────────────┐          │
│              PIPELINE 2 : CONNAISSANCES             │          │
│              (LLM-powered, type "chercheur")        │          │
│                                                     │          │
│  Lit métriques (pipeline 1) + sessions + docs       │          │
│  → Identifie patterns cross-sessions                │          │
│  → Synthétise en articles d'encyclopédie            │          │
│  → Maintient, nettoie, met à jour                   │          │
└────────────────────┬────────────────────────────────┘          │
                     │                                            │
                     ▼                                            │
         content/user/docs/knowledge/                             │
         ├── models/                                              │
         ├── workflows/                                           │
         ├── observations/                                        │
         └── index.json                                           │
```

---

## 5. Pipeline 1 — Métriques (déterministe)

### Déclenchement

Automatique à la fin de chaque session (via le nœud `write-metrics` + `shell-format-report` déjà présent dans les workflows existants).

### Processus

```
1. Session terminée
   │
2. Script extrait _phaseMetrics, _phases, _llmActivity
   │
3. Formate en fichiers structurés :
   │  ├── JSON : données machine-readable
   │  └── MD  : rapport lisible humain (via format-metrics-report.js)
   │
4. Écrit dans content/user/docs/metrics/
   │  ├── sessions/{session-id}/
   │  │   ├── metrics.json          ← Données brutes
   │  │   ├── report.md             ← Rapport formaté
   │  │   └── per-phase/            ← Détails par phase
   │  └── models/{model-id}/
   │      ├── test-history.json     ← Historique des tests pour ce modèle
   │      └── latest-results.md     ← Derniers résultats
   │
5. Met à jour content/user/docs/metrics/index.json
```

### Format des fichiers de métriques

#### `metrics/sessions/{session-id}/metrics.json`

```json
{
  "sessionId": "compliance-run-001",
  "sessionType": "compliance-tester",
  "completedAt": "2026-02-10T15:30:00Z",
  "phases": [
    {
      "id": "test-smollm2-1.7b",
      "modelId": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
      "fitness": 0.95,
      "iterations": 3,
      "passed": true,
      "timing": {
        "coldStartMs": 1200,
        "warmStartMs": 450,
        "totalMs": 8500
      },
      "tokens": {
        "prompt": 2400,
        "completion": 1800,
        "total": 4200
      },
      "criteria": {
        "hasJsonStructure": 1.0,
        "validJsonParse": 1.0,
        "noMarkdownFences": 1.0,
        "hasRequiredFields": 0.8
      }
    }
  ],
  "summary": {
    "totalPhases": 6,
    "passed": 4,
    "failed": 2,
    "bestModel": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
    "bestFitness": 0.95
  }
}
```

#### `metrics/models/{model-id}/test-history.json`

```json
{
  "modelId": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
  "entries": [
    {
      "sessionId": "compliance-run-001",
      "date": "2026-02-10",
      "fitness": 0.95,
      "passed": true,
      "taskType": "json-structured-output"
    },
    {
      "sessionId": "training-run-003",
      "date": "2026-02-09",
      "fitness": 0.88,
      "passed": true,
      "taskType": "commit-message-generation"
    }
  ]
}
```

### Ce que le pipeline 1 ne fait PAS

- Ne synthétise pas (pas de "ce modèle est bon pour X")
- Ne compare pas (pas de "A est meilleur que B parce que...")
- Ne recommande pas (pas de "utilisez ce modèle pour...")
- Ne nettoie pas (les anciennes entrées restent, append-only)

Ce sont les responsabilités du pipeline 2.

---

## 6. Pipeline 2 — Connaissances (LLM-powered)

### Analogie fondatrice : le chercheur

Un chercheur ne copie pas les résultats bruts d'expériences. Il :

1. **Observe** les patterns à travers les expériences
2. **Synthétise** en conclusions actionnables
3. **Structure** en catégories cohérentes
4. **Maintient** — révise quand de nouvelles données contredisent
5. **Nettoie** — supprime ce qui est obsolète ou redondant
6. **Contextualise** — explique pourquoi un résultat est important

Le pipeline 2 reproduit ce comportement via un agent Maestro dédié.

### Déclenchement

- **Manuel** : `maestro docs generate --knowledge` (l'utilisateur décide quand synthétiser)
- **Périodique** : Après N sessions complétées (configurable)
- **Déclenché** : Après une session qui contredit une connaissance existante

Le pipeline 2 n'est **jamais** automatique sans signal explicite. L'utilisateur contrôle quand la synthèse se fait.

> **Affichage Phase 14** : Les deux pipelines sont entièrement pilotés et consultés via la CLI et le TUI Monitor. Pas de frontend React pour la documentation dans cette phase.

### Processus détaillé

```
1. Collecte des sources
   │  ├── Lit content/user/docs/metrics/ (pipeline 1)
   │  ├── Lit content/user/docs/knowledge/ (état actuel de l'encyclopédie)
   │  └── Lit les variables de sessions récentes (optionnel)
   │
2. Analyse des patterns (LLM)
   │  ├── "3 sessions montrent que temperature < 0.3 améliore la compliance JSON"
   │  ├── "SmolLM2-1.7B surpasse systématiquement Qwen2.5-Coder sur les tâches JSON"
   │  └── "Les prompts avec exemples few-shot produisent 39% de fitness en plus"
   │
3. Confrontation avec la base existante (LLM)
   │  ├── Nouvelle observation confirme un article → augmenter la confiance
   │  ├── Nouvelle observation contredit un article → marquer "under-review"
   │  └── Pattern inédit → créer un nouvel article
   │
4. Rédaction / mise à jour des articles (LLM)
   │  ├── Structure en sections standard (overview, evidence, recommendation)
   │  ├── Ajoute les métadonnées (confiance, sources, date)
   │  └── Rédige en prose claire et actionnable
   │
5. Nettoyage (LLM)
   │  ├── Identifie les articles obsolètes (contradits, plus sourcés)
   │  ├── Fusionne les articles redondants
   │  └── Met à jour les liens entre articles
   │
6. Écriture
   │  ├── Écrit/met à jour content/user/docs/knowledge/
   │  └── Met à jour content/user/docs/knowledge/index.json
```

### Workflow block du pipeline 2

```json
{
  "id": "workflow:documentation/generate-knowledge",
  "type": "workflow",
  "config": {
    "nodes": [
      {
        "id": "collect-sources",
        "type": "regular",
        "blockRef": "tool:file-read",
        "inputs": {
          "paths": ["{{metricsPath}}", "{{knowledgePath}}"]
        }
      },
      {
        "id": "analyze-patterns",
        "type": "regular",
        "blockRef": "inference:llm-generate",
        "inputs": {
          "model": "{{inputs.model}}",
          "systemPrompt": "You are a research analyst...",
          "userPrompt": "Given these metrics: {{previousOutput}}\nAnd existing knowledge: {{knowledgeBase}}\nIdentify new patterns, contradictions, and confirmations."
        }
      },
      {
        "id": "for-each-article",
        "type": "for-each",
        "source": "articlesToUpdate",
        "nodes": [
          {
            "id": "write-article",
            "type": "regular",
            "blockRef": "inference:llm-generate",
            "inputs": {
              "systemPrompt": "You are a technical writer for an AI research encyclopedia...",
              "userPrompt": "Write/update this article: {{currentItem}}"
            }
          },
          {
            "id": "save-article",
            "type": "regular",
            "blockRef": "tool:file-write",
            "inputs": {
              "path": "{{outputBase}}/knowledge/{{currentItem.topic}}.md"
            }
          }
        ]
      },
      {
        "id": "update-index",
        "type": "regular",
        "blockRef": "tool:file-write",
        "inputs": {
          "path": "{{outputBase}}/knowledge/index.json"
        }
      }
    ]
  }
}
```

C'est un workflow Maestro standard. Pas de code custom. Respect de la règle cardinale.

### Affichage CLI et TUI Monitor pour la documentation

> **Rappel** : Pas de frontend React en Phase 14. Toutes les interactions passent par la CLI et le TUI Monitor.

#### CLI : Commandes documentation

```
$ maestro docs list

  Documentation disponible
  ════════════════════════

  MÉTRIQUES (pipeline 1)
  ──────────────────────────────────────────────────────
  Type        Entrées  Dernière mise à jour
  sessions    12       2026-02-10
  models      5        2026-02-10

  CONNAISSANCES (pipeline 2)
  ──────────────────────────────────────────────────────
  Catégorie   Articles  Confiance haute  En revue
  models      3         2                0
  workflows   2         1                1

  Total: 17 métriques | 5 articles de connaissance
```

```
$ maestro docs list --knowledge

  Articles de connaissance
  ════════════════════════

  Topic                     Catégorie   Confiance   Mis à jour
  ───────────────────────── ─────────── ─────────── ──────────
  prompt-strategies         models      high        2026-02-10
  temperature-guide         models      high        2026-02-10
  model-selection-matrix    models      medium      2026-02-09
  few-shot-effectiveness    workflows   high        2026-02-10
  quality-criteria          workflows   under-review 2026-02-10

  5 articles | 3 high | 1 medium | 1 under-review
```

```
$ maestro docs show prompt-strategies

  ┌─ prompt-strategies ─────────────────────────────────┐
  │ Stratégies de prompt pour petits LLM                │
  │ Confiance: HIGH | Sources: 3 sessions               │
  │ Dernière MAJ: 2026-02-10                            │
  ├─────────────────────────────────────────────────────┤
  │                                                     │
  │ Observation clé:                                    │
  │ Les prompts spécifiques surpassent les abstraits    │
  │ de 39% en moyenne sur les tâches JSON structuré.    │
  │                                                     │
  │ Recommandation:                                     │
  │ 1. Formuler avec des critères mesurables            │
  │ 2. Inclure un exemple complet du format attendu     │
  │ 3. Éviter les termes subjectifs                     │
  │                                                     │
  │ Sources: experiment-001, experiment-003,             │
  │          experiment-008                              │
  └─────────────────────────────────────────────────────┘
```

```
$ maestro docs show prompt-strategies --full    # Affiche le MD complet
$ maestro docs show prompt-strategies --json    # Sortie JSON (pour agents)
```

```
$ maestro docs generate --metrics               # Pipeline 1 : extraction déterministe
$ maestro docs generate --knowledge             # Pipeline 2 : synthèse LLM

  Generating knowledge documentation...
  ├─ Collecting sources (12 metric files, 5 existing articles)
  ├─ Analyzing patterns... (LLM inference)
  ├─ Updating articles...
  │   ├─ prompt-strategies.md — confirmed (confidence stays high)
  │   ├─ temperature-guide.md — updated with new data
  │   └─ NEW: batch-size-impact.md — created (confidence: low)
  ├─ Updating index.json
  └─ Done. 2 updated, 1 created, 0 deprecated.
```

#### TUI Monitor : widget documentation

Le monitor peut afficher un widget de statut de la base de connaissances si le `_monitorDescriptor` le définit :

```json
{
  "type": "knowledge-status",
  "zone": "sidebar",
  "dataBinding": "$.variables._knowledgeStats",
  "display": "compact"
}
```

Affichage dans le monitor :

```
┌─ Knowledge Base ───────┐
│ Articles: 5            │
│ High: 3 | Med: 1       │
│ Review: 1              │
│ Last gen: 10 min ago   │
└────────────────────────┘
```

#### Futur : Frontend React (hors Phase 14)

Le frontend intégrera dans une phase ultérieure :
- Page encyclopédie avec navigation par catégorie
- Visualisation du cycle de vie des articles (confiance, contradictions)
- Recherche full-text dans la base de connaissances
- Dashboard métriques avec graphiques d'évolution par modèle
- Vue comparative des résultats de compliance cross-modèles

### Garde-fous pour le LLM

Le pipeline 2 utilise un LLM mais avec des protections :

| Risque | Garde-fou |
|--------|-----------|
| Hallucination de métriques | Le LLM ne génère JAMAIS de chiffres — il référence les métriques du pipeline 1 |
| Perte de données | Le pipeline 2 n'efface jamais les métriques (pipeline 1). Il ne modifie que `knowledge/` |
| Observation fausse | Chaque article a un champ `confidence` et `sources` vérifiables |
| Doc incohérente | Le nœud "confrontation" vérifie explicitement les contradictions |
| LLM provider down | Le pipeline 2 échoue visiblement (node status `error`). Le pipeline 1 continue de fonctionner |

---

## 7. Architecture de l'encyclopédie

### Structure des fichiers

```
content/user/docs/
├── metrics/                         ← Pipeline 1 (déterministe)
│   ├── sessions/
│   │   ├── {session-id}/
│   │   │   ├── metrics.json
│   │   │   ├── report.md
│   │   │   └── per-phase/
│   │   └── ...
│   ├── models/
│   │   ├── {model-id}/
│   │   │   ├── test-history.json
│   │   │   └── latest-results.md
│   │   └── ...
│   └── index.json
│
├── knowledge/                       ← Pipeline 2 (LLM-powered)
│   ├── models/
│   │   ├── prompt-strategies.md
│   │   ├── temperature-guide.md
│   │   └── model-selection-matrix.md
│   ├── workflows/
│   │   ├── few-shot-effectiveness.md
│   │   └── quality-criteria-importance.md
│   ├── observations/
│   │   ├── training-patterns.md
│   │   └── failure-modes.md
│   └── index.json
│
└── index.json                       ← Index global (pointe vers metrics + knowledge)
```

### Format d'un article de connaissance

Chaque fichier dans `knowledge/` suit un format standard :

```markdown
---
topic: "prompt-strategies"
category: "models"
title: "Stratégies de prompt pour petits LLM"
confidence: "high"
status: "validated"
sources:
  - sessionId: "experiment-001"
    date: "2026-02-08"
    relevance: "primary"
  - sessionId: "experiment-003"
    date: "2026-02-09"
    relevance: "confirming"
  - sessionId: "experiment-008"
    date: "2026-02-10"
    relevance: "confirming"
contradictions: []
lastUpdated: "2026-02-10"
updatedBy: "knowledge-pipeline-v1"
supersedes: []
relatedArticles:
  - "temperature-guide"
  - "model-selection-matrix"
---

# Stratégies de prompt pour petits LLM

## Observation clé

Les prompts spécifiques et concrets surpassent les prompts abstraits et vagues
de 39% en moyenne sur les tâches de génération JSON structuré.

## Evidence

| Approche | Fitness moyen | Sessions testées | Intervalle |
|----------|--------------|-----------------|------------|
| Prompt spécifique ("raccourcis à 5 mots") | 0.89 | 5 | [0.82, 0.95] |
| Prompt abstrait ("rends plus compact") | 0.50 | 5 | [0.00, 0.70] |
| Prompt avec exemple few-shot | 0.92 | 3 | [0.88, 0.95] |

## Recommandation

Pour les petits LLM (< 3B paramètres) :
1. Toujours formuler les instructions avec des critères mesurables
2. Inclure au moins un exemple complet du format attendu
3. Éviter les termes subjectifs ("meilleur", "compact", "amélioré")

## Limites

- Testé uniquement sur SmolLM2-1.7B et SmolLM2-360M
- Non vérifié sur des tâches non-JSON
- Le delta de 39% peut varier selon la complexité du schéma JSON

## Historique

| Date | Événement |
|------|-----------|
| 2026-02-08 | Observation initiale (experiment-001) |
| 2026-02-09 | Confirmé par experiment-003 |
| 2026-02-10 | Consolidé avec experiments 004-008, confiance → "high" |
```

### Format `knowledge/index.json`

```json
{
  "type": "knowledge-index",
  "version": "1.0.0",
  "generatedAt": "2026-02-10T16:00:00Z",
  "generatedBy": "knowledge-pipeline-v1",
  "articles": [
    {
      "topic": "prompt-strategies",
      "category": "models",
      "title": "Stratégies de prompt pour petits LLM",
      "path": "models/prompt-strategies.md",
      "confidence": "high",
      "status": "validated",
      "lastUpdated": "2026-02-10",
      "tags": ["prompts", "small-llm", "json", "optimization"]
    },
    {
      "topic": "temperature-guide",
      "category": "models",
      "title": "Guide de température par type de tâche",
      "path": "models/temperature-guide.md",
      "confidence": "high",
      "status": "validated",
      "lastUpdated": "2026-02-10",
      "tags": ["temperature", "configuration", "best-practices"]
    }
  ],
  "statistics": {
    "totalArticles": 5,
    "byConfidence": { "high": 3, "medium": 1, "low": 1 },
    "byStatus": { "validated": 4, "under-review": 1 },
    "byCategory": { "models": 3, "workflows": 2 }
  }
}
```

### Niveaux de confiance

| Niveau | Critère | Affichage |
|--------|---------|-----------|
| **high** | 3+ sessions concordantes, 0 contradictions | Fiable, actionnable |
| **medium** | 1-2 sessions, ou résultats partiellement concordants | Probablement vrai, à confirmer |
| **low** | 1 seule session, ou observation préliminaire | Hypothèse, nécessite plus de données |
| **under-review** | Données contradictoires détectées | En cours de réévaluation |
| **deprecated** | Contredit par des données plus récentes | Historique uniquement |

### Cycle de vie d'un article

```
Nouvelle observation
       │
       ▼
   [low confidence]
       │
       ├── Confirmé par 1-2 sessions → [medium confidence]
       │                                    │
       │                                    ├── Confirmé par 3+ sessions → [high confidence]
       │                                    │                                   │
       │                                    │                                   ├── Vie normale
       │                                    │                                   │
       │                                    │                                   └── Contradite → [under-review]
       │                                    │                                                        │
       │                                    └── Contradite → [under-review]                         │
       │                                                          │                                  │
       └── Contradite immédiatement → supprimé                   ├── Résolue → retour au niveau
                                                                  │
                                                                  └── Confirmée obsolète → [deprecated]
```

---

## 8. Implémentation recommandée

### Ce qui change dans le plan Phase 14

Le document `ANALYSIS.md` proposait un plan en 4 priorités. Cette analyse ajoute / modifie :

#### Ajouts au plan

| # | Tâche | Type | Effort | Priorité |
|---|-------|------|--------|----------|
| 1.6 | Documenter le fitness multi-dimensionnel (3 niveaux) dans `docs/system/conventions/` | Spec | S | P1 |
| 1.7 | Étendre le schema manifest pour supporter `fitness.block`, `fitness.task`, `fitness.value` | Spec | S | P1 |
| 3.6 | Créer la structure `content/user/docs/knowledge/` | Architecture | S | P3 |
| 3.7 | Définir le format standard d'article de connaissance (frontmatter + MD) | Spec | S | P3 |
| 3.8 | Créer le workflow `documentation/generate-knowledge` (pipeline 2) | Feature | L | P3 |
| 3.9 | Créer le template de session `knowledge-generator` | Feature | M | P3 |
| 3.10 | CLI : `maestro docs generate --knowledge` | Feature | S | P3 |

#### Modifications au plan

| Tâche originale | Modification |
|-----------------|-------------|
| 3.1 Workflow `generate-docs` | Renommer en `generate-metrics-docs` — c'est le pipeline 1 |
| 3.4 CLI `maestro docs generate` | Split : `--metrics` (pipeline 1) et `--knowledge` (pipeline 2) |

### Ordre d'implémentation recommandé

> **Contrainte Phase 14** : Toutes les interfaces utilisateur sont CLI + TUI Monitor uniquement. Le frontend React ne sera pas modifié. Cela simplifie l'implémentation et permet de stabiliser les fondations avant d'investir dans l'UI.

```
Phase 14a : Fondations + Pipeline 1 (CLI + Monitor)
─────────────────────────────────────────────────────
1. Séparer templates system/user
2. Créer structures docs (metrics + knowledge)
3. Définir les specs (manifest, fitness, formats)
4. Implémenter pipeline 1 (métriques déterministes)
5. Solidifier le publishing end-to-end
6. CLI : maestro docs list, maestro docs show, maestro block info
7. CLI : maestro catalog list, maestro catalog show

Phase 14b : Pipeline 2 — Knowledge (CLI + Monitor)
────────────────────────────────────────────────────
8.  Créer le workflow generate-knowledge
9.  Seed initial de l'encyclopédie (depuis résultats Phase 13)
10. CLI : maestro docs generate --metrics / --knowledge
11. Tester le cycle complet : session → métriques → connaissance
12. TUI Monitor : widgets fitness-summary et knowledge-status

Phase 14c : Intégration (CLI + Monitor)
────────────────────────────────────────
13. Intégrer doc dans le flow publish
14. Tests end-to-end du cycle complet
15. Documenter l'utilisation pour les futurs utilisateurs

Phase future : Frontend React
──────────────────────────────
→ Catalogue UI (page browse, filtres, tri, recherche)
→ Dashboard fitness (graphiques d'évolution, comparaisons)
→ Encyclopédie (navigation, recherche full-text, cycle de vie)
→ Vue détail block (barres de progression, radar chart fitness)
→ Comparaison side-by-side (agent orchestré vs single-model)
```

---

## 9. Décisions architecturales

### ADR-001 : Fitness multi-dimensionnel

**Contexte** : La formule fitness actuelle ne capture pas la valeur des agents orchestrés complexes.

**Décision** : Introduire trois niveaux de fitness (Block, Task, Value) avec des formules distinctes adaptées à chaque niveau de complexité.

**Conséquences** :
- Le manifest supporte les trois niveaux (champs nullable)
- Le catalogue futur peut trier par le niveau pertinent
- Les benchmarks de tâches sont eux-mêmes des workflow blocks (pas de code custom)
- Seul le Block Fitness (niveau 1) est implémenté en Phase 14 ; les niveaux 2 et 3 sont spécifiés mais implémentés plus tard

### ADR-002 : Double pipeline documentation

**Contexte** : Les métriques factuelles et les connaissances synthétisées ont des besoins fondamentalement différents.

**Décision** : Séparer en deux pipelines indépendants — métriques (déterministe) et connaissances (LLM-powered).

**Conséquences** :
- Le pipeline 1 est fiable à 100% et ne dépend pas du LLM provider
- Le pipeline 2 peut échouer sans impacter les données factuelles
- Les deux pipelines alimentent des dossiers séparés (`metrics/` vs `knowledge/`)
- Le pipeline 2 lit la sortie du pipeline 1, mais jamais l'inverse
- Chaque article de connaissance a des métadonnées de confiance et de traçabilité

### ADR-003 : L'encyclopédie est un agent Maestro

**Contexte** : Le pipeline de connaissances nécessite un LLM pour synthétiser, structurer et maintenir.

**Décision** : L'encyclopédie est maintenue par un workflow Maestro standard (`documentation/generate-knowledge`), pas par du code custom.

**Conséquences** :
- Le documentation agent a son propre fitness mesurable
- La qualité de l'encyclopédie s'améliore avec le temps (comme tout agent Maestro)
- Le même workflow est utilisable par le mainteneur (mode system) et par les utilisateurs (mode user)
- Si le LLM provider est down, le nœud échoue visiblement — pas de dégradation silencieuse
- Les articles ont un cycle de vie explicite (low → medium → high → deprecated)

### ADR-004 : CLI et TUI Monitor first — pas de frontend en Phase 14

**Contexte** : Les features de Phase 14 (fitness multi-dimensionnel, documentation, catalogue, encyclopédie) nécessitent des interfaces utilisateur. Le frontend React est fonctionnel mais n'a pas été mis à jour depuis plusieurs phases et ne reflète pas l'état actuel du backend.

**Décision** : Toutes les interfaces utilisateur Phase 14 seront implémentées exclusivement via la CLI et le TUI Monitor. Le frontend React ne sera pas modifié dans cette phase.

**Justification** :
- La CLI est l'interface universelle (humains + agents) — la rendre complète en premier garantit que les agents peuvent tout faire
- Le TUI Monitor est le mode de supervision principal pendant l'exécution — il doit refléter les nouvelles features
- Stabiliser les fondations (formats, commandes, workflows) avant d'investir dans le frontend évite du rework
- Le frontend pourra consommer les mêmes `index.json` et APIs que la CLI quand il sera mis à jour
- Les commandes CLI (`docs list`, `docs show`, `catalog list`, `block info`) définissent le contrat d'affichage que le frontend réutilisera

**Conséquences** :
- Nouvelles commandes CLI : `docs list`, `docs show`, `docs generate`, `block info`, `catalog list`, `catalog show`
- Nouveaux widgets TUI Monitor : `fitness-summary`, `knowledge-status`
- Le frontend React est inchangé — une phase future le mettra à jour avec :
  - Catalogue UI (browse, filtres, recherche)
  - Dashboard fitness (graphiques, comparaisons)
  - Encyclopédie (navigation, recherche full-text)
  - Vue détail block (barres de progression, radar chart)
- Les formats de données (`index.json`, `manifest.json`, frontmatter YAML) sont conçus pour être consommables par le frontend sans transformation

### ADR-005 : Les métriques ne passent jamais par un LLM

**Contexte** : Les données factuelles (scores, timings, configurations) doivent être fiables à 100%. Le pipeline de métriques doit fonctionner indépendamment du LLM provider.

**Décision** : Le pipeline de métriques est entièrement déterministe. Aucun LLM n'est impliqué dans l'extraction, le formatage ou le stockage des métriques.

**Conséquences** :
- `format-metrics-report.js` reste la référence pour la génération de rapports de métriques
- Les `index.json` sont construits par des scripts, pas par des LLM
- Le pipeline de connaissances (LLM) RÉFÉRENCE les métriques mais ne les GÉNÈRE jamais
- Un article de connaissance qui cite un chiffre doit avoir un `source.sessionId` vérifiable
