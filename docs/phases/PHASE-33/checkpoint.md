# Phase 33 : Checkpoint

**Derniere mise a jour** : 2026-02-18
**Sous-phase en cours** : 33-A/B DONE + Tests + Headless, 33-C A FAIRE
**Agent** : Claude Opus 4.6

---

## 33-A : Prototype Ink REPL
**Statut** : DONE (merged into 33-B)
**Date** : 2026-02-18
**Mode choisi** : split Ink (OutputPanel + InputPrompt + StatusBar)
**Raison du choix** : Ink split fonctionne parfaitement via dynamic import chain

**Ce qui a ete fait** :
- Created `maestro-cli/interactive/App.ts` — Ink app with OutputPanel (scrollable log), StatusBar (session info), InputPrompt (text input with busy state)
- Created `maestro-cli/interactive/launcher.ts` — dynamic import wrapper (same CJS-safe pattern as `monitor/tui-monitor.ts`)
- Validated that Ink handles split rendering + input in one terminal

**Decouverte technique critique** :
- yoga-layout (Ink dependency) uses `top-level await` which is incompatible with tsx's CJS output format
- Standalone `npx tsx interactive/App.ts` fails
- Solution: dynamic import chain through `node index.js` → `cli.ts` (CJS via `require`) → `launcher.ts` (CJS `module.exports`) → `await import('./App.ts')` (ESM at runtime)
- Same pattern the monitor uses: `cli.ts` → `require('./monitor/tui-monitor.ts')` → `await import('./ink/App.ts')`

**Fichiers crees** :
- `maestro-cli/interactive/App.ts`
- `maestro-cli/interactive/launcher.ts`

---

## 33-B : maestro code E2E
**Statut** : DONE
**Date** : 2026-02-18
**Commande ajoutee** : OUI (`maestro code` in `cli.ts:5768`)
**Creation session auto** : OUI (SessionManager class in App.ts)
**Invocation E2E** : OUI (create → template → start → invoke)
**Streaming execution** : OUI (polls _executionTree + _executionLog every 2s)

**Ce qui a ete fait** :
1. **Replaced old Phase 28-B code mode** — deleted `maestro-cli/modes/code/` (index.ts + CodeApp.ts). Old code used top-level Ink imports that triggered yoga-layout CJS error. Per CLAUDE.md: "No legacy support — remove old code entirely."

