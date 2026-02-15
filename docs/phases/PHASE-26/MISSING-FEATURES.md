# Phase 26 — Features Maestro Manquantes

> Ce fichier est mis a jour au fur et a mesure du developpement V3.
> Chaque entree note une limitation decouverte et son contournement actuel.

---

## Format des entrees

```
### [DATE] Titre court
- **Decouverte** : Dans quel contexte
- **Impact** : Critique / Eleve / Moyen / Faible
- **Contournement** : Solution temporaire
- **Suggestion** : Ce qui devrait etre ajoute a Maestro
```

---

### 2026-02-13 CLI block CRUD manquant
- **Decouverte** : En planifiant la creation des blocks Layer 1, aucune commande CLI ne permettait de creer/modifier/supprimer des blocks
- **Impact** : Critique — impossible de creer des blocks via CLI, violait le principe CLI-First
- **Contournement** : N/A
- **Suggestion** : Ajouter `block create`, `block update`, `block delete`, `block content` au CLI
- **Resolution** : FAIT — Commandes ajoutees en Phase 26. Backend API existait deja, seul le CLI manquait.

### 2026-02-13 Blocks systeme non visibles dans `block list`
- **Decouverte** : `block list` retourne 17 blocks au lieu de 220 — env var `MAESTRO_GLOBAL_BLOCKS_PATH` dans `dev-start.ps1` pointait vers `C:\Meastro\blocks` (vide) au lieu de `C:\Meastro\content\system\blocks`
- **Impact** : Critique — aucun outil systeme visible
- **Contournement** : N/A
- **Suggestion** : Toujours valider le GlobalBlocksPath au demarrage (log warning si 0 blocks trouves sur le path)
- **Resolution** : FAIT — Corrige dev-start.ps1 ligne 179. Apres correction : 220 blocks visibles (20 tools, 30+ agents, etc.)

### 2026-02-13 API block create ne supporte pas designation/capabilities
- **Decouverte** : `POST /api/blocks` accepte `CreateBlockRequest` mais n'utilise pas `TargetLocation` et ne permet pas de definir `designation` ou `capabilities` directement
- **Impact** : Faible — contournable par appel separe a `block designate`
- **Contournement** : Appeler `block designate` apres `block create`
- **Suggestion** : Ajouter `designation`, `category`, `capabilities` a `CreateBlockRequest` et les traiter dans le controller

### 2026-02-13 Block search endpoint non fonctionnel
- **Decouverte** : `block search <query>` retourne une erreur "Search failed" — le endpoint `/api/discovery/blocks/search` ne semble pas configurable
- **Impact** : Moyen — on peut utiliser `block list` avec des filtres a la place
- **Contournement** : Utiliser `block list --type <type>` ou `block list --designation <designation>`
- **Suggestion** : Verifier et corriger le endpoint de recherche dans le DiscoveryController

### 2026-02-13 Agent blocks: PermissionChecker retourne None sans contexte
- **Decouverte** : En executant `planner-agent` via `POST /api/blocks/{id}/execute`, la commande `run` est bloquee avec "Command 'run' not allowed in this context"
- **Impact** : Critique — les agents ne peuvent pas executer d'outils via maestro_cli sans workspace/session
- **Contournement** : N/A
- **Suggestion** : Quand pas de workspace/session dans le contexte, retourner `Full` permissions (execution directe = pas sandboxe)
- **Resolution** : FAIT — Modifie `PermissionChecker.cs` ligne 76 pour retourner `ContextPermissions.Full` au lieu de `None` quand aucun contexte n'est fourni

### 2026-02-13 RunCommandHandler ne execute pas les blocks
- **Decouverte** : Agent calls `run convention-reader --input workingDir=...` mais recoit `status: "pending"` au lieu du resultat
- **Impact** : Critique — les agents ne peuvent jamais obtenir les resultats de leurs outils
- **Contournement** : N/A
- **Suggestion** : Le `RunCommandHandler` doit utiliser `BlockExecutorRegistry` pour trouver l'executor du block, puis appeler `ExecuteAsync` de maniere synchrone et retourner les outputs
- **Resolution** : FAIT — Injecte `BlockExecutorRegistry` dans `RunCommandHandler`, execute le block via `executor.ExecuteAsync(block, context, inputs)`, retourne les outputs directement

