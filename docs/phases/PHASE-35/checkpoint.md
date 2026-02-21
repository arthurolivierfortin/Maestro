# Phase 35 : Checkpoint

**Derniere mise a jour** : 2026-02-21
**Sous-phase en cours** : 35-B (iteration 3)
**Agent** : Claude Code session (dogfooding)

---

## 35-PRE : Agent composite + tool dispatch
**Statut** : DONE
**Date** : 2026-02-20
**Details** : voir `PHASE-35/PRE/checkpoint.md`

---

## 35-A : Maestro code sans template
**Statut** : DONE
**Date** : 2026-02-20

### Blocages 1-5
| # | Blocage | Fichier | Fix |
|---|---------|---------|-----|
| 1 | `--template none` echoue | `headless.ts` | Skip template quand `template === 'none'` |
| 2 | Agent dispatche comme workflow | `EntryPointExecutor.cs` L141 | `isWorkflowWithNodes` check |
| 3 | Meme dans ExecuteBlockRefAsync | `EntryPointExecutor.cs` L1625 | `isWorkflowBlock` check |
| 4 | ObjectDisposedException tool dispatch | `AgentBlockExecutor.cs` | `_scopeFactory.CreateScope()` |
| 5 | DI circular deadlock | `AgentBlockExecutor.cs` | Lazy resolution `??=` |

---

## 35-B : Scaffold + iterations Cantante
**Statut** : EN COURS
**Date debut** : 2026-02-21

### Bugs Maestro trouves et corriges

| # | Bug | Fichier | Fix |
|---|-----|---------|-----|
| 6 | Agent retourne vide sans nudge | `AgentBlockExecutor.cs` | Empty response → nudge (max 2 retries) |
| 7 | Agent oublie step-complete | `AgentBlockExecutor.cs` | Iteration countdown quand remaining ≤ 3 |
| 8 | Prompt trop faible | `system-prompt.md` | Rewrite v2: strict format, FORBIDDEN section |
| 9 | Agent hallucine multi-tool | `AgentBlockExecutor.cs` | Detection + WARNING dans tool result |
| 10 | Agent utilise bash, read-file | `AgentBlockExecutor.cs` | `NormalizeToolId()` aliases |
| 11 | Non-JSON nudge sans step-complete | `AgentBlockExecutor.cs` | Nudge inclut step-complete example |
| 12 | BOM dans fichiers ecrits | `ToolBlockExecutor.cs` | UTF8Encoding(false) sans BOM |

### Sessions executees

| # | Task | Session (prefix) | Calls | Cout | Duree | Resultat |
|---|------|------------------|-------|------|-------|----------|
| 1 | List structure (sanity) | 2cde5e7e | 5 | $0.013 | 66s | OK |
| 2 | Scaffold React 18 (fail) | 047f6aaf | 13 | $0.085 | 295s | ECHEC — 0 fichiers ecrits |
| 3 | Scaffold React 18 (OK) | 54797e82 | 11 | $0.034 | 117s | OK — 6 fichiers |
| 4 | Fix tsconfig jsx | 4a1c0374 | 3 | $0.008 | 38s | OK |
| 5 | Accessible layout | 47b3b677 | 23 | $0.087 | 316s | OK — 5 composants, 14 iter gaspillees |
| 6 | File operations (IPC) | 08253c64 | 21 | $0.081 | 227s | OK — IPC handlers + hook + updates |
| 7 | Accessibility layer | 61eb8bd5 | 16 | $0.083 | 227s | OK — TTS, keyboard nav, announcer |
| 8 | Vite build system | a4a6cf50 | 16 | $0.034 | 167s | OK — vite.config, split tsconfig |
| 9 | Syntax highlighter | 7f475bda | 10 | $0.115 | 193s | OK — tokenizer + CodeEditor overlay |

### Cout total 35-B : $0.540

### Fichiers Cantante (19 fichiers src)

```
src/main/
  index.ts              — Electron main, IPC setup, preload
  index.html            — Main process HTML (old)
  preload.ts            — contextBridge IPC bridge
  ipc-handlers.ts       — readFile, writeFile, listDirectory handlers

src/core/
  types.ts              — FileNode, TreeOptions

src/modules/
  file-tree.ts          — buildTree, printTree

src/renderer/
  index.html            — Renderer entry (type=module)
  index.tsx             — React 18 createRoot
  App.tsx               — Layout: Sidebar + EditorPane + StatusBar + accessibility
  styles.css            — Dark theme CSS

src/renderer/components/
  Sidebar.tsx           — ARIA navigation, real directory listing
  EditorPane.tsx        — CodeEditor wrapper (was textarea)
  StatusBar.tsx         — aria-live status bar

src/renderer/editor/
  SyntaxHighlighter.ts  — Regex tokenizer (6 color categories)
  CodeEditor.tsx        — Overlay editor (transparent textarea + highlighted pre)

src/renderer/hooks/
  useFileSystem.ts      — IPC file operations hook
  useAccessibility.ts   — Combines aria-live + speech synthesis

src/renderer/accessibility/
  ScreenReaderAnnouncer.tsx  — aria-live region component
  KeyboardNavigation.ts      — Ctrl+Shift+F/E/S + Escape shortcuts
  useSpeechSynthesis.ts      — Web Speech API hook (fr-FR default)
```

### Build status
- `npx tsc --noEmit` : PASS
- `npx tsc -p tsconfig.main.json --noEmit` : PASS
- `npx vite build` : PASS (39 modules, 148 KB)

### Maestro code improvements summary
1. Empty response nudge → agent recovers instead of silently breaking
2. Iteration countdown → agent calls step-complete before running out
3. Multi-tool detection → agent is warned when responses are dropped
4. Tool name aliasing → bash, read-file, write-file, etc all work
5. Non-JSON nudge → includes step-complete example
6. UTF-8 without BOM → no more encoding issues in files
7. System prompt v2 → stricter format, clearer tool names

### Sessions continued

| # | Task | Session (prefix) | Calls | Cout | Duree | Resultat |
|---|------|------------------|-------|------|-------|----------|
| 10 | Tab system | 4ac4f85b | 15 | $0.070 | 195s | OK — TabBar + multi-file App state |

### Cout total 35-B : $0.610

### Agent improvement trend
- Session 2: FAIL (hallucination, 0 files written)
- Session 5: OK but 14 wasted iterations (forgot step-complete)
- Sessions 6-9: Efficient (10-21 calls, no wasted iterations, clean builds)
- Session 10: Very efficient (15 calls, step-complete from prose, clean build)
- Agent cost per task: ~$0.03-0.12 depending on complexity

### Build status final
- `npx tsc --noEmit` : PASS
- `npx vite build` : PASS (42 modules, 152 KB)
- 21 source files total in Cantante
