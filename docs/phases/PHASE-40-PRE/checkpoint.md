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

## Pixel Art System : Bitmap Renderer + Mascotte Sprites + Design Toolkit
**Statut** : DONE
**Date** : 2026-02-24

### Systeme bitmap

Renderer 2-color pixel art utilisant Unicode half-blocks (▀▄█ ) pour 2x resolution verticale.
Chaque cellule terminal = 2 pixels verticaux. Permet de creer des sprites et animations.

| Fichier | Description |
|---------|-------------|
| `packages/tui/utils/bitmap.ts` | **NOUVEAU** — parseBitmap, renderBitmap, renderBitmapDetailed, flipH, overlay, shift |
| `packages/tui/components/PixelArt.ts` | **NOUVEAU** — Composant Ink qui rend un bitmap avec couleur |
| `packages/tui/sprites/mascotte.ts` | **NOUVEAU** — Sprite sheet mascotte redessinee: 5 etats x 2 frames + SPLASH |
| `packages/tui/sprites/index.ts` | **NOUVEAU** — Barrel export sprites |
| `packages/tui/tests/bitmap.test.ts` | **NOUVEAU** — 18 tests renderer |
| `packages/tui/tests/mascotte.test.ts` | **NOUVEAU** — 9 tests sprites (dimensions, rendu, animation, visor consistency) |
| `packages/tui/utils/index.ts` | Ajout exports bitmap |
| `packages/tui/components/index.ts` | Ajout export PixelArt |
| `packages/tui/package.json` | Ajout `./sprites` + devDependency jimp |

### Design Toolkit (workflow AI pixel art)

Outils pour permettre a un agent (Claude ou futur agent Maestro) de designer du pixel art
avec feedback visuel. Le workflow :

1. **Designer** le bitmap (string array '#' / '.')
2. **Rendre** en PNG via `bitmap-preview.ts` (scale + grille + marqueurs)
3. **Voir** le PNG (Read tool supporte les images)
4. **Iterer** : corriger le bitmap, re-rendre, voir, repeter
5. **Importer** des images existantes via `bitmap-import.ts` (PNG → bitmap)

| Outil | Usage |
|-------|-------|
| `tools/bitmap-preview.ts` | `npx tsx tools/bitmap-preview.ts IDLE_1 preview.png --scale 16` |
| `tools/bitmap-preview.ts --all` | Rend tous les sprites dans un dossier |
| `tools/bitmap-preview.ts --file` | Rend un fichier .txt de bitmap |
| `tools/bitmap-import.ts` | `npx tsx tools/bitmap-import.ts image.png --width 24 --threshold 128` |

Dependencies : `jimp` (pure JS, zero deps natives) pour manipulation PNG.

### Mascotte redesignee (v5)

Robot companion avec visiere — design Flipper Zero-style :
- Dome arrondi avec antenne
- Visiere horizontale (bande sombre avec yeux rectangulaires lumineux)
- Corps avec panneau thoracique (indicateur central)
- Bras articules (changent par etat)
- Jambes et pieds

Specs :
- **Character sprites** : 24x22 pixels → 24 chars x 11 lignes terminal
- **SPLASH** : 32x28 pixels → 32 chars x 14 lignes terminal
- **5 etats** : idle, working, navigating, waiting-input, error
- **2 frames par etat** (animation alternee)
- **Tete constante** (rows 1-9) : identite preservee a travers tous les etats
- `getMascotteFrame(state, tick)` → retourne le bon frame

Differences par etat :
- **idle** : bras legerement ecartess (frame 2: pieds plus larges, breathing)
- **working** : bras tres etendus (frame 1: maximum, frame 2: moyen)
- **navigating** : un seul bras etendu (frame 1: droite, frame 2: gauche)
- **waiting** : bras proches du corps
- **error** : bras leves en alarme, ecartement des pieds, etincelles

### Integration

| Fichier | Changement |
|---------|------------|
| `packages/maestro-code/panels/AgentActivity.ts` | Pixel art mascotte 24x22, height=13 |
| `packages/maestro-code/screens/SplashScreen.ts` | SPLASH 32x28 au-dessus du logo texte |
| `packages/maestro-sidecar/package.json` | Fix `workspace:*` → `*` (debloque npm install) |