2. **Wired `maestro code` command** in `cli.ts`:
   - Added to `BUILTIN_COMMANDS` set (so aliases don't override it)
   - Added to help forwarding list (`helpCmd === 'code'`)
   - Handler at line 5768: loads `interactive/launcher.ts` via `require`, passes `apiClient`, `repoPath`, `template`, `entryPoint`, `importSessionTemplate`
   - Updated main help: added to Quick Start + new "Interactive" section

3. **SessionManager class** in `App.ts`:
   - `submitTask()`: creates session → imports template → starts session → invokes entry point → starts polling
   - `startPolling()`: polls `getSession()` every 2s, extracts new `_executionLog` entries and `_executionTree` status changes
   - Detects workflow completion (all nodes done/error/skipped or session status idle/completed)
   - Cleanup: `stopPolling()` called on Ctrl+C and unmount

4. **UI Components**:
   - `OutputPanel` — scrollable log with timestamps, colors, bold/dim support
   - `StatusBar` — shows session ID (short) and running/ready status
   - `InputPrompt` — text input with busy/disabled state, placeholder text
   - `InteractiveApp` — root component, manages lines/busy state, connects to SessionManager
   - Demo mode: if no apiClient, shows fake processing (for UI testing)

5. **Headless Mode** (`--headless`):
   - `maestro-cli/interactive/headless.ts` — runs without Ink/TTY
   - Structured text output: `[HH:MM:SS] [LEVEL] message`
   - Accepts task from `--task` arg or stdin
   - Same session lifecycle as TUI mode
   - Works in pipes, CI, and non-TTY environments

**Verification** :
```
$ node index.js code --help
→ Shows help with --headless and --task options

$ node index.js code (in non-TTY)
→ "Interactive mode requires a terminal (TTY)."

$ node index.js code --headless --task "Test"
→ Structured text output: [HH:MM:SS] [INFO ] Task: Test ...

$ npx vitest run tests/interactive/
→ 29/29 tests pass (App: 25, headless: 4)
```

**Fichiers modifies** :
- `maestro-cli/cli.ts` — replaced Phase 28-B handler, added --headless branch, BUILTIN_COMMANDS, help text
- `maestro-cli/interactive/App.ts` — full rewrite with SessionManager, StatusBar, proper options
- `maestro-cli/interactive/launcher.ts` — updated to pass InteractiveOptions

**Fichiers crees** :
- `maestro-cli/interactive/headless.ts` — headless mode runner
- `maestro-cli/tests/interactive/App.test.ts` — 25 component/integration tests
- `maestro-cli/tests/interactive/headless.test.ts` — 4 headless mode tests
- `maestro-cli/vitest.config.ts` — vitest configuration

**Fichiers supprimes** :
- `maestro-cli/modes/code/index.ts` (Phase 28-B, replaced)
- `maestro-cli/modes/code/CodeApp.ts` (Phase 28-B, replaced)
- `maestro-cli/interactive/test-prototype.ts` (no longer needed)

**Dependencies ajoutees** :
- `ink-testing-library` ^4.0.0 (devDependency)
- `vitest` ^4.0.18 (devDependency)

---

## Test Infrastructure

### ink-testing-library
- Renders Ink components without TTY using fake stdin/stdout/stderr
- `render(h(Component, props))` → `{ lastFrame, stdin, frames, unmount }`
- `stdin.write(char)` simulates keyboard input
- `lastFrame()` returns current rendered output as string (with ANSI codes)
- `stripAnsi()` helper for text assertions

### Key Testing Patterns
1. **Delay before input**: React effects run async, must `await delay()` after `render()` before `stdin.write()` so `useInput` listener is registered
2. **Delay between typing and Enter**: React batches state updates, must `await delay()` between `typeText(stdin, 'text')` and `stdin.write(ENTER)` so `value` state is current
3. **Character-by-character**: Ink's `useInput` expects one keypress per `stdin.write()`, so `typeText()` sends chars individually
4. **SessionManager tests**: Pure unit tests with mock API client, no Ink rendering needed
5. **Headless tests**: Capture `console.log` output, verify structured format

---

## 33-C : Test et iteration sur Cantante
**Statut** : A FAIRE
**Prerequis** : Backend running + Cantante repo with `.maestro/`
**Modes de test** :
- TUI mode: `maestro code` in real terminal with TTY
- Headless mode: `maestro code --headless --task "..."` from anywhere (including Claude Code)

---

## Architecture

### maestro code (TUI mode)
```
node index.js code
    → cli.ts: cmd === 'code'
        → require('./interactive/launcher.ts')  [CJS]
            → await import('./App.ts')           [ESM via dynamic import]
                → startInteractive(options)
                    → SessionManager(apiClient, ...)
                    → render(InteractiveApp)
```

### maestro code --headless
```
node index.js code --headless --task "..."
    → cli.ts: cmd === 'code', argv.headless
        → require('./interactive/headless.ts')  [CJS]
            → runHeadless(options)
                → createSession → importTemplate → start → invoke
                → while (!done) { poll every 2s → console.log structured output }
```

### Session lifecycle (both modes)
```
1. POST /api/sessions         → create session
2. importSessionTemplate()    → set variables, entry points, widgets
3. POST /api/sessions/{id}/start
4. POST /api/sessions/{id}/invoke/dev  → inputs: {repoPath, task}
5. Poll GET /api/sessions/{id} every 2s
   → _executionLog → new entries
   → _executionTree → node status changes
   → Detect all-done → stop polling
```
