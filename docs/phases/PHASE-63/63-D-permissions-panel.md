# 63-D : PermissionsPanel + integration dans les widgets

**Statut** : A FAIRE
**Effort** : 0.5 jour
**Prerequis** : 63-B COMPLETE (widgets inline), 62-D COMPLETE (API permissions)

---

## Objectif

Creer le composant `PermissionsPanel` qui affiche le diff visuel parent/enfant des permissions, et l'integrer dans les widgets session, workspace et block.

---

## PermissionsPanel

### Fichier : `packages/maestro-code/components/PermissionsPanel.ts`

~50-80 lignes TSX.

### Props

```typescript
interface PermissionsPanelProps {
  effectiveBlocks: string[];    // AllowedBlocks effectifs (apres intersection)
  parentBlocks: string[];       // AllowedBlocks du parent (ceiling)
  blockRules?: BlockPermissionRule[];  // Regles explicites (deny/allow)
  title?: string;               // Titre du panel (default: "PERMISSIONS")
  parentName?: string;          // Nom du parent affiche en header
}

interface BlockPermissionRule {
  pattern: string;
  permission: 'Allowed' | 'Denied' | 'RequiresApproval';
  reason?: string;
}
```

### Rendu

```
┌─ PERMISSIONS ────────────────┐
│                               │
│ Parent: Dev Session (s-456)   │
│                               │
│ ○ file-read                   │  ← blanc (dans effectiveBlocks)
│ ○ file-write                  │  ← blanc
│ ○ step-complete               │  ← blanc
│ · file-edit                   │  ← gris (dans parentBlocks mais PAS dans effectiveBlocks)
│ · shell-execute               │  ← gris
│ · directory-list              │  ← gris
│ · json-validator              │  ← gris
│                               │
│ Rules:                        │
│ ✗ shell-execute (security)    │  ← rouge (deny rule avec raison)
│                               │
└───────────────────────────────┘
```

### Logique de rendu

```typescript
// 1. Lister tous les blocks du parent
const allBlocks = [...new Set([...parentBlocks, ...effectiveBlocks])].sort();

// 2. Pour chaque block :
for (const block of allBlocks) {
  const isEffective = effectiveBlocks.includes(block) || effectiveBlocks.includes('*');
  const denyRule = blockRules?.find(r => r.pattern === block && r.permission === 'Denied');

  if (denyRule) {
    // ✗ rouge avec raison
    render(`✗ ${block}`, { color: 'red' });
    render(` (${denyRule.reason})`, { color: 'gray' });
  } else if (isEffective) {
    // ○ blanc
    render(`○ ${block}`, { color: 'white' });
  } else {
    // · gris
    render(`· ${block}`, { color: 'gray' });
  }
}

// 3. Section Rules (si des rules existent)
if (blockRules?.length > 0) {
  render('Rules:');
  for (const rule of blockRules) {
    render(`✗ ${rule.pattern} (${rule.reason || rule.permission})`, { color: 'red' });
  }
}
```

### Cas speciaux

- **AllowedBlocks = ["*"]** : tout est en blanc, afficher "AllowedBlocks: *" en bas
- **Pas de parent** (workspace root) : pas de diff, tout est blanc, titre "PERMISSIONS (ceiling)"
- **BlockRules sans parentBlocks** : afficher uniquement les rules

---

## Integration dans les widgets

### SessionMonitorWidget

Ajouter le PermissionsPanel comme panel supplementaire dans le layout multi-panel.

**Donnees** : appeler `GET /api/sessions/{id}/permissions/effective` pour obtenir :
- `effective.allowedBlocks` → effectiveBlocks
- `parentEffective.allowedBlocks` → parentBlocks (si parent existe)
- `blockRules` → blockRules

**Position** : panel droit, a cote d'EXECUTION ou de VARIABLES selon le mode.

### WorkspaceDetailWidget

Ajouter le PermissionsPanel comme panel droit.

**Donnees** : les AllowedBlocks du workspace sont le ceiling.
- Pas de parent → tout en blanc
- Titre : "PERMISSIONS (ceiling)"

### BlockDetailWidget

Ajouter un panel "TOOLS REQUIS" qui liste les tools que le block utilise.

**Donnees** : lire le system-prompt.md du block ou les config.nodes pour identifier les tools references. Alternativement, utiliser les `capabilities` du block.json.

**Note** : ce panel n'est PAS un PermissionsPanel (pas de diff parent/enfant). C'est une liste simple des tools requis par le block.

### /permissions \<id\> (standalone)

Widget standalone qui affiche le PermissionsPanel pour une session donnee.
Pas besoin de contexte supplémentaire — juste le panel en plein ecran.
Affiche aussi la commande CLI pour modifier : "Pour modifier: maestro session restrict <id> --allow ..."

---

## Donnees API

Le PermissionsPanel consomme l'API creee en Phase 62-D :

```
GET /api/sessions/{id}/permissions/effective
→ {
    sessionId, sessionName,
    effective: { allowedBlocks: [...] },
    parentEffective: { allowedBlocks: [...] },
    blockRules: [{ pattern, permission, reason }]
  }
```

---

## Tests

1. **PermissionsPanel rendu basique** — affiche les blocks en blanc/gris/rouge
2. **PermissionsPanel wildcard** — tout en blanc quand AllowedBlocks = ["*"]
3. **PermissionsPanel sans parent** — pas de diff, titre "ceiling"
4. **PermissionsPanel deny rule** — ✗ rouge avec raison
5. **Integration SessionMonitorWidget** — panel visible
6. **Integration WorkspaceDetailWidget** — panel visible

---

## Verification

- [ ] PermissionsPanel composant cree
- [ ] Diff visuel fonctionne (○ blanc / · gris / ✗ rouge)
- [ ] Integre dans SessionMonitorWidget
- [ ] Integre dans WorkspaceDetailWidget
- [ ] Integre dans BlockDetailWidget (Tools Requis)
- [ ] /permissions \<id\> fonctionne
- [ ] `npx tsc --noEmit` : 0 erreurs
- [ ] Tests passent
