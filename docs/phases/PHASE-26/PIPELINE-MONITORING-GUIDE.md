# Pipeline Monitoring Guide — Phase 26

## Principe fondamental

> **Tout ce que l'agent fait doit être visible dans le TUI monitor.**
> Si ce n'est pas dans le monitor, ça n'existe pas.

## Setup rapide

### 1. Créer la session

```bash
cd C:\Meastro\maestro-cli
node index.js session create --type foundry --name "Cantante Dev"
# → Retourne un SESSION_ID

node index.js session import-template <SESSION_ID> agent-dev
node index.js session start <SESSION_ID>
```

### 2. Lancer le monitor

```bash
node index.js monitor <SESSION_ID>
```

Le TUI affiche :
- **Gauche** : Phases (plan → code → test → review → commit) + arbre d'exécution
- **Droite** : Activité LLM (prompts envoyés, réponses reçues)
- **Bas** : Log d'exécution en temps réel
- **Haut-droite** : Widgets (step courant, features faites, erreurs, fichiers modifiés)

### 3. Exécuter les agents via la session

```bash
# Pipeline complet (plan → code → test → review → commit)
node index.js session invoke <SESSION_ID> develop --input task="Create file-tree module" --input workingDir=C:/Cantante

# Ou agents individuels
node index.js session invoke <SESSION_ID> plan --input task="Create file-tree module" --input workingDir=C:/Cantante
node index.js session invoke <SESSION_ID> code --input subtask="..." --input workingDir=C:/Cantante --input targetFile=src/modules/file-tree.ts
node index.js session invoke <SESSION_ID> test --input sourceFile=C:/Cantante/src/modules/file-tree.ts --input workingDir=C:/Cantante
node index.js session invoke <SESSION_ID> review --input workingDir=C:/Cantante --input files=src/modules/file-tree.ts
node index.js session invoke <SESSION_ID> commit --input action=commit --input workingDir=C:/Cantante
```

## Ce que le monitor affiche

### Phases (`_phases`)

Chaque phase correspond à une étape du pipeline :

| Phase | Agent | Ce qu'il fait | Ce que le monitor montre |
|-------|-------|---------------|-------------------------|
| 1. Planning | `planner-agent` | Décompose la tâche en sous-tâches | Plan JSON avec subtasks |
| 2. Coding | `coder-agent` | Écrit le code dans les fichiers | Fichiers créés/modifiés |
| 3. Testing | `tester-agent` | Génère et exécute les tests | Résultats des tests (pass/fail) |
| 4. Review | `reviewer-agent` | Vérifie qualité, bugs, conventions | Score + issues trouvées |
| 5. Commit | `git-agent` | Stage, commit, push | Hash du commit |

### Arbre d'exécution (`_executionTree`)

L'arbre montre la structure hiérarchique de l'exécution en cours :

```
▼ develop-feature-workflow          [running]
  ✓ plan (planner-agent)            [done] 2.3s
  ● code (coder-agent)              [running]
    ● iteration 1 - convention-reader  [running]
  ○ test (tester-agent)             [pending]
  ○ review (reviewer-agent)         [pending]
  ○ commit (git-agent)              [pending]
```

### Activité LLM (`_llmActivity`)

Chaque appel LLM est loggé avec :
- **Prompt preview** : Les premières lignes du prompt envoyé
- **Response preview** : Les premières lignes de la réponse
- **Duration** : Temps de génération
- **Token count** : Nombre de tokens

### Log d'exécution (`_executionLog`)

Stream en temps réel :
```
[15:23:01] INFO  Agent iteration 1/5
[15:23:01] INFO  Tool call: convention-reader
[15:23:02] INFO  Tool result: {conventions: ...}
[15:23:02] INFO  Agent iteration 2/5
[15:23:03] INFO  Tool call: file-read path=src/core/types.ts
[15:23:03] INFO  Tool result: {content: "interface FileNode..."}
[15:23:04] INFO  Agent iteration 3/5
[15:23:04] INFO  Tool call: file-write path=src/modules/file-tree.ts
[15:23:04] INFO  Written 245 bytes
[15:23:05] INFO  Agent done: Created file-tree.ts
```

### Widgets

| Widget | Variable | Ce qu'il montre |
|--------|----------|-----------------|
| Current Step | `currentStep` | plan/code/test/review/commit/idle |
| Features Done | `featureCount` | Nombre de features complétées |
| Errors | `errorCount` | Nombre d'erreurs (rouge si > 0) |
| Files Modified | `filesModified` | Liste des fichiers créés/modifiés |
| Agent Results | `agentResults` | Historique des résultats des agents |

## Règles du pipeline

### TOUJOURS

1. **Créer la session AVANT de travailler** — Pas de `run` direct sans session
2. **Lancer le monitor** — Le user DOIT pouvoir voir ce qui se passe
3. **Utiliser `session invoke`** — Pas `run <block>` (pas de monitoring)
4. **Mettre à jour les variables** — `currentStep`, `filesModified`, `agentResults` après chaque étape

### JAMAIS

1. **Jamais de `run` en direct** — Toujours via `session invoke`
2. **Jamais de travail invisible** — Si le monitor ne le montre pas, refaire via la session
3. **Jamais continuer sans vérifier** — Si une phase échoue, le monitor montre l'erreur → corriger avant de continuer

## Mise à jour des variables entre les étapes

Quand on exécute les agents individuellement (pas le workflow complet), on met à jour les variables manuellement :

```bash
# Avant de lancer le planner
node index.js session set-var <ID> currentStep plan
node index.js session set-var <ID> currentFeature "file-tree module"

# Après le planner
node index.js session set-var <ID> currentStep code

# Après le coder
node index.js session set-var <ID> filesModified '[{"name":"src/modules/file-tree.ts","status":"created"}]'
node index.js session set-var <ID> currentStep test

# Après le tester
node index.js session set-var <ID> currentStep review

# Après le reviewer
node index.js session set-var <ID> currentStep commit

# Après le commit
node index.js session set-var <ID> currentStep idle
node index.js session set-var <ID> featureCount 1
```

## Diagnostics

### Le monitor est vide
- Vérifier que la session est `started` : `node index.js session get <ID>`
- Vérifier que `_monitorDescriptor` existe : `node index.js session get-var <ID> _monitorDescriptor`

### Les phases ne bougent pas
- L'exécution passe par `session invoke`, pas `run`
- Les phases sont mises à jour automatiquement par `EntryPointExecutor`

### Pas d'activité LLM
- L'agent utilise bien le LLM Provider : vérifier `http://localhost:8000/health`
- Le model est chargé : `Qwen/Qwen2.5-Coder-1.5B-Instruct` requis pour les agents

### Erreur dans le log
- Lire le log complet : `node index.js session get-var <ID> _executionLog`
- Le log contient les messages d'erreur des agents
