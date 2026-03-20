# 63-FIX2 : Qualite des widgets — Compact mais fonctionnel

**Statut** : A FAIRE
**Effort** : 2-3 jours
**Prerequis** : 63-FIX DONE

---

## Contexte

Les 13 widgets crees en 63-B sont des reimplementations simplifiees a 20-50% de couverture des pages originales. Le concept de version minimale est correct — un widget inline dans un chat ne devrait pas etre une page fullscreen compressee. Mais les versions minimales actuelles sont **cassees** : rendu corrompu, interactions manquantes, contenu insuffisant.

### Principe : compact mais fonctionnel

Chaque widget doit :
1. **Afficher un contenu utile** — pas juste un titre et 3 champs
2. **Avoir ses interactions de base** — j/k scroll, Enter ouvre, Space expand, Esc ferme
3. **Rendre proprement** — pas d'artefacts, pas de texte corrompu, pas de timestamps tronques
4. **Etre teste sur le vrai TUI** via MCP (pas juste vitest)

---

## Problemes de rendu globaux (a corriger en premier)

### R1. Timestamps tronques
`21:46:1` au lieu de `21:46:13`.

**Cause** : `SessionManager.ts` fonction `ts()` utilise `toISOString().slice(11, 19)` mais le rendu tronque probablement a cause de `padEnd` ou d'une largeur fixe.

**Fichier** : `packages/maestro-code/services/SessionManager.ts` et `packages/maestro-code/components/ConversationLog.ts`

**Fix** : verifier que le timestamp `HH:MM:SS` (8 chars) est rendu en entier. Chercher toute troncature dans ConversationLog.

### R2. Lignes vides excessives
Chaque etape de la conversation est separee par une ligne vide. Ca prend trop de place verticale.

**Cause** : probablement un `marginBottom: 1` ou un rendu de lignes vides dans le buffer.

**Fichier** : `packages/maestro-code/components/ConversationLog.ts`

**Fix** : les etapes consecutives (✓ Analyze, ✓ Design, etc.) ne devraient PAS avoir de ligne vide entre elles. Une ligne vide seulement entre les groupes (user message → steps → agent response).

### R3. Texte corrompu dans les widgets
`erroreted` (error + completed melanges), noms tronques.

**Cause** : les colonnes de texte ne sont pas alignees avec des largeurs fixes. Quand le status "error" est plus court que "completed", l'ancien texte reste visible (probleme de trailing spaces Ink).

**Fichier** : les widgets qui affichent des listes (StatusWidget, SessionsWidget, etc.)

**Fix** : utiliser `padEnd(width)` pour chaque colonne dans les rows de listes. Assurer que chaque champ a une largeur fixe.

### R4. Contenu agent disparu
"Agent:" suivi de lignes vides — le texte de la reponse a disparu.

**Cause** : probablement un probleme de wrap/overflow qui cache le contenu multi-ligne.

**Fichier** : `packages/maestro-code/components/ConversationLog.ts`

**Fix** : verifier le rendu des messages agent multi-lignes. Le texte doit wrapper correctement.

---

## Contrats minimaux par widget

Chaque widget a un contrat minimal qui definit exactement ce qu'il doit montrer et quelles interactions il doit supporter.

### W1. StatusWidget — System health + sessions

**Contenu** :
- Ligne 1 : Backend status (✓/✗) + LLM status (✓/✗ + model name)
- Ligne 2 : Providers count + Sessions count (total + running)
- Lignes 3+ : Session list (max 8, scrollable avec j/k)
  - Chaque session : `[status_icon] [name padEnd(28)] [id 8chars] [status padEnd(10)]`

**Interactions** :
- j/k : navigate la liste
- Enter : ouvre SessionMonitorWidget pour la session selectionnee
- Esc : ferme le widget

**Validation MCP** :
- [ ] Widget s'affiche avec health + sessions
- [ ] j/k change la selection (→ bouge)
- [ ] Enter ouvre un SessionMonitorWidget
- [ ] Pas de texte corrompu dans les status

---

### W2. SessionsWidget — Sessions list

**Contenu** :
- Header : count + filter toggle `[r]`
- Session list (max 12, scrollable avec j/k) :
  - `[status_icon] [name padEnd(30)] [id 8chars] [status padEnd(10)] [$cost] [duration] [+N children]`
