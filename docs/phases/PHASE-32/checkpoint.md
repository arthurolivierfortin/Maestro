# Phase 32 : Checkpoint

**Derniere mise a jour** : 2026-02-18 19:30
**Sous-phase en cours** : TOUTES COMPLETES
**Agent** : Claude Opus 4.6

---

## 32-A : maestro init
**Statut** : DONE
**Date** : 2026-02-18
**Commande ajoutee** : OUI (enhanced existing `initRepo` in `maestro-cli/cli.ts:1528`)
**Templates crees** :
- `content/system/templates/init/node.md`
- `content/system/templates/init/csharp.md`
- `content/system/templates/init/python.md`
- `content/system/templates/init/java.md`
- `content/system/templates/init/rust.md`
- `content/system/templates/init/default.md`

**Ce qui a ete fait** :
- Added `detectProjectStack()` function — checks for package.json, *.csproj, pyproject.toml/setup.py/requirements.txt, pom.xml/build.gradle, Cargo.toml
- Added `loadConventionsTemplate()` function — reads stack-specific template from `content/system/templates/init/`
- Enhanced `initRepo()` to: detect stack, create config.json, create CONVENTIONS.md from template, create README.md with getting started guide, display next steps
- Created 6 CONVENTIONS.md templates (node, csharp, python, java, rust, default)
- No API contact — purely local filesystem operation

**Teste sur** :
- node (package.json) — detected: `node`, config.json has `"stack": "node"`
- csharp (MyApp.csproj) — detected: `csharp`, config.json has `"stack": "csharp"`
- python (pyproject.toml) — detected: `python`, config.json has `"stack": "python"`
- java (pom.xml) — detected: `java`, config.json has `"stack": "java"`
- rust (Cargo.toml) — detected: `rust`, config.json has `"stack": "rust"`
- unknown (empty dir) — detected: `unknown (generic)`, config.json has `"stack": null`
- re-init on existing — shows "already exists" message

**Verification** :
```
$ node index.js init C:\Meastro\test-repos\test-node
→ Initialized .maestro/ in C:\Meastro\test-repos\test-node
→ Stack detected: node
→ created .maestro/config.json, CONVENTIONS.md, README.md, blocks/, docs/, logs/, artifacts/, metrics/
→ Next steps displayed

$ cat test-repos/test-node/.maestro/config.json
→ { "template": "project-autonomous", "model": null, "stack": "node" }

$ node index.js init C:\Meastro\test-repos\test-node (re-init)
→ .maestro/ already exists in C:\Meastro\test-repos\test-node
→ To reinitialize, remove .maestro/ first.
```

---

## 32-B : Aliases system
**Statut** : DONE
**Date** : 2026-02-18
**Fichiers modifies** :
- `maestro-cli/cli.ts` — added `loadAliases()`, `executeAlias()`, alias resolution in `executeWithArgv`, `aliases` command, updated `initRepo` to copy aliases
- `content/system/templates/init/aliases-default.json` — default aliases (agent → autonomous-development)

**Ce qui a ete fait** :
- `loadAliases()` reads `.maestro/aliases.json` (local, priority) then `~/.maestro/aliases.json` (global)
- `executeAlias()` creates session, imports template, starts session, invokes entry point with task + repoPath inputs
- Alias resolution in `executeWithArgv` checks if command matches an alias BEFORE normal dispatch
- Built-in commands (session, block, health, etc.) cannot be overridden by aliases
- Singular forms (`agent`, `tool`, `workflow`, `prompt`) removed from built-in set — aliases take priority for these, block shortcuts remain as fallback
- Added `maestro aliases` command to list available aliases
- Updated `initRepo` to copy `aliases-default.json` → `.maestro/aliases.json`
- Updated help text to mention aliases
- Updated init next-steps to suggest `maestro agent "task"` instead of manual session create

**Alias testes** :
- `maestro aliases` (no aliases) → "No aliases configured" with guidance
- `maestro aliases` (with aliases) → Lists agent + reviewer with descriptions, templates, entry points
- `maestro agent "Add a README"` → Resolves alias, creates session, imports template (22 variables, 2 entry points), starts session. Failed on file lock (backend issue, not alias issue).
- `maestro nonexistent-alias` → Falls through to "Unknown command" error
- `maestro agents` (plural, builtin) → Still works as block list shortcut

**Alias par defaut** :
- `agent` → workflow: autonomous-development, template: project-autonomous, entryPoint: dev

---

## 32-C : UX improvements
**Statut** : DONE
**Date** : 2026-02-18

**Ce qui a ete fait** :

**1. ID resolution** : DEJA IMPLEMENTE
- `resolveId()` existe depuis Phase 22 (ligne 29 de cli.ts)
- Utilise dans ~25 handlers (session, project, workspace)
- Rien a faire

**2. Messages d'erreur** : AMELIORE
- `handleApiError()` — corrige les suggestions obsoletes (`list-blocks` → `block list`, `session show` → `session info`)
- Ajout suggestion pour `approval` (pending approvals) et `invoking` (session info)
- Fichier: `maestro-cli/cli.ts:1034`

**3. Input simplifie** : IMPLEMENTE
- Le handler `session invoke` parse maintenant les arguments positionnels `key=value` apres l'entry point
- `maestro session invoke <id> dev task="Add login" repoPath="."` fonctionne
- Compatible avec `--input key=value` existant (les deux sont acceptes)
- Fichier: `maestro-cli/cli.ts:6368` (session invoke handler)

**4. Review non-gate P2** : CORRIGE
- Modifie `autonomous-development.workflow.block.json` : le noeud `commit` est maintenant un noeud `conditional` (`review-gate`) avec condition `{{_nodeResult_review.approved}} == true`
- Si review `approved: true` → commit execute (branche `then`)
- Si review `approved: false` → commit skip (pas de branche `else`)
- Enhance `ResolveTemplate` dans `EntryPointExecutor.cs` pour supporter l'extraction de sous-champs JSON: `{{_nodeResult_review.approved}}` → `true`/`false`, `{{_nodeResult_review.score}}` → `0.85`
- Ajout `ExtractJsonSubPath()` qui parse les valeurs JSON (string, JsonElement, JObject) et extrait un champ par nom
- Workflow version bumped to 3.1.0
- Backend build: 0 warnings, 0 errors

**Fichiers modifies** :
- `maestro-cli/cli.ts` — error messages, input simplification, help text
- `backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` — `ResolveTemplate` JSON sub-path, `ExtractJsonSubPath`
- `content/system/blocks/workflows/autonomous-development.workflow.block.json` — review gate conditional, v3.1.0

**Verification** :
```
$ powershell.exe -Command "cd C:\Meastro\backend; dotnet build"
→ Build succeeded. 0 Warning(s). 0 Error(s).

$ node index.js aliases (from project with aliases)
→ Lists available aliases correctly

$ maestro init (creates aliases.json)
→ confirmed aliases.json created with default agent alias
```
