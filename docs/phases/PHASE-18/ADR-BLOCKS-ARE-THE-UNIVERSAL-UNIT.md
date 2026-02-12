# ADR : Les Blocks sont l'Unité Universelle

**Statut :** Accepted
**Date :** 2026-02-12
**Phase :** 18

---

## Contexte

La philosophie Maestro proclame **"Everything is a Block"** (Section 9.1, Philosophy V2),
mais le backend contrevient à ce principe avec trois entités distinctes :

- `BlockDefinition` — l'entité générique
- `AgentDefinition` — une entité séparée avec `BlockId` référence
- `ToolDefinition` — une entité séparée avec `BlockId` référence

La documentation actuelle renforce cette séparation en attribuant aux agents et tools
des propriétés que les blocks ordinaires n'ont pas : métriques, scores, relations,
versions semver, catégories.

**Le problème n'est pas que les agents ont des métriques — c'est que les blocks n'en ont pas.**

---

## Décision

### Principe fondamental : Tout block est mesurable, versionné, et composable

Chaque block, quel que soit son type, possède :

| Propriété | Description | Exemple |
|-----------|-------------|---------|
| **Métriques** | Compteurs d'exécution, taux de succès, temps moyen | `totalRuns: 42, successRate: 0.95` |
| **Score** | Score composite de performance | `overallScore: 0.87` |
| **Version** | Versionnage semver | `1.2.0` |
| **Catégorie** | Classification fonctionnelle | `git`, `code`, `analysis` |
| **Relations** | Blocks utilisés et blocks utilisateurs | `uses: [file-read, shell-exec]` |

Il n'existe aucune raison pour qu'un block de type `inference` n'ait pas de métriques
alors qu'un block de type `agent` en a. **Les métriques décrivent l'exécution, pas le type.**

### Versioning universel

Le champ `Version` existe déjà sur `BlockDefinition` mais n'est pas exploité comme
système de versions. **Tout block se versionne**, pas seulement les agents :

| Type de block | Qu'est-ce qui change entre versions | Exemple |
|---------------|--------------------------------------|---------|
| **workflow** | Changement de nodes, d'ordre, d'ajout d'étapes | `dev-workflow v1.0 → v1.1` (ajout validation) |
| **inference** | Changement de prompt, de température, de modèle | `commit-gen v1.0 → v2.0` (nouveau prompt) |
| **tool** | Changement de schéma I/O, de logique interne | `file-read v1.0 → v1.1` (ajout récursif) |
| **validator** | Changement de critères d'évaluation | `json-validator v1.0 → v1.1` (nouveau champ requis) |
| **agent** | Changement de workflow interne, de stratégie | `code-reviewer v1.0 → v2.0` (meilleur raisonnement) |

**Conséquences du versioning universel :**

1. **Rollback sur n'importe quel block** — pas juste les agents. Un workflow cassé
   peut revenir à sa version précédente.

2. **A/B testing entre versions** — comparer `commit-gen v1.0` (1 inference) vs
   `commit-gen v2.0` (agent avec tools) sur les mêmes inputs.

3. **Promotion = promouvoir une version de block** — l'orchestrateur ne promeut pas
   "un agent" mais "block `code-reviewer` v1.2" du workspace research au workspace staging.

4. **Audit complet** — chaque composant a un historique de versions avec métriques par version.

5. **Parallèle MCP** — un MCP server expose des tools versionnés. Un IDE peut demander
   une version spécifique. Maestro fait la même chose : les blocks sont versionnés,
   les consommateurs peuvent cibler une version.

Le versioning s'implémente dans `BlockDefinition.Version` (déjà existant) avec
un système de stockage multi-version (versions précédentes archivées dans
`{block-dir}/.versions/`). La promotion inter-workspace copie une version spécifique.

### Un agent est un inference block enrichi

Un agent n'est pas une entité fondamentalement différente d'un inference block.
C'est un **workflow qui expose la même interface qu'un inference block** :

```
┌───────────────────────────────────────────────────────────────────┐
│                     INFERENCE BLOCK                                │
│                                                                    │
│   Input: { prompt, context, model? }                              │
│   Output: { response, tokens, score }                             │
│                                                                    │
│   Implémentation: 1 appel LLM                                    │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                     AGENT BLOCK                                    │
│                                                                    │
│   Input: { prompt, context, model? }      ← MÊME INTERFACE       │
│   Output: { response, tokens, score }     ← MÊME INTERFACE       │
│                                                                    │
│   Implémentation: workflow interne avec                            │
│     - Raisonnement (inference)                                     │
│     - Découverte de tools (inference → tool selection)             │
│     - Exécution de tools (tool blocks)                             │
│     - Validation (validator blocks)                                │
│     - Boucle itérative (while/retry)                               │
│                                                                    │
│   Mais de l'extérieur, c'est la MÊME chose qu'un inference block. │
│   L'appelant ne sait pas (et n'a pas besoin de savoir)            │
│   qu'il y a un workflow entier à l'intérieur.                     │
└───────────────────────────────────────────────────────────────────┘
```

**Un agent = un inference block avec plus de capacité interne.**
La complexité est cachée. L'interface est identique.

### Les tools sont découverts, pas déclarés

Dans les sessions de training observées, les tools ne sont pas "attachés" statiquement
à un agent. Ils sont **découverts dynamiquement par un inference block** :

