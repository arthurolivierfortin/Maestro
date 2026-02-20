# 14. Plan de Tests — Validation Agent v4 > Claude Code

> **ADR** : Mis a jour selon `ADR-QUALITY-FIRST-DEGRADATION.md` (2026-02-19).
> Le Tier 1 est evalue sur la **qualite uniquement**. Duration et Cost sont des metriques secondaires.

## Objectif

Demontrer que l'Agent Maestro v4 **depasse considerablement** Claude Code brut (avec le meme modele) sur des taches de developpement fullstack reelles, en termes de **qualite** du resultat.

---

## Protocole de test

### Pour chaque tache

1. **Preparer** un repo de depart identique (git clone frais)
2. **Executer avec Maestro Agent v4** : `maestro agent "<task description>"`
3. **Executer avec Claude Code brut** : meme description de tache, meme modele (Opus/Sonnet)
4. **Evaluer** les deux resultats avec les memes criteres de qualite

### Criteres d'evaluation — Tier 1 (qualite uniquement)

| Critere | Poids | Comment mesurer |
|---------|-------|-----------------|
| **Completion** | 30% | La tache est-elle completement realisee? (0-1) |
| **Code Quality** | 25% | Score du code-reviewer v4 applique aux deux resultats |
| **Tests** | 15% | Tests ecrits et passants (ratio) |
| **Visual Quality** | 15% | Score du ui-reviewer v4 (si applicable) |
| **Security** | 15% | Score du security-reviewer v4 |

> **Note** : Duration est retiree des criteres de victoire du Tier 1. Le temps n'est pas un critere de qualite. Duration et Cost sont mesures comme metriques secondaires (informatives) et deviennent des criteres de decision a partir du Tier 2.

### Seuil de victoire — Tier 1

Maestro Agent v4 doit etre **meilleur sur au moins 4 des 5 criteres de qualite** pour au moins **4 des 5 taches**.

La victoire est jugee sur la qualite du resultat final, pas sur la vitesse ou le cout d'execution.

---

## Les 5 taches de test

### Tache 1 : CRUD Module (Complexite : Simple)

**Description** : "Add a user management module to this React + Express app. Users should have name, email, and avatar. Include list, create, edit, and delete operations with a clean UI."

**Repo de depart** : React 18 + Express + TypeScript + Tailwind. Structure de base existante (App.tsx, routing, API middleware).

**Ce qu'on mesure** :
- Completion : toutes les operations CRUD fonctionnent
- Quality : separation service/component, error handling, types
- Tests : unitaires pour le service + composant
- Visual : layout propre, responsive, hover effects
- Security : validation input, pas de XSS

**Pourquoi Maestro devrait gagner** :
- Specialisation : backend-dev pour l'API, frontend-dev pour les composants, styling-dev pour le polish
- Verification visuelle : le ui-reviewer voit le resultat
- Iteration : si le review echoue, correction automatique

### Tache 2 : Authentication Flow (Complexite : Moderee)

**Description** : "Implement a complete authentication system: login form, registration form, JWT token storage, protected routes, and logout. Use the existing API at /api/auth/login and /api/auth/register."

**Repo de depart** : React 18 + React Router + Tailwind. API auth endpoints deja implementes (mock).

**Ce qu'on mesure** :
- Completion : login, register, logout, route protection
- Quality : token management, error states, form validation
- Tests : unitaires + E2E (login flow)
- Visual : formulaires propres, error messages, loading states
- Security : XSS prevention, token storage (httpOnly si possible), CSRF

**Pourquoi Maestro devrait gagner** :
- Security-reviewer detecte les problemes de token storage
- E2E tester verifie le flow complet
- Styling-dev fait des formulaires soignes avec feedback visuel

### Tache 3 : Data Visualization Dashboard (Complexite : Moderee-Elevee)

**Description** : "Create a dashboard page showing sales data with: a bar chart (monthly sales), a line chart (trend), a pie chart (categories), summary cards at the top, and a data table at the bottom. The data comes from /api/dashboard/stats. Make it visually impressive with animations."

**Repo de depart** : React 18 + Tailwind + recharts (deja installe). API endpoint existant retournant des donnees mock.

**Ce qu'on mesure** :
- Completion : tous les 5 widgets (bar, line, pie, cards, table)
- Quality : composants reutilisables, responsive, data transformation
- Tests : unitaires pour la transformation de donnees
- Visual : animations d'entree, hover tooltips, responsive grid, couleurs coherentes
- Security : pas de raw HTML injection dans les labels

**Pourquoi Maestro devrait gagner** :
- Styling-dev avec Framer Motion pour les animations d'entree
- UI-reviewer verifie l'alignement et l'esthetique
- Task-architect decompose en modules (cards, charts, table) avec deps claires

### Tache 4 : File Explorer Component (Complexite : Elevee)

**Description** : "Build a file explorer component like VS Code's sidebar. It should show a tree structure of files and folders, support expand/collapse, file icons based on extension, search/filter, drag-and-drop for moving files, and context menus (rename, delete, new file). The tree data comes from /api/files."

**Repo de depart** : React 18 + Tailwind + react-dnd (deja installe). API endpoint existant.

**Ce qu'on mesure** :
- Completion : tree view, expand/collapse, icons, search, drag-drop, context menu
- Quality : performance (useMemo pour grands arbres), clean recursion, keyboard navigation
- Tests : unitaires pour tree traversal + composant
- Visual : icons corrects, indentation, hover highlights, animations expand/collapse
- Security : sanitize file names, prevent path traversal in context menu actions

