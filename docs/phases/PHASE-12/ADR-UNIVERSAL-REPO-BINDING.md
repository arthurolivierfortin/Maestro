# ADR: Universal Repository Binding

**Date**: 9 février 2026
**Statut**: Accepté
**Auteurs**: Architecture Maestro

---

## Contexte

### Situation actuelle

Actuellement, le repository binding est implémenté de manière inégale selon les types de sessions :

| Type | Binding repo | Comment |
|------|-------------|---------|
| `ProjectSession` | Oui | `RepositoryPath` en propriété directe sur l'entité |
| `FoundrySession` | Oui (partiel) | Via `FoundrySessionConfig.Source == Repository` + `RepositoryConfig` |
| `Workspace` | Non | Hardcodé à `ContainerBinding.None` |

Le mécanisme sous-jacent (`ContainerBinding.CreateRepositoryBound()`) est **générique** — il fonctionne au niveau `ContainerSession` (la classe de base). Mais le concept de "je suis lié à un repo" est implémenté différemment dans chaque sous-classe, et `Workspace` ne le supporte pas du tout.

### Problème

Une session Foundry qui entraîne un block génère de la documentation interne, des logs d'entraînement, des métriques, des artefacts. Sans repo bindé, tout vit en mémoire ou dans le JSON de session — impossible à inspecter manuellement, impossible à versionner, perdu si la session est archivée.

Un Workspace qui orchestre plusieurs sessions n'a nulle part où stocker sa propre documentation transverse, ses décisions d'architecture, ses logs consolidés.

### Besoin

