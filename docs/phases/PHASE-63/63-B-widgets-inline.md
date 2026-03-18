# 63-B : Widgets inline dans le ConversationLog

**Statut** : A FAIRE
**Effort** : 1-1.5 jours
**Prerequis** : 63-A COMPLETE (FocusProvider necessaire pour le focus des widgets)

---

## Objectif

Creer l'infrastructure pour rendre des widgets interactifs directement dans le flow de conversation. Les widgets sont des composants React qui s'affichent entre les messages du chat.

---

## Architecture

### ConversationEntry augmente

```typescript
type ConversationEntry =
  | { type: 'user'; timestamp: string; content: string }
  | { type: 'agent'; timestamp: string; content: string }
  | { type: 'step'; timestamp: string; content: string }
  | { type: 'widget'; id: string; widget: ChatWidget; interactive: boolean };

interface ChatWidget {
  type: WidgetType;
  props: Record<string, any>;
}

type WidgetType =
  | 'status'           // System health + sessions
  | 'sessions'         // Sessions list (Spaces tab)
  | 'workspaces'       // Workspaces list
  | 'repos'            // Repos list
  | 'catalog'          // Block catalog
  | 'foundry'          // My blocks
  | 'models'           // Model list + metrics
  | 'session-monitor'  // Full session monitor
  | 'block-detail'     // Block info
  | 'model-detail'     // Model info
  | 'workspace-detail' // Workspace info
  | 'repo-detail'      // Repo info
  | 'permissions';     // Permissions diff
```

### ConversationLog modifie

```typescript
// Dans ConversationLog, le rendu boucle sur les entries
{entries.map(entry => {
  if (entry.type === 'widget') {
    return h(InlineWidget, {
      key: entry.id,
      widget: entry.widget,
      focused: focusedWidgetId === entry.id,
      onClose: () => removeWidget(entry.id),
    });
  }
  return h(MessageLine, { key: entry.timestamp, ...entry });
})}
```

### InlineWidget

Composant wrapper qui :
1. Rend le bon widget selon `widget.type`
2. Gere le focus via FocusProvider (`claim('widget')` quand actif)
3. Affiche une bordure Panel autour du widget
4. Gere Esc pour fermer le widget

```typescript
function InlineWidget({ widget, focused, onClose }) {
  const { claim, release } = useFocusLayer();

  useEffect(() => {
    if (focused) claim('widget');
    else release('widget');
  }, [focused]);

  useManagedInput('widget', (input, key) => {
    if (key.escape) onClose();
  });

  return h(Panel, { title: widget.type, focused },
    h(WidgetRenderer, { type: widget.type, props: widget.props })
  );
}
```

---

## Widgets a creer

Chaque widget reutilise au maximum les composants existants de `@maestro/tui`.

### StatusWidget

Source : `HomeScreen.ts`
Contenu : System status (backend + LLM health) + active sessions list
Interactif : Oui (j/k navigate, Enter ouvre `/session <id>`)

### SessionsWidget

Source : `SpacesScreen.ts` (tab Sessions)
Contenu : Session list avec tabs (1/2/3 pour Sessions/Workspaces/Repos)
Interactif : Oui (j/k, Enter expand/open, d delete, r filter)

### WorkspacesWidget

Source : `SpacesScreen.ts` (tab Workspaces)
Contenu : Workspace list
Interactif : Oui (j/k, Enter open)

### ReposWidget

Source : `SpacesScreen.ts` (tab Repos)
Contenu : Repo list
Interactif : Oui (j/k, Enter open)

### CatalogWidget

Source : `CatalogScreen.ts`
Contenu : Block list avec type filter, fitness, capabilities
Interactif : Oui (j/k, Space expand, Enter details, T test, 1/2/3/4 filter)

### FoundryWidget

Source : `FoundryScreen.ts`
Contenu : My blocks list
Interactif : Oui (j/k, Space expand, Enter details)

### ModelsWidget

Source : `ModelsScreen.ts`
Contenu : Model health + metrics + model list
Interactif : Oui (j/k, Enter details, P playground)

### SessionMonitorWidget

Source : `SessionMonitor.ts`
Contenu : Full multi-panel session monitor (mode-aware)
Interactif : Oui (Tab panels, z zoom, j/k scroll, tree nav)

### BlockDetailWidget

Source : `BlockDetail.ts`
Contenu : INFO + FITNESS + SESSIONS + TOOLS REQUIS (nouveau)
Interactif : Non (lecture seule)

### ModelDetailWidget

Source : `ModelDetail.ts`
Contenu : HEALTH + USAGE + PERFORMANCE
Interactif : Oui (P playground)

### WorkspaceDetailWidget

Source : `WorkspaceDetail.ts`
Contenu : Sessions + Settings + PERMISSIONS ceiling (nouveau)
Interactif : Oui (j/k navigate sessions)

### RepoDetailWidget

Source : `RepoDetail.ts`
Contenu : Info + Sessions
Interactif : Oui (j/k navigate sessions)

### PermissionsWidget

Source : Nouveau (Phase 62-E → 63-D)
Contenu : Diff visuel parent/enfant
Interactif : Non (lecture seule)

---

## Strategie d'implementation

### Approche : extraire puis wrapper

Pour chaque page existante :

1. **Extraire** le contenu de la page en composant autonome (sans NavBar, sans StatusBar, sans page routing)
2. **Wrapper** dans un InlineWidget pour le rendu inline
3. **Conserver** l'original pendant la migration (suppression en 63-C)

Ceci permet une migration incrementale sans casser le TUI existant.

---

## Tests

1. **InlineWidget render** — widget s'affiche dans le ConversationLog
2. **InlineWidget focus** — claim('widget') quand focused, release quand unfocused
3. **InlineWidget close** — Esc ferme le widget
4. **Widget injection** — ajouter un widget a la conversation via addWidget()
5. **Multiple widgets** — deux widgets dans le chat, seul le dernier a le focus
6. **Widget interactif** — j/k navigate dans le widget quand il a le focus
7. **Widget non-interactif** — pas de claim, pas de gating

---

## Verification

- [ ] InlineWidget composant cree
- [ ] WidgetRenderer dispatch vers le bon composant
- [ ] Au moins 3 widgets fonctionnent (StatusWidget, SessionsWidget, ModelsWidget)
- [ ] Focus management fonctionne (widget claim/release)
- [ ] Esc ferme le widget
- [ ] `npx tsc --noEmit` : 0 erreurs
- [ ] Tests unitaires passent