**Pourquoi Maestro devrait gagner** :
- Task-architect identifie la complexite et decoupe correctement
- Frontend-dev specialise gere la recursion et les hooks
- Accessibility-checker verifie keyboard navigation et ARIA tree roles
- Iteration : la premiere version sera probablement imparfaite, la boucle while corrige

### Tache 5 : Full-Stack Feature with Backend (Complexite : Elevee)

**Description** : "Add a real-time notifications system. Backend: WebSocket endpoint that pushes notifications, REST API for notification preferences and history. Frontend: notification bell with badge count, dropdown panel showing recent notifications, settings page for notification preferences. Notifications should animate in and auto-dismiss after 5 seconds."

**Repo de depart** : React 18 + Express + Socket.io (installe) + Tailwind. Structure existante avec header component.

**Ce qu'on mesure** :
- Completion : WebSocket connection, notification display, preferences, history
- Quality : reconnection logic, state management, type safety, error handling
- Tests : unitaires backend (events) + frontend (components) + E2E (notification flow)
- Visual : bell animation, dropdown animation, auto-dismiss, toast-style notifications
- Security : WebSocket auth, notification payload validation

**Pourquoi Maestro devrait gagner** :
- Backend-dev et frontend-dev travaillent sur des fichiers differents (file ownership isolation)
- Research-agent cherche Socket.io best practices
- E2E tester verifie le flow complet (connect, receive, dismiss)
- Styling-dev fait des animations de toast professionnelles

---

## Preparation des repos de test

Chaque repo doit etre prepare avec :

1. **Structure minimale** : package.json, tsconfig, vite config, tailwind config, App.tsx, routing
2. **Dependencies installees** : node_modules present, build qui passe
3. **API mock** : endpoints referencees dans la tache retournent des donnees mock
4. **Git initialise** : `.git/` avec un commit initial "Initial project setup"
5. **Pas de code existant** pour la feature demandee — le repo est un squelette

### Creation automatisee

```bash
# Script de preparation (a executer une fois)
for task in crud auth dashboard explorer notifications; do
  mkdir -p test-repos/$task
  cd test-repos/$task
  npm init vite@latest . -- --template react-ts
  npm install
  npm install tailwindcss @tailwindcss/forms
  # ... setup specifique par tache
  git init && git add -A && git commit -m "Initial project setup"
  cd ../..
done
```

---

## Execution et collecte des resultats

### Avec Maestro Agent v4

```bash
cd test-repos/crud
maestro agent "Add a user management module..." 2>&1 | tee maestro-crud.log
```

Collecter :
- Score code-reviewer (QualityScore per bloc)
- Score security-reviewer
- Score architecture-reviewer
- Score ui-reviewer
- Resultats tests (passed/failed)
- Screenshots
- Nombre d'iterations

### Avec Claude Code brut

```bash
cd test-repos/crud-claude
# Meme tache, meme modele
claude "Add a user management module..."
```

Collecter les memes metriques en executant les reviewers v4 sur le resultat de Claude Code.

### Comparaison — Criteres de qualite

| Tache | Completion | Code Quality | Tests | Visual Quality | Security | Gagnant |
|-------|-----------|-------------|-------|---------------|----------|---------|
| CRUD | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | |
| Auth | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | |
| Dashboard | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | |
| Explorer | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | |
| Notifications | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | M: _ / C: _ | |

**Verdict** : Maestro v4 gagne si meilleur sur 4+ criteres de qualite pour 4+ taches.

---

## Metriques secondaires (informatives — pas decisionnelles pour Tier 1)

| Metrique | Description | Pertinent a partir de |
|----------|-------------|----------------------|
| **Duration** | Temps d'execution total par tache | Tier 2+ (optimisation) |
| **Token usage** | Nombre total de tokens (input + output) par tache | Tier 2+ (cout) |
| **Cost** | Cout en dollars par tache | Tier 2+ (cout) |
| **Iterations needed** | Combien de cycles implement→review avant approbation | Tier 1 (informatif) |
| **Human interventions** | Nombre de fois ou l'interaction-handler a demande a l'humain | Tier 1 (informatif) |
| **Memory effectiveness** | Sur la 2e execution sur le meme repo, QualityScore est-il plus eleve ? | Tier 1 (informatif) |

---

## Criteres de reussite globaux

### Tier 1 est valide si :

1. **4/5 taches** completees avec succes (compile, tests passent, commit)
2. **Score code-reviewer moyen** >= 0.80 sur les 5 taches
3. **Meilleur que Claude Code brut** sur 4+ criteres de qualite pour 4+ taches
4. **Aucune vulnerability critique** detectee par security-reviewer
5. **Interaction-handler fonctionnel** : au moins 1 scenario d'interruption teste avec succes

### Tier 1 est exceptionnel si (en plus) :

1. **5/5 taches** completees avec succes
2. **Score code-reviewer moyen** >= 0.85
3. **Visual quality** evaluee "bon" ou "excellent" par un humain
4. **E2E tests passent** pour toutes les taches avec UI
5. **Memory** : la 2e execution sur le meme repo montre un QualityScore plus eleve

### QualityBaseline

Le QualityScore_global mesure sur les 5 taches Tier 1 devient le **QualityBaseline** — la reference absolue pour la degradation en Tiers 2+ (voir [11-fitness-criteria.md](11-fitness-criteria.md)).
