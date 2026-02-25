# 41-F : Agent-in-the-Cockpit (JOIN / CALL / DETACH)

## Lecture obligatoire [OBLIGATOIRE]

- `packages/maestro-code/hooks/useNavigation.ts` — le hook existant avec userScreen/agentScreen/followingAgent/agentState
- `packages/maestro-code/panels/AgentActivity.ts` — mini-panel overlay existant (mascotte compacte + status)
- `packages/maestro-code/panels/AgentBadge.ts` — badge indicateur dans la barre
- `packages/maestro-code/hooks/useSpatialNav.ts` — cree en 41-B, navigation spatiale
- `packages/tui/hooks/useAnimationTick.ts` — pour animations pulsation/clignotement
- `docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md` section 7 — Agent-in-the-Cockpit spec (JOIN/CALL/DETACH, overlays, indicators)

## Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Integrer useNavigation avec useSpatialNav** — Les deux hooks doivent cooperer. `useSpatialNav` gere la page courante, `useNavigation` gere la position de l'agent. Quand l'user navigue via Ctrl+Arrow, ca detache automatiquement de l'agent si necessaire. Quand l'user presse J, ca fait joinAgent + goTo(pageId de l'agent).

2. **Creer MascotteOverlay** — `packages/maestro-code/components/MascotteOverlay.ts` : mini-panel flottant (16x5) qui apparait quand l'agent est sur la MEME page que l'utilisateur. Affiche : mascotte compacte + status text + node courant + shortcuts (Esc detach, Enter focus). Positionne en overlay sur le contenu de la page.

3. **Creer NotificationToast** — `packages/maestro-code/components/NotificationToast.ts` : notification ephemere en haut de l'ecran quand un evenement important se produit et que l'utilisateur est sur une AUTRE page. Evenements : task complete, task error, agent needs input, connection lost. Auto-dismiss 5s. Press any key to dismiss.

4. **Mettre a jour SpatialStatusBar** — Quand agent est sur une autre page :
   - Afficher `⠹ Agent working in [PageName] — [J]oin`
   - La fleche de direction vers la page de l'agent **pulse** (etoile au lieu de fleche : `↑★Execution`)
   Quand agent est sur la meme page :
   - Afficher `⠹ Agent here  [Esc]detach  [Enter]focus`

5. **Ajouter etats mascotte supplementaires** — Ajouter `navigating` (quand agent change de page) et `waiting-input` (quand agent a besoin d'input utilisateur) aux etats geres par la mascotte. Error et thinking restent pour 41-H.

6. **Keyboard integration** — J = joinAgent (global), Esc = detach si agent here + retour home sinon. Enter sur overlay = navigate vers Agent page.

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/MascotteOverlay.ts` | Creer — mini-panel flottant 16x5 avec mascotte + status |
| `packages/maestro-code/components/NotificationToast.ts` | Creer — toast ephemere en haut de l'ecran |
| `packages/maestro-code/components/index.ts` | Modifier — ajouter exports |
| `packages/maestro-code/components/SpatialStatusBar.ts` | Modifier — ajouter agent location hints + pulsation fleche |
| `packages/maestro-code/hooks/useNavigation.ts` | Modifier — integrer avec useSpatialNav (navigation spatiale detache auto) |
| `packages/maestro-code/App.ts` | Modifier — rendre MascotteOverlay et NotificationToast au-dessus du contenu de la page |
| `packages/maestro-code/panels/AgentActivity.ts` | Peut etre supprime si MascotteOverlay le remplace completement |
| `packages/maestro-code/panels/AgentBadge.ts` | Peut etre supprime si SpatialStatusBar le remplace |
| `packages/maestro-code/tests/agent-cockpit.test.ts` | Creer — tests JOIN/CALL/DETACH, overlay visibility, toast events |

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : Tests Agent-in-the-Cockpit
cd packages/maestro-code && npx vitest run tests/agent-cockpit.test.ts
# Resultat attendu : JOIN teleporte user, DETACH detache, overlay visible quand same page, toast quand different page

# Commande 2 : Tests existants
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests passent

# Commande 3 : Real demo check
cd packages/maestro-code && node tests/real-demo-check.cjs
# Resultat attendu : 5/5 PASS

# Commande 4 : Verification visuelle
cd packages/maestro-cli && node index.js code --demo --no-splash
# Resultat attendu :
#   1. Soumettre une tache → agent working
#   2. Ctrl+Left → Catalog → StatusBar montre "Agent in Agent — [J]oin"
#   3. Appuyer J → teleporte vers Agent page
#   4. Quand tache termine (demo ~8s) → toast apparait si sur autre page
```

## Anti-patterns [OBLIGATOIRE]

- Ne PAS dupliquer la logique de navigation — useNavigation et useSpatialNav doivent cooperer, pas implementer chacun leur propre state machine
- Ne PAS rendre MascotteOverlay visible quand l'agent est idle — overlay seulement quand agent est actif (working/navigating/waiting-input) ET sur la meme page
- Ne PAS bloquer les touches quand le toast est visible — le toast se dismiss au premier keypress, il ne capture pas l'input
- Ne PAS supprimer AgentActivity et AgentBadge tant que MascotteOverlay et SpatialStatusBar ne les remplacent pas completement — verifier d'abord, supprimer ensuite

## Checkpoint [OBLIGATOIRE]

```markdown
## 41-F : Agent-in-the-Cockpit
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**JOIN fonctionne** : [J teleporte vers page agent / non]
**DETACH fonctionne** : [Ctrl+Arrow depuis agent detache / non]
**Overlay visible** : [mini-panel quand meme page / non]
**Toast visible** : [notification quand autre page + evenement / non]
**StatusBar agent hint** : [montre location agent quand sur autre page / non]
**Agent cockpit tests** : [X/X passent]
**Real demo check** : [5/5 PASS]
```
