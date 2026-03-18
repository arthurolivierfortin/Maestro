# 63-A : FocusProvider + useManagedInput

**Statut** : A FAIRE
**Effort** : 0.5 jour
**Prerequis** : Aucun (peut etre fait en premier)

---

## Objectif

Creer un systeme de focus management avec layers de priorite pour resoudre le scroll bug et preparer le terrain pour les widgets interactifs inline.

---

## Probleme actuel

Tous les `useInput` hooks tirent simultanement. Quand l'utilisateur tape dans le TaskInputBar, les handlers de scroll du SessionMonitor recoivent aussi les events. C'est le "scroll bug".

---

## Implementation

### Fichier 1 : `packages/maestro-code/hooks/useFocusProvider.ts`

```typescript
// Layers de priorite (higher blocks lower)
type FocusLayer = 'modal' | 'widget' | 'input' | 'page';

const LAYER_PRIORITY: Record<FocusLayer, number> = {
  modal: 4,
  widget: 3,
  input: 2,
  page: 1,
};

interface FocusContextType {
  claim: (layer: FocusLayer) => void;
  release: (layer: FocusLayer) => void;
  isActive: (layer: FocusLayer) => boolean;
  activeLayer: FocusLayer | null;
}
```

Le Provider maintient un Set des layers actifs. `isActive(layer)` retourne `true` seulement si aucun layer de priorite superieure n'est actif.

### Fichier 2 : `packages/maestro-code/hooks/useManagedInput.ts`

```typescript
function useManagedInput(layer: FocusLayer, handler: InputHandler) {
  const { isActive } = useFocusContext();

  useInput((input, key) => {
    if (isActive(layer)) {
      handler(input, key);
    }
  });
}
```

Remplace `useInput` partout. Le handler ne fire que si le layer est actif.

### Fichier 3 : Wrapper dans App.ts

```typescript
// Wrap the entire app
h(FocusProvider, null,
  h(App, props)
)
```

---

## Migration initiale

Migrer les composants les plus critiques d'abord (ceux qui causent le scroll bug) :

| Composant | Layer | Priorite |
|-----------|-------|----------|
| App.ts (page hotkeys) | `page` | Basse — bloque quand widget/input/modal actif |
| TaskInputBar | `input` | Moyenne — claim quand focused, release quand blur |
| HelpOverlay | `modal` | Haute — bloque tout en dessous |
| Quit confirmation | `modal` | Haute |

Les autres composants (SpacesScreen, CatalogScreen, etc.) seront migres en 63-C quand ils deviennent des widgets.

---

## Tests

1. **FocusProvider claim/release** — claim('modal') rend isActive('input') = false
2. **Layer priority** — modal bloque widget, widget bloque input, input bloque page
3. **Release reactive** — release('modal') reactive le layer en dessous
4. **Multiple claims** — claim('modal') + claim('input') → modal gagne
5. **useManagedInput gating** — handler ne fire pas quand layer est bloque

---

## Verification

- [ ] FocusProvider cree avec 4 layers
- [ ] useManagedInput hook fonctionne
- [ ] App.ts utilise useManagedInput('page', ...)
- [ ] TaskInputBar utilise useManagedInput('input', ...) + claim/release
- [ ] HelpOverlay utilise useManagedInput('modal', ...) + claim
- [ ] Le scroll bug est resolu (taper dans TaskInputBar ne trigger pas le scroll)
- [ ] `npx tsc --noEmit` : 0 erreurs
- [ ] Tests unitaires passent