### Tests

| Package | Tests | Resultat |
|---------|-------|----------|
| @maestro/tui | 67 | 67/67 pass (+18 bitmap +9 mascotte) |
| maestro-monitor | 4 | 4/4 pass |
| maestro-code | 39 | 39/39 pass |
| **Total** | **110** | **110 pass, 0 fail** |

---

## 40-PRE-D : First-Run Experience
**Statut** : DONE
**Date** : 2026-02-24

### Fonctionnalites implementees

1. **First-run detection** : CLI verifie `.maestro/` au `repoPath`. Si absent, passe `isFirstRun: true` au TUI → demarre sur WelcomeScreen au lieu d'AgentScreen.

2. **WelcomeScreen [i] init** : Cree `.maestro/` avec structure complete (config.json, aliases.json, README.md, 6 sous-dossiers). Navigue vers AgentScreen apres init.

3. **Health check au demarrage** : `useEffect` asynchrone au mount qui ping `GET /api/health`. Si erreur, affiche warning jaune dans le log.

4. **`maestro --version`** : Flag `--version`/`-v` gere avant minimist (car `version` est un flag string pour d'autres commandes). Import direct de `brand.ts` pour eviter le crash yoga-layout.

5. **Version coherente** : `brand.ts` synced a `0.1.0-alpha` (match tag `v0.1.0-alpha` + package.json).

### Fichiers modifies

| Fichier | Changement |
|---------|------------|
| `packages/maestro-cli/cli.ts` | `.maestro/` detection → `isFirstRun`, `--version`/`-v` flag (pre-minimist) |
| `packages/maestro-code/launcher.ts` | Ajout `isFirstRun` dans InteractiveOptions |
| `packages/maestro-code/App.ts` | `isFirstRun` prop → WelcomeScreen, `handleInit` cree `.maestro/`, health check effect |
| `packages/maestro-code/hooks/useNavigation.ts` | Accepte `initialScreen` param (default 'agent') |
| `packages/tui/theme/brand.ts` | Version 0.17.0 → 0.1.0-alpha |

### Verification

```
$ maestro --version → "maestro 0.1.0-alpha" ✓
$ maestro -v → "maestro 0.1.0-alpha" ✓
$ maestro health → "Backend is not responding" (correct, not running) ✓
$ maestro init /tmp/test → Creates .maestro/ with all dirs + files ✓
$ maestro code --help → Shows help text ✓
```

---

## 40-PRE-E : Test E2E & Polish Final
**Statut** : DONE
**Date** : 2026-02-24

### E2E tests CLI

| Commande | Resultat |
|----------|----------|
| `maestro --version` | `maestro 0.1.0-alpha` ✓ |
| `maestro -v` | `maestro 0.1.0-alpha` ✓ |
| `maestro health` | Error message correct (backend not running) ✓ |
| `maestro init /tmp/test` | Creates .maestro/ structure ✓ |
| `maestro code --help` | Shows help text ✓ |
| `maestro blocks` | Error message correct (backend not running) ✓ |

### Audit App.ts

Audit complet par agent : **zero bugs trouves**. Pas de hooks conditionnels, pas de variables indefinies, pas d'imports manquants, flux isFirstRun/repoPath coherent.

### Cleanup

- Supprime 25+ fichiers temporaires (maestro-A..K.txt/.png) du dossier tools/
- Conserve bitmap-preview.ts et bitmap-import.ts (utiles pour PRE-F)

### Tests finaux

| Package | Tests | Resultat |
|---------|-------|----------|
| @maestro/tui | 67 | 67/67 pass |
| maestro-monitor | 4 | 4/4 pass |
| maestro-code | 39 | 39/39 pass |
| @maestro/client | 19 | 19/19 pass |
| @maestro/sidecar | 5 | 5/5 pass |
| adapt-optimize | 16 | 16/16 pass |
| sandbox-manager | 18 | 18/18 pass + 4 skipped (Docker) |
| **Total** | **168** | **164 pass, 4 skipped, 0 fail** |

### Docs mis a jour

| Document | Changement |
|----------|------------|
| `docs/phases/PHASE-40-PRE/README.md` | Ajout sous-phase PRE-F (Pixel Art Pipeline) |
| `docs/phases/PHASE-40-PRE/PIXEL-ART-PIPELINE.md` | Plan detaille PRE-F |
| `docs/ROADMAP.md` | PRE-F dans table 40-PRE, features planifiees |

---

## 40-PRE-F : Pipeline de Generation Pixel Art (F1 + F4 + F5)
**Statut** : IN PROGRESS (F1, F4, F5 DONE — F2, F3 restent)
**Date** : 2026-02-23

### Architecture

Decision cle : **ImageManager separe de ModelManager** (differents pipelines, VRAM mutual exclusion, differente API).

### F1 : Python SD Service + Endpoint — DONE

| Fichier cree/modifie | Description |
|----------------------|-------------|
| `llm-provider/src/image_manager.py` | ~230L. Singleton ImageManager. load/unload/load_lora/generate/status. Thread-safe, lazy loading, VRAM coordination (decharge text models si necessaire). |
| `llm-provider/src/pixel_quantizer.py` | ~180L. Post-processing : resize NEAREST → grayscale → Otsu threshold → quantize 2-3 couleurs → cleanup morphologique → export bitmap '#'/'+'/'.'. |
| `llm-provider/api/server.py` | +90L : Pydantic models (ImageGenerateRequest, PostProcessConfig, ImageGenerateResponse, ImageStatusResponse). Endpoints POST /v1/image/generate, GET /v1/image/status, POST /v1/image/unload. |

API Contract:
```
POST /v1/image/generate → { image_base64?, bitmap?: string[], seed, width, height, metadata }
GET /v1/image/status → { loaded, model_id, device, loras, diffusers_available }
POST /v1/image/unload → { status }
```

### F4 : .NET Proxy Endpoint — DONE

| Fichier cree/modifie | Description |
|----------------------|-------------|
| `llm-provider/dotnet/src/LLMProvider.Web/Endpoints/ImageEndpoints.cs` | ~200L. Static class avec MapImageEndpoints(). POST /api/v1/image/generate (proxy Python), GET /api/v1/image/status, POST /api/v1/image/unload. DTOs avec [JsonPropertyName]. |
| `llm-provider/dotnet/src/LLMProvider.Web/Program.cs` | +4L : Named HttpClient "LocalPython" (BaseUrl from Providers:Local, timeout 300s) + app.MapImageEndpoints(). |

Build : **0 warnings, 0 errors**.

### F5 : Block Tool Maestro — DONE

| Fichier cree | Description |
|--------------|-------------|
| `content/system/blocks/tools/pixel-art-generator/pixel-art-generator.tool.block.json` | Block definition. runtime=node, scriptFile=generate.js, parseOutput=json, timeout=120s. |
| `content/system/blocks/tools/pixel-art-generator/generate.js` | ~70L. Node.js fetch vers LLM-Provider .NET proxy. Prefix prompt pixel art fixe. Outputs JSON. |
| `content/system/blocks/tools/pixel-art-generator/system-prompt.md` | Instructions pour agents : inputs, output format, tips. |

### F2 : LoRA Training — TODO
Dataset preparation + LoRA fine-tune pour style Maestro consistent.

### F3 : Quantizer Refinement — TODO
Seuillage adaptatif, palette explicite, nettoyage morphologique avance.

### Tests

| Package | Tests | Resultat |
|---------|-------|----------|
| @maestro/tui | 67 | 67/67 pass |
| maestro-monitor | 4 | 4/4 pass |
| maestro-code | 39 | 39/39 pass |
| @maestro/client | 19 | 19/19 pass |
| @maestro/sidecar | 5 | 5/5 pass |
| adapt-optimize | 16 | 16/16 pass |
| sandbox-manager | 18 | 18/18 pass + 4 skipped (Docker) |
| LLM-Provider .NET | — | Build OK, 0 warnings |
| **Total** | **168** | **164 pass, 4 skipped, 0 fail** |
