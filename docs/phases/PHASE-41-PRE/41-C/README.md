# 41-C : Agent Page Redesign (idle / working / completed)

## Lecture obligatoire [OBLIGATOIRE]

- `packages/maestro-code/App.ts` — comprendre InteractiveApp, OutputPanel, InputPrompt, SessionManager, WidgetRenderer
- `packages/maestro-code/screens/AgentScreen.ts` — comprendre l'ecran agent actuel
- `packages/maestro-code/panels/AgentActivity.ts` — comprendre le composant mascotte + status
- `packages/tui/sprites/mascotte.ts` — comprendre les sprites mascotte existants (5 etats, 2 frames, 24x22)
- `packages/tui/theme/animations.ts` — SPINNER_FRAMES, BREATHING_DOTS, etc.
- `packages/tui/hooks/index.ts` — hooks disponibles
- `docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md` sections 2, 10 — Agent page spec + mascotte spec

## Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Creer AgentPage** — `packages/maestro-code/pages/AgentPage.ts` : composant plein ecran qui remplace l'ecran agent actuel. Trois etats visuels :
   - **Idle** : Mascotte centree grande (MascotteFull 24x13), system status (backend + LLM health), active sessions summary, input prompt en bas
   - **Working** : Mascotte compacte header (MascotteCompact 16x1 + spinner + status text), scrollable ConversationLog, widgets inline, input prompt en bas
   - **Completed** : Mascotte celebrant, summary card (fichiers, tests, duree), lien vers Execution page

2. **Creer MascotteFull** — `packages/maestro-code/components/MascotteFull.ts` : rendu grande mascotte centree avec animation breathing (idle), pulse (working), celebration (done). Utilise les sprites de `@maestro/tui/sprites/mascotte`.

3. **Creer MascotteCompact** — `packages/maestro-code/components/MascotteCompact.ts` : 1 ligne — mini face + core symbol + spinner + status text. Ex: `◉ ┃┃ ◉ [◆]  ⠹ Agent working — Implementing auth...`

4. **Creer ConversationLog** — `packages/maestro-code/components/ConversationLog.ts` : remplace OutputPanel. Log scrollable avec user messages (`❯`), agent phases (`◆`), step details indentes, fichiers crees (dot leaders + status). Utilise `useScroll` de @maestro/tui.

5. **Integrer WidgetRenderer** dans le flux de conversation — les widgets apparaissent inline dans le ConversationLog (pas dans un panneau separe).

6. **Migrer SessionManager** dans son propre fichier — `packages/maestro-code/services/SessionManager.ts` : extraire la classe de App.ts pour reduire la taille du fichier.

7. **Integrer AgentPage dans App.ts** — remplacer le rendu agent actuel par AgentPage. Le composant recoit : sessionManager, apiClient, lines, busy, widgets, height, width.

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/pages/AgentPage.ts` | Creer — plein ecran avec 3 etats (idle/working/completed) |
| `packages/maestro-code/pages/index.ts` | Creer — barrel export pages |
| `packages/maestro-code/components/MascotteFull.ts` | Creer — grande mascotte centree avec animations |
| `packages/maestro-code/components/MascotteCompact.ts` | Creer — 1-ligne mascotte header |
| `packages/maestro-code/components/ConversationLog.ts` | Creer — log conversationnel scrollable |
| `packages/maestro-code/services/SessionManager.ts` | Creer — extraire SessionManager de App.ts |
| `packages/maestro-code/services/index.ts` | Creer — barrel export |
| `packages/maestro-code/App.ts` | Modifier — utiliser AgentPage, importer SessionManager depuis services/ |
| `packages/maestro-code/registry/built-in-pages.ts` | Modifier — remplacer placeholder agent par AgentPage reel |
| `packages/maestro-code/tests/agent-page.test.ts` | Creer — tests AgentPage (idle, working, completed states) |

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Tests AgentPage
cd packages/maestro-code && npx vitest run tests/agent-page.test.ts
# Resultat attendu : idle affiche mascotte + system status, working affiche conversation, completed affiche summary

# Commande 2 : Tests existants
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests passent (certains adaptes pour SessionManager extracte)

# Commande 3 : Real demo check
cd packages/maestro-code && node tests/real-demo-check.cjs
# Resultat attendu : 5/5 PASS — agent page rend correctement en demo mode

# Commande 4 : Verification visuelle
cd packages/maestro-cli && node index.js code --demo --no-splash
# Resultat attendu : mascotte visible au centre (idle), devient compacte quand tache soumise
```

## Anti-patterns [OBLIGATOIRE]

- Ne PAS garder OutputPanel ET ConversationLog — supprimer OutputPanel, le remplacer completement par ConversationLog
- Ne PAS dupliquer la logique SessionManager — extraire, pas copier. App.ts importe depuis services/
- Ne PAS mettre de `.catch(() => null)` dans AgentPage — les erreurs doivent etre visibles (texte rouge dans le ConversationLog)
- Ne PAS hardcoder les dimensions de la mascotte — utiliser `height` et `width` fournis par le parent pour choisir entre Full et Compact
- Ne PAS implementer les 7 etats de mascotte dans cette sous-phase — idle, working, celebrating suffisent pour v1. Les autres (navigating, error, thinking, waiting-input) seront ajoutes en 41-F et 41-H.

## Checkpoint [OBLIGATOIRE]

```markdown
## 41-C : Agent Page Redesign
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**AgentPage tests** : [X/X passent]
**SessionManager extraite** : [oui/non — App.ts importe depuis services/]
**Mascotte idle** : [visible centree en demo / non]
**Mascotte working** : [compacte avec spinner / non]
**Real demo check** : [5/5 PASS]
**Tests totaux** : [X/X passent]
```
