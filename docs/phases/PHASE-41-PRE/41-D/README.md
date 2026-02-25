# 41-D : Execution Page (SessionMonitor complet)

## Lecture obligatoire [OBLIGATOIRE]

- `packages/maestro-monitor/components/SessionMonitor.ts` — LE composant central : 3 modes (descriptor/execution/idle), panel focus, zoom, keyboard dispatch, panel toggles
- `packages/maestro-monitor/hooks/useSessionData.ts` — polling session data dans le monitor
- `packages/tui/hooks/usePanelFocus.ts` — comprendre le cycling entre panneaux
- `packages/tui/hooks/useTreeNav.ts` — comprendre la navigation arborescente
- `packages/tui/hooks/useScroll.ts` — comprendre le scroll multi-panel
- `packages/tui/components/WorkflowTree.ts` — arbre d'execution interactif
- `packages/tui/components/PhaseWorkflow.ts` — phases + execution fusionnes
- `packages/maestro-code/hooks/useSpatialNav.ts` — cree en 41-B, le hook de navigation spatiale
- `docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md` section 3 — Execution page spec (3 modes, panels, keyboard)

## Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Creer ExecutionPage** — `packages/maestro-code/pages/ExecutionPage.ts` : page plein ecran qui wrappe `SessionMonitor` du monitor. Recoit `apiClient` et `sessionId` (de la session courante). Si `sessionId` est null → affiche message "No active session" avec lien vers Agent page.

2. **Adapter SessionMonitor pour recevoir des props externes** — Si le SessionMonitor du monitor est couple a son propre App.ts, creer un wrapper leger qui lui passe les bonnes props (apiClient, sessionId, height, width). NE PAS modifier SessionMonitor.ts dans le monitor si possible — le wrapper gere l'adaptation.

3. **Integrer les 11 panneaux** — L'ExecutionPage doit montrer les memes panneaux que le monitor standalone :
   - Mode descriptor : PhaseWorkflow + LLMActivity + ExecutionLog
   - Mode execution : WorkflowTree + Filesystem + WidgetsPanel + MetricsPanel
   - Mode idle : Variables + Filesystem + CommandLog
   - Le mode est auto-detecte depuis la session data

4. **Panel interactions** — Tab/Shift+Tab cycle le focus, 1/2/3 jump direct, z zoom, Esc unzoom. Touches t/f/w/v/l toggle les panneaux. Le clavier ne doit PAS interagir avec le spatial nav quand on est sur l'Execution page (sauf Ctrl+Arrow et Esc global).

5. **Integrer dans le PageRegistry** — Remplacer le placeholder execution dans `built-in-pages.ts` par le vrai ExecutionPage.

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/pages/ExecutionPage.ts` | Creer — page plein ecran wrappant SessionMonitor |
| `packages/maestro-code/pages/index.ts` | Modifier — ajouter export ExecutionPage |
| `packages/maestro-code/registry/built-in-pages.ts` | Modifier — remplacer placeholder execution par ExecutionPage |
| `packages/maestro-code/App.ts` | Modifier — passer sessionId au page renderer pour que ExecutionPage le recoive |
| `packages/maestro-code/tests/execution-page.test.ts` | Creer — test ExecutionPage (no-session state, with session renders panels) |

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Tests ExecutionPage
cd packages/maestro-code && npx vitest run tests/execution-page.test.ts
# Resultat attendu : no-session montre message, with-session montre WorkflowTree/ExecutionLog

# Commande 2 : Tests existants
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests passent

# Commande 3 : Monitor standalone pas casse
cd packages/maestro-monitor && npx vitest run tests/
# Resultat attendu : 4 tests passent

# Commande 4 : Real demo check
cd packages/maestro-code && node tests/real-demo-check.cjs
# Resultat attendu : 5/5 PASS

# Commande 5 : Verification visuelle
cd packages/maestro-cli && node index.js code --demo --no-splash
# Resultat attendu : Ctrl+Up depuis Agent → page Execution avec arbre + log + metriques
```

## Anti-patterns [OBLIGATOIRE]

- Ne PAS copier SessionMonitor dans maestro-code — l'importer depuis `@maestro/monitor/components/SessionMonitor.ts`
- Ne PAS modifier SessionMonitor.ts dans maestro-monitor — creer un wrapper si l'interface ne match pas
- Ne PAS casser le dispatch clavier — Tab/Shift-Tab/z/t/f/w/v/l doivent fonctionner UNIQUEMENT quand l'ExecutionPage est active, pas sur les autres pages
- Ne PAS dupliquer le polling — ExecutionPage utilise le meme `useSessionData` que le monitor, via le sessionId partage depuis App.ts
- Ne PAS hardcoder les layouts de mode — laisser SessionMonitor gerer ses propres layouts par mode (descriptor/execution/idle)

## Checkpoint [OBLIGATOIRE]

```markdown
## 41-D : Execution Page (SessionMonitor complet)
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**ExecutionPage tests** : [X/X passent]
**No-session state** : [message affiche correctement / non]
**Panneaux visibles en demo** : [WorkflowTree/ExecutionLog/MetricsPanel visibles / non]
**Panel focus Tab** : [fonctionne / non]
**Monitor standalone** : [4/4 passent]
**Real demo check** : [5/5 PASS]
```
