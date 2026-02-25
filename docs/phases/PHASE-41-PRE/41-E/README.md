# 41-E : List Pages (Catalog + Spaces + Models + Details)

## Lecture obligatoire [OBLIGATOIRE]

- `packages/maestro-monitor/components/CatalogScreen.ts` — catalogue complet avec filtres type, expand, fitness bars
- `packages/maestro-monitor/components/SpacesScreen.ts` — 3 onglets (Repos/Workspaces/Sessions)
- `packages/maestro-monitor/components/ModelsScreen.ts` — status panel + liste modeles + detail
- `packages/maestro-monitor/components/BlockDetail.ts` — detail block : info + fitness + sessions
- `packages/maestro-monitor/components/WorkspaceDetail.ts` — detail workspace : sessions + settings
- `packages/maestro-monitor/components/RepoDetail.ts` — detail repo : sessions + .maestro/ info
- `packages/maestro-monitor/components/ModelDetail.ts` — detail modele : health + usage + performance
- `packages/maestro-code/screens/CatalogBrowser.ts` — stub actuel a remplacer
- `packages/maestro-code/screens/SessionBrowser.ts` — stub actuel a remplacer
- `packages/maestro-code/screens/ModelsBrowser.ts` — stub actuel a remplacer
- `docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md` sections 4, 5, 6, 8 — specs Spaces, Catalog, Models, Details

## Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Creer CatalogPage** — `packages/maestro-code/pages/CatalogPage.ts` : page plein ecran wrappant `CatalogScreen` du monitor. Ajoute un onglet "Foundry" pour les blocks en developpement. Navigation Enter → BlockDetail, Space → expand inline.

2. **Creer SpacesPage** — `packages/maestro-code/pages/SpacesPage.ts` : page plein ecran wrappant `SpacesScreen` du monitor. 3 onglets : Repos / Workspaces / Sessions. Enter → detail screen correspondant. J → resume session dans Agent page.

3. **Creer ModelsPage** — `packages/maestro-code/pages/ModelsPage.ts` : page plein ecran wrappant `ModelsScreen` du monitor. Master-detail layout. Enter → ModelDetail.

4. **Creer les 5 ecrans detail** dans `packages/maestro-code/pages/details/` :
   - `BlockDetailPage.ts` — wrappe `BlockDetail` du monitor
   - `SessionDetailPage.ts` — wrappe `SessionMonitor` du monitor (meme que ExecutionPage mais pour n'importe quelle session)
   - `WorkspaceDetailPage.ts` — wrappe `WorkspaceDetail` du monitor
   - `RepoDetailPage.ts` — wrappe `RepoDetail` du monitor
   - `ModelDetailPage.ts` — wrappe `ModelDetail` du monitor

5. **Gerer la navigation detail** — Chaque page liste peut naviguer vers un ecran detail. Esc dans un detail → retour a la page liste parente. Le detail remplace le contenu de la page, pas la page entiere (pas de changement dans le spatial nav).

6. **Supprimer les anciens stubs** — Supprimer `screens/CatalogBrowser.ts`, `screens/SessionBrowser.ts`, `screens/ModelsBrowser.ts`, `screens/BlockDetailScreen.ts`, `screens/SessionDetailScreen.ts`, `screens/ModelDetailScreen.ts`. Mettre a jour `screens/index.ts`.

7. **Mettre a jour le PageRegistry** — Remplacer les placeholders catalog, spaces, models par les vrais composants dans `built-in-pages.ts`.

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/pages/CatalogPage.ts` | Creer — wrappe CatalogScreen + Foundry tab |
| `packages/maestro-code/pages/SpacesPage.ts` | Creer — wrappe SpacesScreen (3 onglets) |
| `packages/maestro-code/pages/ModelsPage.ts` | Creer — wrappe ModelsScreen |
| `packages/maestro-code/pages/details/BlockDetailPage.ts` | Creer — wrappe BlockDetail |
| `packages/maestro-code/pages/details/SessionDetailPage.ts` | Creer — wrappe SessionMonitor |
| `packages/maestro-code/pages/details/WorkspaceDetailPage.ts` | Creer — wrappe WorkspaceDetail |
| `packages/maestro-code/pages/details/RepoDetailPage.ts` | Creer — wrappe RepoDetail |
| `packages/maestro-code/pages/details/ModelDetailPage.ts` | Creer — wrappe ModelDetail |
| `packages/maestro-code/pages/details/index.ts` | Creer — barrel export |
| `packages/maestro-code/pages/index.ts` | Modifier — ajouter exports |
| `packages/maestro-code/registry/built-in-pages.ts` | Modifier — remplacer placeholders par vrais composants |
| `packages/maestro-code/App.ts` | Modifier — gerer navigation vers ecrans detail (state interne a chaque page) |
| `packages/maestro-code/screens/CatalogBrowser.ts` | Supprimer |
| `packages/maestro-code/screens/SessionBrowser.ts` | Supprimer |
| `packages/maestro-code/screens/ModelsBrowser.ts` | Supprimer |
| `packages/maestro-code/screens/BlockDetailScreen.ts` | Supprimer |
| `packages/maestro-code/screens/SessionDetailScreen.ts` | Supprimer |
| `packages/maestro-code/screens/ModelDetailScreen.ts` | Supprimer |
| `packages/maestro-code/screens/index.ts` | Modifier — retirer exports supprimes |
| `packages/maestro-code/tests/list-pages.test.ts` | Creer — test CatalogPage, SpacesPage, ModelsPage rendus |
| `packages/maestro-code/tests/screens.test.ts` | Modifier — adapter aux nouveaux noms de composants |

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Tests list pages
cd packages/maestro-code && npx vitest run tests/list-pages.test.ts
# Resultat attendu : CatalogPage, SpacesPage, ModelsPage rendent sans erreur

# Commande 2 : Tests existants
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests passent (screens.test.ts adapte)

# Commande 3 : Real demo check
cd packages/maestro-code && node tests/real-demo-check.cjs
# Resultat attendu : 5/5 PASS

# Commande 4 : Monitor standalone
cd packages/maestro-monitor && npx vitest run tests/
# Resultat attendu : 4 tests passent

# Commande 5 : Verification visuelle
cd packages/maestro-cli && node index.js code --demo --no-splash
# Resultat attendu : Ctrl+Left → Catalog avec filtres + fitness, Ctrl+Right → Spaces avec 3 onglets
```

## Anti-patterns [OBLIGATOIRE]

- Ne PAS reecrire les composants du monitor — les wrapper. Si l'interface ne matche pas, creer un adaptateur, pas une copie
- Ne PAS garder les anciens stubs a cote des nouveaux composants — supprimer immediatement les fichiers `screens/CatalogBrowser.ts` etc.
- Ne PAS gerer l'etat detail dans App.ts — chaque page gere son propre etat detail internement (useState dans CatalogPage pour tracker si on est en mode liste ou detail)
- Ne PAS casser la page "sessions" existante en la renommant — le type Screen `'sessions'` peut rester pour la compatibilite interne, mais le composant est SpacesPage

## Checkpoint [OBLIGATOIRE]

```markdown
## 41-E : List Pages (Catalog + Spaces + Models + Details)
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Pages creees** : [CatalogPage/SpacesPage/ModelsPage — oui/non]
**Detail pages** : [5/5 creees — Block/Session/Workspace/Repo/Model]
**Stubs supprimes** : [6 fichiers supprimes de screens/]
**List pages tests** : [X/X passent]
**Screens tests adaptes** : [X/X passent]
**Monitor standalone** : [4/4 passent]
**Real demo check** : [5/5 PASS]
```
