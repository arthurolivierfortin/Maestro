# 41-G : Command Palette + Help + Demo Mode

## Lecture obligatoire [OBLIGATOIRE]

- `packages/maestro-code/screens/HelpOverlay.ts` — help overlay actuel a remplacer
- `packages/maestro-code/registry/PageRegistry.ts` — le registre, source pour les sections Navigation et Spatial
- `packages/maestro-code/hooks/useSpatialNav.ts` — expose `registry` pour que CommandPalette et Help puissent lire les pages
- `packages/maestro-code/App.ts` — comprendre ou rendre les modals (CommandPalette, HelpOverlay)
- `packages/maestro-code/services/SessionManager.ts` — comprendre le demo mode actuel
- `packages/tui/hooks/useSelectableList.ts` — pour la liste filtrable dans CommandPalette
- `docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md` sections 12, 13, 14 — CommandPalette, Help, Demo specs

## Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Creer CommandPalette** — `packages/maestro-code/components/CommandPalette.ts` : modal plein ecran (Ctrl+K toggle). Input texte en haut pour fuzzy search. Resultats categorises :
   - **Recent** : derniers items ouverts (sessions, blocks)
   - **Navigation** : auto-populated depuis `registry.getAll()` — chaque page avec son shortcut Ctrl+Arrow
   - **Actions** : New session, Import template, Switch model, Refresh, Voice mode
   - **Sessions** : liste sessions actives
   - **Blocks** : liste blocks
   Utilise `useSelectableList` de @maestro/tui. Enter = executer action. Esc = fermer.

2. **Refaire HelpOverlay** — `packages/maestro-code/components/HelpOverlay.ts` : remplacer le help actuel. Le contenu est **auto-genere depuis le PageRegistry** pour la section Spatial Navigation. Les autres sections (Agent Page, Execution Page, etc.) sont statiques mais organises comme dans le design doc section 13.

3. **Ameliorer le Demo Mode** — Les pages CatalogPage, SpacesPage, ModelsPage doivent afficher des donnees mock en mode demo :
   - `packages/maestro-code/mocks/demo-data.ts` : donnees mock pour catalog (12 blocks), spaces (3 repos, 2 workspaces, 5 sessions), models (6 modeles avec statut)
   - En mode demo, les pages utilisent ces donnees mock au lieu d'appeler l'API

4. **Creer NoBackendScreen** — `packages/maestro-code/components/NoBackendScreen.ts` : ecran d'erreur rouge clair quand backend pas disponible ET `--demo` pas specifie. Affiche les instructions pour demarrer les services ou utiliser `--demo`. Remplace le comportement silencieux actuel.

5. **Mouse support basique** — Ajouter `useMouse` dans App.ts : clic sur les direction hints dans SpatialStatusBar → navigation. Scroll wheel dans ConversationLog et dans les listes. Pas de support mouse complexe dans les panneaux du monitor (deja gere par les hooks tui).

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/CommandPalette.ts` | Creer — modal Ctrl+K avec fuzzy search |
| `packages/maestro-code/components/HelpOverlay.ts` | Creer — remplacer l'ancien help, auto-genere depuis registry |
| `packages/maestro-code/components/NoBackendScreen.ts` | Creer — ecran erreur rouge avec instructions |
| `packages/maestro-code/components/index.ts` | Modifier — ajouter exports |
| `packages/maestro-code/mocks/demo-data.ts` | Creer — donnees mock pour catalog/spaces/models |
| `packages/maestro-code/mocks/index.ts` | Creer — barrel export |
| `packages/maestro-code/App.ts` | Modifier — rendre CommandPalette + HelpOverlay en modal, gerer Ctrl+K et ?, ajouter useMouse |
| `packages/maestro-code/screens/HelpOverlay.ts` | Supprimer — remplace par components/HelpOverlay.ts |
| `packages/maestro-code/pages/CatalogPage.ts` | Modifier — utiliser demo-data en mode demo |
| `packages/maestro-code/pages/SpacesPage.ts` | Modifier — utiliser demo-data en mode demo |
| `packages/maestro-code/pages/ModelsPage.ts` | Modifier — utiliser demo-data en mode demo |
| `packages/maestro-code/tests/command-palette.test.ts` | Creer — test ouverture, fuzzy search, selection |
| `packages/maestro-code/tests/demo-pages.test.ts` | Creer — test que chaque page affiche des donnees en demo mode |

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Tests CommandPalette
cd packages/maestro-code && npx vitest run tests/command-palette.test.ts
# Resultat attendu : ouvre sur Ctrl+K, filtre les resultats, Enter execute action

# Commande 2 : Tests demo pages
cd packages/maestro-code && npx vitest run tests/demo-pages.test.ts
# Resultat attendu : Catalog montre 12 blocks, Spaces montre 3 onglets, Models montre modeles

# Commande 3 : Tests existants
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests passent

# Commande 4 : Real demo check
cd packages/maestro-code && node tests/real-demo-check.cjs
# Resultat attendu : 5/5 PASS

# Commande 5 : Verification visuelle demo mode
cd packages/maestro-cli && node index.js code --demo --no-splash
# Resultat attendu : Ctrl+K ouvre palette, ? ouvre help, Ctrl+Left → Catalog avec 12 blocks mock

# Commande 6 : Verification sans backend sans demo
cd packages/maestro-cli && node index.js code --no-splash
# Resultat attendu : ecran rouge "Backend not available" (pas de demo silencieux)
```

## Anti-patterns [OBLIGATOIRE]

- Ne PAS hardcoder la liste des pages dans CommandPalette ou HelpOverlay — lire depuis `registry.getAll()` et `registry.getDirectionHints()`
- Ne PAS mettre les donnees mock dans les composants pages — les centraliser dans `mocks/demo-data.ts`
- Ne PAS rendre CommandPalette visible en meme temps que HelpOverlay — un seul modal a la fois
- Ne PAS garder le mode demo silencieux actuel — le remplacer completement par le flag explicite `--demo`

## Checkpoint [OBLIGATOIRE]

```markdown
## 41-G : Command Palette + Help + Demo Mode
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**CommandPalette** : [Ctrl+K ouvre + fuzzy search fonctionne / non]
**HelpOverlay** : [auto-genere spatial nav section / non]
**Demo mode pages** : [Catalog/Spaces/Models affichent mock data / non]
**NoBackendScreen** : [ecran erreur sans backend sans --demo / non]
**Mouse support** : [clic StatusBar navigue / non]
**CommandPalette tests** : [X/X passent]
**Demo pages tests** : [X/X passent]
**Real demo check** : [5/5 PASS]
```
