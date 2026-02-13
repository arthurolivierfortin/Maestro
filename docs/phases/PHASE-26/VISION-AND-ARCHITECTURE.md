# Phase 26 — Vision et Architecture

## 1. Ce qui est demande

### Objectif principal

Construire un **agent de developpement autonome** capable de prendre une description de tache (feature, bug fix, refactoring) et de la livrer sous forme de code fonctionnel, teste, et commite — **sans aucune intervention humaine directe dans le code**.

L'agent doit etre **aussi capable qu'un developpeur senior** : il comprend le projet, respecte les conventions, planifie son travail, ecrit du code propre, ecrit des tests, fait ses commits avec des messages clairs, et cree des PRs.

### Contrainte fondamentale

> **En aucun temps Claude (le coach) ne modifie directement le code du projet cible.**

Toute modification passe par les blocks, agents, et workflows crees dans Maestro, executes via le CLI. Claude agit comme **architecte et entraineur**, pas comme executeur.

### Terrain d'epreuve : Cantante

**Cantante** est un editeur de code accessible pour les personnes non-voyantes (Electron + TypeScript). Le projet est en phase initiale (2 commits, boilerplate basique). Il sert de terrain d'epreuve pour :

1. Tester les agents sur un vrai projet
2. Decouvrir ce qui manque dans Maestro
3. Produire un livrable reel et utile

**Important** : Les blocks et agents crees ne doivent PAS etre specifiques a Cantante. Ils doivent fonctionner sur n'importe quel projet TypeScript/JavaScript (et idealement n'importe quel langage).

### Approche bottom-up

```
Layer 4: Agent Autonome (orchestrateur)
    ↑ compose
Layer 3: Workflows (implement-feature, fix-bug, setup-project)
    ↑ compose
Layer 2: Agents Specialises (planner, coder, tester, reviewer, git-ops)
    ↑ compose
Layer 1: Outils Atomiques (context-builder, code-generator, commit-writer, ...)
    ↑ utilise
Layer 0: Outils Existants (file-read, shell-execute, git-status, ...)
```

On commence par le bas. Chaque couche est testee et validee avant de composer la couche suivante.

### Double objectif

1. **Valeur utilisateur** : A la fin, on a un agent fonctionnel qui developpe du code
2. **Test de Maestro** : On decouvre ce qui manque dans la plateforme (features, UX, limites)

Tout au long du developpement, les **features manquantes** sont documentees dans `MISSING-FEATURES.md`.

---

## 2. Alignement avec la philosophie Maestro

Chaque decision doit passer le test des 6 principes fondamentaux.

### 2.1 Everything is a Block

> *"Il n'y a pas d'entite Agent. Il n'y a pas d'entite Tool. Il n'y a que des Blocks avec des types differents."*

Chaque capacite de l'agent = un block avec :
- **Metriques** : totalRuns, successRate, avgTime, avgCost
- **Fitness** : score composite performance / cout
- **Version** : progression tracee dans le temps
- **Interface uniforme** : inputs → outputs, quel que soit le type

Un `commit-writer` (tool) et un `coder-agent` (agent) ont tous les deux des metriques. La seule difference : la complexite interne de l'agent est invisible pour l'appelant.

### 2.2 CLI-First

> *"Un agent a UN outil : le maestro-cli block. A travers ce block, il peut TOUT faire."*

L'agent autonome utilise le CLI pour :
- Lire des fichiers (`maestro run file-read --input path=...`)
- Executer des commandes (`maestro run shell-execute --input command=...`)
- Gerer le git (`maestro run git-status`, `git-diff`, etc.)
- Ecrire des fichiers (`maestro run file-write --input path=... content=...`)

**Aucun script custom, aucune commande directe.** Tout passe par des blocks.

### 2.3 Generic Infrastructure, Specific Content

> *"L'infrastructure est generique, le contenu est specifique."*

| Generique (blocks/infra) | Specifique (templates/config) |
|--------------------------|-------------------------------|
| `code-generator` block | Prompts specifiques dans `_workflowConfig` |
| `convention-reader` block | Le fichier CLAUDE.md du projet cible |
| `implement-feature` workflow | Les features Cantante dans la session |
| `autonomous-developer` agent | La tache assignee dans les variables |

**Test** : Si on remplace Cantante par un projet Python, aucun block ne change. Seules les variables de session changent.

### 2.4 No Silent Failures

> *"Les erreurs doivent etre visibles."*

- Si le LLM genere du code invalide → le noeud echoue avec `status: error`
- Si `typescript-check` echoue → l'erreur remonte au workflow
- Si un test echoue → le `tester-agent` rapporte l'echec, le workflow decide de la suite
- **Jamais de code fallback**, jamais de contenu par defaut

### 2.5 Self-Describing Sessions

Les sessions portent tout leur comportement dans les variables :
- `_phases` definit les etapes
- `_workflowConfig` definit les prompts et criteres
- `_monitorDescriptor` definit l'affichage TUI
- Variables custom portent l'etat de la tache

### 2.6 Fitness-Driven Evolution

