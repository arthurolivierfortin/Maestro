# 41-B : Spatial Navigation + SpatialStatusBar

## Lecture obligatoire [OBLIGATOIRE]

- `packages/maestro-code/registry/PageRegistry.ts` — le registre cree en 41-A
- `packages/maestro-code/registry/types.ts` — PageDefinition, Direction
- `packages/maestro-code/App.ts` — comprendre le routing actuel (NavBar, screen switching, useInput)
- `packages/maestro-code/types.ts` — Screen type actuel, CODE_PAGES, screenToPageKey
- `packages/tui/components/StatusBar.ts` — StatusBar existant dans @maestro/tui
- `packages/tui/hooks/useActionKeyboard.ts` — comprendre le pattern de dispatch clavier
- `docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md` sections 1, 9, 11 — navigation + StatusBar spec

## Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Creer le hook useSpatialNav** — `packages/maestro-code/hooks/useSpatialNav.ts` : lit le PageRegistry, gere `navigate(direction)`, `goHome()`, `goTo(id)`, `rotateRing(clockwise)`, expose `directionHints`, `previousPageId` pour Ctrl+Tab. Voir design doc section 20b.
2. **Creer SpatialStatusBar** — `packages/maestro-code/components/SpatialStatusBar.ts` : remplace RichStatusBar. Affiche [position icon] [page name] [agent status] [direction hints auto-generees] [context shortcuts]. Les hints sont calculees depuis `directionHints` du hook.
3. **Integrer useSpatialNav dans App.ts** — remplacer le routing actuel (NavBar A/C/S/M + Tab cycling) par le spatial nav. Ctrl+Arrow navigue, Esc = home. Le composant de page courant est resolu via `registry.getById(pageId).component`.
4. **Supprimer NavBar** — les raccourcis A/C/S/M et Tab cycling sont remplaces par Ctrl+Arrow. La NavBar n'apparait plus.
5. **Ajouter la transition** — 1-frame directional wipe (texte `▲ EXECUTION`, `◄ CATALOG`, etc.) affiche brievement lors du changement de page.
6. **Tests** — tester la navigation spatiale : Ctrl+Up depuis agent → execution, Esc → agent, Ctrl+Tab → previous, ring rotation.

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/hooks/useSpatialNav.ts` | Creer — hook spatial navigation base sur PageRegistry |
| `packages/maestro-code/hooks/index.ts` | Modifier — exporter useSpatialNav |
| `packages/maestro-code/components/SpatialStatusBar.ts` | Creer — StatusBar avec direction hints auto-generees |
| `packages/maestro-code/components/TransitionWipe.ts` | Creer — 1-frame directional wipe overlay |
| `packages/maestro-code/components/index.ts` | Creer — barrel export composants |
| `packages/maestro-code/App.ts` | Modifier — remplacer NavBar + routing par useSpatialNav + SpatialStatusBar |
| `packages/maestro-code/types.ts` | Modifier — retirer `CODE_PAGES` et `screenToPageKey` (remplaces par registry) |
| `packages/maestro-code/tests/spatial-nav.test.ts` | Creer — tests useSpatialNav |

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Tests spatial nav
cd packages/maestro-code && npx vitest run tests/spatial-nav.test.ts
# Resultat attendu : navigation directionnelle, ring rotation, goHome, goTo, Ctrl+Tab — tous passent

# Commande 2 : Tests existants
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tests adaptes a la nouvelle navigation passent (certains tests NavBar supprimes/modifies)

# Commande 3 : Real demo check
cd packages/maestro-code && node tests/real-demo-check.cjs
# Resultat attendu : 5/5 PASS (SpatialStatusBar visible, navigation fonctionne)

# Commande 4 : Verification visuelle
cd packages/maestro-cli && node index.js code --demo --no-splash
# Resultat attendu : StatusBar en bas avec direction hints, Ctrl+Arrow change de page
```

## Anti-patterns [OBLIGATOIRE]

- Ne PAS garder la NavBar ET le SpatialStatusBar — supprimer completement NavBar, pas de redondance
- Ne PAS hardcoder les directions dans useSpatialNav — tout doit etre calcule depuis `registry.getDirectionHints()`
- Ne PAS casser les tests existants sans les adapter — les tests qui testaient la NavBar doivent etre migres vers des tests de spatial nav
- Ne PAS implementer les pages reelles dans cette sous-phase — les pages restent des placeholders ou les stubs existants. Les vrais ecrans viennent dans 41-C/D/E.

## Checkpoint [OBLIGATOIRE]

```markdown
## 41-B : Spatial Navigation + SpatialStatusBar
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**useSpatialNav tests** : [X/X passent]
**Direction hints** : [verifie que Agent montre 4 directions, Catalog montre seulement →Agent]
**Real demo check** : [5/5 PASS]
**Tests totaux maestro-code** : [X/X passent]
**Verification visuelle** : [Ctrl+Arrow fonctionne / ne fonctionne pas]
```