```
Étape 1: L'agent reçoit une tâche
Étape 2: Un inference block interne analyse la tâche
Étape 3: L'inference block sélectionne les tools pertinents
         (parmi les blocks disponibles dans le scope de la session)
Étape 4: Les tools sont exécutés
Étape 5: Les résultats sont agrégés
```

Le concept `AvailableTools[]` de l'ancien `AgentDefinition` devient simplement
le **scope de discovery** du block — quels blocks sont accessibles dans son contexte
d'exécution. C'est une propriété de la session et du workspace, pas de l'agent lui-même.

### Hiérarchie de complexité (pas de type)

Les blocks forment un spectre de complexité, pas des catégories rigides :

```
Complexité croissante →

┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ script   │   │inference │   │  tool    │   │  agent   │   │ workflow │
│          │   │          │   │          │   │          │   │          │
│ 1 action │   │ 1 appel  │   │ input →  │   │ workflow │   │ orchestre│
│ détermi- │   │ LLM      │   │ output   │   │ interne  │   │ tout     │
│ niste    │   │          │   │ (peut    │   │ (même    │   │          │
│          │   │          │   │ être     │   │ I/O que  │   │          │
│          │   │          │   │ complexe │   │ inference│   │          │
│          │   │          │   │ dedans)  │   │ block)   │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
    │               │               │               │               │
    └───────────────┴───────────────┴───────────────┴───────────────┘
                    Tous ont: métriques, score, version,
                    catégorie, relations, fitness
```

---

## Conséquences

### Sur le modèle de données

`BlockDefinition` absorbe tout :

```csharp
// AVANT : 3 entités
BlockDefinition   → pas de métriques, pas de category
AgentDefinition   → métriques agent, AvailableTools[], AgentConfig
ToolDefinition    → métriques tool, InputSchema, OutputSchema

// APRÈS : 1 entité
BlockDefinition
  .Metadata.metrics     → métriques universelles (tout block)
  .Metadata.category    → catégorie (tout block)
  .Metadata.designation → "agent" | "tool" | null (rôle fonctionnel)
  .Config.inputs        → schéma d'entrée (tout block peut en avoir)
  .Config.outputs       → schéma de sortie (tout block peut en avoir)
  .Config.agent         → config agent (si applicable)
```

### Sur l'interface agent ↔ inference

Un agent expose la même interface qu'un inference block. Cela signifie :

1. **Un workflow peut utiliser un agent OU un inference block de façon interchangeable**
   - Exemple : noeud `generate` dans un workflow pointe vers un `inference` block
   - On peut le remplacer par un `agent` block sans changer le workflow
   - Le workflow ne voit que input/output, pas l'implémentation

2. **Le training fonctionne identiquement pour les deux**
   - Même boucle create → evaluate → optimize
   - Même métriques de fitness
   - La seule différence : l'agent est plus lent (workflow interne) mais potentiellement meilleur

3. **La promotion est un changement de scope, pas de type**
   - Un block "promu" = un block rendu disponible dans un scope plus large
   - Pas besoin de convertir un block en "agent entity"

### Sur la discovery

Un seul système de discovery (`FileSystemBlockDiscoveryService`) pour tout :

```
block list                     → tous les blocks
block list --type agent        → blocks de type agent
block list --type tool         → blocks de type tool
block list --type inference    → blocks de type inference
block list --designation tool  → blocks désignés comme tools (promus)
```

`--type` filtre le type structurel du block.
`--designation` filtre le rôle fonctionnel (un block promu dans un scope).

### Sur le MCP server

Le MCP server expose des blocks, pas des "agents" ou "tools" :

```
maestro_execute_block  → exécute n'importe quel block
maestro_list_blocks    → liste avec filtres (type, designation, category)
```

Un IDE qui veut les "tools MCP" fait : `list_blocks --designation tool`.
C'est le même block, juste filtré par rôle.

### Sur la philosophie documentée

Les documents de philosophie sont mis à jour pour refléter :

1. **Tout block a des métriques** — pas seulement les agents
2. **Un agent est un inference block enrichi** — même interface, plus de capacité
3. **Les tools sont découverts** — pas hardcodés dans la définition de l'agent
4. **La complexité est interne** — l'interface est toujours simple
5. **Le type définit l'interface, la désignation définit le rôle**

---

## Alternatives rejetées

### Garder 3 entités avec des interfaces communes

**Rejeté car :** Viole le principe "Everything is a Block". Crée de la maintenance
dupliquée (3 discovery services, 3 controllers, 3 formats de fichier). Les "interfaces
communes" finissent toujours par diverger.

### Faire de Agent et Tool des sous-classes de Block

**Rejeté car :** L'héritage crée une hiérarchie rigide. Un block peut changer de
désignation (un tool devient un agent, un workflow est promu tool). Avec l'héritage,
il faudrait recréer l'entité. Avec la composition (metadata.designation), c'est un
simple changement de valeur.

### Garder les métriques uniquement sur les blocks "promus"

**Rejeté car :** Toute exécution produit des métriques. Un simple inference block
qui tourne 100 fois a un taux de succès, un temps moyen, un coût. Pourquoi perdre
cette information ? Les métriques sont une propriété de l'exécution, pas du type.

---

## Références

- `docs/system/philosophy/MAESTRO-PHILOSOPHY.md` — Section "Tout est un Block"
- `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md` — Section 9.1
- `docs/system/architecture/blocks.md` — Hiérarchie des blocks
- `docs/phases/PHASE-18/PLAN-ENTITY-FUSION.md` — Plan de migration
