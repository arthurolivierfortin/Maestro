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

---

## 40-PRE-A : Shared Components + Architecture Agent-First
**Statut** : DONE
**Date** : 2026-02-24

### Etape 1 : Promouvoir composants dans @maestro/tui

Composants extraits du monitor vers le design system shared :

| Fichier cree/modifie | Description |
|----------------------|-------------|
| `packages/tui/theme/ink.ts` | inkTheme compose + 11 text helpers (T, primary, muted, bold...) + Badge/TypeBadge |
| `packages/tui/theme/animations.ts` | SPINNER_FRAMES, BREATHING_DOTS, ACTIVITY_FRAMES + frame selectors |
| `packages/tui/hooks/useAnimationTick.ts` | Tick counter hook (useState + setInterval) |
| `packages/tui/hooks/useActionKeyboard.ts` | Wraps createActionKeyboardHandler with Ink's useInput |
| `packages/tui/app/hooks/useSessionData.ts` | Session polling (single or list) with connection status |
| `packages/tui/components/Header.ts` | Session info header (status, name, duration, fitness, phases) |
| `packages/tui/components/NavBar.ts` | Data-driven navigation bar (accepts pages prop) |
| `packages/tui/components/StatusBar.ts` | Enhanced with animations and context-aware shortcuts |
| `packages/tui/theme/index.ts` | Updated barrel exports |
| `packages/tui/hooks/index.ts` | Updated barrel exports |
| `packages/tui/components/index.ts` | Updated barrel exports |

Monitor mis a jour avec thin re-exports :

| Fichier | Changement |
|---------|------------|
| `packages/maestro-monitor/theme.ts` | Re-export depuis @maestro/tui, garde page nav localement |
| `packages/maestro-monitor/components/Panel.ts` | Re-export |
| `packages/maestro-monitor/components/Header.ts` | Re-export |
| `packages/maestro-monitor/components/StatusBar.ts` | Re-export |
| `packages/maestro-monitor/components/NavBar.ts` | Wrapper avec MONITOR_PAGES |
| `packages/maestro-monitor/hooks/useAnimationTick.ts` | Re-export |
| `packages/maestro-monitor/hooks/useSessionData.ts` | Re-export |
| `packages/maestro-monitor/hooks/useKeyboard.ts` | Re-export useActionKeyboard + garde legacy |

### Etape 2 : Architecture Agent-First dans maestro-code

Nouveaux fichiers :

| Fichier | Description |
|---------|-------------|
| `packages/maestro-code/types.ts` | Screen union type (8 variants), AgentState, CODE_PAGES, helpers |
| `packages/maestro-code/hooks/useNavigation.ts` | Agent-in-the-Cockpit: 2 positions independantes, join/detach |
| `packages/maestro-code/hooks/useInputHistory.ts` | 50 derniers inputs, Up/Down navigation |
| `packages/maestro-code/panels/AgentActivity.ts` | Mini-panel overlay agent state + animations |
| `packages/maestro-code/screens/AgentScreen.ts` | HOME: conversation + activity overlay |
| `packages/maestro-code/screens/CatalogBrowser.ts` | Browse blocks avec fitness bars |
| `packages/maestro-code/screens/SessionBrowser.ts` | Browse sessions avec status icons |
| `packages/maestro-code/screens/ModelsBrowser.ts` | Browse modeles, indicateur actif |
| `packages/maestro-code/screens/HelpOverlay.ts` | Raccourcis clavier par section |
| `packages/maestro-code/screens/WelcomeScreen.ts` | First-run: logo + init/skip/help |
| `packages/maestro-code/screens/index.ts` | Barrel export |
| `packages/maestro-code/hooks/index.ts` | Barrel export |
| `packages/maestro-code/panels/index.ts` | Barrel export |

### Etape 3 : Rearchitecture App.ts

App.ts rearchitecture en navigateur multi-ecran :

