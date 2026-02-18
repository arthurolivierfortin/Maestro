# Issue P1-A : Fix TUI Monitor Phase Display for Project Sessions

**Priorite** : P1 (broken functionality)
**Estimation** : 2-3 heures
**Bloque** : Rien
**Bloque par** : Rien

---

## Probleme

Le TUI monitor n'affiche pas correctement les phases actives pour les sessions de type `project-autonomous`.

### Cause racine

Le template `project-autonomous.session.json` definit `_phases` avec 6 phases generiques :
- prepare, plan, implement, test, review, commit

Le workflow `autonomous-development` utilise `for-each` avec des nodes comme `store-plan`, `implement-steps`, etc. Ces IDs de nodes ne correspondent PAS aux IDs de phases dans `_phases`.

`UpdatePhaseStatus()` est appele avec les IDs des nodes du workflow, pas ceux de `_phases`. Resultat : les phases restent indefiniment en statut initial.

### Fichiers concernes

| Fichier | Role |
|---------|------|
| `content/system/templates/sessions/project-autonomous.session.json` | Definit `_phases` avec IDs generiques |
| `content/system/blocks/workflows/autonomous-development.workflow.block.json` | Definit les nodes du workflow (IDs differents) |
| `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs:176-206` | `InitializeFromSessionData` + `UpdatePhaseStatus()` |
| `maestro-cli/monitor/ink/components/SessionMonitor.ts` | Affiche les phases depuis `_phases` |

---

## Options de correction

### Option A : Aligner les IDs (recommande)

Modifier `project-autonomous.session.json` pour que les `_phases` utilisent les memes IDs que les nodes du workflow.

```json
"_phases": [
  {"id": "prepare-context", "name": "Prepare", "status": "pending"},
  {"id": "create-plan", "name": "Plan", "status": "pending"},
  {"id": "validate-plan", "name": "Validate Plan", "status": "pending"},
  {"id": "implement-steps", "name": "Implement", "status": "pending"},
  {"id": "run-tests", "name": "Test", "status": "pending"},
  {"id": "review-code", "name": "Review", "status": "pending"},
  {"id": "git-commit", "name": "Commit", "status": "pending"}
]
```

**Avantage** : Simple, pas de changement backend.
**Inconvenient** : Couple les phases a la structure interne du workflow.

### Option B : Deriver le statut depuis l'execution tree

Le monitor lit `_executionTree` (qui est toujours mis a jour). Au lieu de lire `_phases[].status`, le monitor pourrait deriver le statut de chaque phase en mappant les nodes de l'arbre d'execution aux phases.

**Avantage** : Decouple les phases de la structure du workflow.
**Inconvenient** : Plus complexe. Necessite un mapping node→phase dans le template.

### Option C : Mise a jour explicite dans le workflow

Ajouter des nodes `set-variable` dans le workflow qui mettent a jour `_phases[n].status` explicitement a chaque transition.

**Avantage** : Controle total sur les transitions de phases.
**Inconvenient** : Alourdit le workflow JSON. Chaque workflow doit gerer ses propres transitions.

---

## Recommandation

**Option A** est la plus pragmatique. Les phases sont deja un concept d'affichage — les aligner avec les nodes du workflow est la bonne approche. Si un workflow a 8 nodes mais l'utilisateur veut voir 5 phases, les IDs de phases correspondent aux nodes "significatifs" du workflow.

---

## Criteres de completion

- [ ] Les phases dans `_phases` correspondent aux nodes du workflow
- [ ] Lancer le monitor, invoquer le workflow, verifier que les phases passent de `pending` → `running` → `done`
- [ ] Chaque phase s'allume au bon moment (pas toutes en meme temps)
- [ ] Le monitor affiche correctement les phases pour les sessions foundry existantes (non-regression)
