# Notes d'analyse — Repos de test 34-E

**Date** : 2026-02-20
**Objectif** : Comparer le travail fait par Maestro agent vs Claude CLI sur les repos de test

---

## Structure des repos

Les repos `xxx` sont les originaux (template). Les repos `xxx-claude` sont les copies pour Claude CLI.

Repos : auth, crud, dashboard, explorer, notifications (x2 = 10 total)

### Repos originaux (templates)
- Chaque repo : React 18 + TypeScript + Vite + Tailwind + Express mock API
- Un seul commit initial : "Initial project setup"
- Build passe pour les 5

### Repos Claude CLI (-claude)
- Copie des originaux + un commit de feature chacun
- Pas de `.maestro/` directory (normal — Claude CLI natif, pas Maestro)

### Maestro sessions
- `.maestro/sessions/` UNIQUEMENT dans `test-repos/crud/` (12 sessions JSON)
- Les sessions de test E2E Run 1-3 ont ete executees sur `crud/` (pas `crud-claude`)
- Les repos originaux etaient destines au workflow Maestro, les `-claude` a Claude CLI natif

---

## Git logs

| Repo | Commits | Dernier commit |
|------|---------|----------------|
| crud | 1 | `cd68a6e` Initial project setup |
| crud-claude | 2 | `568aacc` feat: Add user management module with CRUD operations |
| auth | 1 | `9a712eb` Initial project setup |
| auth-claude | 2 | `167d35d` feat: implement JWT auth flow with login, register, protected routes |
| dashboard | 1 | `f436488` Initial project setup |
| dashboard-claude | 2 | `a0e6c5f` feat: implement data visualization dashboard |
| explorer | 1 | `8375820` Initial project setup |
| explorer-claude | 2 | `3b2ec41` feat: implement file explorer with tree view |
| notifications | 1 | `5c66923` Initial project setup |
| notifications-claude | 2 | `1964ba0` feat: implement notification system with bell, panel, toasts |

---

## Etat du repo crud (Maestro target)

Apres 12 sessions Maestro (3 E2E runs + 9 sessions de test isole) :
- `package.json` modifie (npm install pour bcryptjs, jsonwebtoken)
- `package-lock.json` modifie (+150 lignes)
- **ZERO fichier TypeScript cree**
- Seul le step 2 (add-dependency) a fonctionne
- Les fichiers de code n'ont pas ete crees a cause du bug file-write

### Analyse de la session Run 3 (8b80d7cc)

Phases Maestro :
1. Prepare : DONE — project-analyzer a lu la structure
2. Plan : DONE — task-planner a genere 10 steps detailles (auth system complet)
3. Validate : DONE — json-validator a accepte le plan
4. Implement : DONE (marque done mais 9/10 items SKIPPED a cause du checkpoint bug)
5. Test : ERROR — LLM-Provider InternalServerError
6. Review : PENDING (jamais atteint)
7. Commit : PENDING (jamais atteint)

Le plan genere etait EXCELLENT (10 steps, types, deps, config, utils, repo, service, middleware, controller, route mounting) mais :
- Item 1 (types/auth.types.ts) : implement-single-step a echoue
  - Tentative 1 : `--input content="export interface..."` → "Missing required input: content" (CliParser bug)
  - Tentative 2 : LLM a essaye `<invoke name="Write">` (XML format) → JSON parse error
  - Tentative 3 : `--input-json {...}` tronque → JSON parse error "depth zero"
  - Tentative 4 : `--input path=X --input content=placeholder` → "Missing required input: path" (repeated --input bug)
  - Boucle de detection atteinte : "loop detected (same call repeated 3x)"
