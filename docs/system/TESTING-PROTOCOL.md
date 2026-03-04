# Testing Protocol — Validation obligatoire par couches

**Version** : 1.0
**Obligatoire** : OUI — chaque phase DOIT suivre ce protocole avant de declarer DONE.
**Reference** : `AGENT-PROTOCOL.md` Regle 2c renvoie a ce fichier.

---

## Pourquoi ce protocole existe

- vitest passing ≠ feature works (incident Phase 41-PRE, prouve 3 fois)
- headless mode ≠ TUI testing (incident Phase 44)
- `dotnet build` success ≠ API correcte (incident Phase 47)
- "Ca marche" sans preuves = hallucination (Regle 4 de l'Agent Protocol)

Un agent qui declare DONE sans avoir execute TOUTES les couches applicables **viole le protocole**.

---

## Les 6 couches

### Couche 1 : Type Check (TOUJOURS obligatoire)

Chaque fichier modifie doit etre type-checke. Pas d'exceptions.

```bash
# TypeScript (pour chaque package modifie)
cd packages/<package> && npx tsc --noEmit

# C# (si backend modifie)
cd apps/backend && dotnet build
```

**Regle absolue** : JAMAIS de `@ts-nocheck`. Si le type check echoue, CORRIGER avant de continuer.

### Couche 2 : Tests unitaires (TOUJOURS obligatoire)

**Deux obligations** :

1. **Tests existants** : tous les tests pre-existants doivent continuer a passer
2. **Nouveaux tests** : chaque feature ajoutee DOIT avoir au moins un test unitaire

```bash
# Executer les tests du package modifie
cd packages/<package> && npx vitest run

# Pour le backend
cd apps/backend && dotnet test
```

**L'agent DOIT lister dans le checkpoint** :
- Nombre de tests avant / apres
- Noms des tests crees
- Output complet de la commande de test (tronque si > 50 lignes)

### Couche 3 : Visual Gate — PTY (obligatoire si TUI modifie)

vitest ne teste PAS le rendu reel. Le visual gate spawne le TUI dans un PTY et verifie la structure.

```bash
cd packages/maestro-code && npm run test:visual
```

**Quand c'est obligatoire** :
- Nouveau composant TUI
- Modification d'un composant existant
- Modification de App.ts
- Modification du layout ou de la navigation

**L'agent DOIT mettre a jour les assertions** si de nouveaux panels/pages sont ajoutes.

### Couche 4 : Real Demo Check (obligatoire si TUI modifie)

Verifie la resolution de modules CJS → ESM dans le vrai runtime. Attrape les bugs invisibles a vitest.

```bash
cd packages/maestro-code && node tests/real-demo-check.cjs
```

**Quand c'est obligatoire** :
- Ajout de nouveaux fichiers/imports
- Modification de App.ts ou du setup flow
- Ajout de dependances

### Couche 5 : Tests d'integration (obligatoire si backend/API modifie)

Valide les endpoints API avec un vrai backend.

```bash
cd packages/maestro-integration-tests && npm test
```

**Quand c'est obligatoire** :
- Nouveau endpoint API
- Modification d'un endpoint existant
- Changement dans les DTOs ou le serialization
- Modification du SDK client

**L'agent DOIT creer des tests d'integration** pour chaque nouvel endpoint ajoute.

### Couche 6 : E2E Dogfooding (obligatoire a la fin de chaque sous-phase)

Un agent **separe** (e2e-tester) interagit avec le vrai TUI via MCP `tui-dogfood`.

```
Outils : tui_spawn, tui_frame, tui_press, tui_type, tui_wait,
         tui_stable, tui_check, tui_note, tui_report, tui_kill
```

**Regles** :
- L'agent de dogfooding est TOUJOURS un sous-agent separe (Regle 2e de l'Agent Protocol)
- Il ne doit PAS lire le code — il teste comme un utilisateur
- Il produit un rapport avec des scores
- Score minimum pour declarer DONE : 3.5/5

---

## Checklist obligatoire de fin de phase

L'agent DOIT copier cette checklist dans `checkpoint.md` et la remplir :

```markdown
## Validation finale

### Couche 1 — Type Check
- [ ] `npx tsc --noEmit` : __ errors (doit etre 0)
- [ ] `dotnet build` : __ errors (doit etre 0, si applicable)

### Couche 2 — Tests unitaires
- Tests avant : __
- Tests apres : __
- Tests crees :
  - (lister chaque test par nom)
- [ ] Tous les tests passent : __/__ (output colle)

### Couche 3 — Visual Gate
- [ ] `npm run test:visual` : __/__ assertions passent
- [ ] Assertions mises a jour pour les nouveaux panels : oui/non/NA
- Output :
  ```
  (coller le resultat)
  ```

### Couche 4 — Real Demo Check
- [ ] `node tests/real-demo-check.cjs` : 4/4 PASS
- Output :
  ```
  (coller le resultat)
  ```

### Couche 5 — Integration (si applicable)
- [ ] `npm test` dans maestro-integration-tests : __/__ passent
- Tests crees :
  - (lister chaque test par nom)

### Couche 6 — E2E Dogfooding
- [ ] Rapport genere : oui/non
- Score global : __/5
- Issues critiques : (lister ou "aucune")
```

---

## Matrice : quel test pour quel changement

| Changement | C1 Type | C2 Unit | C3 Visual | C4 Demo | C5 Integ | C6 E2E |
|------------|:-------:|:-------:|:---------:|:-------:|:--------:|:------:|
| Nouveau composant TUI | ✓ | ✓ | — | ✓ | — | ✓ |
| Modifier composant TUI | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Modifier App.ts / setup | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Nouveau endpoint API | ✓* | — | — | — | ✓ | — |
| Modifier endpoint API | ✓* | — | — | — | ✓ | — |
| Modifier SDK client | ✓ | ✓ | — | — | ✓ | — |
| Modifier block JSON | — | — | — | — | ✓ | — |
| Modifier Python server | — | — | — | — | ✓ | ✓ |

*\* `dotnet build` pour C#, `npx tsc --noEmit` pour TypeScript*

---

## Ordre d'execution

Toujours dans cet ordre (du plus rapide au plus lent) :

```
1. Type check        (~30s)    — echec = STOP
2. Tests unitaires   (~1-2min) — echec = STOP
3. Real demo check   (~15s)    — echec = STOP
4. Visual gate       (~30s)    — echec = STOP
5. Integration       (~2min)   — echec = STOP (si applicable)
6. E2E dogfooding    (~15min)  — score < 3.5 = corrections requises
```

**STOP** signifie : ne pas passer a la couche suivante tant que la couche echouee n'est pas corrigee.

---

## Anti-patterns

| Interdit | Pourquoi | Faire a la place |
|----------|----------|------------------|
| Declarer DONE apres seulement le type check | vitest ≠ feature works | Executer les 6 couches |
| "128/129 pass, le 1 est pre-existant" sans verifier | Peut masquer un vrai echec | Verifier que le test echoue aussi sur main |
| Creer des features sans tests | Regression invisible | Au minimum 1 test par feature |
| Dogfooder soi-meme | Biais de confirmation | Sous-agent separe (Regle 2e) |
| Sauter la couche 4 (demo check) | Module resolution bugs | Toujours executer apres les imports |
| "Les tests passent en isolation" | Timing bugs en parallele | Documenter la flakiness, ne pas ignorer |
| Mettre a jour le golden file sans verifier | Cache les regressions visuelles | Inspecter le diff du golden avant de regenerer |