- Detail expand (Space sur un item) :
  - Full ID
  - Children list (indented)
  - Fitness bar + percentage
  - Active workflow name

**Interactions** :
- j/k : navigate
- Space : expand/collapse detail de l'item selectionne
- Enter : ouvre SessionMonitorWidget
- r : toggle filter running/all
- d : delete session (avec confirmation inline "Delete? y/n")
- Esc : ferme le widget

**Validation MCP** :
- [ ] Liste s'affiche avec toutes les sessions
- [ ] j/k navigation fonctionne
- [ ] Space expand les details
- [ ] r toggle le filtre
- [ ] Enter ouvre le monitor
- [ ] Pas de texte corrompu

---

### W3. WorkspacesWidget — Workspace list

**Contenu** :
- Workspace list (max 10, scrollable) :
  - `[status_icon] [name padEnd(30)] [id 8chars]`

**Interactions** :
- j/k : navigate
- Enter : ouvre WorkspaceDetailWidget
- Esc : ferme

**Validation MCP** :
- [ ] Liste s'affiche
- [ ] j/k et Enter fonctionnent

---

### W4. ReposWidget — Repo list

**Contenu** :
- Repo list (max 10, scrollable) :
  - `[status_icon] [name padEnd(30)] [id 8chars] [path]`

**Interactions** :
- j/k : navigate
- Enter : ouvre RepoDetailWidget
- Esc : ferme

**Validation MCP** :
- [ ] Liste s'affiche
- [ ] j/k et Enter fonctionnent

---

### W5. CatalogWidget — Block catalog

**Contenu** :
- Filter tabs : `[1] All [2] Workflows [3] Agents [4] Tools`
- Block list (max 12, scrollable) :
  - `[type_badge] [name padEnd(28)] [id padEnd(20)] [fitness_bar] [fitness_%]`
- Detail expand (Space) :
  - Description (full, wrapped)
  - Version + atomic flag
  - Capabilities : `[cap1] [cap2]`
  - Contract ID

**Interactions** :
- j/k : navigate
- 1/2/3/4 : filter par type
- Space : expand/collapse detail
- T : lancer contract test (affiche resultat inline)
- Enter : ouvre BlockDetailWidget
- Esc : ferme

**Validation MCP** :
- [ ] Liste avec fitness bars
- [ ] 1/2/3/4 filtre les types
- [ ] Space expand les details
- [ ] j/k navigation
- [ ] Enter ouvre le detail

---

### W6. FoundryWidget — My blocks

**Contenu** :
- Header : count par type `N block(s) (X agent, Y tool, ...)`
- Block list (max 10, scrollable) :
  - `[type_badge] [name padEnd(28)] [id padEnd(20)]`
- Detail expand (Space) :
  - Description
  - Version + atomic

**Interactions** :
- j/k : navigate
- Space : expand/collapse
- Enter : ouvre BlockDetailWidget
- Esc : ferme

**Validation MCP** :
- [ ] Liste avec type badges
- [ ] Space expand
- [ ] Enter ouvre detail

---

### W7. ModelsWidget — Models + health

**Contenu** :
- Ligne 1 : Status (Online/Offline) + Active model
- Ligne 2 : Requests + Tokens + p50 latency + Error rate
- Model list (scrollable) :
  - `[status_icon] [name padEnd(28)] [provider_badge] [(active)]`

**Interactions** :
- j/k : navigate
- Enter : ouvre ModelDetailWidget
- P : ouvre playground (si implemente)
- Esc : ferme

**Validation MCP** :
- [ ] Health + metrics affiches
- [ ] Model list avec provider badges
- [ ] j/k navigation
- [ ] Enter ouvre detail

---

### W8. SessionMonitorWidget — Session resume compact

Ce widget ne devrait PAS reproduire le vrai SessionMonitor multi-panel. C'est un **resume compact** de la session.

**Contenu** :
- Ligne 1 : Session name + status + duration + cost
- Ligne 2 : Active workflow ou "idle"
- Ligne 3 : Current node/phase (si en cours)
- Ligne 4 : Last 3 tool calls ou execution steps
- Ligne 5+ : PermissionsPanel (si pertinent)
- Footer : "Full monitor: /session <id> --full" (pour le futur fullscreen mode)

**Interactions** :
- Esc : ferme
- (Lecture seule pour V1 — le vrai monitor multi-panel est un objectif futur)

