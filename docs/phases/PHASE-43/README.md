# Phase 43 : Visual Gate — PTY Capture + Golden Files + Structural Assertions

**Statut** : A faire
**Prerequis** : Phase 42 EN COURS (restructuration maestro-code — code quasi-fini, non verifie)
**Objectif** : Creer un pipeline de verification visuelle automatise qui spawne le TUI dans un vrai PTY, lit le buffer terminal, et valide contre des golden files et assertions structurelles.

---

## Motivation

Le cycle actuel est destructeur :
1. On corrige le TUI
2. vitest passe
3. On lance l'app → c'est casse
4. On corrige encore → autre chose casse

**Cause racine** : `ink-testing-library` ne voit pas ce qu'un vrai terminal rend. Pas de detection d'overflow, de bordures corrompues, de conflits clavier. `real-demo-check.cjs` comble le gap de resolution de modules mais reste aveugle au rendu visuel.

**Ce que le Visual Gate resout** : un filet de securite automatise. Avant de declarer "c'est fixe", le gate spawn l'app dans un vrai PTY, capture le buffer, et valide que les panels, la navigation, et les bordures sont correctes.

---

## Regles pour l'agent executant

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `docs/phases/PHASE-43/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS modifier App.ts ou les composants** — cette phase cree uniquement l'infra de test
5. **Ne PAS toucher au backend C#** — zero changement cote serveur
6. **Si node-pty ne compile pas** → essayer `node-pty-prebuilt-multiarch` avant de declarer bloque

---

## Architecture

```
node-pty spawne: node packages/maestro-cli/index.js code --demo --no-bell
       │
       ▼
@xterm/headless (Terminal) interprete les codes ANSI
       │
       ▼
Buffer terminal (120x40 cellules de texte)
       │
       ├──► normalizeFrame() — strip timestamps, UUIDs, animation
       │
       ├──► checkStructure() — assertions structurelles (hard gate)
       │    "NavBar visible", "panel AGENT STATUS existe", "bordures intactes"
       │
       └──► compareGolden() — comparaison golden file (soft warning)
            Diff ligne par ligne, log les differences, ne fail pas
```

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 43-A | Frame Capture Infrastructure | 1-1.5 jours |
| 43-B | Golden Files + Structural Assertions + Integration | 1-1.5 jours |

**Total : ~3 jours**

---

## 43-A : Frame Capture Infrastructure

### Lecture obligatoire
- `packages/maestro-code/App.ts` — comprendre startInteractive(), TTY check (ligne 500), demo mode
- `packages/maestro-code/tests/real-demo-check.cjs` — mecanisme de capture actuel et ses limites
- `packages/maestro-code/mocks/DemoApiClient.ts` — timing demo (etats bases sur elapsed time)
- `packages/maestro-code/launcher.ts` — entry point utilise par le CLI
- `packages/maestro-code/theme.ts` — PAGE_ORDER definit les pages et hotkeys

### Ce que cette sous-phase fait

1. **Installer devDependencies** dans `packages/maestro-code/package.json` :
   - `node-pty` (ou `node-pty-prebuilt-multiarch` si natif echoue)
   - `@xterm/headless`

2. **Creer `packages/maestro-code/tests/frame-capture.ts`** (~130 lignes) :
   - `captureFrame(options)` : spawn PTY, attend, lit buffer via @xterm/headless, kill, retourne Frame
   - `captureSequence(keystrokes, options)` : spawn PTY, capture initiale, injecte touches avec delai, capture apres chaque
   - `normalizeFrame(text)` : remplace timestamps, UUIDs, caracteres d'animation, trailing whitespace
   - Spawn: `cmd.exe /c node packages/maestro-cli/index.js code --demo --no-bell` (Windows)
   - Terminal: 120x40, TERM=xterm-256color
   - `proc.kill()` dans un finally block obligatoire

3. **Creer `packages/maestro-code/tests/smoke-capture.test.ts`** (~30 lignes) :
   - Capture une frame apres 5s de demo mode
   - Assert : buffer non vide, contient un caractere box-drawing, aucun crash

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/package.json` | Modifier — ajouter node-pty + @xterm/headless en devDependencies |
| `packages/maestro-code/tests/frame-capture.ts` | Creer — utilitaire de capture PTY (~130 lignes) |
| `packages/maestro-code/tests/smoke-capture.test.ts` | Creer — smoke test du pipeline (~30 lignes) |