Tout enfant de `ContainerSession` doit pouvoir :
1. Se binder à un repository (dossier local ou repo git)
2. Y stocker ses artefacts dans une structure standardisée
3. Fonctionner aussi sans binding (mode sandbox, comme aujourd'hui)

---

## Décision : Repository Binding universel au niveau ContainerSession

### Ce qui change

#### 1. `RepositoryPath` monte dans `ContainerSession`

Actuellement, `RepositoryPath` est une propriété de `ProjectSession` uniquement. Elle doit monter dans `ContainerSession` pour que tous les enfants en héritent :

```
Avant :
  ContainerSession          → Binding (ContainerBinding)
    Workspace               → Binding = None (hardcodé)
    Session
      ProjectSession        → RepositoryPath + Binding = Repository|Sandbox
      FoundrySession        → Config.RepositoryConfig + Binding = Repository|Sandbox

Après :
  ContainerSession          → Binding (ContainerBinding) + RepositoryPath (nullable)
    Workspace               → Peut se binder à un repo
    Session
      ProjectSession        → Se binde à un repo (comme avant)
      FoundrySession        → Se binde à un repo (simplifié, plus besoin de Config.Source)
```

`RepositoryPath` devient `string?` sur `ContainerSession`. Si null, la session n'est pas bindée (sandbox). Si défini, la session est liée à ce chemin.

#### 2. Le binding se décide à la création, via le CLI

```bash
# Créer une session Foundry bindée à un repo
node index.js session create --type foundry --name "Train CommitTool" --repo-path /path/to/repo

# Créer un workspace bindé
node index.js session create --type workspace --name "Research WS" --repo-path /path/to/workspace-repo

# Sans binding (sandbox, comportement actuel par défaut)
node index.js session create --type foundry --name "Quick test"
```

Le flag `--repo-path` est **générique** — il fonctionne avec tout type de session. C'est le CLI qui passe le `repositoryPath` au backend, et le factory method de chaque entité crée le `ContainerBinding` approprié.

#### 3. Structure standardisée `.maestro/` dans le repo bindé

Quand une session est bindée à un repo, elle crée et utilise une structure standardisée :

```
/path/to/repo/
├── .maestro/
│   ├── session.json              ← Métadonnées de la session (ID, type, dates)
│   ├── docs/                     ← Documentation interne générée
│   │   ├── architecture.md       ← Décisions, choix de conception
│   │   ├── learnings.md          ← Ce que la session a appris
│   │   └── ...                   ← Libre, chaque session structure comme elle veut
│   ├── logs/                     ← Logs d'exécution persistés
│   │   ├── executions/           ← Un fichier par exécution de workflow
│   │   └── events.jsonl          ← Event stream (append-only, JSONL)
│   ├── artifacts/                ← Artefacts produits (blocks, configs, outputs)
│   │   └── ...
│   └── metrics/                  ← Métriques persistées
│       └── ...
├── (reste du repo — code, etc.)
```

**Points importants :**
- Le dossier `.maestro/` est la convention, pas une obligation. L'infrastructure crée le dossier si absent, mais ne casse pas si les sous-dossiers n'existent pas.
- Chaque session met ce qu'elle veut dans `docs/`, `artifacts/`, etc. L'infrastructure ne dicte pas le contenu — seulement la structure racine.
- Le `.maestro/session.json` est un fichier de liaison — il identifie quelle session est bindée ici. Si on retrouve ce repo plus tard, on peut re-lier la session.

#### 4. Les sous-sessions héritent du repo parent (optionnel)

Un workspace bindé à `/path/to/workspace-repo` peut créer des sessions enfants qui :
- **Se bindent au même repo** dans un sous-dossier : `/path/to/workspace-repo/sessions/session-A/`
- **Se bindent à leur propre repo** : `/path/to/other-repo/`
- **Ne se bindent pas** (sandbox)

C'est un choix à la création, pas une règle automatique.

---

## Décision : Documentation locale au repo

### Options considérées

#### Option A : Docs dans une base partagée centralisée

Toutes les sessions écrivent leur doc dans une base centrale (un repo "knowledge-base" ou une DB).

**Pour :** Recherche transverse facile, pas de duplication
**Contre :** Couplage fort entre sessions, perte d'isolation, complexité de synchronisation

#### Option B : Docs locales au repo, workflow de partage futur

Chaque session bindée stocke sa doc dans son propre `.maestro/docs/`. Les concepts transverses sont partagés via un workflow dédié qui va chercher la doc pertinente entre sessions.

**Pour :** Isolation simple, chaque session est autonome, pas de dépendance centrale
**Contre :** Pas de recherche transverse immédiate (nécessite un workflow dédié)

#### Option C : Hybride — docs locales + index centralisé

Les docs vivent dans chaque repo, mais un index central référence où trouver quoi.

**Pour :** Meilleur des deux mondes
**Contre :** Complexité supplémentaire, index à maintenir

### Décision retenue : Option B — Docs locales, partage futur

**Justification :**

1. **Isolation d'abord.** Chaque session est autonome. Si on archive ou supprime une session, sa doc part avec elle. Pas de référence brisée dans une base centrale.

2. **Simplicité.** Écrire dans `./maestro/docs/` est trivial. Pas de service central à déployer, pas de synchronisation.

3. **Cohérent avec "self-describing sessions".** La session porte tout : variables, config, ET documentation. Le repo bindé est le support physique de cette autonomie.

4. **Le partage viendra quand il sera nécessaire.** Un futur workflow (un agent "documentaliste") aura accès aux repos de plusieurs sessions et ira chercher la doc pertinente. Ce workflow sera lui-même un block — "everything is a block". Il n'a pas besoin d'une base centrale, il a besoin de lire des fichiers dans des repos.

### Flux futur de partage de doc

```
┌───────────────────────────────────────────────────────────────┐
│  Workspace (bindé à /workspace-repo)                          │
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐            │
│  │ Session A            │  │ Session B            │           │
│  │ repo: /repo-a        │  │ repo: /repo-b        │           │
│  │ .maestro/docs/       │  │ .maestro/docs/       │           │
│  │   architecture.md    │  │   training-log.md    │           │
│  │   patterns.md        │  │   eval-criteria.md   │           │
│  └──────────┬───────────┘  └──────────┬───────────┘           │
│             │                          │                       │
│             └──────────┬───────────────┘                       │
│                        │                                       │
│  ┌─────────────────────▼─────────────────────────┐            │
│  │  Workflow: "knowledge-sync"                    │            │
│  │  (block, pas un service central)              │            │
│  │                                                │            │
│  │  1. Lit .maestro/docs/ de chaque session      │            │
│  │  2. Identifie les concepts transverses        │            │
│  │  3. Écrit un résumé dans le workspace repo    │            │
│  │     → /workspace-repo/.maestro/docs/shared/   │            │
│  └────────────────────────────────────────────────┘            │
└───────────────────────────────────────────────────────────────┘
```

Ce workflow est un block comme un autre. Il s'exécute quand on le demande. Il ne nécessite pas d'infrastructure supplémentaire — juste un block qui lit des fichiers et écrit un résumé.

---

## Conséquences sur le code existant

### Domain Layer

| Changement | Fichier | Impact |
|-----------|---------|--------|
| Ajouter `RepositoryPath` (string?) à `ContainerSession` | `ContainerSession.cs` | Propriété nullable, pas de breaking change |
| Retirer `RepositoryPath` de `ProjectSession` | `ProjectSession.cs` | Utilise celui du parent |
| Simplifier `FoundrySession.Create()` | `FoundrySession.cs` | Plus besoin de `Config.Source` — le `repositoryPath` du constructeur suffit |
| Permettre `Workspace` de se binder | `Workspace.cs` | Retirer le hardcode `Binding = None` |
| Ajouter `BindToRepository(path, accessLevel)` à `ContainerSession` | `ContainerSession.cs` | Méthode générique pour tous les enfants |

### Simplification de FoundrySessionConfig

```
Avant :
  FoundrySessionConfig
    Source: SessionSource (Sandbox | Repository)    ← SUPPRIMÉ
    RepositoryConfig: RepositorySourceConfig         ← SUPPRIMÉ
      RepositoryPath
      AccessLevel
      Branch
      ExcludePatterns

Après :
  FoundrySessionConfig
    (pas de notion de source — le binding est sur ContainerSession)
```

Le `FoundrySessionConfig` n'a plus besoin de `Source` ni de `RepositoryConfig`. Le binding est décidé au niveau `ContainerSession.Create()` via le paramètre `repositoryPath`. C'est la même simplification pour tout futur type de session.

### Infrastructure Layer

| Changement | Fichier | Impact |
|-----------|---------|--------|
| Sérialiser `RepositoryPath` depuis `ContainerSession` | Repositories | Mineur — déjà fait pour ProjectSession |
| Créer `.maestro/` à la création si bindé | `ProjectSessionServer` (ou équivalent) | Nouvelle logique (petite) |

### CLI

| Changement | Fichier | Impact |
|-----------|---------|--------|
| Flag `--repo-path` sur `session create` (générique, tout type) | `index.js` | Remplace la logique `--source repository` |
| Retirer `--source` (plus nécessaire) | `index.js` | Simplification |

---

## Exemple concret : Session Foundry bindée

```bash
# 1. Créer un repo pour la session
mkdir /projects/foundry-commit-tool
cd /projects/foundry-commit-tool
git init

# 2. Créer la session bindée
node index.js session create --type foundry --name "Train CommitTool" \
  --repo-path /projects/foundry-commit-tool

# 3. La session crée automatiquement :
# /projects/foundry-commit-tool/
# └── .maestro/
#     ├── session.json
#     ├── docs/
#     ├── logs/
#     ├── artifacts/
#     └── metrics/

# 4. Importer le template
node index.js session import-template <id> foundry-default

# 5. Lancer l'entraînement
node index.js session invoke <id> start

# 6. Les artefacts sont écrits dans le repo :
# /projects/foundry-commit-tool/
# └── .maestro/
#     ├── artifacts/
#     │   └── commit-tool.block.json    ← block entraîné
#     ├── logs/
#     │   └── executions/
#     │       └── 2026-02-09-001.json   ← trace d'exécution
#     ├── docs/
#     │   └── training-notes.md          ← doc auto-générée par le workflow
#     └── metrics/
#         └── fitness-history.json       ← historique de scores

# 7. On peut git commit le tout
cd /projects/foundry-commit-tool
git add .maestro/
git commit -m "Training run: fitness 0.87"
```

---

## Litmus test

> Peut-on ajouter un nouveau type de session avec UNIQUEMENT des changements JSON ?

**Binding :** Oui — le flag `--repo-path` est générique. Un nouveau type de session reçoit automatiquement la capacité de se binder à un repo sans changement C#. La structure `.maestro/` est créée automatiquement.

**Documentation :** Oui — chaque session écrit ce qu'elle veut dans `.maestro/docs/`. L'infrastructure crée le dossier, le contenu est libre.

---

## Prochaines étapes d'implémentation

### Phase 12.5: Repository Binding universel
1. Monter `RepositoryPath` dans `ContainerSession`
2. Ajouter `BindToRepository()` générique
3. Retirer `RepositoryPath` de `ProjectSession` (utilise le parent)
4. Simplifier `FoundrySessionConfig` (retirer `Source` et `RepositoryConfig`)
5. Permettre `Workspace` de se binder

### Phase 12.6: Structure `.maestro/` standardisée
1. Créer le scaffolding `.maestro/` automatiquement quand une session se binde
2. Écrire `session.json` (liaison session ↔ repo)
3. Adapter les write nodes pour écrire dans `.maestro/artifacts/`
4. Adapter les logs pour persister dans `.maestro/logs/`

### Phase 12.7: CLI générique `--repo-path`
1. Remplacer `--source repository --repository-path` par `--repo-path` (plus simple)
2. Fonctionne pour tout type (`--type foundry`, `--type project`, `--type workspace`)
3. Retirer les flags source-spécifiques

### Phase 12.8 (futur): Workflow de partage de documentation
1. Block "knowledge-sync" qui lit `.maestro/docs/` de plusieurs sessions
2. Agrège les concepts transverses
3. Écrit un résumé dans le workspace parent
