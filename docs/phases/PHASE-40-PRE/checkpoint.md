# Phase 40-PRE — Checkpoint

## 40-PRE-C : Bug Fixing & Verification
**Statut** : DONE
**Date** : 2026-02-24

### Tests Baseline

| Package | Tests | Resultat |
|---------|-------|----------|
| @maestro/tui | 40 | 40/40 pass |
| maestro-monitor | 4 | 4/4 pass |
| maestro-code | 32 | 32/32 pass |
| @maestro/client | 19 | 19/19 pass |
| @maestro/sidecar | 5 | 5/5 pass |
| adapt-optimize | 16 | 16/16 pass |
| sandbox-manager | 22 | 18/18 pass + 4 skipped (Docker) |
| Backend C# | — | Build OK, 0 warnings |
| **Total** | **138** | **134 pass, 4 skipped, 0 fail** |

### Bugs corriges

1. **LLMMonitorScreen.ts theme crash** : Utilisait `theme.colors.brand`, `theme.primary()`, etc. qui n'existent pas — `theme` est un objet, les helpers sont des exports separees. Fix : importer `primary, success, warning, error, muted, T` directement depuis `../theme.ts`.

2. **OutputPanel memoire non bornee** : `setLines(prev => [...prev, line])` sans limite. Fix : FIFO cap a 500 lignes (`MAX_LINES = 500`).

3. **InputPrompt pas de curseur gauche/droite** : Seulement backspace + append. Fix : tracking curseur via `useRef` (evite stale closures), support fleches gauche/droite, Ctrl+A (debut), Ctrl+E (fin).

4. **BlockDetail actions "coming soon"** : 3/4 actions marquees indisponibles avec "(coming soon)". Fix : retire les actions non implementees, garde seulement "View source JSON".

5. **headless.test.ts `workingDir`** : Le code envoie `workingDir` dans les inputs d'invocation mais le test ne l'attendait pas. Fix : ajout de `workingDir` dans le expected du test.

### Fichiers modifies

| Fichier | Changement |
|---------|------------|
| `packages/maestro-monitor/components/LLMMonitorScreen.ts` | Fix imports theme, remplacer methodes inexistantes |
| `packages/maestro-code/App.ts` | FIFO cap OutputPanel, curseur InputPrompt avec refs |
| `packages/maestro-monitor/components/BlockDetail.ts` | Retirer actions "coming soon" |
| `packages/maestro-code/tests/headless.test.ts` | Ajouter `workingDir` dans expected inputs |