```
           P x S x W
Fitness = ─────────────
          (C_norm)^lambda
```

Chaque block est mesure. Les meilleurs prompts gagnent. L'entrainement est iteratif :
1. Creer une version initiale
2. Tester (fitness)
3. Optimiser (ajuster prompts, temperature, few-shot examples)
4. Tester a nouveau
5. Repeter jusqu'a un seuil de fitness

---

## 3. Architecture en couches

### Layer 0 — Outils existants (deja dans Maestro)

Ces blocks sont deja disponibles et fonctionnels :

| Block | Fonction |
|-------|----------|
| `file-read` | Lire le contenu d'un fichier |
| `file-write` | Ecrire/modifier un fichier |
| `directory-list` | Lister le contenu d'un dossier |
| `project-structure` | Arbre du projet |
| `code-extractor` | Extraire du code d'un fichier |
| `code-search` | Chercher des patterns dans le code |
| `shell-execute` | Executer une commande shell |
| `test-runner` | Executer des tests (npm test, dotnet test) |
| `npm-run` | Executer un script npm |
| `typescript-check` | Verifier la compilation TypeScript |
| `git-status` | Etat du repo git |
| `git-diff` | Diff git (staged/unstaged) |
| `git-log` | Historique des commits |
| `llm-generate` | Appel LLM generique |

### Layer 1 — Nouveaux outils atomiques

Outils atomiques a creer. Chacun fait **une seule chose** et la fait bien.

**Outils de comprehension :**
- `context-builder` — Construit un contexte focalise pour inference LLM
- `convention-reader` — Lit et resume les conventions du projet

**Outils de generation :**
- `code-generator` — Genere du code en respectant conventions et contexte
- `test-generator` — Genere des tests unitaires
- `file-scaffolder` — Cree des structures de fichiers/dossiers

**Outils d'analyse :**
- `code-analyzer` — Analyse structure, patterns, issues d'un fichier
- `code-reviewer` — Review du code pour qualite et conventions

**Outils git :**
- `commit-writer` — Ecrit un message de commit conventionnel
- `pr-writer` — Ecrit une description de PR

**Outils de gestion :**
- `dependency-manager` — Gere les dependances (npm install/add/remove)

### Layer 2 — Agents specialises

Chaque agent est un block composite contenant un workflow interne :

- `planner-agent` — Analyse une tache et produit un plan d'execution
- `coder-agent` — Implemente du code selon un plan
- `tester-agent` — Ecrit et execute des tests
- `reviewer-agent` — Review et valide les changements
- `git-agent` — Gere les operations git (commit, branch, PR)

### Layer 3 — Workflows de composition

- `implement-feature` — Pipeline complet : plan → code → test → review → commit
- `fix-bug` — Pipeline de correction : analyse → plan → fix → test → commit
- `setup-project` — Initialisation : analyse → deps → scaffold → verify

### Layer 4 — Agent autonome

- `autonomous-developer` — Orchestre tout : comprend → planifie → execute → valide → livre

---

## 4. Contraintes et principes de developpement

### 4.1 Gestion du contexte (CRITIQUE)

Les modeles disponibles (SmolLM2-1.7B) ont une fenetre de contexte limitee (~2048 tokens utiles). Le `context-builder` est le block **le plus important** du systeme.

**Strategies :**
- **Sliding window** : Chaque inference recoit SEULEMENT les fichiers pertinents
- **Resumes** : Les agents passent des resumes, pas du contenu brut
- **Few-shot examples** : Chaque prompt inclut un exemple concret du format attendu
- **Prompts specifiques** : "Ecris une fonction qui retourne X" > "Ecris du code"
- **Decomposition** : Les grandes taches sont decoupees en micro-taches

### 4.2 Test-first

Chaque block est teste individuellement AVANT d'etre compose :
1. Creer le block
2. Ecrire les criteres de fitness
3. Tester avec `maestro test start <block-id>`
4. Mesurer le fitness
5. Optimiser si necessaire
6. Passer a la composition

### 4.3 Separation des responsabilites

Un block = une responsabilite. Jamais de block qui "fait tout" :
- Le `planner-agent` planifie, il ne code pas
- Le `coder-agent` code, il ne teste pas
- Le `reviewer-agent` review, il ne modifie pas
- Le `git-agent` commite, il ne review pas

### 4.4 Multi-couche de planification

Avant d'executer, on planifie. A chaque niveau :
- L'orchestrateur planifie les grandes etapes
- Le `planner-agent` planifie les micro-taches
- Le `coder-agent` planifie la structure du code

### 4.5 Detection de docs manquantes

Si l'agent ne trouve pas de documentation sur :
- Les conventions du projet
- L'architecture cible
- Les patterns a suivre
- Les dependances autorisees

Il doit **signaler le manque** et demander a l'utilisateur de creer les docs.

### 4.6 Notes continues

Tout au long du developpement :
- `MISSING-FEATURES.md` — Features Maestro manquantes
- `SESSION-NOTES.md` — Notes pour continuite entre sessions
- Chaque workspace/session documente son etat
