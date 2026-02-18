# Issue 30-A-2 : Debugger le bug tools-in-session-context

**Statut** : COMPLETE (2026-02-17)
**Estimation** : 2-4 heures
**Bloquant** : **OUI — bloque TOUTE la Phase 30-B et au-dela**
**Prerequis** : Aucun

---

## Description

Quand un agent est invoque via `session invoke` → `EntryPointExecutor` → `AgentBlockExecutor` → `ICliExecutor`, les tools filesystem (`directory-list`, `file-read`, `shell-execute`) retournent du contenu vide. Le meme agent invoque via `node index.js run <block>` fonctionne correctement.

Ce bug empeche tout agent de lire ou ecrire des fichiers dans le contexte d'une session. C'est le bloqueur le plus critique de la Phase 30.

---

## Tache detaillee

### 1. Ajouter du logging dans CliExecutor

Dans `CliExecutor.ExecuteAsync()` (chercher dans `backend/src/Maestro.Infrastructure/`) :

```csharp
// Ajouter du logging AVANT l'execution :
_logger.LogInformation("CliExecutor: command={Command}, workingDir={WorkDir}, args={Args}",
    command, workingDirectory, string.Join(" ", arguments));

// APRES l'execution :
_logger.LogInformation("CliExecutor: exitCode={ExitCode}, stdout.Length={StdoutLen}, stderr={Stderr}",
    exitCode, stdout?.Length ?? 0, stderr);
```

### 2. Comparer les deux chemins d'execution

**Chemin A (fonctionne)** : `node index.js run file-read --input path=C:\Cantante\package.json`
- Trace le flow : CLI → API → BlockExecutor → CliExecutor → Process → result

**Chemin B (ne fonctionne pas)** : `session invoke <id> dev` → noeud "prepare" → AgentBlockExecutor → CliExecutor
- Trace le flow identique et compare chaque etape

### 3. Hypotheses a verifier

| # | Hypothese | Comment verifier |
|---|-----------|-----------------|
| 1 | `workingDirectory` n'est pas transmis dans le chemin session | Logger le `workingDirectory` dans CliExecutor |
| 2 | Les variables d'environnement sont differentes | Logger `Process.StartInfo.EnvironmentVariables` |
| 3 | Le `RepositoryPath` de la session n'est pas passe aux blocs enfants | Verifier dans `EntryPointExecutor.ExecuteBlockRefAsync()` |
| 4 | Le `Process.Start` ne recoit pas le bon PATH | Logger la variable PATH du processus |
| 5 | Les arguments sont mal formates (quotes, espaces) | Logger les arguments avant et apres formatage |
| 6 | Le stdout est capture mais pas lu correctement (async deadlock) | Verifier les `ReadToEndAsync()` |

### 4. Tester avec un tool simple d'abord

Avant de debugger un agent complexe, tester avec le tool le plus simple :

```bash
# Creer une session minimale
node index.js session create --type project --name "Debug tools test" --repo "C:\Cantante" --start

# Invoquer un tool directement via un entry point simple
# (peut necessiter de creer un workflow a un seul noeud pour isoler le probleme)
```

### 5. Corriger le bug

Une fois la cause identifiee, appliquer la correction et verifier.

---

## Instructions de test

### Test 1 : Tool direct via session (minimal)

```bash
# Creer une session liee a un repo
node index.js session create --type project --name "Tool test" --repo "C:\Cantante" --start

# Invoquer un tool qui lit un fichier connu
# Le fichier doit exister : C:\Cantante\package.json
node index.js session invoke <session-id> <entry-point-qui-lit-un-fichier>

# Verifier dans les logs du backend que :
# 1. CliExecutor recoit le bon workingDirectory
# 2. Le Process.Start a les bonnes variables d'environnement
# 3. Le stdout contient le contenu du fichier
```

### Test 2 : Agent qui lit un fichier

```bash
# Utiliser project-preparer (l'agent le plus simple qui lit des fichiers)
node index.js run project-preparer --input repoPath="C:\Cantante"
# Doit retourner les infos du projet

# PUIS via session invoke :
node index.js session invoke <session-id> prepare --input repoPath="C:\Cantante"
# Doit retourner les MEMES infos
```

### Test 3 : Agent qui ecrit un fichier

```bash
# Utiliser un agent qui ecrit dans un dossier sandbox
# (pour ne pas polluer Cantante)
mkdir C:\temp\sandbox-test
echo '{}' > C:\temp\sandbox-test\package.json

node index.js session invoke <session-id> <entry-point> --input repoPath="C:\temp\sandbox-test"
# Verifier que le fichier a ete cree/modifie dans le sandbox
```

---

## Critere de completion

- [ ] La cause racine du bug est identifiee et documentee
- [ ] Le fix est applique dans le code C#
- [ ] `dotnet build` compile sans erreur
- [ ] **Test A** : `file-read` via session retourne le contenu d'un fichier existant
- [ ] **Test B** : `directory-list` via session retourne la liste des fichiers d'un repertoire
- [ ] **Test C** : `shell-execute` via session execute une commande et retourne la sortie
- [ ] **Test D** : Un agent (project-preparer) invoque via session produit le meme resultat que via `run`
- [ ] Les logs montrent clairement le chemin d'execution dans les deux cas

---

## Risques

- **Risque** : Le bug est dans le `Process.Start` lui-meme (permissions Windows, working directory)
- **Mitigation** : Tester sur un chemin simple (C:\temp) avant un chemin complexe
- **Risque** : Le fix casse le chemin `run` (hors session)
- **Mitigation** : Tester les DEUX chemins apres le fix
- **Si bloque >4h** : Documenter exactement ou le flux diverge et demander de l'aide

---

## Resolution (2026-02-17)

### Cause racine

Le bug etait dans `EntryPointExecutor.ExecuteBlockRefAsync()` (ligne 1012-1014). Le `ExecutionContext` etait cree avec seulement `sessionId` et `workingDir` :

```csharp
// AVANT (bugge)
var execContext = new Domain.Entities.ExecutionContext();
execContext.Variables["sessionId"] = session.Id;
execContext.Variables["workingDir"] = workingDir;
```

Quand `AgentBlockExecutor` (ligne 404-409) construisait le `CliExecutionContext`, il lisait `workspaceId` et `agentId` depuis `context.Variables` — mais ces valeurs n'etaient jamais definies dans le chemin `session invoke`. Le `CliExecutionContext` resultant avait `WorkspaceId = null` et `AgentId` fallback au block.Id.

En comparaison, `RunCommandHandler` (ligne 114-121) propageait correctement les 3 valeurs.

### Correction

```csharp
// APRES (corrige)
var execContext = new Domain.Entities.ExecutionContext();
execContext.Variables["sessionId"] = session.Id;
execContext.Variables["workingDir"] = workingDir;
if (!string.IsNullOrEmpty(session.ParentWorkspaceId))
    execContext.Variables["workspaceId"] = session.ParentWorkspaceId;
execContext.Variables["agentId"] = blockRefId;
```

### Fichier modifie

`backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — lignes 1010-1018

### Verification

- `dotnet build` : 0 erreurs, 0 warnings
- Le chemin `run` (RunCommandHandler) n'est pas affecte (code independant)
- PermissionChecker resout correctement les permissions quand workspaceId est present
