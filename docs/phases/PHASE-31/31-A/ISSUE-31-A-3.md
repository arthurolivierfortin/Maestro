# Issue 31-A-3 : Widgets TUI pour le mode code

**Statut** : A faire
**Estimation** : 2-3 heures
**Bloquant** : Non
**Prerequis** : 31-A-1 (commande maestro code fonctionne)

---

## Description

Reutiliser et adapter les composants du moniteur TUI pour le mode `maestro code`. Les widgets montrent la progression en temps reel.

---

## Tache detaillee

### 1. Widgets a reutiliser

Depuis `maestro-cli/monitor/ink/` et `shared/tui/` :

| Widget | Usage dans maestro code | Source |
|--------|------------------------|--------|
| ExecutionTree | Arbre du workflow en cours | Composant moniteur existant |
| LLMActivity | Appels LLM en cours (modele, duree) | Composant moniteur existant |
| PlanView | Les steps du plan, cochees au fur et a mesure | **NOUVEAU** |
| FileChanges | Diff courant (fichiers modifies) | **NOUVEAU** |

### 2. PlanView (nouveau widget)

Affiche le plan produit par le `task-planner` :

```
  Plan (5/7 completed):
  ✓ 1. [types]    Create User interface
  ✓ 2. [backend]  Create user service
  ✓ 3. [api]      Create API client
  ✓ 4. [frontend] Create useUsers hook
  → 5. [frontend] Create UserList component
    6. [test]     Tests for service
    7. [test]     Tests for component
```

**Implementation** :
- Lit `_nodeResult_plan` (les steps du plan)
- Lit `_executionTree` pour savoir quel step est en cours
- Coche les steps termines
- Fleche sur le step en cours

### 3. FileChanges (nouveau widget)

Affiche les fichiers modifies par l'agent :

```
  Changes:
  + src/types/User.ts            (created)
  + src/services/userService.ts  (created)
  ~ src/App.tsx                  (modified)
```

**Implementation** :
- Lit les `_nodeResult_implement-step-X` pour les fichiers modifies
- Ou : execute `git status` periodiquement dans le repo

### 4. Layout du mode code

```
┌──────────────────────────┬──────────────────────────┐
│  Plan View               │  Execution Tree          │
│  (steps + progress)      │  (workflow nodes)         │
├──────────────────────────┴──────────────────────────┤
│  File Changes                                        │
├─────────────────────────────────────────────────────┤
│  > User input / Agent messages                       │
└─────────────────────────────────────────────────────┘
```

---

## Instructions de test

### Test 1 : Widgets affichent des donnees

```bash
cd C:\Cantante
node C:\Meastro\maestro-cli\index.js code
> Create a hello module with tests
```

- [ ] Le PlanView affiche les steps
- [ ] L'ExecutionTree montre les noeuds du workflow
- [ ] Le FileChanges montre les fichiers modifies
- [ ] Les widgets se mettent a jour en temps reel

### Test 2 : PlanView progression

- [ ] Les steps termines sont coches (✓)
- [ ] Le step en cours a une fleche (→)
- [ ] Le compteur "X/Y completed" est correct

### Test 3 : Taille du terminal

- [ ] Les widgets s'adaptent a la taille du terminal
- [ ] Pas de debordement visuel

---

## Critere de completion

- [ ] PlanView widget fonctionnel (affiche les steps, coche les termines)
- [ ] FileChanges widget fonctionnel (affiche les fichiers modifies)
- [ ] ExecutionTree reutilise du moniteur
- [ ] LLMActivity reutilise du moniteur
- [ ] Le layout est lisible et s'adapte au terminal
- [ ] Les widgets se mettent a jour en temps reel (polling 2s)

---

## Risques

- **Risque** : Les widgets du moniteur ne sont pas reutilisables en dehors du contexte moniteur
- **Mitigation** : Les widgets utilisent des hooks generiques (`usePolling`, `useSessionData`). Verifier la compatibilite.
- **Risque** : Trop d'informations sur un petit terminal
- **Mitigation** : Le PlanView et FileChanges sont scrollables. Les zones ont des tailles minimales.
