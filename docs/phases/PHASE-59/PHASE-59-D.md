# 59-D : TUI — Visibilite complete de l'isolation des agents

---

## Lecture obligatoire

- `packages/maestro-code/components/SpacesScreen.ts` — liste des sessions, rendu SessionRow
- `packages/maestro-code/App.ts` — slash commands, status bar
- `packages/maestro-cli/cli.ts` — commandes session (list, info)
- `packages/maestro-cli/api-client.ts` — SDK adapter
- `packages/tui/types/api-client.ts` — IApiClient interface
- `apps/backend/src/Maestro.Api/Controllers/SessionsController.cs` — API sessions

---

## Ce que cette sous-phase fait

L'utilisateur doit pouvoir voir, comprendre et controler l'isolation des agents dans le TUI.

### 1. Spaces — sessions enfants sous le parent

Dans `SpacesScreen.ts`, les sessions enfants doivent etre visuellement liees a leur parent :

```
→ ▼ ○ Block Forge - code-reviewer    cfcd8de7  idle       $0.46  2m 30s
      ├─ test-designer                a1b2c3d4  idle       $0.12  45s
      └─ agent-creator                e5f6g7h8  idle       $0.34  1m 45s
   ○ Cost Visual Test                 4c147c39  paused     $0.01  0ms
```

- Les sessions enfants sont **indentees** sous le parent avec `├─` / `└─`
- Le nom est le **block ID** de l'agent (pas le nom de session auto-genere)
- Cout et duree visibles pour chaque enfant
- Quand le parent est collapse (triangle `▶`), les enfants sont caches
- Quand expand (`▼`), les enfants sont visibles

Pour cela, l'API doit retourner `parentSessionId` dans la session. C'est deja le cas — il faut juste l'utiliser dans le rendu.

### 2. Session detail — info parent/enfant

Quand une session est selectionnee dans Spaces (expand view), afficher :
- Si c'est un parent : `Children: 2 sessions (test-designer, agent-creator)`
- Si c'est un enfant : `Parent: cfcd8de7 (Block Forge - code-reviewer)`
- Les permissions heritees du parent (si differentes)

### 3. `/session info` — details d'isolation

Enrichir la commande `/status` ou ajouter `/session` pour afficher :
```
Session: cfcd8de7 (Block Forge - code-reviewer)
  Type: project
  Children:
    a1b2c3d4 — test-designer ($0.12, 45s)
    e5f6g7h8 — agent-creator ($0.34, 1m 45s)
  Permissions: AllowedPaths: [content/system/blocks/], AllowedTools: [*]
  FileAccessRules: 2 rules (1 ReadOnly, 1 Hidden)
  BlockPermissions: 1 rule (deny: shell-execute)
```

### 4. CLI `maestro session list --tree`

Ajouter un flag `--tree` a `maestro session list` qui affiche l'arborescence parent/enfants :
```
cfcd8de7  Block Forge - code-reviewer    idle    $0.46
  a1b2c3d4  test-designer               idle    $0.12
  e5f6g7h8  agent-creator               idle    $0.34
4c147c39  Cost Visual Test               paused  $0.01
```

### 5. API — endpoint enfants

Verifier que `GET /api/sessions/{id}` retourne `parentSessionId` dans le JSON. Ajouter un endpoint ou parametre pour lister les enfants :
- `GET /api/sessions?parentId={id}` — retourne les sessions enfants d'un parent
- Ou inclure les enfants dans le detail du parent

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/SpacesScreen.ts` | Modifier — grouper sessions parent/enfants, indentation, collapse/expand |
| `packages/maestro-code/App.ts` | Modifier — enrichir `/status` avec info parent/enfants/permissions |
| `packages/maestro-cli/cli.ts` | Modifier — `session list --tree` flag |
| `packages/maestro-cli/api-client.ts` | Modifier si besoin — endpoint enfants |
| `apps/backend/src/Maestro.Api/Controllers/SessionsController.cs` | Verifier/modifier — retourner parentSessionId, endpoint enfants |

---

## Tests

| # | Test | Type | Description |
|---|------|------|-------------|
| 1 | SpacesScreen enfants sous parent | Unit | Sessions avec parentSessionId groupees sous le parent |
| 2 | SpacesScreen collapse cache enfants | Unit | Triangle `▶` = enfants caches |
| 3 | SpacesScreen expand montre enfants | Unit | Triangle `▼` = enfants visibles |
| 4 | SpacesScreen session sans enfant | Unit | Pas d'indentation, pas de tree indicator |
| 5 | CLI --tree affiche arborescence | Unit | Output formate avec indentation |
| 6 | API retourne parentSessionId | Integration | GET /api/sessions/{child} contient parentSessionId |
| 7 | Verification visuelle Spaces | E2E/Visual | Spawn TUI, naviguer Spaces, verifier arborescence |
| 8 | Verification visuelle /status | E2E/Visual | Taper /status sur une session parent, verifier enfants listes |

---

## Verification

```bash
# Type check TUI
cd C:\Meastro\packages\maestro-code && npx tsc --noEmit
# 0 erreurs

# Tests TUI
cd C:\Meastro\packages\maestro-code && npx vitest run
# Pas de regression + nouveaux tests passent

# Build backend (si API modifiee)
dotnet build C:\Meastro\apps\backend\src\Maestro.Api\Maestro.Api.csproj
# 0 erreurs

# Verification visuelle via TUI dogfood
# Spawn real mode, naviguer Spaces, verifier sessions parent/enfant
```

---

## Anti-patterns

- Ne PAS ajouter une page entiere pour l'isolation — l'info doit etre dans les vues existantes (Spaces, /status)
- Ne PAS charger tous les enfants a chaque render — charger uniquement quand le parent est expand
- Ne PAS montrer les variables internes des enfants — seulement le resume (cout, duree, statut)
- Ne PAS casser l'affichage pour les sessions sans enfants (la majorite)

---

## Checkpoint

```markdown
## 59-D : TUI Isolation
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Spaces parent/enfant** : arborescence visible
**Collapse/expand** : fonctionne
**/status enfants** : liste les enfants
**CLI --tree** : affiche l'arborescence
**API parentSessionId** : retourne dans le JSON
**Type check** : 0 erreurs
**Tests** : X/8 pass
**Verification visuelle** : captures validees
```
