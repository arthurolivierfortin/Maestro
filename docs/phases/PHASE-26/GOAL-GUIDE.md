# Phase 26 — Guide de Reference Rapide

> **Ce document est une boussole.** Consultez-le a chaque debut de session pour ne jamais perdre le cap.

---

## Mission

Construire un **agent de developpement autonome** via Maestro qui prend une tache et livre du code fonctionnel, teste, et commite. Le projet **Cantante** (editeur accessible pour aveugles) sert de terrain d'epreuve.

---

## 7 Regles d'or

| # | Regle | Consequence |
|---|-------|-------------|
| 1 | **Jamais de code direct** | Toute modification passe par des blocks/agents via le CLI Maestro |
| 2 | **Generique d'abord** | Aucun block ne mentionne "Cantante" — tout fonctionne sur n'importe quel projet |
| 3 | **Bottom-up** | Tools atomiques → Agents → Workflows → Orchestrateur. Tester chaque couche avant de monter |
| 4 | **Mesurer tout** | Chaque block a un fitness score. Pas de "ca a l'air de marcher" — des chiffres |
| 5 | **Noter ce qui manque** | Si Maestro ne permet pas quelque chose → `MISSING-FEATURES.md` |
| 6 | **Workspace d'abord** | Tout dans un workspace lie a un repo. Foundry → Publish → Projet. Jamais de blocks en vrac |
| 7 | **Ne jamais s'arreter** | Premier obstacle ≠ fin. Tester models, reformuler prompts, changer d'approche. Continuer |

---

## Methodologie Obligatoire (CRITIQUE)

> **Toute violation de cette methodologie est un echec de processus, meme si le code "fonctionne".**

### 1. Tout dans un Workspace lie a un repo

```
maestro workspace create --name "cantante-dev" --repo "C:\Cantante"
```

- Chaque workspace est **lie a un repo Git** pour tracabilite
- L'utilisateur peut voir tout ce qui a ete fait en consultant le workspace
- **Jamais de blocks ou fichiers crees "en vrac"** hors d'un workspace

### 2. Trois types de sessions dans le workspace

| Type | Usage | Exemple |
|------|-------|---------|
| **Session Projet** | Developpement reel du projet cible | `cantante-v1` — execute les features |
| **Sessions Foundry** | Creation et entrainement de chaque block | `train-commit-writer`, `train-planner-agent` |
| **Sessions Test** | Tests d'integration et validation | `test-implement-feature` |

### 3. Cycle de vie d'un block

```
┌─────────────────────────────────────────────────────────────┐
│  Session Foundry                                             │
│  1. Creer le block (block create / ecriture directe)        │
│  2. Tester (execute, mesurer fitness)                        │
│  3. Iterer (ajuster prompt, model, temperature, few-shot)   │
│  4. Si fitness < seuil → retour a 2                         │
│  5. Si le model ne suit pas → TESTER D'AUTRES MODELS         │
│  6. Publier quand fitness >= seuil                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ publish
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Session Projet                                              │
│  Utiliser les blocks publies pour le developpement reel     │
└─────────────────────────────────────────────────────────────┘
```

### 4. Regles de perseverance

| Situation | Reponse correcte | Reponse INTERDITE |
|-----------|-------------------|-------------------|
| Le model ne suit pas le format | Tester 2-3 autres models disponibles | S'arreter et noter "a faire" |
| Le prompt ne fonctionne pas | Reformuler, ajouter few-shot, reduire | S'arreter et noter "a faire" |
| Un bug dans l'infra bloque | Le corriger et continuer | S'arreter et noter "a faire" |
| Fitness trop bas apres 5 essais | Changer d'approche (model, architecture, decomposition) | S'arreter |
| **Seul cas d'arret** | Incapacite technique fondamentale (GPU crash, API cassee, etc.) | — |

> **Le plan dit "continuer jusqu'a ce que Cantante soit fini". C'est un ordre, pas une suggestion.**

### 5. Tracabilite

- Chaque action est dans un workspace → visible par l'utilisateur
- Chaque block a un historique de fitness dans sa session foundry
- `SESSION-NOTES.md` documente chaque session de travail
- `MISSING-FEATURES.md` documente les gaps Maestro decouverts
- A chaque debut de session, dire a l'utilisateur : "Workspace: X, Session: Y"

---

## Progression

