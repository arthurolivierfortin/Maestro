# Design Document : autonomous-dev — Agent Autonome de Developpement

**Date** : 2026-02-17
**Statut** : Brainstorm / Pre-implementation
**Auteur** : Claude Code (Opus 4.6) + supervision utilisateur

---

## 1. Vision

### Qu'est-ce que autonomous-dev ?

Un agent composite qui prend une tache de developpement et la realise de A a Z dans n'importe quel repository, avec la meme qualite qu'un developpeur senior. Il ne connait rien du projet a l'avance — il decouvre, comprend, planifie, implemente, teste, et livre.

### Qu'est-ce qui le differencie d'un "chat avec Claude" ?

| Chat Claude | autonomous-dev |
|-------------|---------------|
| Un seul modele, un seul contexte | Plusieurs agents specialises, chacun avec son contexte optimal |
| Le context window se remplit et la qualite degrade | Chaque agent commence avec un contexte frais et focalise |
| Pas de structure — l'humain guide chaque etape | Pipeline deterministe avec des gates de qualite |
| Pas de memoire du projet entre les taches | Cree et maintient de la documentation projet (.maestro/docs/) |
| Pas de separation frontend/backend | Plan structure par domaine avec interfaces definies d'abord |
| Pas de tests systematiques | Tests obligatoires, review automatique, score de qualite |

### La promesse

> Donnez une tache a autonomous-dev dans n'importe quel repo. Il comprend le projet, planifie, implemente proprement, teste, et commit. Si quelque chose manque (conventions, docs, architecture), il le cree. Si quelque chose est ambigu, il pose des questions.

---

## 2. Architecture globale

```
autonomous-dev (workflow composite)
│
│  ┌─────────────────────────────────────────────────┐
│  │              PHASE DE COMPREHENSION              │
│  │                                                  │
│  │  ┌──────────┐     ┌───────────┐                 │
│  │  │ prepare  │ ──→ │  clarify  │  ← Phase 31+   │
│  │  │ (Opus)   │     │  (Opus)   │  (absorbe par   │
│  │  └──────────┘     └───────────┘   plan en Ph30) │
│  │  Comprend le       Clarifie la tache,           │
│  │  projet, cree      pose des questions,          │
│  │  les docs          definit les criteres         │
│  └─────────────────────────────────────────────────┘
│                          │
│                          ▼
│  ┌─────────────────────────────────────────────────┐
│  │              PHASE DE PLANIFICATION              │
│  │                                                  │
│  │  ┌──────────────────────┐                       │
│  │  │        plan          │                       │
│  │  │       (Opus)         │                       │
│  │  └──────────────────────┘                       │
│  │  Decompose en sous-taches,                      │
│  │  definit les interfaces,                        │
│  │  ordonne par dependance                         │
│  └─────────────────────────────────────────────────┘
│                          │
│                          ▼
│  ┌─────────────────────────────────────────────────┐
│  │              PHASE D'IMPLEMENTATION              │
│  │                                                  │
│  │       for-each step dans le plan :              │
│  │  ┌──────────────────────┐                       │
│  │  │  implement-step      │  ← contexte focalise  │
│  │  │     (Sonnet)         │    (seulement les     │
│  │  └──────────────────────┘     fichiers de la    │
│  │         ↓ (repete)            sous-tache)       │
│  └─────────────────────────────────────────────────┘
│                          │
│                          ▼
│  ┌─────────────────────────────────────────────────┐
│  │              PHASE DE VALIDATION                 │
│  │                                                  │
│  │  ┌──────────┐     ┌──────────┐                  │
│  │  │  test    │ ──→ │  review  │                  │
│  │  │ (Sonnet) │     │  (Opus)  │                  │
│  │  └──────────┘     └──────────┘                  │
│  │  Execute les       Review holiste,              │
│  │  tests, parse      score, issues                │
│  │  les resultats                                  │
│  └─────────────────────────────────────────────────┘
│                          │
│                    score >= 0.8 ?
│                     /          \
│                   oui          non
│                    │            │
│                    ▼            ▼
│              ┌──────────┐  ┌──────────┐
│              │  commit  │  │   fix    │ → retour a implement
│              │ (Sonnet) │  │ (Sonnet) │   (max 2 iterations)
│              └──────────┘  └──────────┘
```

### Pourquoi cette structure ?

1. **Comprehension avant action** — un humain ne code pas avant de comprendre le projet
2. **Planification avec le meilleur modele** — Opus pour la vision strategique, Sonnet pour l'execution
3. **Implementation focalisee** — une tache a la fois, contexte chirurgical, pas de pollution
4. **Validation independante** — le testeur et le reviewer ne sont pas le codeur, ils sont objectifs
5. **Boucle de correction** — si la qualite n'est pas suffisante, on corrige avant de livrer

---

## 3. Les blocs en detail

### 3.1 prepare — Comprendre le projet

**Modele** : Opus (besoin de comprendre globalement, creer de la documentation de qualite)
**Role** : Decouvrir et documenter le projet pour tous les agents en aval