### Verification

```bash
# Commande 1 : Installer les deps
cd C:\Meastro && npm install
# Resultat attendu : node-pty compile sans erreur

# Commande 2 : Smoke test
cd C:\Meastro\packages\maestro-code && npx vitest run tests/smoke-capture.test.ts
# Resultat attendu : 1 test passe, frame non vide, contient box-drawing

# Commande 3 : Tests existants intacts
cd C:\Meastro\packages\maestro-code && npx vitest run tests/
# Resultat attendu : tous les tests pre-existants passent

# Commande 4 : real-demo-check.cjs intact
cd C:\Meastro\packages\maestro-code && node tests/real-demo-check.cjs
# Resultat attendu : tous les checks passent
```

### Anti-patterns
- Ne PAS utiliser `ink-testing-library` dans le pipeline de capture — c'est l'outil qu'on remplace
- Ne PAS mettre waitMs < 3000ms — DemoApiClient a besoin d'au moins 2s pour populer
- Ne PAS importer node-pty au top-level des fichiers test reguliers — fichier separe pour ne pas casser les tests sur machines sans build tools

### Checkpoint

```markdown
## 43-A : Frame Capture Infrastructure
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**node-pty installe** : oui/non (si non, quel alternative)
**Smoke test passe** : oui/non
**Temps de capture par frame** : Xms
**Contenu de la frame** : [coller les 5 premieres lignes]
**Tests existants** : X passent, Y echouent (doit matcher baseline pre-43)
**Verification** : coller output de `npx vitest run tests/smoke-capture.test.ts`
```

---

## 43-B : Golden Files + Structural Assertions + Integration

### Lecture obligatoire
- `packages/maestro-code/tests/frame-capture.ts` — utilitaire cree en 43-A
- `packages/maestro-code/components/NavBar.ts` — noms des pages et hotkeys
- `packages/maestro-code/components/SessionMonitor.ts` — noms des panels
- `packages/maestro-code/components/AgentPanel.ts` — contenu du panel agent
- `packages/maestro-code/theme.ts` — PAGE_ORDER = ['home','agent','spaces','foundry','catalog','models']

### Ce que cette sous-phase fait

1. **Creer `packages/maestro-code/tests/golden-utils.ts`** (~80 lignes) :
   - `readGolden(name)` / `writeGolden(name, content)` : lecture/ecriture dans `testdata/`
   - `compareGolden(name, actualText)` : normalise, compare ligne par ligne, retourne `{ match, diffs, diffCount }`
   - `checkStructure(lines, assertions)` : verifie patterns texte dans la frame

2. **Creer `packages/maestro-code/tests/visual-gate.test.ts`** (~180 lignes) :
   - **Tests structurels (hard gate)** :
     - Agent page initiale : NavBar, panel titles, TaskInputBar, bordures
     - Navigation h/s/f/c/m : chaque page a le bon contenu
     - Agent page apres 8s : execution demo en cours
   - **Test golden file (soft gate = warning seulement)** :
     - Capture agent page, compare au golden, log les diffs sans fail

3. **Creer `packages/maestro-code/tests/update-golden.ts`** (~50 lignes) :
   - Capture chaque page en demo mode, normalise, ecrit dans `testdata/*.golden`
   - Usage : `npx tsx tests/update-golden.ts`

4. **Creer `packages/maestro-code/testdata/`** — dossier + 6 golden files

5. **Modifier `packages/maestro-code/vitest.config.ts`** — exclure visual-gate et smoke-capture du run par defaut

