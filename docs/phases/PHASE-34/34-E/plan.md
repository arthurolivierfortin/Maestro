# Phase 34-E : Integration Testing + QualityScore Tier 1 + Comparaison vs Claude Code

**Statut** : A faire
**Prerequis** : Phase 34-A COMPLETE (34 blocks v4), Phase 34-B-4 COMPLETE (checkpointing), Phase 34-D COMPLETE (TUI widget integration)
**Objectif** : Tester l'agent v4 de bout en bout sur 5 projets reels, mesurer le QualityScore (P x W) de chaque bloc, comparer a Claude Code brut sur des criteres de qualite, et publier le manifeste Tier 1 avec le QualityBaseline.

> **ADR** : Cette phase applique `ADR-QUALITY-FIRST-DEGRADATION.md`. Le Tier 1 est evalue sur QualityScore (qualite pure), pas sur Fitness (rapport qualite/prix). Le cout est irrelevant.

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** de chaque sous-phase
3. **Ecrire dans `docs/phases/PHASE-34/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS inventer de scores** — chaque score doit venir d'une mesure reelle (execution + evaluation)
5. **Ne PAS confondre QualityScore et Fitness** — QualityScore = P x W (pas de cout), Fitness = QualityScore / Cost (Tiers 2+ uniquement)
6. **Le backend Maestro ET le LLM-Provider doivent tourner** — verifier avec health check avant de commencer
7. **Documenter TOUT dans le checkpoint** — scores, logs, problemes, contournements
8. **Si un service n'est pas disponible**, documenter le blocage et passer a la prochaine sous-phase non-dependante

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort |
|-------|-------|--------|
| 34-E-1 | Preparer les 5 repos de test | 2h |
| 34-E-2 | Mesurer le QualityScore par bloc | 3-4h |
| 34-E-3 | Executer les 5 taches avec Maestro Agent v4 | 4-6h |
| 34-E-4 | Executer les 5 taches avec Claude Code brut | 2-3h |
| 34-E-5 | Comparer, calculer QualityScore_global, etablir QualityBaseline | 1h |
| 34-E-6 | Publier le manifeste Tier 1 | 30min |

**Dependances** : 34-E-1 → 34-E-2 (repos necessaires pour mesurer les blocs d'analyse). 34-E-1 → 34-E-3 (repos necessaires). 34-E-3 → 34-E-4 (meme protocole, repos paralleles). 34-E-3 + 34-E-4 → 34-E-5 (comparaison). 34-E-2 + 34-E-5 → 34-E-6 (manifeste final). Executer dans l'ordre 1 → 2 → 3 → 4 → 5 → 6.

---

## 34-E-1 : Preparer les 5 repos de test

### Lecture obligatoire [OBLIGATOIRE]
- `docs/phases/PHASE-34/34-A/14-test-plan/spec.md` — les 5 taches de test, repos de depart, ce qu'on mesure
- `docs/phases/PHASE-34/ADR-QUALITY-FIRST-DEGRADATION.md` — comprendre QualityScore = P x W, pas de cout pour Tier 1

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Creer le dossier `test-repos/`** a la racine de `C:\Meastro\` :
   ```bash
   powershell.exe -Command "New-Item -ItemType Directory -Force -Path 'C:\Meastro\test-repos\crud','C:\Meastro\test-repos\auth','C:\Meastro\test-repos\dashboard','C:\Meastro\test-repos\explorer','C:\Meastro\test-repos\notifications'"
   ```

2. **Pour chaque repo**, initialiser un projet React + TypeScript + Vite + Tailwind avec la structure minimale :
   ```bash
   # Exemple pour crud (repeter pour les 5)
   powershell.exe -Command "cd C:\Meastro\test-repos\crud; npm init vite@latest . -- --template react-ts; npm install; npm install tailwindcss @tailwindcss/forms"
   ```

3. **Ajouter les specifiques par repo** :
   - `crud` : Express backend, structure de base (App.tsx, routing, API middleware)
   - `auth` : React Router, API auth endpoints mock (`/api/auth/login`, `/api/auth/register`)
   - `dashboard` : recharts installe, API endpoint mock (`/api/dashboard/stats`)
   - `explorer` : react-dnd installe, API endpoint mock (`/api/files`)
   - `notifications` : Express + Socket.io, structure existante avec header component

4. **Pour chaque repo** :
   - Verifier que `npm run build` passe (le squelette compile)
   - Initialiser git : `git init && git add -A && git commit -m "Initial project setup"`
   - Creer une copie pour Claude Code : `cp -r crud crud-claude` (meme point de depart)

5. **Creer aussi les copies pour Claude Code** :
   ```bash
   powershell.exe -Command "Copy-Item -Recurse -Force 'C:\Meastro\test-repos\crud' 'C:\Meastro\test-repos\crud-claude'; Copy-Item -Recurse -Force 'C:\Meastro\test-repos\auth' 'C:\Meastro\test-repos\auth-claude'; Copy-Item -Recurse -Force 'C:\Meastro\test-repos\dashboard' 'C:\Meastro\test-repos\dashboard-claude'; Copy-Item -Recurse -Force 'C:\Meastro\test-repos\explorer' 'C:\Meastro\test-repos\explorer-claude'; Copy-Item -Recurse -Force 'C:\Meastro\test-repos\notifications' 'C:\Meastro\test-repos\notifications-claude'"
   ```

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `test-repos/crud/` | CREER — Squelette React + Express + TS + Tailwind |
| `test-repos/auth/` | CREER — Squelette React + React Router + TS + Tailwind |
| `test-repos/dashboard/` | CREER — Squelette React + recharts + TS + Tailwind |
| `test-repos/explorer/` | CREER — Squelette React + react-dnd + TS + Tailwind |
| `test-repos/notifications/` | CREER — Squelette React + Express + Socket.io + TS + Tailwind |
| `test-repos/*-claude/` | CREER — Copies identiques pour Claude Code |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : Les 10 dossiers existent (5 Maestro + 5 Claude)
powershell.exe -Command "Get-ChildItem 'C:\Meastro\test-repos' -Directory | Select-Object Name"
# Resultat attendu : crud, crud-claude, auth, auth-claude, dashboard, dashboard-claude, explorer, explorer-claude, notifications, notifications-claude

# Commande 2 : Chaque repo compile
powershell.exe -Command "cd C:\Meastro\test-repos\crud; npm run build"
powershell.exe -Command "cd C:\Meastro\test-repos\auth; npm run build"
powershell.exe -Command "cd C:\Meastro\test-repos\dashboard; npm run build"
powershell.exe -Command "cd C:\Meastro\test-repos\explorer; npm run build"
powershell.exe -Command "cd C:\Meastro\test-repos\notifications; npm run build"
# Resultat attendu : tous compilent sans erreur

# Commande 3 : Git initialise dans chaque repo
powershell.exe -Command "cd C:\Meastro\test-repos\crud; git log --oneline -1"
# Resultat attendu : "Initial project setup"
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS commencer les tests d'integration avant que les 5 repos compilent — sinon les erreurs de build polluent les resultats
- Ne PAS mettre du code existant pour la feature demandee dans le repo — le squelette doit etre vierge de la feature
- Ne PAS oublier les copies pour Claude Code — la comparaison doit partir du meme point de depart exact

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-E-1 : Repos de test
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Repos crees** : X / 5
**Repos qui compilent** : X / 5
**Copies Claude Code** : X / 5
**Git initialise** : X / 5
**Verification** : [copier output de Get-ChildItem + build status]
```

---

## 34-E-2 : Mesurer le QualityScore par bloc

### Lecture obligatoire [OBLIGATOIRE]
- `docs/phases/PHASE-34/ADR-QUALITY-FIRST-DEGRADATION.md` — section "Comment on evalue la qualite" (ligne ~107) — protocoles de mesure de P par type de bloc, mesure de W, seuils
- `content/system/blocks/` — lire les block JSON des blocs a mesurer pour comprendre leurs inputs/outputs attendus

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Pour chaque categorie de blocs, executer le protocole de mesure de P** decrit dans l'ADR :

   **Blocs d'implementation** (backend-developer, frontend-developer, styling-developer) :
   - Preparer 10 steps varies de complexite differente
   - Pour chaque step, executer le bloc via `node index.js run <block-id> --input step="..." repoPath="..."`
   - Verifier avec `compilation-check` et `test-runner`
   - `P = (0.30 x CompilationRate) + (0.40 x TestPassRate) + (0.30 x AcceptanceCriteria)`

   **Blocs de review** (code-reviewer, security-reviewer, architecture-reviewer) :
   - Preparer 20 revues de code (10 bonne qualite, 10 mauvaise qualite) avec un score humain de reference
   - Executer le bloc sur chaque revue
   - Calculer la correlation de Pearson entre scores bloc et scores humain
   - `P = Correlation(scores_bloc, scores_humain)`

   **Blocs de planification** (task-planner, task-architect) :
   - Donner 10 taches au planner
   - Pour chaque plan produit, verifier si les steps sont executables
   - `P = nb_steps_implementes_avec_succes / nb_steps_total`

   **Blocs d'analyse** (project-analyzer, research-agent) :
   - Utiliser les 5 repos de test + 5 repos connus supplementaires
   - Executer le bloc et verifier chaque champ contre la verite terrain
   - `P = nb_champs_corrects / nb_champs_total`

   **Blocs d'interaction** (classify-intent, decide-action) :
   - Preparer 50 messages de test pour classify-intent (10 par categorie)
   - Preparer 30 scenarios pour decide-action
   - `P = nb_reponses_correctes / nb_scenarios_total`

   **Blocs utilitaires** (step-validator, compilation-check, git-committer, test-runner, etc.) :
   - Executer chaque bloc 10 fois sur des cas varies
   - `P = nb_executions_correctes / nb_executions_total`

2. **Pour chaque bloc, mesurer W** sur les memes executions :
   - Verifier si l'output est du JSON valide (quand attendu)
   - Verifier si tous les champs requis sont presents
   - Verifier si les valeurs sont reelles (pas d'inventions)
   - `W = 1 - HallucinationRate`

3. **Calculer QualityScore = P x W** pour chaque bloc

4. **Verifier les seuils** (de l'ADR) :
   - Blocs d'interaction : W >= 1.0
   - Blocs de review : W >= 0.95
   - Blocs d'implementation : W >= 0.90
   - Blocs utilitaires : W >= 0.95

5. **Si un bloc est sous le seuil** : iterer le prompt, changer l'approche, retester. Minimum 2 tentatives.

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-34/34-E/quality-scores.md` | CREER — Tableau complet des scores P, W, QualityScore par bloc |
| `docs/phases/PHASE-34/checkpoint.md` | MODIFIER — Mettre a jour le checkpoint |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : Le fichier quality-scores.md existe et a du contenu
powershell.exe -Command "Test-Path 'C:\Meastro\docs\phases\PHASE-34\34-E\quality-scores.md'"
# Resultat attendu : True

# Commande 2 : Verifier que tous les blocs sont documentes (au moins 20 lignes pour la table)
powershell.exe -Command "(Get-Content 'C:\Meastro\docs\phases\PHASE-34\34-E\quality-scores.md').Count"
# Resultat attendu : >= 30 lignes
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS inventer les scores — chaque P et W doit venir d'une execution reelle avec le protocole decrit
- Ne PAS sauter les blocs "faciles" (step-validator, compilation-check) — mesurer TOUS les blocs
- Ne PAS declarer un bloc valide si W < seuil — iterer le prompt
- Ne PAS mesurer P sur 1-2 exemples — les protocoles exigent 10-50 executions selon le type

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-E-2 : QualityScore par bloc
**Statut** : DONE / EN_COURS / BLOQUE
**Date** : YYYY-MM-DD
**Blocs mesures** : X / 23
**Table QualityScore** :
  | Bloc | P | W | QualityScore | Seuil W | OK? |
  |------|---|---|-------------|---------|-----|
  | project-analyzer | | | | 0.95 | |
  | ... | | | | | |
**Blocs sous seuil** : [liste]
**Iterations effectuees** : [pour chaque bloc sous seuil]
**Verification** : [copier le chemin du fichier quality-scores.md]
```

---

## 34-E-3 : Executer les 5 taches avec Maestro Agent v4

### Lecture obligatoire [OBLIGATOIRE]
- `docs/phases/PHASE-34/34-A/14-test-plan/spec.md` — descriptions exactes des 5 taches, ce qu'on mesure, criteres d'evaluation
- `content/system/templates/sessions/project-v4.session.json` — le template de session v4 et ses entry points
- `packages/maestro-cli/cli.ts` — comprendre la commande `maestro code` ou `session invoke`

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Verifier les services** :
   ```bash
   curl -s http://localhost:5000/api/health
   curl -s http://localhost:5010/api/v1/health/
   ```
   Si l'un des deux ne repond pas → BLOQUE (documenter dans le checkpoint).

2. **Pour chaque tache (1 a 5)**, executer avec Maestro Agent v4 :
   ```bash
   # Methode A : Via maestro code (interactif)
   powershell.exe -Command "cd C:\Meastro\test-repos\crud; node C:\Meastro\packages\maestro-cli\index.js code"
   # Taper la description de la tache dans le TUI

   # Methode B : Via session invoke (headless)
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js session create --type project --name 'Test CRUD - Maestro v4' --repo 'C:\Meastro\test-repos\crud' --template project-v4 --start"
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js session invoke <UUID> dev --input task='Add a user management module to this React + Express app. Users should have name, email, and avatar. Include list, create, edit, and delete operations with a clean UI.' repoPath='C:\Meastro\test-repos\crud'"
   ```

3. **Collecter les resultats** pour chaque tache :
   - `Completion` (0-1) : verifier manuellement que toutes les features demandees fonctionnent
   - `Code Quality` : executer `code-reviewer` sur le code produit
   - `Tests` : ratio tests passes / tests ecrits (si des tests ont ete generes)
   - `Visual Quality` : executer `ui-reviewer` sur des screenshots (si applicable)
   - `Security` : executer `security-reviewer` sur le code produit
   - `Duration` : temps total (metrique secondaire, pas decisionnelle)
   - `Iterations` : combien de cycles implement→review avant approbation

4. **Documenter chaque execution** dans un fichier de resultats.

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-34/34-E/results-maestro.md` | CREER — Resultats detailles des 5 taches avec Maestro v4 |
| `docs/phases/PHASE-34/checkpoint.md` | MODIFIER — Mettre a jour |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : Les 5 repos Maestro ont des commits (code produit)
powershell.exe -Command "cd C:\Meastro\test-repos\crud; git log --oneline | Measure-Object"
# Resultat attendu : Count > 1 (le commit initial + au moins 1 commit de l'agent)

# Commande 2 : Les resultats sont documentes
powershell.exe -Command "Test-Path 'C:\Meastro\docs\phases\PHASE-34\34-E\results-maestro.md'"
# Resultat attendu : True
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS lancer les 5 taches en meme temps — une a la fois, verifier les resultats
- Ne PAS ignorer les echecs — si l'agent v4 echoue sur une tache, documenter pourquoi, iterer si possible
- Ne PAS inventer des scores de completion — verifier manuellement chaque feature

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-E-3 : Taches Maestro v4
**Statut** : DONE / EN_COURS / BLOQUE
**Date** : YYYY-MM-DD
**Taches executees** : X / 5
  | Tache | Completion | CodeQuality | Tests | Visual | Security | Iterations | Duration |
  |-------|-----------|-------------|-------|--------|----------|------------|----------|
  | CRUD | | | | | | | |
  | Auth | | | | | | | |
  | Dashboard | | | | | | | |
  | Explorer | | | | | | | |
  | Notifications | | | | | | | |
**Problemes** : [si BLOQUE]
```

---

## 34-E-4 : Executer les 5 taches avec Claude Code brut

### Lecture obligatoire [OBLIGATOIRE]
- `docs/phases/PHASE-34/34-A/14-test-plan/spec.md` — memes taches, memes criteres
- Les resultats de 34-E-3 (pour savoir quoi comparer)

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Pour chaque tache**, executer avec Claude Code directement sur les repos `-claude` :
   ```bash
   # Lancer Claude Code sur le repo de test
   cd C:\Meastro\test-repos\crud-claude
   claude "Add a user management module to this React + Express app. Users should have name, email, and avatar. Include list, create, edit, and delete operations with a clean UI."
   ```
   Utiliser le meme modele (Opus ou Sonnet) que celui utilise par Maestro v4.

2. **Appliquer les memes reviewers v4** au resultat de Claude Code :
   ```bash
   # Executer les reviewers sur le code produit par Claude Code
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run code-reviewer --input implementedCode='...' projectContext='...'"
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run security-reviewer --input implementedCode='...' projectContext='...'"
   ```
   Ceci garantit une comparaison equitable : memes evaluateurs pour les deux.

3. **Collecter les memes metriques** que pour Maestro v4 : Completion, CodeQuality, Tests, Visual, Security.

4. **Documenter** dans un fichier de resultats separe.

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-34/34-E/results-claude.md` | CREER — Resultats detailles des 5 taches avec Claude Code |
| `docs/phases/PHASE-34/checkpoint.md` | MODIFIER — Mettre a jour |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : Les 5 repos Claude ont des commits
powershell.exe -Command "cd C:\Meastro\test-repos\crud-claude; git log --oneline | Measure-Object"
# Resultat attendu : Count > 1

# Commande 2 : Les resultats sont documentes
powershell.exe -Command "Test-Path 'C:\Meastro\docs\phases\PHASE-34\34-E\results-claude.md'"
# Resultat attendu : True
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS utiliser un modele different pour Claude Code et Maestro — la comparaison doit etre sur le meme modele de base
- Ne PAS evaluer les resultats de Claude Code avec des criteres plus laxistes — memes reviewers, memes seuils
- Ne PAS donner plus ou moins d'informations a Claude Code qu'a Maestro — meme description de tache exacte

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-E-4 : Taches Claude Code
**Statut** : DONE / EN_COURS / BLOQUE
**Date** : YYYY-MM-DD
**Taches executees** : X / 5
  | Tache | Completion | CodeQuality | Tests | Visual | Security |
  |-------|-----------|-------------|-------|--------|----------|
  | CRUD | | | | | |
  | Auth | | | | | |
  | Dashboard | | | | | |
  | Explorer | | | | | |
  | Notifications | | | | | |
**Problemes** : [si BLOQUE]
```

---

## 34-E-5 : Comparer, calculer QualityScore_global, etablir QualityBaseline

### Lecture obligatoire [OBLIGATOIRE]
- `docs/phases/PHASE-34/34-E/results-maestro.md` — resultats Maestro v4
- `docs/phases/PHASE-34/34-E/results-claude.md` — resultats Claude Code
- `docs/phases/PHASE-34/34-E/quality-scores.md` — QualityScore par bloc
- `docs/phases/PHASE-34/ADR-QUALITY-FIRST-DEGRADATION.md` — section "Application au Tier 1" (ligne ~274) — formule QualityScore_global, poids par phase

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Remplir le tableau de comparaison** :
   ```
   | Tache | Critere | Maestro v4 | Claude Code | Gagnant |
   |-------|---------|-----------|-------------|---------|
   | CRUD | Completion | X | X | M/C |
   | CRUD | CodeQuality | X | X | M/C |
   | ... | ... | ... | ... | ... |
   ```

2. **Determiner le gagnant par tache** : celui qui gagne 3+ criteres sur 5 (ponderes par les poids : Completion 30%, CodeQuality 25%, Tests 15%, Visual 15%, Security 15%).

3. **Calculer QualityScore_global** selon les poids par phase de l'ADR :
   ```
   QualityScore_global = (0.10 x avg_COMPRENDRE) + (0.10 x avg_PLANIFIER) +
                         (0.30 x avg_IMPLEMENTER) + (0.20 x avg_VERIFIER) +
                         (0.15 x avg_REVIEWER) + (0.05 x avg_LIVRER) +
                         (0.10 x avg_INTERACTION)
   ```
   Ou chaque `avg_PHASE` est la moyenne des QualityScore des blocs de cette phase (mesures en 34-E-2).

4. **Etablir le QualityBaseline** :
   ```
   QualityBaseline = QualityScore_global
   ```

5. **Evaluer le critere de victoire** : Maestro v4 gagne sur 4+ criteres de qualite pour 4+ taches ?

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-34/34-E/comparison.md` | CREER — Tableau de comparaison complet, verdict |
| `docs/phases/PHASE-34/checkpoint.md` | MODIFIER — Mettre a jour |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : Le fichier comparison.md existe
powershell.exe -Command "Test-Path 'C:\Meastro\docs\phases\PHASE-34\34-E\comparison.md'"
# Resultat attendu : True

# Commande 2 : Il contient le QualityBaseline
powershell.exe -Command "Select-String -Path 'C:\Meastro\docs\phases\PHASE-34\34-E\comparison.md' -Pattern 'QualityBaseline'"
# Resultat attendu : au moins 1 occurrence
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS declarer victoire sans metriques objectives — les scores doivent etre dans le tableau
- Ne PAS arrondir les scores pour obtenir le resultat souhaite — reporter les scores bruts
- Ne PAS oublier les poids par critere — Completion (30%) pese 2x plus que Tests (15%)

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-E-5 : Comparaison
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**QualityScore_global** : [score]
**QualityBaseline** : [score]
**Maestro gagne** : X / 5 taches
**Critere de victoire** (4/5 criteres sur 4/5 taches) : ATTEINT / PAS ATTEINT
**Comparaison** :
  | Tache | Completion | CodeQuality | Tests | Visual | Security | Gagnant |
  |-------|-----------|-------------|-------|--------|----------|---------|
  | ... | M:_/C:_ | M:_/C:_ | M:_/C:_ | M:_/C:_ | M:_/C:_ | |
```

---

## 34-E-6 : Publier le manifeste Tier 1

### Lecture obligatoire [OBLIGATOIRE]
- `docs/phases/PHASE-34/ADR-QUALITY-FIRST-DEGRADATION.md` — section "Resultat : un tier par palier" (ligne ~381) — format du manifeste JSON
- `docs/phases/PHASE-34/34-E/comparison.md` — les resultats a inclure
- `docs/phases/PHASE-34/34-E/quality-scores.md` — les QualityScore par bloc

### Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Creer le fichier `content/system/manifests/tier-1.manifest.json`** avec le format suivant :
   ```json
   {
     "tier": 1,
     "date": "YYYY-MM-DD",
     "qualityScore_global": 0.XX,
     "qualityBaseline": 0.XX,
     "costReduction": "N/A (Tier 1 = qualite maximale, cout irrelevant)",
     "blocks": {
       "project-analyzer": { "model": "...", "P": 0.XX, "W": 0.XX, "qualityScore": 0.XX },
       "task-architect": { "model": "...", "P": 0.XX, "W": 0.XX, "qualityScore": 0.XX },
       ...pour chaque bloc...
     },
     "comparison": {
       "verdict": "Maestro v4 wins X/5 tasks",
       "tasks": {
         "crud": { "maestro": { "completion": 0.XX, ... }, "claude": { "completion": 0.XX, ... }, "winner": "maestro|claude" },
         ...pour chaque tache...
       }
     },
     "secondaryMetrics": {
       "avgDuration": "Xmin",
       "avgCost": "$X",
       "avgTokens": "X",
       "avgIterations": X
     }
   }
   ```

2. **Verifier que le manifeste est du JSON valide** :
   ```bash
   powershell.exe -Command "Get-Content 'C:\Meastro\content\system\manifests\tier-1.manifest.json' | ConvertFrom-Json | ConvertTo-Json -Depth 5"
   ```

3. **Mettre a jour le checkpoint final** de la Phase 34-E.

### Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `content/system/manifests/tier-1.manifest.json` | CREER — Manifeste Tier 1 complet |
| `docs/phases/PHASE-34/checkpoint.md` | MODIFIER — Checkpoint final 34-E |

### Verification [OBLIGATOIRE]

```bash
# Commande 1 : Le manifeste existe et est du JSON valide
powershell.exe -Command "Get-Content 'C:\Meastro\content\system\manifests\tier-1.manifest.json' | ConvertFrom-Json | Select-Object tier, qualityScore_global, qualityBaseline"
# Resultat attendu : tier=1, qualityScore_global=0.XX, qualityBaseline=0.XX

# Commande 2 : Le manifeste contient tous les blocs
powershell.exe -Command "(Get-Content 'C:\Meastro\content\system\manifests\tier-1.manifest.json' | ConvertFrom-Json).blocks.PSObject.Properties.Count"
# Resultat attendu : >= 23 (tous les blocs specialistes)

# Commande 3 : Le manifeste contient la comparaison
powershell.exe -Command "(Get-Content 'C:\Meastro\content\system\manifests\tier-1.manifest.json' | ConvertFrom-Json).comparison.verdict"
# Resultat attendu : "Maestro v4 wins X/5 tasks"
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS publier un manifeste avec des scores inventes — chaque score doit venir de 34-E-2 et 34-E-3/4
- Ne PAS oublier le champ `qualityBaseline` — c'est la reference pour les Tiers 2+ (Phase 34-F)
- Ne PAS inclure de scores de Fitness (QualityScore/Cost) dans le manifeste Tier 1 — seul QualityScore est pertinent

### Checkpoint [OBLIGATOIRE]
```markdown
## 34-E-6 : Manifeste Tier 1
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Manifeste publie** : OUI / NON
**Chemin** : content/system/manifests/tier-1.manifest.json
**QualityScore_global** : [score]
**QualityBaseline** : [score]
**JSON valide** : OUI / NON
**Blocs dans le manifeste** : X / 23
**Verification** : [copier output de ConvertFrom-Json]
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-34/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 34-E complete — QualityBaseline = [score]. Manifeste Tier 1 publie a `content/system/manifests/tier-1.manifest.json`. Maestro v4 gagne X/5 taches vs Claude Code."
- Ajouter : "QualityScore = P x W (pas de cout pour Tier 1). Fitness = QualityScore / Cost (Tiers 2+ uniquement)."