- **NavBar** en haut : MAESTRO [A]gent [C]atalog [S]essions [M]odels
- **Screen router** : switch basee sur `nav.userScreen.type`
- **Agent screen** (HOME) : OutputPanel + WidgetRenderer + InputPrompt (meme layout qu'avant)
- **Browser screens** : CatalogBrowser, SessionBrowser, ModelsBrowser
- **Help/Welcome** : HelpOverlay, WelcomeScreen
- **StatusBar** en bas : session ID, busy state, voice mode

Navigation :
- **Agent screen** : slash commands (`/catalog`, `/sessions`, `/models`, `/help`, `/back`, `/join`, `/quit`)
- **Browser screens** : letter shortcuts (A/C/S/M/?), Esc=back (via useActionKeyboard)
- **Global** : Tab=cycle screens, Ctrl+C=quit, Ctrl+V=voice

Input history : Up/Down arrows dans InputPrompt (optional callbacks, backward compatible)

**Backward compatibility** : Tous les exports preserves (OutputPanel, StatusBar, InputPrompt, SessionManager, WidgetRenderer, InteractiveApp). 25 tests App.test.ts passent sans modification.

### Etape 4-5 : Input history + Tests

- useInputHistory deja cable dans App.ts (history.prev/next passes a InputPrompt)
- 7 nouveaux tests navigation (screenEquals, screenToPageKey, CODE_PAGES, input history logic, slash commands)
- Barrel exports crees pour screens/, hooks/, panels/

### Tests finaux

| Package | Tests | Resultat |
|---------|-------|----------|
| @maestro/tui | 40 | 40/40 pass |
| maestro-monitor | 4 | 4/4 pass |
| maestro-code | 39 | 39/39 pass (+7 nouveaux) |
| @maestro/client | 19 | 19/19 pass |
| @maestro/sidecar | 5 | 5/5 pass |
| **Total** | **107** | **107 pass, 0 fail** |

---

## 40-PRE-B : Identite Visuelle Command Center
**Statut** : DONE
**Date** : 2026-02-24

### B.1 : Palette expansion

| Fichier | Changement |
|---------|------------|
| `packages/tui/theme/colors.ts` | Ajout `agentAccent: '#a78bfa'` (violet) dans palette, `semantic.agent` (idle/working/navigating/waiting/accent) |
| `packages/tui/theme/ink.ts` | Expose `inkTheme.agent` depuis semantic |
| `packages/maestro-code/panels/AgentActivity.ts` | Utilise `theme.agent.*` au lieu de couleurs hardcodees |

### B.2 : Double borders focus

| Fichier | Changement |
|---------|------------|
| `packages/tui/components/Panel.ts` | `borderStyle: focused ? 'double' : 'single'` |

### B.3 : Splash screen

| Fichier | Changement |
|---------|------------|
| `packages/maestro-code/screens/SplashScreen.ts` | **NOUVEAU** — ASCII logo + version + tagline + breathing dot animation, auto-dismiss apres 1.5s |
| `packages/maestro-code/App.ts` | RootApp wrapper: splash → main app transition, import SplashScreen |
| `packages/maestro-code/launcher.ts` | Passe `noSplash` option |
| `packages/maestro-cli/cli.ts` | Ajout `--no-splash` option, passe au launcher |

### B.4 : Agent mascotte + NavBar badge

| Fichier | Changement |
|---------|------------|
| `packages/maestro-code/panels/AgentActivity.ts` | **ENHANCED** — ASCII art mascotte (3 lignes) qui change par etat, activity frame animation |
| `packages/maestro-code/panels/AgentBadge.ts` | **NOUVEAU** — Badge compact pour NavBar (spinner+working/dot+ready) |
| `packages/maestro-code/App.ts` | NavBar recoit `badge: AgentBadge` |
| `packages/maestro-code/screens/index.ts` | +SplashScreen |
| `packages/maestro-code/panels/index.ts` | +AgentBadge |

### Tests

| Package | Tests | Resultat |
|---------|-------|----------|
| @maestro/tui | 40 | 40/40 pass |
| maestro-monitor | 4 | 4/4 pass |
| maestro-code | 39 | 39/39 pass |
| @maestro/client | 19 | 19/19 pass |
| @maestro/sidecar | 5 | 5/5 pass |
| **Total** | **107** | **107 pass, 0 fail** |

---

## Pixel Art System : Bitmap Renderer + Mascotte Sprites
**Statut** : DONE
**Date** : 2026-02-24

### Systeme bitmap

Renderer 2-color pixel art utilisant Unicode half-blocks (▀▄█ ) pour 2x resolution verticale.
Chaque cellule terminal = 2 pixels verticaux. Permet de creer des sprites et animations.

| Fichier | Description |
|---------|-------------|
| `packages/tui/utils/bitmap.ts` | **NOUVEAU** — parseBitmap, renderBitmap, renderBitmapDetailed, flipH, overlay, shift |
| `packages/tui/components/PixelArt.ts` | **NOUVEAU** — Composant Ink qui rend un bitmap avec couleur |
| `packages/tui/sprites/mascotte.ts` | **NOUVEAU** — Sprite sheet mascotte: 5 etats x 1-2 frames (idle, working, navigating, waiting, error) + SPLASH |
| `packages/tui/sprites/index.ts` | **NOUVEAU** — Barrel export sprites |
| `packages/tui/tests/bitmap.test.ts` | **NOUVEAU** — 18 tests renderer (parseBitmap, bitmapSize, renderBitmap, flipH, overlay, shift) |
| `packages/tui/tests/mascotte.test.ts` | **NOUVEAU** — 8 tests sprites (dimensions, rendu, animation frames) |
| `packages/tui/utils/index.ts` | Ajout exports bitmap |
| `packages/tui/components/index.ts` | Ajout export PixelArt |
| `packages/tui/package.json` | Ajout `./sprites` dans exports map |

### Integration mascotte

| Fichier | Changement |
|---------|------------|
| `packages/maestro-code/panels/AgentActivity.ts` | Remplace ASCII art par pixel art via renderBitmap + getMascotteFrame |
| `packages/maestro-code/screens/SplashScreen.ts` | Ajoute sprite SPLASH pixel art au-dessus du logo texte |

### Mascotte specs

- Corps principal : 14x12 pixels → 14 chars x 6 lignes terminal
- Splash : 20x14 pixels → 20 chars x 7 lignes terminal
- 5 etats : idle, working, navigating, waiting-input, error
- 2 frames par etat (animation alternee pour breathing effect)
- getMascotteFrame(state, tick) → retourne le bon frame

### Tests

| Package | Tests | Resultat |
|---------|-------|----------|
| @maestro/tui | 66 | 66/66 pass (+18 bitmap +8 mascotte) |
| maestro-monitor | 4 | 4/4 pass |
| maestro-code | 39 | 39/39 pass |
| **Total** | **109** | **109 pass, 0 fail** |
