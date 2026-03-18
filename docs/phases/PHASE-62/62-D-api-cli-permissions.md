# 62-D : API et CLI de gestion des permissions

**Statut** : DONE
**Effort** : 0.5-1 jour
**Prerequis** : 62-A COMPLETE

---

## Objectif

Exposer la gestion des permissions via l'API REST et le CLI pour que l'utilisateur puisse voir, configurer et debugger les permissions de ses sessions et workspaces.

---

## API REST

### GET /api/sessions/{id}/permissions/effective

Retourne les permissions effectives d'une session (apres intersection avec tous les parents).

**Response** :
```json
{
  "sessionId": "abc-123",
  "sessionName": "Cantante - Dev Session",
  "effective": {
    "allowedBlocks": ["file-read", "file-write", "step-complete"],
    "allowedTools": ["*"],
    "allowedCommands": ["run", "list-tools"],
    "canCreateBlocks": true,
    "canCreateSessions": true
  },
  "own": {
    "allowedBlocks": ["file-read", "file-write", "step-complete"],
    "allowedTools": ["*"],
    "allowedCommands": ["*"]
  },
  "parentId": "parent-456",
  "parentEffective": {
    "allowedBlocks": ["*"],
    "allowedTools": ["*"]
  },
  "blockRules": [
    {"pattern": "shell-execute", "permission": "Denied", "reason": "security"}
  ]
}
```

**Implementation** : dans `SessionsController.cs`, ajouter un endpoint qui lit `session.GetEffectivePermissions()` et `session.BlockPermissions`.

### PUT /api/sessions/{id}/permissions

Met a jour les AllowedBlocks d'une session. L'intersection avec le parent est appliquee automatiquement par `UpdatePermissions()`.

**Request** :
```json
{
  "allowedBlocks": ["file-read", "file-write", "step-complete"],
  "allowedCommands": ["run", "list-tools"]
}
```

**Response** : les permissions effectives resultantes (meme format que GET).

### PUT /api/sessions/{id}/block-rules

Definit les regles BlockPermission explicites (deny/allow/requires-approval par pattern).

**Request** :
```json
{
  "rules": [
    {"pattern": "shell-execute", "permission": "Denied", "reason": "no shell access in this session"},
    {"pattern": "agents/*", "permission": "Allowed"}
  ]
}
```

### GET /api/workspaces/{id}/tree

Retourne l'arbre de sessions d'un workspace avec permissions et couts par niveau.

**Response** :
```json
{
  "workspaceId": "ws-789",
  "sessions": [
    {
      "id": "session-1",
      "name": "Dev Session",
      "status": "Active",
      "allowedBlocks": ["*"],
      "accumulatedCost": 0.52,
      "children": [
        {
          "id": "child-1",
          "name": "child / agents/agent-creator",
          "status": "Completed",
          "allowedBlocks": ["file-read", "file-write", "step-complete"],
          "accumulatedCost": 0.12,
          "children": []
        }
      ]
    }
  ]
}
```

---

## CLI

### maestro session permissions \<id\>

Affiche les permissions effectives d'une session.

```
$ maestro session permissions abc-123

Session: Cantante - Dev Session (abc-123)
Parent:  workspace ws-789

Effective AllowedBlocks:
  ✓ file-read
  ✓ file-write
  ✓ step-complete
  ✗ shell-execute (denied by block rule: "security")

Block Rules:
  DENY  shell-execute  (security)
  ALLOW agents/*
```

**Implementation** : appel GET `/api/sessions/{id}/permissions/effective`, formatage en tableau.

### maestro session restrict \<id\> --allow \<blocks\> --deny \<blocks\>

Modifie les permissions d'une session.

```
$ maestro session restrict abc-123 --allow file-read,file-write,step-complete --deny shell-execute

Permissions updated for session abc-123:
  ✓ file-read
  ✓ file-write
  ✓ step-complete
  ✗ shell-execute (denied)
```

**Implementation** : appel PUT `/api/sessions/{id}/permissions` et/ou PUT `/api/sessions/{id}/block-rules`.

### maestro workspace tree \<id\>

Affiche l'arbre de sessions d'un workspace.

```
$ maestro workspace tree ws-789

Workspace ws-789
  └─ Dev Session (session-1) [$0.52] AllowedBlocks: *
       ├─ agents/agent-creator (child-1) [$0.12] AllowedBlocks: file-read, file-write, step-complete
       └─ agents/test-designer (child-2) [$0.08] AllowedBlocks: file-read, step-complete
```

---

## Fichiers concernes

| Fichier | Action |
|---------|--------|
| `Maestro.Api/Controllers/SessionsController.cs` | Ajouter 3 endpoints |
| `packages/maestro-cli/commands/session.ts` | Ajouter `permissions`, `restrict` |
| `packages/maestro-cli/commands/workspace.ts` | Ajouter `tree` |

---

## Tests

1. **GET effective** — retourne les permissions intersectees
2. **PUT permissions** — applique l'intersection avec le parent
3. **PUT permissions escalation refusee** — si le child demande des blocks que le parent n'a pas, `UpdatePermissions()` applique l'intersection et les blocks supplementaires sont ignores. Verifier que `GetEffectivePermissions()` ne contient PAS les blocks escalades. Ce test est critique : il valide que `UpdatePermissions` fait reellement l'intersection (et pas juste un set sans verifier le parent).
4. **PUT block-rules** — sauvegarde les regles
5. **GET tree** — retourne l'arbre avec couts
6. **PUT permissions puis GET effective** — round-trip complet pour verifier la coherence

---

## Verification

- [ ] `GET /api/sessions/{id}/permissions/effective` fonctionne
- [ ] `PUT /api/sessions/{id}/permissions` applique l'intersection
- [ ] `PUT /api/sessions/{id}/block-rules` sauvegarde les regles
- [ ] `GET /api/workspaces/{id}/tree` retourne l'arbre
- [ ] `maestro session permissions` affiche les permissions
- [ ] `maestro session restrict` modifie les permissions
- [ ] `maestro workspace tree` affiche l'arbre
- [ ] Tests passent
- [ ] Checkpoint mis a jour
