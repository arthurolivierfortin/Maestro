# 33-D-A : Nettoyage root + fix MaestroPathConfiguration

**Statut** : PAS_COMMENCE
**Objectif** : Supprimer les 20+ fichiers parasites de la racine et corriger le bug MaestroPathConfiguration AVANT tout deplacement de dossier.

**Regle** : Cette sous-phase est UNIQUEMENT du nettoyage — supprimer des fichiers et corriger un bug. Ne PAS deplacer de dossiers, ne PAS creer de nouvelle structure.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi |
|---------|----------|
| `backend/src/Maestro.Infrastructure/Configuration/MaestroPathConfiguration.cs` | Comprendre l'algorithme FindRepoRoot() ligne 148-171 — `Maestro.sln` est dans les markers et causera un bug apres deplacement |
| `.gitignore` | Comprendre les patterns actuels pour eviter les doublons |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Supprimer les logs orphelins (10 fichiers)

```
backend-err.log
backend-error.log
backend-out.log
backend-output.log
backend-stderr.log
backend-stdout.log
monitor-bg-stderr.log
monitor-final-stderr.log
monitor-legacy-stderr.log
monitor-test-stderr.log
```

### Etape 2 : Supprimer les JSON temporaires (4 fichiers)

```
temp-blocks.json
test-agent-multiturn.json
test-multiturn.json
compat.json
```

### Etape 3 : Supprimer les docs orphelins (6 fichiers)

```
pr-description.md        — artefact de PR
guide.md                 — orphelin
ROADMAP.md               — obsolete (date du 2026-01-20, "B-One Maestro"), remplace par docs/ROADMAP.md
BUILD.md                 — obsolete
CONTRIBUTING.md          — obsolete
dotnet-install.ps1       — one-time setup
```

### Etape 4 : Fix MaestroPathConfiguration

Modifier `backend/src/Maestro.Infrastructure/Configuration/MaestroPathConfiguration.cs` ligne 152 :

```csharp
// AVANT :
var markers = new[] { ".git", "Maestro.sln", "maestro.config.json" };

// APRES :
var markers = new[] { ".git", "maestro.config.json" };
```

**Pourquoi** : Apres le deplacement `backend/` → `apps/backend/` (sous-phase 33-D-B), `Maestro.sln` sera a `apps/backend/Maestro.sln`. L'algorithme remonte le systeme de fichiers et trouvera `Maestro.sln` AVANT `.git` (qui est a la racine). Le backend croira que `apps/backend/` est la racine → paths `content/`, `blocks/` invalides → crash silencieux.

### Etape 5 : Mettre a jour .gitignore

Ajouter ces patterns pour empecher le retour de fichiers parasites :

```
# Logs
*.log

# Temporary files
temp-*.json
```

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `*.log` (10 fichiers a la racine) | Supprimer |
| `temp-blocks.json`, `test-agent-multiturn.json`, `test-multiturn.json`, `compat.json` | Supprimer |
| `pr-description.md`, `guide.md`, `ROADMAP.md`, `BUILD.md`, `CONTRIBUTING.md`, `dotnet-install.ps1` | Supprimer |
| `backend/src/Maestro.Infrastructure/Configuration/MaestroPathConfiguration.cs` | Retirer `"Maestro.sln"` de la ligne 152 |
| `.gitignore` | Ajouter patterns `*.log`, `temp-*.json` |

---

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Verifier que les logs sont supprimes
powershell.exe -Command "(Get-ChildItem C:\Meastro\*.log).Count"
# Resultat attendu : 0

# Commande 2 : Verifier MaestroPathConfiguration
grep "Maestro.sln" backend/src/Maestro.Infrastructure/Configuration/MaestroPathConfiguration.cs
# Resultat attendu : aucun match

# Commande 3 : Backend compile toujours
powershell.exe -Command "cd C:\Meastro\backend; dotnet build --no-restore 2>&1 | Select-Object -Last 3"
# Resultat attendu : Build succeeded

# Commande 4 : Nombre d'elements a la racine
powershell.exe -Command "(Get-ChildItem C:\Meastro -Name).Count"
# Resultat attendu : ~25 (avant deplacements apps/)
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS supprimer `maestro.config.json` — c'est un marqueur de root utilise par FindRepoRoot()
- Ne PAS supprimer `.env.example` — template utile pour les contributeurs
- Ne PAS supprimer le dossier `tests/` a la racine sans verifier son contenu d'abord
- Ne PAS encore deplacer de dossiers (backend/, frontend/) — c'est pour 33-D-B

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 33-D-A : Nettoyage root + fix MaestroPathConfiguration
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Fichiers supprimes** : [nombre]
**Elements root restants** : [nombre]
**MaestroPathConfiguration markers** : [copier la ligne]
**Backend build** : [copier la derniere ligne]
```