#### Ce qu'il fait

1. **Detecter le stack technique** :
   - Lire les fichiers de configuration racine (package.json, tsconfig.json, pyproject.toml, Cargo.toml, go.mod, pom.xml, .csproj, etc.)
   - Identifier : langage principal, framework, runtime, gestionnaire de paquets, outil de build, framework de test
   - Detecter si c'est un monorepo, un projet frontend, backend, full-stack, desktop, mobile, lib

2. **Comprendre l'architecture** :
   - Lire la structure des dossiers (directory-list, 2 niveaux)
   - Identifier le pattern architectural : clean architecture, MVC, feature-based, domain-driven, flat
   - Identifier les couches : si `src/controllers/` + `src/services/` + `src/models/` → MVC
   - Si `src/domain/` + `src/application/` + `src/infrastructure/` → clean architecture
   - Si `src/features/user/` + `src/features/product/` → feature-based

3. **Lire la documentation existante** :
   - Chercher : README.md, CONTRIBUTING.md, .maestro/docs/*, docs/*, ARCHITECTURE.md, CONVENTIONS.md
   - Si ces fichiers existent → les lire et les synthetiser
   - Ne JAMAIS ecraser un document existant

4. **Creer les documents manquants** dans `.maestro/docs/` :

   | Document | Contenu | Quand le creer |
   |----------|---------|----------------|
   | `PROJECT.md` | Nom, description, objectif, stack detecte, scripts disponibles | Toujours si absent |
   | `CONVENTIONS.md` | Naming (camelCase/snake_case), patterns detectes, style d'import, structure des fichiers | Toujours si absent |
   | `ARCHITECTURE.md` | Modules, couches, dependances entre modules, patterns observes | Toujours si absent |
   | `STACK.md` | Langage, framework, runtime, versions, outils de build/test/lint | Toujours si absent |

   > **Principe** : ces documents sont DEDUITS de l'analyse du code existant. L'agent ne les invente pas — il observe et documente ce qui existe deja. Si quelque chose n'est pas determinable, il le note comme "a confirmer par l'utilisateur".

5. **Identifier les gaps** :
   - Pas de tests ? → noter
   - Pas de linter ? → noter
   - Pas de CI ? → noter
   - Architecture incoherente ? → noter
   - Ces gaps ne sont PAS corriges dans cette phase — ils sont documentes pour le planificateur

#### Sortie

```json
{
  "project": {
    "name": "...",
    "description": "...",
    "type": "fullstack|frontend|backend|desktop|mobile|library|monorepo"
  },
  "stack": {
    "language": "TypeScript",
    "framework": "React",
    "runtime": "Node.js",
    "packageManager": "npm",
    "buildTool": "vite",
    "testFramework": "vitest",
    "linter": "eslint"
  },
  "architecture": {
    "pattern": "feature-based",
    "layers": ["components", "hooks", "services", "types", "utils"],
    "entryPoints": ["src/main.tsx", "src/App.tsx"]
  },
  "conventions": {
    "naming": "camelCase for files, PascalCase for components",
    "imports": "relative paths, barrel exports",
    "patterns": ["custom hooks for logic", "services for API calls"]
  },
  "docsCreated": [".maestro/docs/CONVENTIONS.md", ".maestro/docs/ARCHITECTURE.md"],
  "gaps": ["No tests found", "No CI configuration"],
  "questions": [
    "The project has both Express and React - is this a monorepo or are they co-located?",
    "No test framework detected - which do you prefer? (vitest, jest, mocha)"
  ]
}
```

#### Outils

| Outil | Usage |
|-------|-------|
| directory-list | Voir la structure du projet |
| file-read | Lire les configs, docs existantes, fichiers source cles |
| file-write | Creer les documents .maestro/docs/ manquants |

#### Regles

- **Jamais ecraser** un document existant — le lire et le synthetiser
- **Max 20 iterations** — ne pas lire tout le projet, lire ce qui est representatif
- **Toujours produire un JSON valide** en sortie
- **Les questions sont informatives**, pas bloquantes — l'agent continue avec les meilleures hypotheses

---

### 3.2 clarify — Clarifier la tache (Phase 31+, pas Phase 30)

> **DECISION** : En Phase 30, clarify n'est PAS un bloc separe. Sa logique est absorbee par le bloc `plan`, qui identifie les ambiguites et fait des hypotheses raisonnables. En Phase 31 (avec `maestro code`), clarify deviendra un bloc a part entiere qui questionne l'utilisateur via les widgets TUI.

**Modele** : Opus (besoin de comprendre les nuances, poser les bonnes questions)
**Role** : Transformer une tache vague en specification actionnable

#### Ce qu'il fera (Phase 31+)

1. **Analyser la tache** :
   - Identifier le type : nouvelle fonctionnalite, bug fix, refactoring, docs, tests, performance
   - Identifier les domaines touches : frontend, backend, database, API, infra, tests
   - Identifier les ambiguites

2. **Poser des questions** (via les widgets TUI) :
   - "Cette fonctionnalite doit-elle supporter le mode sombre ?"
   - "Quel endpoint API cette page doit-elle appeler ?"
   - "Y a-t-il des contraintes de performance ?"

3. **Definir les criteres d'acceptation** :
   - Ce que la tache doit accomplir (fonctionnel)
   - Les contraintes (performance, accessibilite, compatibilite)
   - Les fichiers/modules probablement affectes

#### En Phase 30 (non-interactif) — clarify absorbe par plan

Le planificateur recoit la tache brute + le contexte projet et fait double duty :
- Il identifie les ambiguites et fait des hypotheses raisonnables
- Les hypotheses sont documentees dans le plan (champ `assumptions`)
- Les questions non resolues sont listees dans le plan (champ `questions`)

**Le workflow Phase 30 a donc 7 noeuds, pas 8** : prepare → plan → for-each(implement) → test → review → conditional(commit/fix).

#### Sortie (Phase 31+)

```json
{
  "taskType": "feature",
  "domains": ["frontend", "backend", "tests"],
  "scope": "Create a user authentication module with login/register pages and API endpoints",
  "acceptanceCriteria": [
    "Login page with email/password",
    "Register page with validation",
    "API endpoints: POST /auth/login, POST /auth/register",
    "JWT token handling",
    "Unit tests for API and components"
  ],
  "assumptions": [
    "Using existing database setup (Prisma detected)",
    "JWT for token management (jsonwebtoken package found)"
  ],
  "estimatedComplexity": "high",
  "estimatedSteps": 12
}
```

---

### 3.3 plan — Planifier l'implementation

**Modele** : Opus (decomposition strategique, vision d'ensemble)
**Role** : Decomposer la tache en sous-taches atomiques, ordonnees, avec les interfaces definies

#### Ce qu'il fait

C'est le bloc le plus important. La qualite du plan determine la qualite de l'implementation. Un plan mediocre produit du code mediocre.

1. **Identifier les couches a toucher** :
   - Types/Interfaces (toujours en premier)
   - Backend : services, controllers, routes, middleware
   - Frontend : composants, hooks, pages, styles
   - Tests : unitaires, integration
   - Configuration : routes, env vars, etc.

2. **Definir les interfaces/contrats EN PREMIER** :

   > **Principe fondamental** : avant d'implementer quoi que ce soit, definir le CONTRAT entre les couches. Le backend sait ce qu'il doit fournir. Le frontend sait ce qu'il va recevoir. Pas de surprise.

   Exemple pour une feature "liste d'utilisateurs" :
   ```
   Step 1 : Creer types/User.ts          → { id, name, email, role }
   Step 2 : Creer types/api/users.ts     → { GetUsersResponse, CreateUserRequest }
   Step 3 : Creer services/userService.ts → implements les methodes
   Step 4 : Creer api/userApi.ts          → client HTTP qui appelle le backend
   Step 5 : Creer hooks/useUsers.ts       → hook React qui utilise le client
   Step 6 : Creer components/UserList.tsx  → composant qui utilise le hook
   Step 7 : Creer tests/userService.test.ts
   Step 8 : Creer tests/UserList.test.tsx
   ```

   **L'ordre n'est pas arbitraire** : les types d'abord, puis les implementations de bas en haut (service → api → hook → composant), puis les tests.

3. **Separer par domaine** :

   Chaque step a un `domain` qui permet au for-each de donner le bon contexte :

   | Domain | Contexte donne a l'implementeur |
   |--------|--------------------------------|
   | `types` | Les types existants du projet, les conventions de typage |
   | `backend` | L'architecture backend, les services existants, les patterns |
   | `frontend` | L'architecture frontend, les composants existants, les patterns |
   | `api` | Les endpoints existants, le client API, les types de requete/reponse |
   | `test` | Le framework de test, les patterns de test existants, les mocks |
   | `config` | Les fichiers de config, les variables d'environnement |
   | `docs` | La documentation existante |

4. **Gerer les dependances entre steps** :

   Chaque step a un array `dependencies` qui reference les IDs des steps prerequis. Le for-each les execute dans l'ordre, mais le planificateur doit s'assurer que l'ordre est correct :
   - Les types avant les implementations
   - Les services avant les controllers
   - Les controllers avant les routes
   - Les clients API avant les hooks
   - Les hooks avant les composants
   - Les implementations avant les tests

5. **Le pipeline complet d'un utilisateur** :

   Pour une feature full-stack, le plan doit couvrir le chemin complet :

   ```
   [Utilisateur] → [UI Component] → [Hook/State] → [API Client] →
   → [Controller] → [Service] → [Repository/DB] →
   → [Response] → [API Client] → [Hook/State] → [UI Update]
   ```

   Chaque maillon de cette chaine est une step dans le plan. Si un maillon manque, le plan est incomplet.

6. **Adapter le plan au type de projet** :

   | Type de projet | Adaptation du plan |
   |---------------|-------------------|
   | Frontend seulement | Pas de steps backend, focus sur composants + hooks + tests |
   | Backend seulement | Pas de steps UI, focus sur services + controllers + tests |
   | Full-stack | Pipeline complet avec interfaces definies entre front et back |
   | Library | Focus sur API publique, types exportes, tests exhaustifs, docs |
   | CLI tool | Focus sur commandes, parsers, handlers, tests |
   | Desktop (Electron) | Separation main process / renderer process |
   | Monorepo | Identifier quel package est touche, respecter les frontieres |

#### Sortie

Le plan est un **JSON array** (pas un objet wrapper) directement parsable par le for-each :

```json
[
  {
    "id": 1,
    "domain": "types",
    "action": "create",
    "target": "src/types/User.ts",
    "description": "Define User interface and API request/response types",
    "dependencies": [],
    "context_files": ["src/types/index.ts"],
    "acceptance": "File exports User, GetUsersResponse, CreateUserRequest types"
  },
  {
    "id": 2,
    "domain": "backend",
    "action": "create",
    "target": "src/services/userService.ts",
    "description": "User service with getUsers, createUser, getUserById methods",
    "dependencies": [1],
    "context_files": ["src/services/index.ts", "src/types/User.ts"],
    "acceptance": "Service methods return correct types, handle errors"
  },
  {
    "id": 3,
    "domain": "api",
    "action": "create",
    "target": "src/api/userApi.ts",
    "description": "HTTP client for user endpoints",
    "dependencies": [1],
    "context_files": ["src/api/client.ts", "src/types/User.ts"],
    "acceptance": "Client wraps fetch/axios with proper typing"
  },
  {
    "id": 4,
    "domain": "frontend",
    "action": "create",
    "target": "src/hooks/useUsers.ts",
    "description": "React hook for user data fetching and management",
    "dependencies": [3],
    "context_files": ["src/hooks/index.ts", "src/api/userApi.ts"],
    "acceptance": "Hook returns { users, loading, error, createUser }"
  },
  {
    "id": 5,
    "domain": "frontend",
    "action": "create",
    "target": "src/components/UserList.tsx",
    "description": "User list component with loading and error states",
    "dependencies": [4],
    "context_files": ["src/components/Layout.tsx", "src/hooks/useUsers.ts"],
    "acceptance": "Renders user list, handles loading/error, follows existing patterns"
  },
  {
    "id": 6,
    "domain": "test",
    "action": "create",
    "target": "src/__tests__/userService.test.ts",
    "description": "Unit tests for user service",
    "dependencies": [2],
    "context_files": ["src/services/userService.ts"],
    "acceptance": "Tests getUsers, createUser, error cases"
  },
  {
    "id": 7,
    "domain": "test",
    "action": "create",
    "target": "src/__tests__/UserList.test.tsx",
    "description": "Component tests for UserList",
    "dependencies": [5],
    "context_files": ["src/components/UserList.tsx"],
    "acceptance": "Tests render, loading state, error state, data display"
  }
]
```

#### Outils

| Outil | Usage |
|-------|-------|
| file-read | Lire les fichiers existants pour comprendre les patterns |
| code-search | Trouver les imports, usages, patterns existants |

#### Regles

- **Interfaces/Types TOUJOURS en premier** — c'est le contrat entre les couches
- **Maximum 25 steps** par plan. Si plus, regrouper les sous-taches similaires.
- **Chaque step est atomique** — un fichier, une action
- **Chaque step a un `acceptance`** — un critere clair de completion
- **Chaque step a `context_files`** — les fichiers que l'implementeur doit lire
- **Le plan est un JSON array pur** — pas de texte autour, pas d'objet wrapper
- **Si une tache est trop vague** — le plan commence par des steps de clarification (creer un ADR, un spec doc) avant les steps d'implementation

---

### 3.4 implement-step — Implementer UNE sous-tache

**Modele** : Sonnet (code focalise, rapide, excellent pour l'implementation)
**Role** : Executer une seule step du plan avec un contexte chirurgical

#### Ce qu'il fait

C'est le seul bloc qui ecrit du code. Son contexte est VOLONTAIREMENT restreint :
- Il ne connait pas "tout le projet" — seulement la step et les fichiers pertinents
- Il ne fait pas de decisions architecturales — le plan les a deja prises
- Il execute, verifie, et passe a la suite

1. **Lire le contexte** :
   - La step du plan (action, target, description, acceptance)
   - Les `context_files` de la step (les fichiers dont il a besoin)
   - Les conventions du projet (passees en input depuis le prepare)

2. **Lire le fichier cible** (si action = modify) :
   - Lire le fichier existant en entier
   - Comprendre la structure avant de modifier

3. **Implementer** :
   - Pour `create` : ecrire le fichier complet
   - Pour `modify` : lire → modifier → reecrire le fichier complet
   - Pour `delete` : supprimer le fichier
   - Pour `add-dependency` : ajouter au package.json/requirements.txt/etc.
   - Pour `run-command` : executer une commande shell

4. **Verifier** :
   - Si TypeScript : `npx tsc --noEmit` (type check)
   - Si Python : `python -m py_compile <file>`
   - Si le type check echoue : corriger immediatement (max 3 tentatives)

#### Pourquoi le contexte focalise est crucial

C'est LE point ou Maestro prouve sa valeur :

**Sans separation** (chat Claude classique) :
- Context window : 200K tokens
- Apres prepare + plan + 5 fichiers lus : il reste ~100K tokens
- Le modele commence a "oublier" les conventions, les patterns, les types
- La qualite degrade step apres step

**Avec separation** (Maestro) :
- Chaque implement-step demarre avec un contexte FRAIS
- Il recoit : conventions (2K tokens) + step (500 tokens) + context_files (5-10K tokens)
- Total : ~15K tokens — le modele a TOUTE sa capacite pour coder
- La qualite est CONSTANTE de la premiere a la derniere step

#### Sortie

```json
{
  "stepId": 5,
  "action": "create",
  "target": "src/components/UserList.tsx",
  "linesWritten": 45,
  "verified": true,
  "verificationMethod": "tsc --noEmit",
  "notes": "Created component with loading state, error handling, following existing Card pattern"
}
```

#### Outils

| Outil | Usage |
|-------|-------|
| file-read | Lire le fichier cible (pour modify) et les context_files |
| file-write | Ecrire/modifier le fichier cible |
| shell-execute | Type check, lint, installer des deps |
| directory-list | Verifier la structure |
| code-search | Trouver les patterns a suivre |

#### Regles

- **TOUJOURS lire avant d'ecrire** quand on modifie un fichier existant
- **TOUJOURS verifier** apres ecriture (type check si disponible)
- **Jamais d'imports inventes** — verifier que le module importe existe
- **Suivre les conventions** passees en input (naming, patterns, style)
- **Max 15 iterations** — si ca ne compile pas apres 15 tentatives, reporter l'erreur
- **Pas de TODO, pas de placeholder** — le code doit etre complet et fonctionnel
- **Pas de decisions architecturales** — suivre le plan tel quel

---

### 3.5 test — Executer les tests

**Modele** : Sonnet (interpretation de resultats, pas besoin de vision strategique)
**Role** : Executer la suite de tests et produire un rapport structure

#### Ce qu'il fait

1. **Detecter le framework de test** :
   - Lire package.json / pyproject.toml / Cargo.toml
   - Identifier : vitest, jest, mocha, pytest, cargo test, dotnet test, go test
   - Si aucun framework → noter "No test framework detected"

2. **Installer les dependances si necessaire** :
   - Si `node_modules/` n'existe pas → `npm install`
   - Si `package-lock.json` a change → `npm install`

3. **Executer les tests** :
   - La commande appropriee pour le framework detecte
   - Capturer stdout + stderr
   - Timeout : 120 secondes

4. **Parser les resultats** :
   - Nombre de tests passes/echoues/ignores
   - Pour chaque echec : fichier, test name, message d'erreur, stack trace
   - Temps d'execution total

5. **Executer les checks supplementaires** :
   - Type check (`tsc --noEmit`, `mypy`, etc.) si disponible
   - Linter (`eslint`, `flake8`, etc.) si configure
   - Ces checks sont bonus — pas de blocage si non configures

#### Sortie

```json
{
  "framework": "vitest",
  "command": "npx vitest run",
  "passed": 24,
  "failed": 2,
  "skipped": 1,
  "duration": "3.2s",
  "failures": [
    {
      "file": "src/__tests__/UserList.test.tsx",
      "test": "renders loading state",
      "error": "Expected element to have text 'Loading...' but received 'Chargement...'",
      "line": 15
    },
    {
      "file": "src/__tests__/userService.test.ts",
      "test": "handles network error",
      "error": "TypeError: fetch is not a function",
      "line": 42
    }
  ],
  "typeCheck": { "passed": true, "errors": [] },
  "linter": { "passed": false, "warnings": 3, "errors": 0 }
}
```

#### Outils

| Outil | Usage |
|-------|-------|
| file-read | Lire package.json pour detecter le framework |
| shell-execute | Executer les tests, type check, linter |

#### Regles

- **Detecter avant d'executer** — ne pas assumer npm/vitest
- **Timeout 120s** — si les tests prennent plus, tuer et reporter
- **Capturer les details** — pas juste "2 failed", mais QUEL test et POURQUOI
- **Max 10 iterations** — detecter, installer si necessaire, executer, parser
- **Ne pas fixer les tests** — c'est le role de l'etape fix, pas de test

---

### 3.6 review — Evaluer la qualite

**Modele** : Opus (vision holiste, jugement de qualite)
**Role** : Evaluer TOUS les changements comme un reviewer senior

#### Ce qu'il fait

C'est un bloc **inference** (single LLM call), pas un agent. Il recoit tous les inputs et produit une review en une seule evaluation.

1. **Recevoir** :
   - Les changements effectues (output de chaque implement-step)
   - Les resultats de test (output de test)
   - Les conventions du projet (output de prepare)
   - La tache originale

2. **Evaluer sur ces axes** :

   | Axe | Poids | Ce qu'il verifie |
   |-----|-------|-----------------|
   | **Completude** | 0.25 | La tache est-elle entierement realisee ? Tous les criteres d'acceptation sont-ils remplis ? |
   | **Qualite du code** | 0.25 | Le code est-il propre, lisible, idiomatique ? Suit-il les conventions du projet ? |
   | **Tests** | 0.20 | Les tests sont-ils presents et passent-ils ? Les cas limites sont-ils couverts ? |
   | **Architecture** | 0.15 | Le code respecte-t-il l'architecture du projet ? Les couches sont-elles respectees ? |
   | **Securite** | 0.15 | Pas d'injection, pas de secrets hardcodes, pas de failles evidentes ? |

3. **Produire un score et des issues** :

   Score >= 0.8 → approuve → commit
   Score < 0.8 → rejete → fix loop (max 2 iterations)

#### Sortie

```json
{
  "score": 0.85,
  "approved": true,
  "axes": {
    "completeness": 0.9,
    "codeQuality": 0.85,
    "tests": 0.8,
    "architecture": 0.9,
    "security": 0.8
  },
  "issues": [
    {
      "severity": "warning",
      "file": "src/hooks/useUsers.ts",
      "description": "Missing error type narrowing in catch block",
      "suggestion": "Use `if (error instanceof Error)` pattern"
    }
  ],
  "summary": "Feature implemented correctly with good test coverage. Minor typing issue in error handling."
}
```

#### Regles

- **Le reviewer n'est pas le codeur** — il est objectif et critique
- **Score honnete** — 0.5 si c'est mediocre, pas 0.8 par complaisance
- **Issues actionnables** — chaque issue dit OU et COMMENT corriger
- **Pas de suggestions aspirationnelles** — seulement des problemes reels

---

### 3.7 fix — Corriger les issues de la review

> **NOTE** : `fix` n'est PAS un bloc separe. C'est un re-invoke de `implement-single-step` avec les issues de la review comme input supplementaire. La boucle fix → review est geree par le noeud `conditional` + `while` dans le workflow composite (voir section 10).

**Modele** : Sonnet (corrections ciblees, meme executeur que implement-step)
**Role** : Corriger les issues identifiees par le reviewer

#### Ce qu'il fait

1. Recevoir la liste d'issues de la review
2. Pour chaque issue :
   - Lire le fichier concerne
   - Appliquer la correction
   - Verifier (type check)
3. Maximum 2 iterations de fix → review → fix

Si apres 2 iterations le score est toujours < 0.8, l'agent commit quand meme avec une note dans le message de commit indiquant les issues restantes.

#### Implementation dans le workflow

Le noeud `conditional` dans `config.nodes` gere la branche :
- Score >= 0.8 → noeud `commit`
- Score < 0.8 → noeud `fix` (re-invoke implement-single-step avec les issues) → re-review → re-evaluate (max 2 iterations via compteur `_fixIterations`)

#### Outils

Memes que implement-step : file-read, file-write, shell-execute, code-search.

---

### 3.8 commit — Creer le commit

**Modele** : Sonnet (formatage precis, simple)
**Role** : Creer un commit propre avec un message conventionnel

#### Ce qu'il fait

1. **git status** — voir tous les fichiers modifies/crees/supprimes
2. **git diff** — voir les changements reels pour le contexte du message
3. **Stage selectif** — `git add <fichier>` pour chaque fichier pertinent. JAMAIS `git add .`
4. **Message conventionnel** :

   ```
   <type>(<scope>): <description courte>

   <corps detaille>

   <liste des fichiers>
   ```

   Types : feat, fix, refactor, test, docs, chore, style
   Scope : le module ou la zone affectee

5. **Commit** — `git commit -m "..."`

#### Regles

- **Jamais `git add .`** — stage seulement les fichiers de la tache
- **Ignorer** les fichiers generes (dist/, node_modules/, .env)
- **Message en anglais** par defaut (sauf si les conventions du projet disent autrement)
- **Si pas de changements** → ne pas committer, reporter "No changes to commit"

---

## 4. Choix de conception

### 4.1 Pourquoi Opus pour prepare/plan/review et Sonnet pour implement/test/commit ?

| Tache | Besoin cognitif | Modele |
|-------|----------------|--------|
| Comprendre un projet | Synthese, abstraction, creation de docs | Opus (vision strategique) |
| Planifier une feature | Decomposition, dependances, architecture | Opus (raisonnement complexe) |
| Ecrire du code | Focus, precision, suivi d'instructions | Sonnet (excellent codeur, rapide) |
| Executer des tests | Interpretation, commandes shell | Sonnet (suffisant) |
| Review holiste | Jugement, evaluation, vision d'ensemble | Opus (qualite de jugement) |
| Corriger des issues | Modifications ciblees | Sonnet (rapide, precis) |
| Committer | Formatage, conventions | Sonnet (simple) |

**Principe** : les taches de reflexion vont a Opus, les taches d'execution vont a Sonnet. Pas le contraire.

### 4.2 Pourquoi le for-each sur les steps ?

Le for-each n'est pas un choix technique — c'est un choix architectural fondamental :

1. **Contexte frais a chaque step** : l'implementeur ne traine pas le contexte des steps precedentes
2. **Remplacement granulaire** : en Phase 32, on peut changer le modele d'implement-step sans toucher le reste
3. **Observabilite** : dans le monitor TUI, chaque step apparait individuellement dans l'arbre d'execution
4. **Resilience** : si une step echoue, on sait laquelle et pourquoi
5. **Parallelisation future** : des steps sans dependances mutuelles pourraient tourner en parallele

### 4.3 Pourquoi definir les interfaces en premier ?

Quand un humain senior developpe une feature full-stack :
1. Il ne code pas le frontend "en esperant" que le backend retournera le bon format
2. Il definit le contrat (types, endpoints, payloads) d'ABORD
3. Ensuite backend et frontend travaillent independamment sur le meme contrat

L'agent suit le meme principe :
- Step 1 : types partagees → le contrat existe
- Steps 2-3 : backend + API client → implementent le contrat
- Steps 4-5 : hooks + composants → consomment le contrat
- Steps 6-7 : tests → verifient le contrat

### 4.4 Pourquoi separer test et review ?

Ce sont deux preoccupations differentes :
- **test** : "est-ce que ca MARCHE ?" (fonctionnel)
- **review** : "est-ce que c'est BIEN ?" (qualite)

Du code peut passer tous les tests et etre mal ecrit. Du code peut etre bien ecrit et avoir un bug. Les deux evaluations sont complementaires.

### 4.5 Pourquoi le fix loop est limite a 2 iterations ?

Empiriquement, si un agent ne corrige pas un probleme en 2 tentatives, il ne le corrigera pas en 10. A la troisieme iteration, il commence a tourner en rond (meme erreur, meme correction). Mieux vaut livrer avec une note que boucler indefiniment.

---

## 5. Gestion du contexte — Le coeur de la valeur Maestro

### 5.1 Ce que chaque bloc recoit

| Bloc | Input du prepare | Input du plan | Inputs specifiques |
|------|-----------------|---------------|-------------------|
| prepare | - | - | repoPath |
| plan | Contexte projet complet | - | task, repoPath |
| implement-step | Conventions (extrait) | Step courante | context_files |
| test | Stack (extrait) | - | repoPath |
| review | Conventions | - | changes, testResults, task |
| commit | - | - | repoPath, task, review |

### 5.2 Pourquoi implement-step ne recoit PAS tout le prepare

Le prepare produit peut-etre 10K tokens de contexte projet. L'implementeur n'a besoin que :
- Des conventions (naming, patterns) — ~1K tokens
- De la step courante — ~500 tokens
- Des context_files (2-3 fichiers) — ~5K tokens

Total : ~7K tokens au lieu de 50K+. Le modele est CONCENTRE sur sa tache.

### 5.3 Le principe de "need-to-know"

Chaque agent recoit le MINIMUM necessaire pour sa tache. Pas plus. C'est le principe du "need-to-know" militaire applique au LLM :
- Plus le contexte est focalise, meilleure est la qualite
- Plus le contexte est pollue, plus le modele "oublie" ou hallucine

---

## 6. Cas d'usage — Comment le plan s'adapte

### 6.1 Bug fix

```
prepare → comprend le projet
plan → identifie le bug, localise la cause, planifie :
  1. [test] Ecrire un test qui reproduit le bug
  2. [backend/frontend] Corriger le bug
  3. [test] Verifier que le test passe
test → confirme la correction
review → verifie que la correction est minimale et ne casse rien
commit → "fix(auth): resolve token expiration on refresh"
```

### 6.2 Nouvelle feature full-stack

```
prepare → comprend le projet
plan → decompose la feature :
  1. [types] Definir les types partages
  2. [backend] Service
  3. [backend] Controller + routes
  4. [api] Client API
  5. [frontend] Hook
  6. [frontend] Composant(s)
  7. [frontend] Integration dans la navigation/layout
  8. [test] Tests backend (service)
  9. [test] Tests frontend (composant)
test → tous les tests
review → qualite globale
commit → "feat(users): add user management module"
```

### 6.3 Refactoring

```
prepare → comprend le projet
plan → identifie ce qui change :
  1. [types] Mettre a jour les interfaces si necessaire
  2. [backend/frontend] Refactorer le code (un fichier a la fois)
  3. [test] Mettre a jour les tests affectes
  4. [test] Verifier que rien n'est casse (tests existants)
test → regression
review → pas de changement de comportement
commit → "refactor(auth): extract validation into dedicated service"
```

### 6.4 Documentation

```
prepare → comprend le projet
plan → identifie les docs a creer/modifier :
  1. [docs] README.md
  2. [docs] API documentation
  3. [docs] Contributing guide
test → pas de tests (ou check de liens si disponible)
review → qualite et completude de la doc
commit → "docs: add comprehensive README and API documentation"
```

### 6.5 Ajout de tests

```
prepare → comprend le projet
plan → identifie les fichiers sans tests :
  1. [test] Tests pour moduleA
  2. [test] Tests pour moduleB
  3. [config] Setup du test framework si necessaire
test → les nouveaux tests passent
review → couverture, cas limites
commit → "test(core): add unit tests for auth and user modules"
```

---

## 7. Ce que l'agent NE FAIT PAS

| Hors scope | Raison |
|-----------|--------|
| Deployment/CI | L'agent developpe, il ne deploie pas |
| Database migrations schema | Trop risque sans supervision humaine |
| Suppression de modules entiers | Destruction irreversible — necessite confirmation |
| Changements de config prod | Risque operationnel |
| Merge/rebase/push | L'agent commit localement, l'humain push |
| Choix de stack initial | L'agent s'adapte a la stack existante |
| Design UI (visuels) | L'agent ecrit du code, pas du CSS creatif |

---

## 8. Outils disponibles — Resume

Tous les outils passent par `maestro_cli` :

| Outil | Commande | Blocs qui l'utilisent |
|-------|----------|----------------------|
| directory-list | `run directory-list --input path=<path>` | prepare, implement-step |
| file-read | `run file-read --input path=<path>` | prepare, plan, implement-step, test |
| file-write | `run file-write --input path=<path> --input content=<content>` | prepare, implement-step |
| shell-execute | `run shell-execute --input command=<cmd>` | implement-step, test, commit |
| code-search | `run code-search --input pattern=<p> --input path=<path>` | plan, implement-step |

**Futurs outils** (Phase 31+) :

| Outil | Usage | Phase |
|-------|-------|-------|
| screenshot | Capturer l'etat visuel du frontend (multimodal) | 31+ |
| browser-test | Tests E2E avec Playwright | 32+ |
| widget-request | Poser une question a l'utilisateur via le TUI | 31 |

---

## 9. Qualite — Comment on s'assure que c'est bon

### 9.1 Gates de qualite

```
Apres prepare  : les docs sont pertinentes et completes ?
Apres plan     : le plan couvre toute la tache ? les deps sont correctes ?
Apres chaque step : le type check passe ?
Apres test     : les tests passent ?
Apres review   : score >= 0.8 ?
Apres commit   : le commit est propre ?
```

### 9.2 Ce qui peut mal tourner et comment on gere

| Probleme | Detection | Resolution |
|----------|-----------|------------|
| Le planificateur manque une step | Le review detecte un critere non rempli | Fix loop |
| L'implementeur ne suit pas les conventions | Le review baisse le score architecture | Fix loop |
| Les tests echouent | Le test executor reporte les echecs | Fix loop cible sur les tests |
| L'implementeur hallucine un import | Le type check echoue | L'implementeur corrige dans ses 15 iterations |
| Le plan est trop gros (>25 steps) | Le planificateur regroupe | Si impossible, livrer en plusieurs commits |
| Le projet n'a pas de framework de test | Le test executor le detecte | Reporter "no tests" dans la review, le review baisse le score tests |

### 9.3 Metriques de succes

| Metrique | Seuil Tier 1 | Comment mesurer |
|----------|-------------|-----------------|
| Taux de completion | >= 90% | La tache est-elle realisee ? |
| Tests pass rate | >= 95% | Les tests passent-ils ? |
| Review score moyen | >= 0.85 | Score du reviewer |
| Fix iterations moyennes | <= 1.0 | Combien de fix loops en moyenne |
| Fichiers non utilises crees | 0 | Pas de code mort |

---

## 10. Flot de donnees detaille

```
                    ┌──────────┐
      repoPath ───→│ prepare  │───→ projectContext (JSON)
                    └──────────┘        │
                         │              │
                         ▼              ▼
      task ──────→ ┌──────────┐
                   │   plan   │───→ steps[] (JSON array)
                   └──────────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
           ▼             ▼             ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │implement │ │implement │ │implement │  ... (for-each)
      │ step 1   │ │ step 2   │ │ step N   │
      └──────────┘ └──────────┘ └──────────┘
           │             │             │
           └─────────────┼─────────────┘
                         │
                         ▼ (tous les changements)
                    ┌──────────┐
      repoPath ───→│   test   │───→ testResults (JSON)
                    └──────────┘
                         │
                         ▼
                    ┌──────────┐
   conventions ───→│  review  │───→ reviewResult (JSON, score)
   testResults ───→│          │
   task ──────────→│          │
   changes ───────→└──────────┘
                         │
                   score >= 0.8 ?
                    /         \
                  oui         non ──→ fix ──→ review (max 2x)
                   │
                   ▼
              ┌──────────┐
              │  commit  │───→ commitResult (JSON, hash)
              └──────────┘
```

---

## 11. Prochaine etape

Ce document definit la LOGIQUE de l'agent. L'implementation suivra l'ordre du plan Phase 30 :

1. Fix l'infrastructure (tools-in-session, for-each dynamique)
2. Implementer chaque bloc bottom-up, tester individuellement
3. Assembler le composite, tester sur des taches reelles
4. Iterer les system prompts jusqu'a la qualite cible
5. Foundry → mesure → publish