### 2026-02-13 EntryPointExecutor ne dispatch pas par blockRef
- **Decouverte** : En planifiant Layer 3 workflows, `ExecuteNodeAsync` dispatch par pattern-matching sur nodeId (contains "generate", "write", etc.), pas par `blockRef` dans config.nodes
- **Impact** : Eleve — impossible de referencer des agents dans des workflows JSON
- **Contournement** : Utiliser des agents orchestrateurs (agent blocks qui appellent d'autres agents via maestro_cli) au lieu de workflows avec config.nodes
- **Suggestion** : Ajouter un chemin de dispatch par `blockRef` dans `ExecuteRegularNodeAsync` qui utilise `BlockExecutorRegistry` pour executer le block reference. Le commentaire a la ligne 887 d'EntryPointExecutor documente deja cette evolution.

### 2026-02-14 CLI workspace delete --force ne fonctionne pas
- **Decouverte** : `workspace delete <id> --force` affiche toujours "Use --force to confirm" parce que le code CLI ne passe pas `{ force: argv.force }` a `deleteWorkspace()`
- **Impact** : Faible — contournable par appel API direct
- **Contournement** : `curl -X DELETE http://localhost:5000/api/workspaces/<id>`
- **Resolution** : FAIT — Corrige cli.ts ligne 6340, passe `{ force: argv.force }` a `deleteWorkspace()`

### 2026-02-14 CLI workspace create : --repo flag non documente
- **Decouverte** : `workspace create --repo <path>` ne lie pas le repo. Le vrai flag est `--repo-path` (cli.ts ligne 6332)
- **Impact** : Moyen — l'utilisateur croit avoir lie un repo mais il ne l'est pas
- **Contournement** : Utiliser `--repo-path` au lieu de `--repo`
- **Suggestion** : Ajouter un alias `--repo` pour `--repo-path` ou documenter clairement le flag

### 2026-02-14 LLM Provider CUDA crash en multi-turn
- **Decouverte** : Conversations multi-turn (agent iteration 2+) causent un CUDA device-side assert qui corrompt le GPU irreversiblement
- **Impact** : Critique — les agents ne peuvent pas depasser 1 iteration, l'agent loop est completement bloque
- **Cause racine** : `format_chat_prompt()` construisait `<|im_start|>/<|im_end|>` comme texte brut au lieu d'utiliser le tokenizer. Le tokenizer ne reconnaissait pas les tokens speciaux correctement.
- **Resolution** : FAIT —
  1. `format_chat_prompt()` utilise desormais `tokenizer.apply_chat_template()` (tokens speciaux geres correctement)
  2. `model_manager.py` ajoute `_recover_cuda()` qui unload, clear cache, reload et retry automatiquement en cas de CUDA error
  3. `get_tokenizer()` methode ajoutee pour exposer le tokenizer

### 2026-02-14 CliParser strip les guillemets du JSON dans --input-json
- **Decouverte** : L'agent envoie `--input-json {"content":"code..."}` mais le tokenizer CLI strip les `"`, le JSON devient `{content:code...}` = invalide
- **Impact** : Critique — file-write via agent impossible (boucle d'echec)
- **Cause racine** : Le tokenizer CLI traite `"` comme delimiteur de chaîne et le supprime, mais le JSON a besoin des guillemets
- **Resolution** : FAIT — CliParser detecte les blocs JSON ({...} ou [...]), entre en mode JSON et preserve tout le contenu brut (guillemets, whitespace, newlines) jusqu'a l'accolade fermante equilibree

### 2026-02-14 file-write rejette content de type JsonElement
- **Decouverte** : Quand `--input-json {"content":"..."}` est parse par RunCommandHandler, `JsonSerializer.Deserialize` cree un `JsonElement`, pas un `string`. `HandleFileWriteAsync` verifie `contentObj is not string` → echec silencieux
- **Impact** : Critique — file-write via --input-json toujours echoue meme apres fix du parsing
- **Resolution** : FAIT — `HandleFileWriteAsync` accepte maintenant `string`, `JsonElement`, et `object.ToString()`

### 2026-02-14 RunCommandHandler messages d'erreur trop vagues
- **Decouverte** : Quand un block echoue, l'agent recoit juste "Block execution failed" sans details, l'empechant de corriger
- **Impact** : Moyen — l'agent ne peut pas comprendre pourquoi une operation echoue
- **Resolution** : FAIT — Si pas de champ `error` dans les outputs, les logs du block sont inclus dans le message d'erreur

### 2026-02-14 JSON avec newlines litteraux dans --input-json
- **Decouverte** : LLMs generent des JSON avec des retours a la ligne litteraux dans les string values (`{"content":"line1\nline2"}`), invalide en JSON
- **Impact** : Moyen — peut causer des erreurs de parsing intermittentes
- **Resolution** : FAIT — `SanitizeJsonNewlines()` dans RunCommandHandler echappe les `\n` et `\r` litteraux a l'interieur des valeurs de chaîne JSON avant le parsing