### Layer 1 — Outils Atomiques
- [x] `context-builder` — Heuristique keyword+content scoring, teste 124ms
- [x] `convention-reader` — Scanner de conventions projet, teste 245ms
- [x] `code-generator` — Inference block, template avec {{context}}/{{conventions}}
- [x] `test-generator` — Inference block, detection framework auto
- [x] `code-analyzer` — Structure de fichier (imports/exports/functions), teste 153ms
- [x] `code-reviewer` — Inference block, output JSON {issues, score}
- [x] `commit-writer` — Inference block, teste avec SmolLM2 (template OK, qualite a affiner)
- [x] `pr-writer` — Inference block, markdown structure
- [x] `file-scaffolder` — Creation fichiers/dossiers depuis template JSON
- [x] `dependency-manager` — npm/yarn/pnpm/bun auto-detect, teste 1176ms

### Layer 2 — Agents Specialises
- [x] `planner-agent` — Decompose tache en subtasks ordonnees (uses convention-reader, context-builder, code-analyzer)
- [x] `coder-agent` — Implemente un subtask (read → generate → write → verify)
- [x] `tester-agent` — Genere et execute tests (uses test-generator, shell-execute)
- [x] `reviewer-agent` — Review code qualite/bugs/conventions (uses code-reviewer, convention-reader)
- [x] `git-agent` — Commit/branch/push/status (uses commit-writer, pr-writer)

### Layer 3 — Workflows (agents orchestrateurs)
- [x] `implement-feature` — plan → code → test → review → commit (max 20 iterations)
- [x] `fix-bug` — analyze → fix → test → review → commit (max 15 iterations)
- [ ] `setup-project` — pas encore necessaire

### Layer 4 — Agent Autonome
- [ ] `autonomous-developer` — a evaluer si necessaire (implement-feature pourrait suffire)

---

## Features Cantante (ordre de developpement)

| # | Feature | Difficulte | Workflow utilise |
|---|---------|-----------|-----------------|
| 1 | Installer les dependances (`npm install`) | Facile | dependency-manager |
| 2 | Corriger `renderer.ts` (fichier casse) | Facile | fix-bug |
| 3 | Remplacer le HTML audio par un squelette editeur | Moyen | implement-feature |
| 4 | Module de gestion de fichiers (ouvrir/sauver) | Moyen | implement-feature |
| 5 | Module file-tree (arborescence de fichiers) | Moyen | implement-feature |
| 6 | Module editeur de code (textarea accessible) | Complexe | implement-feature |
| 7 | Module accessibilite TTS (synthese vocale) | Complexe | implement-feature |
| 8 | Module commandes vocales basiques | Complexe | implement-feature |
| 9 | Tests unitaires pour chaque module | Continu | tester-agent |
| 10 | Packaging Electron fonctionnel | Moyen | implement-feature |

---

## Criteres de succes

### Minimum viable
- [ ] L'agent `coder-agent` peut generer du code TypeScript valide
- [ ] L'agent `tester-agent` peut generer et executer des tests
- [ ] Le workflow `implement-feature` peut livrer une feature complete

### Objectif
- [ ] L'`autonomous-developer` prend "Ajouter un file-tree" et livre un PR fonctionnel
- [ ] Le code genere passe `tsc --noEmit` sans erreur
- [ ] Les tests generent couvrent les cas principaux
- [ ] Les commits ont des messages conventionnels
- [ ] Le code respecte les conventions du projet

### Stretch
- [ ] L'agent detecte les docs manquantes et les demande
- [ ] L'agent peut travailler sur un projet Python ou C# sans modification
- [ ] Fitness > 0.85 sur chaque block

---

## Rappels importants

- **Workspace d'abord** : TOUJOURS travailler dans un workspace lie a un repo. Jamais de blocks en vrac.
- **Foundry → Publish → Projet** : Creer/entrainer dans foundry, publier quand OK, utiliser dans session projet.
- **Ne jamais s'arreter** : Si un model ne marche pas, en tester un autre. Si un prompt echoue, le reformuler. Continuer jusqu'au bout.
- **Tester les models** : SmolLM2-1.7B, Qwen2.5-Coder-1.5B, DeepSeek-R1-Distill-Qwen-1.5B — essayer au moins 2-3 avant de conclure qu'un block ne fonctionne pas.
- **Contexte limite** : Le `context-builder` est le block le plus critique. Ne jamais envoyer tout le projet.
- **Erreurs visibles** : Si ca casse, ca doit se voir. Pas de fallback silencieux.
- **Tracabilite** : L'utilisateur doit pouvoir voir tout ce qui a ete fait en consultant le workspace.
- **Documents de reference** :
  - Vision complete : `PHASE-26/VISION-AND-ARCHITECTURE.md`
  - Strategie detaillee : `PHASE-26/STRATEGY-BLOCKS-AND-AGENTS.md`
  - Features manquantes : `PHASE-26/MISSING-FEATURES.md`
  - Notes de session : `PHASE-26/SESSION-NOTES.md`
