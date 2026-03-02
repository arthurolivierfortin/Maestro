# 45-PREP-A : Securite — Path Traversal + Shell Injection

**Effort** : 0.5 jour
**Prerequis** : Aucun (premiere sous-phase)

---

## Lecture obligatoire

| Fichier | Pourquoi |
|---------|----------|
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` (lignes 699-708) | Validation path existante — comprendre ce qui est deja protege et ce qui manque |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` (lignes 233-278) | Shell execute handler — comprendre comment les commandes sont construites et echappees |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` (lignes 120-145) | Script file validation — pattern existant de validation path traversal pour les scripts |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` (lignes 758-778) | Tool dispatch — comprendre comment les tool calls de l'agent arrivent au ToolBlockExecutor |
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` (ligne 1016) | NormalizeToolId — mapping des noms d'outils (bash→shell-execute, read→file-read, etc.) |

---

## Ce que cette sous-phase fait

### 1. Renforcer la validation path dans `ToolBlockExecutor.cs`

La validation existante (lignes 699-708) verifie que le path ne sort pas du working directory via `StartsWith()`. Renforcements necessaires :

- **Normaliser les paths** avant validation : `Path.GetFullPath()` pour resoudre `../`, `./`, et les melanges de slashes
- **Rejeter explicitement les paths contenant `..`** en segment : `../../etc/passwd`, `foo/../../../bar`
- **Gerer les chemins Windows et Unix** : `..\..\Windows\system32` et `../../etc/passwd`
- **Appliquer la meme validation** a file-read, file-write, file-edit, directory-list (deja le cas via `HandleFilesystemOperationAsync`, verifier)

### 2. Renforcer la validation du working directory shell

Le shell execute handler (lignes 233-278) utilise l'echappement de quotes pour prevenir l'injection basique. Renforcements :

- **Valider que `workingDir`** (fourni via inputs) ne pointe pas vers un path arbitraire hors du scope de la session
- **Appliquer `Path.GetFullPath()` + `StartsWith(baseDir)`** au workingDir avant de l'utiliser dans ProcessStartInfo

> **IMPORTANT** : Ne PAS bloquer les operateurs shell (`;`, `&&`, `||`, `|`) dans les commandes elles-memes. L'agent DOIT pouvoir executer des commandes comme `cd /path && node index.js workspace create`. Le vecteur d'attaque n'est pas les operateurs shell (l'agent compose les commandes, pas l'utilisateur) — c'est le path traversal dans les chemins de fichiers et le working directory.

### 3. Ajouter des tests unitaires

Creer des tests specifiques qui verifient :
- Path traversal bloque pour file-read, file-write, file-edit, directory-list
- Working directory hors scope bloque pour shell-execute
- Paths normaux (absolus dans le scope, relatifs sans `..`) passent

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `apps/backend/src/Maestro.Infrastructure/BlockExecutors/ToolBlockExecutor.cs` | Modifier : renforcer `HandleFilesystemOperationAsync` (normalisation + rejet `..`), valider workingDir dans le shell handler |
| `apps/backend/tests/Maestro.Infrastructure.Tests/BlockExecutors/ToolBlockSecurityTests.cs` | Creer : tests pour path traversal (fichiers) + working directory (shell) |

---

## Verification

```bash
# Commande 1 : Build backend apres modifications
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : Build succeeded, 0 errors

# Commande 2 : Executer les tests backend
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet test"
# Resultat attendu : Tous les tests passent, incluant les nouveaux tests de securite

# Commande 3 : Verifier que les tests maestro-code ne cassent pas
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# Resultat attendu : Meme nombre de tests passants qu'avant (69+)

# Commande 4 : Test manuel — path traversal via l'API (demarrer le backend d'abord)
curl -s -X POST http://localhost:5000/api/blocks/file-read/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs":{"path":"../../etc/passwd"}}'
# Resultat attendu : Erreur "Invalid file path" ou similar, PAS le contenu du fichier

# Commande 5 : Test manuel — path valide dans le scope
curl -s -X POST http://localhost:5000/api/blocks/file-read/execute \
  -H "Content-Type: application/json" \
  -d '{"inputs":{"path":"C:/Meastro/README.md"}}'
# Resultat attendu : Contenu du fichier retourne sans erreur
```

---

## Anti-patterns

- Ne PAS bloquer les operateurs shell (`&&`, `|`, `;`) dans les commandes — l'agent les utilise legitimement pour chainer des commandes CLI. La protection est dans l'echappement des quotes (deja en place) et la validation du working directory.
- Ne PAS mettre la validation dans l'infrastructure generique (middleware, API controller) — la validation est dans le tool block executor, car c'est le tool block qui connait la semantique de ses inputs.
- Ne PAS bloquer les paths absolus valides a l'interieur du working directory — seuls les paths qui SORTENT du scope sont rejetes.
- Ne PAS creer un systeme d'allowlist de commandes shell qui empeche l'agent de fonctionner — si trop complexe, le documenter dans `next-phase-items.md`.

---

## Checkpoint

```markdown
## 45-PREP-A : Securite
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Tests ajoutes** : [nombre de tests de securite]
**Path traversal bloque** : oui / non (copier output du test curl)
**Working directory valide** : oui / non (copier output)
**Tests existants** : [nombre] passants, 0 casses
```
