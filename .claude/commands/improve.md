# Maestro TUI — Boucle d'amelioration autonome

Tu es un agent de developpement autonome qui ameliore le TUI maestro-code (React/Ink). Suis cette boucle exacte.

## Protocoles obligatoires

Avant de commencer, rappelle-toi :
- `docs/system/AGENT-PROTOCOL.md` — anti-hallucination, verification en 3 temps
- `docs/system/TESTING-PROTOCOL.md` — 6 couches, ordre d'execution
- `docs/guides/ai-agents/common-pitfalls.md` — JAMAIS de `@ts-nocheck`, TOUJOURS `real-demo-check.cjs`

## PHASE 1 : OBSERVER

1. Lancer le TUI via MCP :
   - `tui_spawn` avec `mode: "demo"` (pas besoin du backend pour l'observation visuelle)
2. Capturer l'ecran initial :
   - `tui_frame` — lire CHAQUE ligne attentivement
3. Naviguer systematiquement a travers toutes les pages :
   - Appuyer `h` (Home) → `tui_frame` → noter ce qu'on voit
   - Appuyer `a` (Agent) → `tui_frame` → noter l'etat du chat
   - Appuyer `s` (Spaces) → `tui_frame` → noter les sessions/workspaces
   - Appuyer `f` (Foundry) → `tui_frame` → noter l'etat de l'entrainement
   - Appuyer `c` (Catalog) → `tui_frame` → noter les blocks affiches
   - Appuyer `m` (Models) → `tui_frame` → noter l'etat des modeles
4. Tester les interactions cles :
   - Sur la page Agent : appuyer `/` pour focus l'input, taper un message test, appuyer `enter`
   - Sur la page Catalog : appuyer `j`/`k` pour scroller, `1`/`2`/`3`/`4` pour filtrer par type
   - Sur la page Spaces : naviguer dans les sessions avec `j`/`k`, `enter` pour ouvrir
   - Tester `escape` pour fermer les overlays
   - Tester `?` pour l'aide
5. Arreter le TUI :
   - `tui_kill`

## PHASE 2 : ANALYSER

Relire toutes les frames capturees. Pour chaque page/interaction :
- Decrire ce qui est affiche
- Identifier les problemes visuels (alignement, troncature, caracteres corrompus, espaces vides)
- Identifier les problemes fonctionnels (navigation cassee, donnees manquantes, widgets non reactifs)
- Identifier les problemes UX (pas de feedback, action ambigue, texte incomprehensible)
- Noter la severite : critique (crash/freeze), majeur (feature cassee), mineur (cosmetique)

Compiler une liste priorisee des **TOP 3 problemes** par impact utilisateur.

## PHASE 3 : CORRIGER

Prendre le probleme le plus impactant. Le corriger :

1. Lire les fichiers source concernes (les composants sont dans `packages/maestro-code/`)
2. Faire le changement MINIMAL necessaire — une seule correction, pas de refactoring
3. Verifier le build TypeScript :
   ```bash
   cd C:\Meastro\packages\maestro-code && npx tsc --noEmit
   ```
4. Executer les tests unitaires :
   ```bash
   cd C:\Meastro\packages\maestro-code && npx vitest run
   ```
5. Executer le real demo check :
   ```bash
   cd C:\Meastro\packages\maestro-code && node tests/real-demo-check.cjs
   ```

**Si le build ou les tests echouent, corriger AVANT de continuer.**

## PHASE 4 : VALIDER

1. Relancer le TUI : `tui_spawn` avec `mode: "demo"`
2. Naviguer jusqu'a la zone corrigee
3. Capturer la frame : `tui_frame`
4. Verifier que le probleme est resolu : `tui_check` avec le texte attendu
5. Verifier qu'aucune regression n'est apparue :
   - Naviguer les autres pages (`h`, `a`, `s`, `f`, `c`, `m`)
   - Capturer et lire chaque frame
6. Arreter : `tui_kill`

**Si la correction a cree une regression, revert immediatement et essayer une autre approche.**

## PHASE 5 : RAPPORTER

Resumer en un paragraphe :
- Quel probleme a ete trouve (avec la page/composant concerne)
- Quelle correction a ete appliquee (avec le chemin du fichier modifie)
- Avant/apres — le changement visuel observe
- Problemes restants pour la prochaine iteration

## REGLES

- Corriger UN SEUL probleme par iteration, jamais plusieurs
- TOUJOURS verifier visuellement APRES la correction — le build seul ne suffit pas
- Si une correction casse quelque chose, revert immediatement
- JAMAIS de `@ts-nocheck` — corriger les types correctement
- JAMAIS de refactoring cosmetique — corrections fonctionnelles uniquement
- Le TUI est en React/Ink (pas Electron, pas un navigateur) — les outils sont `tui_*`, pas des selecteurs CSS
- Comparer au standard : un TUI terminal propre et lisible (pas VS Code, c'est un terminal)
- Les composants TUI sont dans `packages/maestro-code/` — c'est du TypeScript/React/Ink
