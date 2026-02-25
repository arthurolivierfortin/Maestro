# 41-A : Foundation — Page Registry + Monitor Exports

## Lecture obligatoire [OBLIGATOIRE]

- `packages/maestro-monitor/package.json` — comprendre les exports actuels (un seul : `./tui-monitor.ts`)
- `packages/maestro-code/package.json` — comprendre les dependances actuelles (pas de @maestro/monitor)
- `packages/maestro-monitor/theme.ts` — comprendre comment les composants monitor resolvent le theme
- `packages/tui/theme/terminal.ts` — comprendre `setTerminalBg` / `resetTerminalBg`
- `packages/maestro-code/types.ts` — comprendre Screen type et CODE_PAGES
- `docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md` section 1 — Page Registry spec

## Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Ajouter les exports granulaires au monitor** — `packages/maestro-monitor/package.json` : exporter `./components/*`, `./hooks/*`, `./theme` pour que maestro-code puisse importer des composants individuels sans passer par l'entry point principal
2. **Ajouter @maestro/monitor comme dependance de maestro-code** — `packages/maestro-code/package.json` : ajouter `"@maestro/monitor": "*"` dans dependencies
3. **Creer le PageRegistry** — `packages/maestro-code/registry/PageRegistry.ts` : implementer la classe PageRegistry avec `register()`, `getById()`, `getAt()`, `getAll()`, `getRing()`, `getDirectionHints()` selon la spec du design document section 20b
4. **Creer les PageDefinition types** — `packages/maestro-code/registry/types.ts` : `PageDefinition`, `PageProps`, `DetailScreenDef`, `Direction`
5. **Enregistrer les 5 pages built-in** — `packages/maestro-code/registry/built-in-pages.ts` : registrer Agent (0,0), Execution (0,-1), Catalog (-1,0), Spaces (1,0), Models (0,1) avec les composants placeholder
6. **Verifier que les imports fonctionnent** — creer un test qui importe `WorkflowTree`, `SessionMonitor`, `CatalogScreen` depuis `@maestro/monitor/components/X.ts`

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-monitor/package.json` | Modifier — ajouter exports `"./components/*"`, `"./hooks/*"`, `"./theme"` |
| `packages/maestro-code/package.json` | Modifier — ajouter `"@maestro/monitor": "*"` dans dependencies |
| `packages/maestro-code/registry/PageRegistry.ts` | Creer — classe PageRegistry avec grid Map + pages Map |
| `packages/maestro-code/registry/types.ts` | Creer — PageDefinition, PageProps, Direction, DetailScreenDef |
| `packages/maestro-code/registry/built-in-pages.ts` | Creer — 5 pages default enregistrees |
| `packages/maestro-code/registry/index.ts` | Creer — barrel export |
| `packages/maestro-code/tests/page-registry.test.ts` | Creer — tests unitaires pour PageRegistry |
| `packages/maestro-code/tests/monitor-imports.test.ts` | Creer — test que les composants monitor sont importables |

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Tests PageRegistry
cd packages/maestro-code && npx vitest run tests/page-registry.test.ts
# Resultat attendu : tous les tests passent (register, getById, getAt, getRing, getDirectionHints)

# Commande 2 : Tests imports monitor
cd packages/maestro-code && npx vitest run tests/monitor-imports.test.ts
# Resultat attendu : WorkflowTree, SessionMonitor, CatalogScreen sont importables

# Commande 3 : Tests existants ne cassent pas
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : 63+ tests passent (aucune regression)

# Commande 4 : Monitor standalone fonctionne toujours
cd packages/maestro-monitor && npx vitest run tests/
# Resultat attendu : 4 tests passent
```

## Anti-patterns [OBLIGATOIRE]

- Ne PAS supprimer l'export principal `"."` du monitor — le monitor standalone doit continuer a fonctionner
- Ne PAS hardcoder les positions des pages dans PageRegistry — les positions viennent de `PageDefinition.position`, pas d'un COMPASS const
- Ne PAS creer de composants de page reels dans cette sous-phase — utiliser des placeholders (`() => h(Text, null, 'TODO')`) pour les components dans built-in-pages.ts
- Ne PAS modifier App.ts dans cette sous-phase — on pose les fondations, on integre dans 41-B

## Checkpoint [OBLIGATOIRE]

```markdown
## 41-A : Foundation — Page Registry + Monitor Exports
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Exports monitor** : [nombre d'exports dans package.json]
**PageRegistry tests** : [X/X passent]
**Import tests** : [X/X passent]
**Tests existants** : [X/X passent — aucune regression]
**Monitor standalone** : [4/4 passent]
```