**Validation MCP** :
- [ ] Resume affiche avec info utile
- [ ] Pas de placeholder vide

---

### W9. BlockDetailWidget — Block info

**Contenu** :
- Type badge + name + version + atomic
- Description (full, wrapped)
- Contract ID + capabilities
- Fitness : bar + score (si disponible)
- Tools requis (config.nodes extraction)

**Interactions** :
- Esc : ferme
- (Lecture seule)

**Validation MCP** :
- [ ] Info complete affichee
- [ ] Description wrappee correctement

---

### W10. ModelDetailWidget — Model info

**Contenu** :
- Status + name + provider
- Metriques : requests, tokens, latency, errors
- Availability

**Interactions** :
- P : playground
- Esc : ferme

**Validation MCP** :
- [ ] Info affichee
- [ ] Metriques presentes

---

### W11. WorkspaceDetailWidget — Workspace info

**Contenu** :
- Workspace name + ID
- Session list (max 8, scrollable)
- PermissionsPanel (ceiling)

**Interactions** :
- j/k : navigate sessions
- Enter : ouvre SessionMonitorWidget
- Esc : ferme

**Validation MCP** :
- [ ] Sessions listees
- [ ] Permissions affichees

---

### W12. RepoDetailWidget — Repo info

**Contenu** :
- Repo name + path + status
- Session list (max 8, scrollable)

**Interactions** :
- j/k : navigate sessions
- Enter : ouvre SessionMonitorWidget
- Esc : ferme

**Validation MCP** :
- [ ] Info affichee
- [ ] Sessions listees

---

### W13. PermissionsWidget — Permissions diff

Deja fonctionnel (wrapper de PermissionsPanel). Pas de changement necessaire.

---

## Outils a mettre en place

### O1. Validation MCP systematique

Chaque widget doit etre teste via le MCP TUI server (tui_spawn, tui_type, tui_press, tui_check, tui_frame). Les tests unitaires (vitest) ne suffisent PAS — vitest ≠ real app.

**Process pour chaque widget** :
1. `tui_spawn` (demo mode)
2. `tui_type` le slash command
3. `tui_press` Enter
4. `tui_frame` — verifier le contenu
5. `tui_press` j/k — verifier la navigation
6. `tui_press` Enter — verifier l'action
7. `tui_check` pour des textes specifiques (noms, status, etc.)
8. `tui_press` Escape — verifier la fermeture

### O2. Widget test helper

Creer un helper partage pour tester les widgets qui :
- Genere des donnees mock coherentes (sessions, blocks, models)
- Verifie le format des colonnes (padEnd, alignment)
- Verifie qu'il n'y a pas de texte corrompu (regex pour detecter les melanges comme `erroreted`)

### O3. ConversationLog rendering tests

Ajouter des tests specifiques pour le rendu du ConversationLog :
- Timestamp format : exactement `HH:MM:SS` (8 chars)
- Pas de lignes vides consecutives entre les etapes
- Texte agent multi-ligne wrape correctement
- Widget inline ne corrompt pas les lignes adjacentes

---

## Ordre d'execution

1. **Rendu global** (R1-R4) — corriger les problemes de rendu dans ConversationLog et les templates de lignes
2. **Widgets interactifs** (W1-W7) — corriger/completer chaque widget avec son contrat minimal
3. **Widgets detail** (W8-W12) — corriger les detail widgets
4. **Outils** (O1-O3) — mettre en place les helpers de test
5. **Validation MCP** — tester chaque widget sur le vrai TUI

---

## Definition of Done

- [ ] Timestamps complets (HH:MM:SS, 8 chars)
- [ ] Pas de lignes vides excessives entre les etapes
- [ ] Pas de texte corrompu dans les widgets (pas de `erroreted` etc.)
- [ ] Contenu agent multi-ligne wrape correctement
- [ ] Chaque widget respecte son contrat minimal (contenu + interactions)
- [ ] j/k navigation fonctionne dans tous les widgets interactifs
- [ ] Space expand fonctionne dans SessionsWidget, CatalogWidget, FoundryWidget
- [ ] Enter ouvre le sous-widget correct
- [ ] Esc ferme le widget
- [ ] Colonnes alignees avec padEnd dans les listes
- [ ] Valide visuellement via MCP sur le vrai TUI
- [ ] `npx tsc --noEmit` : 0 erreurs
- [ ] Tests unitaires passent
