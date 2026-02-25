# 41-H : Polish, Responsive, Tests, Cleanup

## Lecture obligatoire [OBLIGATOIRE]

- `packages/maestro-code/App.ts` — etat final apres 41-A→G, comprendre la taille du fichier et l'organisation
- `packages/maestro-code/tests/real-demo-check.cjs` — le test d'integration real-path
- `packages/tui/theme/terminal.ts` — setTerminalBg/resetTerminalBg
- `packages/maestro-code/components/MascotteFull.ts` — creer en 41-C, ajouter etats manquants
- `memory/tui-verification.md` — protocole de verification TUI
- `docs/phases/PHASE-41-PRE/DESIGN-SPATIAL-TUI.md` sections 16, 17, 18, 21 — responsive, mouse, terminal effects, checklist

## Ce que cette sous-phase fait [OBLIGATOIRE]

1. **Responsive design** — Adapter le layout selon la taille du terminal :
   - Width ≥120 : full layout (master 55% + detail 45%)
   - Width 100-119 : standard (50/50)
   - Width 80-99 : narrow (single column, detail on Enter)
   - Width 60-79 : compact (truncated, no fitness bars)
   - Width <60 : warning message
   - Height <20 : minimal (no mascotte, text-only)
   Utiliser `useStdout()` d'Ink pour les dimensions + re-render on resize.

2. **Terminal effects** —
   - `setTerminalBg(palette.bg)` au demarrage, `resetTerminalBg()` au cleanup (process.on('exit'))
   - Terminal bell : single `\x07` on task complete, double on error, triple on agent needs input
   - Flag `--no-bell` pour desactiver

3. **Etats mascotte manquants** — Ajouter `error` (yeux X rouges, shaking) et `thinking` (main sur menton, dots). Completer les 7 etats specifies dans le design doc section 10.

4. **Personality events** — Mascotte reagit aux evenements :
   - Session created → eyes brighten
   - All tests passed → celebrating 3s
   - Test failed → error state
   - Idle >30s → falls asleep (Z's float)
   - User returns → wake-up animation

5. **Cleanup code** —
   - Supprimer `layouts/FlipperLayout.ts` (remplace par les pages plein ecran)
   - Supprimer `screens/AgentScreen.ts` (remplace par `pages/AgentPage.ts`)
   - Supprimer les composants panels/ inutilises si MascotteOverlay les remplace
   - Verifier qu'aucun import casse ne reste
   - Simplifier App.ts : deleguer le max aux pages et hooks

6. **Tests comprehensifs** —
   - Mettre a jour `real-demo-check.cjs` pour verifier la navigation spatiale, les direction hints, les pages
   - Ajouter des assertions : SpatialStatusBar visible, direction hints correctes, Ctrl+Arrow fonctionne
   - Verifier que TOUS les tests des 3 packages passent
   - Compter le total de tests et mettre a jour MEMORY.md

7. **Documentation** —
   - Mettre a jour `memory/MEMORY.md` avec la nouvelle architecture
   - Creer `docs/phases/PHASE-41-PRE/CHANGELOG.md` avec le resume de tout ce qui a change
   - Mettre a jour checkpoint.md final

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/App.ts` | Modifier — setTerminalBg/resetTerminalBg, bell, responsive hooks |
| `packages/maestro-code/components/MascotteFull.ts` | Modifier — ajouter etats error/thinking |
| `packages/maestro-code/components/MascotteCompact.ts` | Modifier — ajouter etats error/thinking |
| `packages/maestro-code/layouts/FlipperLayout.ts` | Supprimer |
| `packages/maestro-code/screens/AgentScreen.ts` | Supprimer |
| `packages/maestro-code/panels/AgentActivity.ts` | Supprimer si remplace par MascotteOverlay |
| `packages/maestro-code/panels/AgentBadge.ts` | Supprimer si remplace par SpatialStatusBar |
| `packages/maestro-code/tests/real-demo-check.cjs` | Modifier — ajouter assertions spatial nav |
| `packages/maestro-code/tests/responsive.test.ts` | Creer — test breakpoints de largeur/hauteur |
| `docs/phases/PHASE-41-PRE/CHANGELOG.md` | Creer — resume des changements de toute la phase |
| `memory/MEMORY.md` | Modifier — mettre a jour architecture, compte de tests |

## Verification [OBLIGATOIRE]

```bash
# Commande 1 : TOUS les tests maestro-code
cd packages/maestro-code && npx vitest run tests/
# Resultat attendu : XX tests passent (aucune regression)

# Commande 2 : Tests TUI
cd packages/tui && npx vitest run tests/
# Resultat attendu : 67 tests passent

# Commande 3 : Tests monitor
cd packages/maestro-monitor && npx vitest run tests/
# Resultat attendu : 4 tests passent

# Commande 4 : Real demo check (OBLIGATOIRE)
cd packages/maestro-code && node tests/real-demo-check.cjs
# Resultat attendu : 5/5 PASS avec navigation spatiale + direction hints + pages

# Commande 5 : Verification visuelle complete
cd packages/maestro-cli && node index.js code --demo --no-splash
# Resultat attendu :
#   - Terminal background gris (#1e1e1e)
#   - Agent page avec mascotte breathing
#   - Ctrl+Up → Execution page avec arbre + log
#   - Ctrl+Left → Catalog avec blocks mock
#   - Ctrl+Right → Spaces avec 3 onglets
#   - Ctrl+Down → Models avec liste modeles
#   - Ctrl+K → Command palette
#   - ? → Help overlay
#   - Esc → retour Agent
#   - Bell quand tache complete

# Commande 6 : Sans backend sans demo
cd packages/maestro-cli && node index.js code --no-splash
# Resultat attendu : ecran rouge "Backend not available"

# Commande 7 : Pas d'imports casses
cd packages/maestro-code && npx tsc --noEmit 2>&1 | head -20
# Resultat attendu : pas d'erreurs d'import (ou erreurs pre-existantes seulement)
```

## Anti-patterns [OBLIGATOIRE]

- Ne PAS supprimer des fichiers avant d'avoir verifie qu'ils ne sont plus importes nulle part — `grep -r "FlipperLayout\|AgentScreen\|AgentActivity\|AgentBadge" packages/maestro-code/`
- Ne PAS oublier `resetTerminalBg()` au exit — si le process crash, le terminal reste avec le background gris
- Ne PAS declarer la phase DONE sans avoir execute les 7 commandes de verification ci-dessus
- Ne PAS ecrire "tests passent" sans copier le resultat reel dans le checkpoint

## Checkpoint [OBLIGATOIRE]

```markdown
## 41-H : Polish, Responsive, Tests, Cleanup
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Fichiers supprimes** : [FlipperLayout.ts, AgentScreen.ts, ...]
**Terminal background** : [setTerminalBg au startup / non]
**Bell events** : [single/double/triple bell fonctionne / non]
**Responsive** : [breakpoints width fonctionnent / non]
**Mascotte 7 etats** : [idle/working/waiting-input/navigating/error/celebrating/thinking — X/7]
**Tests maestro-code** : [X/X passent]
**Tests tui** : [67/67 passent]
**Tests monitor** : [4/4 passent]
**Real demo check** : [5/5 PASS]
**Total tests** : [XXX — maj dans MEMORY.md]
**CHANGELOG** : [cree dans docs/phases/PHASE-41-PRE/CHANGELOG.md]
```
