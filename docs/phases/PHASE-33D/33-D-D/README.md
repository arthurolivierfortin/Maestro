# 33-D-D : Mise a jour docs + validation E2E

**Statut** : PAS_COMMENCE
**Objectif** : Mettre a jour CLAUDE.md, MEMORY.md, docs/ROADMAP.md avec les nouveaux paths, puis valider que TOUT compile, TOUT passe les tests, et qu'il n'y a AUCUN path stale.

**Regle** : Ne PAS declarer DONE sans avoir execute TOUTES les commandes de verification et copie les resultats dans le checkpoint.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi |
|---------|----------|
| `CLAUDE.md` | Identifier TOUS les paths references (`backend/`, `frontend/`, `maestro-mcp/`) — il y en a 50+ |
| `C:\Users\arthu\.claude\projects\C--Meastro\memory\MEMORY.md` | Identifier les paths dans Architecture Quick Reference, Key File Paths, Testing Commands |
| `docs/ROADMAP.md` | Etat actuel des phases — ajouter 33-D comme COMPLETE |
| `docs/phases/PHASE-33C/checkpoint.md` | Resultats de la phase precedente pour contexte |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Mettre a jour CLAUDE.md

Rechercher et remplacer systematiquement :

| Ancien path | Nouveau path |
|-------------|-------------|
| `backend/` | `apps/backend/` |
| `backend/src/` | `apps/backend/src/` |
| `frontend/` | `apps/desktop/` |
| `frontend/src/` | `apps/desktop/src/` |
| `maestro-mcp/` | `apps/mcp/` |

**ATTENTION** : Ne PAS faire un remplacement aveugle. Certaines occurrences sont dans des contextes specifiques :
- Les commandes Docker referent a `./backend` dans les docker-compose — ceux-ci sont deja mis a jour en 33-D-B
- Les commandes de test referent a `cd C:\Meastro\backend` → `cd C:\Meastro\apps\backend`
- Les paths relatifs dans la doc d'architecture sont importants

### Etape 2 : Mettre a jour MEMORY.md

Memes remplacements, sections specifiques :
- **Architecture Quick Reference** : Backend path, Frontend path
- **Key File Paths** : Backend entry, Session executor, Session controller, etc.
- **Testing Commands** : `cd C:\Meastro\backend` → `cd C:\Meastro\apps\backend`, etc.

### Etape 3 : Mettre a jour docs/ROADMAP.md

Ajouter dans les phases completees :

```markdown
| 33-C | Consolidation TUI Monorepo (40 tui + 4 monitor + 32 code tests) | COMPLETE |
| 33-D | Restructuration Monorepo — apps/ + nettoyage root | COMPLETE |
```

### Etape 4 : Ecrire le checkpoint final

`docs/phases/PHASE-33D/checkpoint.md` avec TOUS les resultats de verification copies.

### Etape 5 : Validation E2E

Executer TOUTES les suites de tests et builds. Voir section Verification ci-dessous.

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `CLAUDE.md` | Remplacer tous les paths (`backend/` → `apps/backend/`, `frontend/` → `apps/desktop/`, `maestro-mcp/` → `apps/mcp/`) |
| `C:\Users\arthu\.claude\projects\C--Meastro\memory\MEMORY.md` | Memes remplacements dans Architecture, Key File Paths, Testing Commands |
| `docs/ROADMAP.md` | Ajouter Phase 33-D comme COMPLETE |
| `docs/phases/PHASE-33D/checkpoint.md` | Creer avec resultats de verification |

---

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Tests TUI toolkit
powershell.exe -Command "cd C:\Meastro\packages\tui; npx vitest run tests/ 2>&1 | Select-Object -Last 5"
# Resultat attendu : 40 tests passed

# Commande 2 : Tests maestro-code
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/ 2>&1 | Select-Object -Last 5"
# Resultat attendu : 32 tests passed

# Commande 3 : Tests maestro-monitor
powershell.exe -Command "cd C:\Meastro\packages\maestro-monitor; npx vitest run tests/ 2>&1 | Select-Object -Last 5"
# Resultat attendu : 4 tests passed

# Commande 4 : Backend build
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build 2>&1 | Select-Object -Last 3"
# Resultat attendu : Build succeeded

# Commande 5 : Frontend build
powershell.exe -Command "cd C:\Meastro\apps\desktop; npm run build:web 2>&1 | Select-Object -Last 5"
# Resultat attendu : build completed

# Commande 6 : Aucune reference stale dans CLAUDE.md
powershell.exe -Command "Select-String -Path C:\Meastro\CLAUDE.md -Pattern 'backend/src|frontend/src|maestro-mcp/' | Measure-Object | Select-Object -ExpandProperty Count"
# Resultat attendu : 0 (tout remplace par apps/backend/src, apps/desktop/src, apps/mcp/)

# Commande 7 : Structure root propre
powershell.exe -Command "(Get-ChildItem C:\Meastro -Name) | Sort-Object"
# Resultat attendu : ~20 items :
# .claude, .env.example, .github, .gitignore, .maestro, .vscode,
# apps, CLAUDE.md, content, dev-scripts,
# docker-compose.backend.yml, docker-compose.dev.yml, docker-compose.full.yml, docker-compose.yml,
# docs, global.json, llm-provider, maestro.config.json,
# node_modules, package.json, package-lock.json, packages, README.md, tests
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS declarer la phase DONE sans avoir run TOUS les tests et builds
- Ne PAS oublier de mettre a jour les DEUX fichiers de memoire (CLAUDE.md et MEMORY.md)
- Ne PAS laisser de paths stales — chercher systematiquement `backend/src`, `frontend/src`, `maestro-mcp/` dans CLAUDE.md
- Ne PAS faire un remplacement aveugle de "backend" — le mot apparait dans des contextes non-path (ex: "Backend .NET", "backend build")

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 33-D-D : Docs + validation E2E
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Tests TUI** : [X passed / Y failed]
**Tests maestro-code** : [X passed / Y failed]
**Tests maestro-monitor** : [X passed / Y failed]
**Backend build** : [succeeded/failed]
**Frontend build** : [succeeded/failed]
**CLAUDE.md stale paths** : [nombre, idealement 0]
**Root item count** : [nombre]
**Structure finale** : [copier le output de Get-ChildItem]
```