- Item 2 (package.json) : SEUL item qui a PARTIELLEMENT fonctionne — npm install a ajoute les deps
- Items 3-10 : SKIPPED par le checkpoint resume bug (Fix #17)

---

## Analyse Claude CLI — crud-claude

**Commit** : `568aacc` — "feat: Add user management module with CRUD operations"
**Fichiers** : 7 files, +411 insertions, -15 deletions

### Fichiers crees/modifies
| Fichier | Lignes | Role |
|---------|--------|------|
| `src/types.ts` | +6 | Interface User (id, name, email) |
| `src/api.ts` | +46 | Client API (getUsers, createUser, updateUser, deleteUser) |
| `src/components/UserCard.tsx` | +48 | Carte utilisateur avec boutons edit/delete |
| `src/components/UserForm.tsx` | +112 | Formulaire create/edit avec validation |
| `src/components/UserList.tsx` | +48 | Liste paginee d'utilisateurs |
| `src/App.tsx` | +102/-15 | Integration composants, state management |
| `server/index.ts` | +64/-0 | Endpoints REST CRUD |

### Qualite
- **Completude** : CRUD complet (Create, Read, Update, Delete) fonctionnel
- **Architecture** : Separation propre (types, api, components, server)
- **TypeScript** : Typage correct, interfaces definies
- **UI** : Composants React fonctionnels avec Tailwind
- **Backend** : Express avec in-memory store, validation basique
- **Bugs trouves** : Aucun bug bloquant
- **Production-ready** : Non (in-memory store, pas de tests) mais fonctionnel
- **Score** : 8.5/10

---

## Analyse Claude CLI — auth-claude

**Commit** : `167d35d` — "feat: implement JWT auth flow with login, register, protected routes"
**Fichiers** : 10 files, +1085 insertions, -49 deletions

### Fichiers crees/modifies
| Fichier | Lignes | Role |
|---------|--------|------|
| `src/types.ts` | +34 | Types auth (User, LoginPayload, etc.) |
| `src/types/auth.ts` | +30 | Types auth dupliques (!) |
| `src/api.ts` | +58 | Client API generique |
| `src/api/auth.ts` | +47 | Client API auth specifique |
| `src/context/AuthContext.tsx` | +182 | Provider React pour auth state |
| `src/components/LoginForm.tsx` | +202 | Formulaire login avec validation |
| `src/components/RegisterForm.tsx` | +279 | Formulaire register avec validation |
| `src/components/ProtectedRoute.tsx` | +48 | Guard route avec redirect |
| `src/pages/DashboardPage.tsx` | +181 | Page dashboard protegee |
| `src/App.tsx` | +73/-49 | Router setup, auth integration |

### Qualite
- **Completude** : Flow auth complet (login, register, protected routes, logout)
- **Architecture** : Context/Provider pattern pour auth state
- **Bugs critiques** :
  - Types dupliques (`src/types.ts` ET `src/types/auth.ts`) — confusion
  - `api.ts` et `api/auth.ts` — deux clients API partiellement redondants
  - Session restore potentiellement cassee (pas de verification du token au load)
- **UI** : Forms bien structures avec validation client-side
- **Score** : 7/10 (bugs de coherence)

---

## Analyse Claude CLI — dashboard-claude

**Commit** : `a0e6c5f` — "feat: implement data visualization dashboard with charts, stats cards, and orders table"
**Fichiers** : 11 files, +840 insertions, -53 deletions

### Fichiers crees/modifies
| Fichier | Lignes | Role |
|---------|--------|------|
| `src/types.ts` | +37 | Types (DashboardStats, SalesData, Order, etc.) |
| `src/api.ts` | +44 | Client API |
| `src/components/KPICard.tsx` | +52 | Carte KPI avec trend indicator |
| `src/components/StatCard.tsx` | +66 | Carte statistique avec mini-chart |
| `src/components/SalesChart.tsx` | +88 | Graphique ventes (recharts) |
| `src/components/CategoryChart.tsx` | +131 | Graphique categories (bar/pie) |
| `src/components/OrdersTable.tsx` | +149 | Table commandes avec tri/filtre |
| `src/components/PeriodFilter.tsx` | +39 | Filtre de periode |
| `src/components/ErrorState.tsx` | +35 | Composant erreur |
| `src/App.tsx` | +142/-53 | Layout dashboard complet |
| `server/index.ts` | +110/-0 | API stats/orders/categories |

### Qualite
- **Completude** : Dashboard complet avec stats, charts, table, filtres
- **Architecture** : Bien structure, composants reutilisables
- **Bug critique** : Mismatch API endpoints
  - Frontend appelle `/api/dashboard/stats`, `/api/dashboard/sales`, etc.
  - Backend expose `/api/stats`, `/api/orders`, `/api/categories` (PAS le prefix `/dashboard/`)
  - **Le dashboard est NON-FONCTIONNEL** tel quel — les requetes 404
- **UI** : Bon design system, responsive
- **Score** : 6/10 (beau mais casse)

---

## Analyse Claude CLI — explorer-claude

**Commit** : `3b2ec41` — "feat: implement file explorer with tree view, context menu, breadcrumb, and keyboard navigation"
**Fichiers** : 12 files, +1379 insertions

### Fichiers crees/modifies
| Fichier | Lignes | Role |
|---------|--------|------|
| `src/types.ts` | +48 | Types FileNode |
| `src/types/FileTree.ts` | +44 | Types FileTree dupliques |
| `src/api.ts` | +46 | Client API |
| `src/api/fetchFileTree.ts` | +32 | Fetch specifique |
| `src/hooks/useFileTree.ts` | +193 | Hook principal avec state + keyboard |
| `src/components/FileTree.tsx` | +171 | Arbre de fichiers |
| `src/components/TreeNode.tsx` | +164 | Noeud d'arbre recursif |
| `src/components/Breadcrumb.tsx` | +54 | Breadcrumb navigation |
| `src/components/ContextMenu.tsx` | +142 | Menu contextuel click droit |
| `src/components/FilePreview.tsx` | +157 | Preview de fichier |
| `src/components/FileIcon.tsx` | +112 | Icones par type |
| `src/utils/fileUtils.ts` | +216 | Utilitaires fichiers |

### Qualite
- **Completude** : Composants riches MAIS App.tsx NON MODIFIE
  - `App.tsx` reste le placeholder Vite par defaut
  - Les composants existent mais ne sont JAMAIS montes
  - **L'application ne fonctionne pas** — rien n'est visible
- **Architecture** : Bonne separation (hooks, composants, utils, types)
- **Types dupliques** : `src/types.ts` et `src/types/FileTree.ts` — meme probleme que auth
- **API dupliquee** : `src/api.ts` et `src/api/fetchFileTree.ts`
- **Score** : 4/10 (composants ok mais app non fonctionnelle, ~40% complete)

---

## Analyse Claude CLI — notifications-claude

**Commit** : `1964ba0` — "feat: implement notification system with bell, panel, toasts, and preferences"
**Fichiers** : 17 files, +1436 insertions, -15 deletions

### Fichiers crees/modifies
| Fichier | Lignes | Role |
|---------|--------|------|
| `src/types.ts` | +35 | Types Notification |
| `src/types/notification.ts` | +24 | Types dupliques |
| `src/api.ts` | +76 | Client API |
| `src/api/notifications.ts` | +33 | API specifique |
| `src/context/NotificationContext.tsx` | +216 | Provider avec WebSocket simulation |
| `src/hooks/useNotifications.ts` | +154 | Hook principal |
| `src/hooks/useNotificationPreferences.ts` | +45 | Hook preferences |
| `src/hooks/useToasts.ts` | +58 | Hook toasts |
| `src/components/NotificationBell.tsx` | +43 | Icone cloche avec badge |
| `src/components/NotificationItem.tsx` | +115 | Item notification |
| `src/components/NotificationPanel.tsx` | +94 | Panel notifications |
| `src/components/PreferencesPanel.tsx` | +115 | Panel preferences |
| `src/components/Toast.tsx` | +74 | Toast notification |
| `src/components/ToastContainer.tsx` | +18 | Container toasts |
| `src/index.css` | +72 | Styles animations |
| `src/App.tsx` | +188/-15 | Integration complete |
| `server/index.ts` | +91/-0 | API notifications |

### Qualite
- **Completude** : Systeme complet — bell, panel, toasts, preferences, context
- **Architecture** : Excellente separation (context, hooks, composants)
- **Bug** : Mismatch API paths
  - Frontend : `/api/notifications` (dans api.ts)
  - Backend : `/api/notifications` MAIS aussi des routes `/api/notification/preferences` (singulier vs pluriel inconsistant)
  - Moins grave que dashboard — la plupart des routes fonctionnent
- **UI** : Systeme riche avec animations CSS, toasts, badge count
- **Score** : 8/10

---

## Resultats Maestro (crud repo — seul repo teste)

### Ce qui a fonctionne
- **Planning** : Plan detaille de 10 steps avec types, deps, utils, services, middleware, controller, routes
- **Validation** : JSON validator a accepte le plan
- **Decomposition** : for-each a correctement extrait 10 items
- **Phase tracking** : Phases visibles et mises a jour dans le monitor

### Ce qui a echoue
- **File writing** : 0 fichiers TypeScript crees sur 10 tentatives
- **Tool calling** : Agent ne sait pas utiliser `--input-json` de maniere fiable
- **Checkpoint** : Items 2-10 SKIPPED (bug fix #17 — resolu mais pas re-teste E2E)
- **Error recovery** : Pas de retry intelligent apres echec file-write

### Resultat net
- `package.json` : modifie (deps ajoutees) — 1 step sur 10
- Fichiers TypeScript : 0 crees — 0 steps sur 10
- **Completion** : ~10% (1/10 steps)
- **Cout** : ~$30+ sur 3 runs E2E

---

## Patterns observes dans Claude CLI

### Pattern positif : Completude de bout en bout
Claude CLI cree tous les fichiers necessaires en un seul commit atomique. Pas de plan intermediaire, pas de phases — execution directe.

### Pattern negatif recurrent : Types dupliques
4 repos sur 5 ont des types dupliques :
- `src/types.ts` ET `src/types/auth.ts` (auth-claude)
- `src/types.ts` ET `src/types/FileTree.ts` (explorer-claude)
- `src/types.ts` ET `src/types/notification.ts` (notifications-claude)
- Seul crud-claude n'a pas ce probleme

### Pattern negatif recurrent : API dupliquee
3 repos sur 5 ont des clients API dupliques :
- `src/api.ts` ET `src/api/auth.ts` (auth-claude)
- `src/api.ts` ET `src/api/fetchFileTree.ts` (explorer-claude)
- `src/api.ts` ET `src/api/notifications.ts` (notifications-claude)

### Pattern negatif recurrent : Mismatch API endpoints
2 repos sur 5 ont des mismatches frontend/backend :
- dashboard-claude : frontend `/api/dashboard/stats` vs backend `/api/stats` — **NON FONCTIONNEL**
- notifications-claude : inconsistance singulier/pluriel — partiellement fonctionnel

### Pattern negatif : App.tsx non modifie
- explorer-claude : composants riches mais App.tsx = placeholder Vite — **NON FONCTIONNEL**
