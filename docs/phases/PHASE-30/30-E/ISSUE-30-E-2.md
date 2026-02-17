# Issue 30-E-2 : 5 scenarios de validation E2E

**Statut** : A faire
**Estimation** : 2-4 heures
**Prerequis** : 30-E-1 (session E2E creee)

---

## Description

Tester l'agent publie sur 5 scenarios representatifs. Gate Phase 30 : >= 4/5 reussis.

---

## Scenarios

### Scenario 1 : "Create README.md"

```bash
node index.js session invoke <id> dev --input task="Create a comprehensive README.md for the project" --input repoPath="C:\Cantante"
```

| Critere | Verification |
|---------|-------------|
| Fichier cree | `ls C:\Cantante\README.md` |
| Contenu pertinent | Le README decrit Cantante, pas un projet generique |
| Commit propre | `git log -1` dans Cantante |

### Scenario 2 : "Fix TypeScript errors"

```bash
node index.js session invoke <id> dev --input task="Fix all TypeScript compilation errors" --input repoPath="C:\Cantante"
```

| Critere | Verification |
|---------|-------------|
| Erreurs corrigees | `npx tsc --noEmit` dans Cantante (0 erreurs) |
| Pas de regression | Les tests existants passent toujours |
| Commit propre | `git log -1` → message `fix(...)` |

### Scenario 3 : "Create a file-tree module with tests"

```bash
node index.js session invoke <id> dev --input task="Create a file-tree module that lists all project files in a tree view, with unit tests" --input repoPath="C:\Cantante"
```

| Critere | Verification |
|---------|-------------|
| Module cree | Les fichiers existent |
| Tests crees | Les fichiers test existent |
| Tests passent | `npm test` passe |
| Commit propre | `git log -1` → message `feat(...)` |

### Scenario 4 : "Add accessibility labels to all buttons"

```bash
node index.js session invoke <id> dev --input task="Add accessibility aria-labels to all buttons in the application" --input repoPath="C:\Cantante"
```

| Critere | Verification |
|---------|-------------|
| Labels ajoutes | Grep `aria-label` dans les composants |
| Pas de regression | Les tests existants passent |
| Commit propre | `git log -1` → message `feat(accessibility)` ou `fix(a11y)` |

### Scenario 5 : "Refactor audio module to use custom hooks"

```bash
node index.js session invoke <id> dev --input task="Refactor the audio module to extract logic into custom React hooks" --input repoPath="C:\Cantante"
```

| Critere | Verification |
|---------|-------------|
| Hooks crees | Les fichiers `useAudio*` existent |
| Module refactore | Le code utilise les nouveaux hooks |
| Tests passent | `npm test` passe |
| Commit propre | `git log -1` → message `refactor(audio)` |

---

## Grille de resultat

| # | Scenario | Resultat | Notes |
|---|----------|----------|-------|
| 1 | Create README.md | ✅ / ❌ | |
| 2 | Fix TypeScript errors | ✅ / ❌ | |
| 3 | File-tree module + tests | ✅ / ❌ | |
| 4 | Accessibility labels | ✅ / ❌ | |
| 5 | Refactor audio hooks | ✅ / ❌ | |

---

## Gate Phase 30

**>= 4/5 scenarios reussis** → Phase 30 COMPLETE. Passer a Phase 31.

**< 4/5 scenarios reussis** → Retourner a 30-C-5 (iterer les prompts) et re-tester.

---

## Critere de completion

- [ ] 5 scenarios executes
- [ ] Chaque scenario documente (resultat + notes)
- [ ] >= 4/5 reussis
- [ ] Tous les resultats dans le journal d'experience
- [ ] La session E2E est dans le workspace Phase 30

---

## Important

- **Pas de modification du composite entre les scenarios** — les memes prompts pour les 5 tests
- **Si un scenario echoue** : noter pourquoi, mais NE PAS corriger et retester immediatement. Finir les 5 scenarios d'abord, puis iterer.
- **Chaque scenario dans une branche isolee** : `git checkout -b maestro-e2e-scenario-<N>` avant chaque scenario, `git checkout main && git branch -D maestro-e2e-scenario-<N>` apres. Pas de `git stash` ou `git checkout .` — une branche propre est plus sure et plus tracable.
