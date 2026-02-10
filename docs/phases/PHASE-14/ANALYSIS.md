# Phase 14 — Analyse Architecturale : Documentation, Publishing & Fondations du Catalogue

**Date** : 2026-02-10
**Branche** : `feat/MAESTRO-8-create-first-real-session`
**Statut** : Analyse initiale
**Requête source** : `docs/phases/PHASE-14/request.md`

> **Contrainte d'affichage Phase 14** : Toutes les features de cette phase seront exposées via la **CLI** et le **TUI Monitor** uniquement. Le frontend React ne sera pas mis à jour. L'intégration frontend sera planifiée dans une phase ultérieure.
>
> **Document complémentaire** : `ANALYSIS-FITNESS-AND-DOCS.md` — Fitness multi-dimensionnel & Double pipeline documentation

---

## Table des matières

1. [Synthèse de la requête](#1-synthèse-de-la-requête)
2. [Audit de l'existant](#2-audit-de-lexistant)
3. [Analyse des quatre axes](#3-analyse-des-quatre-axes)
4. [Recommandations architecturales](#4-recommandations-architecturales)
5. [Plan d'implémentation Phase 14](#5-plan-dimplémentation-phase-14)
6. [Ce qui est hors-scope Phase 14](#6-ce-qui-est-hors-scope-phase-14)
7. [Questions ouvertes](#7-questions-ouvertes)
8. [Annexes](#8-annexes)

---

## 1. Synthèse de la requête

La requête Phase 14 touche **quatre axes interdépendants** qui préparent le terrain pour le futur catalogue/store de Maestro :

| Axe | Court terme (Phase 14) | Long terme (Catalogue/Store) |
|-----|----------------------|------------------------------|
| **Documentation** | Système de docs system + user, lisible humain & agent | Encyclopédie vectorielle, base de connaissances |
| **Publishing** | Solidifier le publish actuel, vérifier le end-to-end | Publish vers catalogue avec métriques, ressources, grading |
| **Séparation system/user** | Trier les templates, déplacer le personnel dans `content/user/` | Chaque utilisateur a son espace, le store ne contient que du validé |
| **Workflow documenteur** | Workflow qui traverse sessions/blocks et génère de la doc structurée | Auto-documentation continue, utilisable par le mainteneur ET par les utilisateurs |

### Vision long terme exprimée

> Un catalogue/store où les utilisateurs soumettent tools, agents, sessions, workflows. Les gens peuvent voir les requirements, la note, comment c'est construit, les ressources nécessaires. Le grading est uniformisé. Les métriques sont obligatoires au publish.

### Contrainte architecturale cardinale

Toutes les décisions doivent respecter la règle fondamentale de Maestro :

> *"L'infrastructure est générique, le contenu est spécifique."*

Le système de documentation et de publishing doit être **générique** — les sessions, blocks et workflows définissent **eux-mêmes** ce qu'il y a à documenter et publier, via leurs variables et métadonnées.

---

## 2. Audit de l'existant

### 2.1 Ce qui fonctionne

| Composant | Statut | Détails |
|-----------|--------|---------|
| `format-metrics-report.js` | Fonctionnel | Génère rapports Markdown depuis `_phaseMetrics` (compliance + training) |
| Block `system:documenter` | Défini, non câblé | JSON de définition avec capabilities (readme, changelog, tutorial, api-reference) |
| Block `system:publisher` | Défini, non câblé | Quality gates (fitness >= 0.75, tests requis, doc requise) |
| API d'approbation | Fonctionnelle | `POST/GET /api/approvals`, statuts Pending/Approved/Rejected |
| CLI publish | Fonctionnelle | `block publish`, `block approve`, `block reject` |
| Séparation `content/system/` vs `content/user/` | En place | Structure de dossiers créée en Phase 13 |
| Templates de session | 14 templates | 4 system + 8 research-exp + 2 variantes foundry |
| Workflow submit-for-approval | Défini | Orchestre load → validate → submit → notify |

### 2.2 Ce qui manque

| Manque | Impact | Priorité |
|--------|--------|----------|
| **Publish non testé end-to-end** | Le commit generator n'a jamais été publié via le flow complet | Haute |
| **Documenter agent sans workflow** | La définition JSON existe mais aucun workflow ne l'invoque | Haute |
| **Pas de format standard de doc** | Chaque session produit ses rapports dans son propre format | Haute |
| **Templates personnels mélangés aux system** | 8 templates `research-exp-*` sont dans `content/system/` | Moyenne |
| **Pas de métadonnées hardware au publish** | Impossible de filtrer "qu'est-ce qui tourne sur ma machine" | Moyenne |
| **Pas de scoring uniforme cross-session** | Chaque session a ses propres critères, pas de comparabilité | Moyenne |
| **Pas d'index machine-readable des docs** | Les agents ne peuvent pas découvrir la documentation programmatiquement | Moyenne |

### 2.3 Inventaire des templates — classification system vs user

| Template | Classification | Justification |
|----------|---------------|---------------|
| `foundry-default` | **SYSTEM** | Template générique de développement d'agent — coeur de Maestro |
| `foundry-training` | **SYSTEM** | Variante training — utile pour tout utilisateur |
| `foundry-sandbox` | **SYSTEM** | Sandbox léger — utile universellement |
| `compliance-tester` | **SYSTEM** | Test de conformité des modèles — outil de base de l'app |
| `research-exp-001` | **USER** | Expérience personnelle Phase 13 — spécifique au mainteneur |
| `research-exp-002` | **USER** | Expérience personnelle Phase 13 |
| `research-exp-003` | **USER** | Expérience personnelle Phase 13 |
| `research-exp-004` | **USER** | Expérience personnelle Phase 13 |
| `research-exp-005` | **USER** | Expérience personnelle Phase 13 |
| `research-exp-006` | **USER** | Expérience personnelle Phase 13 |
| `research-exp-007` | **USER** | Expérience personnelle Phase 13 |
| `research-exp-008` | **USER** | Expérience personnelle Phase 13 |
| `research-workspace` | **SYSTEM** (renommer `research-starter`) | Starter kit de recherche — utile comme point de départ |

**Action requise** : Déplacer `research-exp-001` à `research-exp-008` vers `content/user/templates/sessions/`.

---

## 3. Analyse des quatre axes

### 3.1 Axe Documentation — Deux couches, un format

#### Le problème

Les résultats de sessions (compliance, training) sont stockés uniquement dans le repo lié à la session. Pas de consolidation, pas d'accessibilité transversale, pas de format machine-readable uniforme.

#### La solution : documentation à deux couches

```
content/
├── system/
│   └── docs/                        ← SYSTEM DOCS (livrées avec l'app)
│       ├── models/                  ← Documentation par modèle
│       │   ├── smollm2-1.7b.md
│       │   ├── qwen2.5-coder.md
│       │   ├── deepseek-r1.md
│       │   └── index.json           ← Registre machine-readable
│       ├── blocks/                  ← Documentation auto-générée des blocks
│       │   ├── tools/
│       │   ├── agents/
│       │   ├── workflows/
│       │   └── index.json
│       └── guides/                  ← Guides d'utilisation
│           ├── getting-started.md
│           ├── creating-sessions.md
│           └── index.json
└── user/
    └── docs/                        ← USER DOCS (générées par l'usage)
        ├── models/                  ← Résultats de compliance de l'utilisateur
        ├── sessions/                ← Rapports de sessions de l'utilisateur
        ├── knowledge/               ← Base de connaissances custom
        └── index.json               ← Index global user docs
```

#### Principes de design

1. **`content/system/docs/`** est livré avec l'app et versionné dans git
2. **`content/user/docs/`** est généré par l'usage et propre à chaque utilisateur
3. **Chaque dossier contient un `index.json`** pour la découverte machine
4. **Les fichiers `.md` utilisent du frontmatter YAML** pour les métadonnées structurées
5. **Les agents lisent les `index.json`**, les humains lisent les `.md`

#### Format standard de documentation modèle

```markdown
---
modelId: "HuggingFaceTB/SmolLM2-1.7B-Instruct"
displayName: "SmolLM2 1.7B Instruct"
category: "instruction-following"
parameters: "1.7B"
quantization: null
requirements:
  vram: "~4GB"
  ram: "~8GB"
  gpu: "optional (CPU viable but slow)"
  os: ["windows", "linux", "macos"]
bestFor: ["json-generation", "structured-output", "instruction-following"]
avoidFor: ["code-generation", "long-form-text"]
fitnessRange: [0.85, 0.95]
lastTested: "2026-02-10"
testedBy: "compliance-tester"
---

# SmolLM2 1.7B Instruct

## Overview
[Description du modèle, provenance, licence]

## Capabilities
| Task | Fitness | Notes |
|------|---------|-------|
| JSON structured output | 0.95 | Excellent — best small model for this |
| Instruction following | 0.85 | Good with specific prompts |
| Code generation | 0.40 | Not recommended |

## Recommended Configuration
- Temperature: 0.3 (creation), 0.5 (optimization)
- Max tokens: 512-1024
- System prompt: Include explicit JSON schema

## Known Issues
- Adds trailing whitespace after JSON in ~5% of cases
- Temperature > 0.7 degrades JSON validity significantly

## Test History
| Date | Session | Fitness | Pass |
|------|---------|---------|------|
| 2026-02-10 | compliance-run-001 | 0.95 | Yes |
```

Le frontmatter YAML est parseable programmatiquement. Le Markdown est lisible par les humains. C'est le même fichier pour les deux usages.

#### Format `index.json` (registre machine-readable)

```json
{
  "type": "model-documentation",
  "version": "1.0.0",
  "generatedAt": "2026-02-10T15:00:00Z",
  "entries": [
    {
      "modelId": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
      "docPath": "smollm2-1.7b.md",
      "category": "instruction-following",
      "parameters": "1.7B",
      "fitnessRange": [0.85, 0.95],
      "bestFor": ["json-generation", "structured-output"],
      "lastTested": "2026-02-10"
    }
  ]
}
```

### 3.2 Axe Publishing — Solidifier avant d'étendre

#### État actuel du flow de publishing

```
block publish <id>
    → API: POST /api/approvals (crée PendingBlockApproval)
    → Statut: Pending

block approve <approval-id>
    → API: POST /api/approvals/{id}/approve
    → Statut: Approved
    → ??? Le block est-il réellement copié/déployé quelque part ?
```

#### Le gap identifié

Le flow **s'arrête à l'approbation**. Il n'y a pas de mécanisme vérifié qui :
1. Copie le block approuvé vers `content/user/blocks/` (pour un user publish)
2. Ajoute les métadonnées de fitness et de requirements
3. Génère ou vérifie la documentation associée
4. Met à jour un index/catalogue

#### Métadonnées obligatoires au publish (à ajouter)

Le `system:publisher` agent définit déjà des quality gates, mais les métadonnées de ressources manquent :

```json
{
  "requirements": {
    "hardware": {
      "vram": "4GB",
      "ram": "8GB",
      "gpu": "optional",
      "disk": "50MB"
    },
    "os": ["windows", "linux", "macos"],
    "dependencies": {
      "models": ["HuggingFaceTB/SmolLM2-1.7B-Instruct"],
      "blocks": ["system:shell", "system:llm-generate"],
      "runtime": "node >= 18"
    }
  },
  "metrics": {
    "fitness": 0.95,
    "fitnessFormula": "maestro-v2",
    "lastTested": "2026-02-10",
    "testSessionId": "session-abc-123",
    "testReport": "content/user/docs/sessions/session-abc-123/report.md"
  }
}
```

### 3.3 Axe Séparation system/user — Règle de décision

#### Critère de classification

Un template/block/doc est **SYSTEM** si et seulement si :
1. Il est **utile à tout utilisateur** de Maestro (pas spécifique à un cas d'usage personnel)
2. Il est **générique** (pas lié à un modèle spécifique, un repo spécifique, ou un projet spécifique)
3. Il sert de **point de départ** ou d'**outil de base**

Tout le reste est **USER**.

#### Application concrète

| Contenu | Classification | Action |
|---------|---------------|--------|
| Templates foundry-* | SYSTEM | Rester dans `content/system/templates/` |
| Template compliance-tester | SYSTEM | Rester — outil de base |
| Templates research-exp-* | USER | Déplacer vers `content/user/templates/sessions/` |
| Résultats de compliance Phase 13 | USER (données) + SYSTEM (format) | Les données brutes vont dans `content/user/docs/models/`, le format de rapport reste system |
| Block gen-commit (s'il est publié) | USER | Publié dans `content/user/blocks/` |
| Docs des modèles testés | SYSTEM (base) | Seed initial dans `content/system/docs/models/` basé sur les résultats de compliance |
| Workspace model-research | USER | Déjà dans `content/user/workspaces/` |

### 3.4 Axe Workflow Documenteur — Un block générique

#### Concept

Un workflow block `workflow:documentation/generate-docs` qui :
1. Scanne les sessions et leurs métriques
2. Scanne les blocks et leurs définitions
3. Extrait ce qui est pertinent
4. Structure la documentation
5. Écrit dans `content/{system|user}/docs/`

#### Architecture du workflow

```
generate-docs (workflow)
├── scan-sources (tool)
│   ├── Lit les sessions actives/complétées
│   ├── Lit les blocks et leurs définitions
│   └── Produit un inventaire structuré
├── extract-knowledge (inference, optionnel)
│   ├── LLM résume les résultats clés
│   └── Identifie ce qui est pertinent
├── for-each: source in sources
│   ├── format-doc (tool/script)
│   │   ├── Applique le template de doc approprié
│   │   └── Génère le frontmatter + contenu
│   └── write-doc (tool)
│       └── Écrit le fichier .md
├── update-index (tool)
│   └── Met à jour les index.json
└── generate-summary (inference, optionnel)
    └── Résumé global des changements de doc
```

#### Deux modes via configuration (même workflow)

| Mode | `_workflowConfig` | Cible | Utilisé par |
|------|-------------------|-------|-------------|
| **system** | `{ "outputBase": "content/system/docs", "scope": "system-blocks" }` | Doc de l'app | Mainteneur (pré-déploiement) |
| **user** | `{ "outputBase": "content/user/docs", "scope": "user-sessions" }` | Doc personnelle | Utilisateur (post-usage) |

C'est le pattern Maestro : **même infrastructure, contenu différent via configuration**.

#### Stratégie d'extraction : hybride déterministe + LLM

| Étape | Méthode | Justification |
|-------|---------|---------------|
| Scan des sources | Déterministe | Lecture de fichiers JSON, pas d'ambiguïté |
| Extraction des métriques | Déterministe | Parsing de `_phaseMetrics`, `_phases`, manifest |
| Formatage des rapports | Déterministe (template) | `format-metrics-report.js` prouve que ça marche |
| Résumés et guides | LLM | Synthèse intelligente, mais basée sur données vérifiées |
| Choix de pertinence | LLM (optionnel) | Utile mais non critique — peut être désactivé |

**Principe** : Les données brutes sont **toujours** déterministes. Le LLM **enrichit** mais ne **fabrique** pas. Si le LLM est down, la doc de base est quand même générée (dégradation gracieuse au niveau du workflow, pas silencieuse — le node LLM échoue visiblement mais les nodes déterministes réussissent).

---

## 4. Recommandations architecturales

### 4.1 Block Manifest Standard

Chaque block publié doit contenir un `manifest.json` standardisé. Ce manifest est ce que le futur catalogue indexera.

```json
{
  "schema": "maestro-block-manifest/1.0",
  "id": "user:gen-commit",
  "version": "1.0.0",
  "type": "tool",
  "author": {
    "name": "arthur",
    "type": "human"
  },
  "description": "Generates conventional commit messages from git diff",
  "tags": ["git", "commit", "automation"],

  "fitness": {
    "score": 0.95,
    "formula": "maestro-v2",
    "testedAt": "2026-02-10",
    "sessionId": "session-abc-123"
  },

  "requirements": {
    "models": [
      {
        "id": "HuggingFaceTB/SmolLM2-1.7B-Instruct",
        "role": "primary",
        "vram": "4GB"
      }
    ],
    "hardware": {
      "minVram": "4GB",
      "minRam": "8GB",
      "gpu": "optional"
    },
    "os": ["windows", "linux", "macos"],
    "dependencies": ["system:shell", "system:llm-generate"]
  },

  "metrics": {
    "tokenEfficiency": 0.92,
    "avgLatency": "2.3s",
    "fitnessHistory": [0.70, 0.85, 0.95]
  },

  "documentation": {
    "readme": "docs/README.md",
    "changelog": "docs/CHANGELOG.md",
    "testReport": "docs/test-report.md"
  }
}
```

**Pourquoi maintenant ?** Définir ce format maintenant évite une migration douloureuse quand le catalogue arrivera. Chaque publish commence à produire des manifests dans ce format, et le catalogue n'aura qu'à les indexer.

### 4.2 Grading uniforme = Fitness Maestro

Le scoring du catalogue **doit** utiliser la formule fitness Maestro V2 :

```
                  P × S × W
ModelFitness = ─────────────────────────
             (C_norm × C_compute × C_hw)^λ
```

**Pas de système de "5 étoiles"**, pas de scores custom par session. Un block publié a un score fitness Maestro, point final. Cela permet :
- La comparabilité cross-blocks
- Le tri automatique dans le catalogue
- La sélection par agents ("donne-moi le block avec le meilleur fitness pour cette tâche")

### 4.3 Le catalogue comme simple index (pour l'instant)

Pas besoin de base de données ni de serveur dédié. Le "catalogue" Phase 14 est un `index.json` :

```
content/
├── system/
│   └── catalog/
│       └── index.json      ← Liste des blocks system avec manifests
└── user/
    └── catalog/
        └── index.json      ← Liste des blocks user publiés
```

Quand le store arrivera, ces fichiers seront remplacés par une API, mais le **format des manifests restera le même**. Zéro migration.

### 4.4 CLI et TUI Monitor : interfaces principales Phase 14

> **Le frontend React ne sera pas modifié en Phase 14.** Toutes les interactions utilisateur passent par la CLI et le TUI Monitor. Le frontend sera mis à jour dans une phase ultérieure pour consommer les mêmes données (`index.json`, `manifest.json`, frontmatter YAML).

Nouvelles commandes CLI génériques (pas spécifiques à un type de session) :

```bash
# Génération de documentation
maestro docs generate --metrics          # Pipeline 1 : extraction déterministe
maestro docs generate --knowledge        # Pipeline 2 : synthèse LLM
maestro docs generate --scope system     # Mode system (mainteneur uniquement)

# Consultation
maestro docs list                        # Liste toutes les docs disponibles
maestro docs list --knowledge            # Liste les articles de connaissance
maestro docs list --category models      # Filtre par catégorie
maestro docs show <topic>                # Affiche une doc spécifique
maestro docs show <topic> --json         # Sortie JSON (pour agents)
maestro docs search <query>              # Recherche dans les docs

# Catalogue
maestro catalog list                     # Liste les blocks publiés
maestro catalog show <block-id>          # Détails d'un block du catalogue
maestro catalog search <query>           # Recherche dans le catalogue

# Fitness
maestro block info <block-id>            # Détails d'un block incluant fitness multi-niveau
```

Ces commandes sont **génériques** — elles opèrent sur des fichiers et des index, pas sur des concepts spécifiques à un type de session.

Le TUI Monitor gagne deux nouveaux types de widgets :
- `fitness-summary` — Affiche le fitness du block courant (block/task/value)
- `knowledge-status` — Affiche les statistiques de la base de connaissances

---

## 5. Plan d'implémentation Phase 14

### Priorité 1 — Fondations (pré-requis pour tout le reste)

| # | Tâche | Type | Effort | Détails |
|---|-------|------|--------|---------|
| 1.1 | Trier templates system vs user | Cleanup | S | Déplacer `research-exp-001..008` vers `content/user/templates/sessions/` |
| 1.2 | Créer la structure `content/{system,user}/docs/` | Architecture | S | Dossiers + `index.json` vides + `.gitkeep` |
| 1.3 | Créer la structure `content/{system,user}/catalog/` | Architecture | S | Dossiers + `index.json` vides |
| 1.4 | Définir le schema Block Manifest (`manifest.json`) | Spec | S | Document JSON Schema dans `docs/system/conventions/` |
| 1.5 | Définir le format standard de doc modèle | Spec | S | Template frontmatter YAML + MD |

### Priorité 2 — Publishing end-to-end

| # | Tâche | Type | Effort | Détails |
|---|-------|------|--------|---------|
| 2.1 | Tester le flow publish complet (foundry-default) | Validation | M | `block publish` → approve → block copié dans user/blocks |
| 2.2 | Implémenter la copie post-approbation | Feature | M | Après approve, copier le block dans `content/user/blocks/` |
| 2.3 | Ajouter les métadonnées requirements au publish | Feature | M | Hardware, OS, dépendances, fitness |
| 2.4 | Générer le `manifest.json` au publish | Feature | M | Automatique à partir des métadonnées et métriques de session |
| 2.5 | Mettre à jour `content/user/catalog/index.json` au publish | Feature | S | Append l'entrée du manifest à l'index |

### Priorité 3 — Système de documentation

| # | Tâche | Type | Effort | Détails |
|---|-------|------|--------|---------|
| 3.1 | Créer le workflow block `documentation/generate-docs` | Feature | L | Scan → Extract → Format → Write → Update index |
| 3.2 | Créer le template de session `doc-generator` | Feature | M | Variables pour le workflow, entry point `generate` |
| 3.3 | Alimenter `content/system/docs/models/` | Contenu | M | Seed initial depuis les résultats compliance existants |
| 3.4 | CLI : `maestro docs generate` | Feature | M | Crée une session doc-generator, invoque le workflow |
| 3.5 | CLI : `maestro docs list` / `maestro docs show` | Feature | S | Lecture des `index.json` et affichage |

### Priorité 4 — Intégration et polish

| # | Tâche | Type | Effort | Détails |
|---|-------|------|--------|---------|
| 4.1 | CLI : `maestro catalog list` / `maestro catalog show` | Feature | S | Lecture de l'index catalogue |
| 4.2 | Intégrer la génération de doc dans le flow publish | Feature | M | Le publish déclenche une génération de doc pour le block |
| 4.3 | Tests end-to-end du cycle complet | Validation | M | Create → Train → Publish → Doc → Catalog entry |

**Légende effort** : S = Small (< 2h), M = Medium (2-6h), L = Large (> 6h)

---

## 6. Ce qui est hors-scope Phase 14

| Feature | Raison du report | Phase estimée |
|---------|-----------------|---------------|
| **Frontend React** | CLI + Monitor sont les interfaces Phase 14 ; stabiliser les fondations avant l'UI | Phase 15-16 |
| Base vectorielle / embeddings | Volume de doc insuffisant, infrastructure pas prête | Phase 16+ |
| Store UI (frontend catalogue) | Pas de contenu à afficher, besoin du catalogue d'abord ; dépend du frontend | Phase 16+ |
| Soumission publique de blocks | Pas d'infrastructure de review communautaire | Phase 17+ |
| Grading cross-utilisateurs | Pas assez d'utilisateurs pour que ce soit pertinent | Phase 17+ |
| Auto-publish des résultats compliance | Le workflow documenteur doit d'abord être fiable | Phase 15 |
| API de recherche de documentation | Simple `index.json` suffit pour l'instant | Phase 15 |
| Versioning de blocks (semver auto) | Le publisher agent le prévoit mais pas prioritaire | Phase 15 |

---

## 7. Questions ouvertes

### Q1 : Le workflow documenteur utilise-t-il un LLM ?

| Option | Description | Avantages | Inconvénients |
|--------|-------------|-----------|---------------|
| **A : Déterministe pur** | Script qui lit métriques → formate en MD | Fiable, rapide, pas de coût LLM | Doc "plate", pas de synthèse intelligente |
| **B : LLM pur** | LLM génère toute la doc | Résumés intelligents, guides contextuels | Dépend du provider, hallucinations possibles, coûteux |
| **C : Hybride (recommandé)** | Extraction déterministe + LLM pour résumés | Données fiables + enrichissement intelligent | Plus complexe à implémenter |

**Recommandation** : Option C. Les données brutes sont toujours déterministes. Le LLM ajoute de la valeur (résumés, guides) sans risquer de corrompre la base. Si le LLM est down, les nodes déterministes réussissent quand même — le node LLM échoue visiblement (pas de dégradation silencieuse).

### Q2 : Le template `research-workspace` reste-t-il en system ?

**Recommandation** : Oui, mais le renommer en `research-starter` pour signaler que c'est un point de départ générique, pas une workspace personnelle. C'est un "starter kit" utile à tout utilisateur qui veut faire de la recherche de modèles.

### Q3 : Où vit le manifest — dans le block ou à côté ?

| Option | Description |
|--------|-------------|
| **Intégré au block JSON** | Ajouter une section `manifest` dans le `definition.json` du block |
| **Fichier séparé (recommandé)** | `manifest.json` à côté du `definition.json` dans le dossier du block |

**Recommandation** : Fichier séparé. Le manifest est généré au publish, pas au développement. Il contient des données de runtime (fitness, date de test) qui n'ont pas leur place dans la définition statique du block.

### Q4 : Faut-il une commande CLI `docs` ou un entry point de session ?

**Recommandation** : Les deux.

- `maestro docs generate` est un raccourci CLI qui crée une session temporaire et invoque le workflow
- Le workflow `documentation/generate-docs` est aussi utilisable directement via `session invoke`
- C'est le pattern CLI-first : la commande est un wrapper, la logique est dans le workflow

### Q5 : Comment gérer le hardcoding vs la configuration ?

La question "qu'est-ce qu'on hardcode" revient souvent. Règle de décision :

| Hardcodé dans l'infrastructure | Configuré dans les templates/variables |
|-------------------------------|---------------------------------------|
| Le format des `index.json` (schema) | Le contenu des `index.json` |
| Les chemins `content/system/` et `content/user/` | Les sous-dossiers (models/, blocks/, etc.) |
| Le CLI parsing des commandes | Les actions déclenchées par les commandes |
| Le format du manifest (schema) | Le contenu du manifest (métadonnées) |
| Les node types (for-each, while, phase) | Les workflows qui les utilisent |

**Règle** : Hardcoder les **interfaces** (schemas, formats, chemins de base). Configurer les **contenus** (données, prompts, critères).

---

## 8. Annexes

### A. Blocs existants pertinents

| Block | Type | Pertinence Phase 14 |
|-------|------|---------------------|
| `system:documenter` | Agent | Base pour le workflow documenteur |
| `system:publisher` | Agent | Quality gates, versioning, publication |
| `system:orchestrator` | Agent | Promotion research → staging → production |
| `workflow:foundry/submit-for-approval` | Workflow | Flow d'approbation existant |
| `workflow:foundry/block-validation` | Workflow | Validation pré-publish |
| `format-metrics-report.js` | Script | Génération de rapports (à réutiliser) |

### B. APIs existantes pertinentes

| Endpoint | Méthode | Usage |
|----------|---------|-------|
| `/api/approvals` | GET | Lister les approbations en attente |
| `/api/approvals` | POST | Soumettre un block pour approbation |
| `/api/approvals/{id}/approve` | POST | Approuver un block |
| `/api/approvals/{id}/reject` | POST | Rejeter avec raison |
| `/api/sessions/{id}/variables` | GET/PUT | Lire/écrire les variables de session |
| `/api/sessions/{id}/invoke/{entryPoint}` | POST | Invoquer un entry point |

### C. Relation avec les phases précédentes

| Phase | Contribution à Phase 14 |
|-------|------------------------|
| Phase 8 | Règle cardinale generic/specific — tout le design en découle |
| Phase 11 | Safety LLM (JSON extraction, write guard) — protège la génération de docs |
| Phase 12 | Runtime, CLI JSON, repo binding — infrastructure pour le publish et les docs |
| Phase 13 | Restructuration directory, training research — structure `content/` et résultats compliance |

### D. Diagramme de dépendances des tâches

```
[1.1 Trier templates] ──────────────────────────────────────┐
[1.2 Structure docs] ───────────────────┐                   │
[1.3 Structure catalog] ────────────┐   │                   │
[1.4 Schema manifest] ─────────┐   │   │                   │
[1.5 Format doc modèle] ───┐   │   │   │                   │
                            │   │   │   │                   │
                            ▼   ▼   │   ▼                   │
                     [2.3 Metadata] │ [3.3 Seed docs]       │
                            │       │   │                   │
                            ▼       ▼   │                   │
              [2.1 Test publish] ──►[2.4 Manifest auto]     │
                            │           │                   │
                            ▼           ▼                   │
              [2.2 Copie post-approve] [2.5 Update index]   │
                                        │                   │
                                        ▼                   ▼
              [3.1 Workflow generate-docs] ◄──── [3.2 Template doc-generator]
                            │
                            ▼
              [3.4 CLI docs generate] ──► [3.5 CLI docs list/show]
                            │
                            ▼
              [4.1 CLI catalog] ──► [4.2 Doc dans publish] ──► [4.3 Tests E2E]
```