6. **Modifier `packages/maestro-code/package.json`** — ajouter script `"test:visual"`

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/tests/golden-utils.ts` | Creer — comparaison golden files + assertions structurelles (~80 lignes) |
| `packages/maestro-code/tests/visual-gate.test.ts` | Creer — suite de tests visual gate (~180 lignes) |
| `packages/maestro-code/tests/update-golden.ts` | Creer — script de regeneration golden files (~50 lignes) |
| `packages/maestro-code/testdata/` | Creer — dossier + 6 golden files |
| `packages/maestro-code/vitest.config.ts` | Modifier — exclure visual-gate du default run |
| `packages/maestro-code/package.json` | Modifier — ajouter script test:visual |

### Verification

```bash
# Commande 1 : Generer les golden files
cd C:\Meastro\packages\maestro-code && npx tsx tests/update-golden.ts
# Resultat attendu : 6 fichiers .golden ecrits dans testdata/

# Commande 2 : Run visual gate
cd C:\Meastro\packages\maestro-code && npx vitest run tests/visual-gate.test.ts
# Resultat attendu : tous les tests structurels passent

# Commande 3 : Tests par defaut excluent le visual gate
cd C:\Meastro\packages\maestro-code && npx vitest run tests/
# Resultat attendu : visual-gate et smoke-capture NON inclus, tests pre-existants passent

# Commande 4 : Script test:visual fonctionne
cd C:\Meastro\packages\maestro-code && npm run test:visual
# Resultat attendu : tous les tests visual gate + smoke passent
```

### Anti-patterns
- Ne PAS faire du golden file comparison un hard failure — les layouts changent legitimement
- Ne PAS tester sur des positions exactes de colonnes — Ink peut decaler de 1-2 colonnes
- Ne PAS lancer les tests visual gate en parallele — concurrence PTY cause des problemes

### Checkpoint

```markdown
## 43-B : Golden Files + Structural Assertions + Integration
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Golden files crees** : X fichiers dans testdata/
**Tests structurels** : X passent, Y echouent
**Tests navigation** : toutes les 5 pages accessibles via hotkeys ? oui/non
**Golden file comparison** : match / warning / fail
**Tests par defaut** : X passent (inchange du baseline pre-43)
**real-demo-check.cjs** : passe ? oui/non
**Temps total visual gate** : Xs
**Verification** : coller output de `npx vitest run tests/visual-gate.test.ts`
```

---

## Hors scope (explicitement)

- FocusContext / layer system (corrige le bug clavier mais n'est pas un gate)
- ComponentDescription / `--inspect` (diagnostic, pas capture)
- ValidationRule engine (le golden diff + assertions structurelles suffisent)
- TUI QA Agent / SWE-Agent loop / auto-improvement (Phase 44)
- IToolDispatcher backend (zero changement C#)
- fast-check property testing (futur)

---

## Risque principal

`node-pty` est un addon natif C++. Sur Windows il utilise ConPTY (Win 10+). Si compilation echoue : essayer `node-pty-prebuilt-multiarch`. Si les deux echouent : installer Visual Studio Build Tools.

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-43/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 43 COMPLETE — Visual Gate : PTY capture + golden files + structural assertions"
- Ajouter : "Visual gate : `npm run test:visual` dans maestro-code — requiert node-pty"
- Ajouter : "Golden files dans packages/maestro-code/testdata/*.golden — regenerer avec `npx tsx tests/update-golden.ts`"

---

## Documents connexes

- `docs/phases/PHASE-43/ANALYSIS.md` — Analyse originale "TUI Solidification" (3 piliers, 755 lignes). Le Visual Gate correspond au pilier 2 (capture pipeline) en version minimale. Les piliers 1 (focus management) et 3 (validation rules engine) sont differes.
- `docs/phases/PHASE-44/README.md` — TUI Sentinel (agent autonome), construit sur l'infra du Visual Gate.
