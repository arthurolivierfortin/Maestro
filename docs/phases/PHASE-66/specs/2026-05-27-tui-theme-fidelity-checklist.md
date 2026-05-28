# Checklist — TUI Theme Fidelity (Phase 66-G)

**Linked spec:** [2026-05-27-tui-theme-fidelity-design.md](2026-05-27-tui-theme-fidelity-design.md)
**Tags:** [code-app]
**Phase:** Phase-66 (66-G)

## Code

- [x] [SPEC-1] [code-app] Rewrite `tui-theme.css` as a port of `pure-theme.css`: 3 phosphor presets (`:root`/`[data-tui="amber"]`, `[data-tui="green"]`, `[data-tui="white"]`), CRT scanlines+vignette on `.shell::before/::after` with `[data-crt="off"]` disabling them, `.term` grid, `.term-title`, `.tabs`/`.tab`, `.box`, `.status`/`.mode`/`.k`, `.cmdline`, `.conv`, `.line` role variants, `.b` badges, `.bar-ascii`, color helpers, scrollbar. `.term` is fluid (no fixed 1380px width). — `apps/code/src/theme/tui-theme.css`
- [x] [SPEC-2] [code-app] Align `tokens.ts` to the amber phosphor palette (bg `#0a0a0a`, fg `#ffb454`, accent/`--ac` `#ffd089`, line `#5a4520`, ok `#b8e57a`, err `#ff6b4a`, muted/tertiary `#8c6024`), keeping the same exported symbols (`colors`, `fontFamily`, `spacing`) so no importer breaks. — `apps/code/src/theme/tokens.ts`
- [x] [SPEC-3] [code-app] `App.tsx`: render `<div className="shell"><div className="term" data-route={page}>…</div></div>`; add phosphor state (default `'amber'`) + crt state (default `'on'`); `useEffect` sets `document.documentElement.dataset.tui` and `.dataset.crt`. Remove the flex-column inline `style` wrapper. — `apps/code/src/App.tsx`
- [x] [SPEC-4] [code-app] `Header.tsx`: render `.term-title` (`.wm` `▌MAESTRO`, `.sep`, version label, `.mid` session/context, `.right` online `.pip` + tier + model) and a `.tabs` row of `.tab` items with `.n` key numbers and `.active` on the current page. Remove inline color/layout styles. — `apps/code/src/components/Header.tsx`
- [ ] [SPEC-5] [code-app] `StatusBar.tsx`: render `.status` line with a `.mode` badge (`NORMAL`), `.k` keybind hints separated by `.sep`, and the backend connection state shown via a status pip + label using theme color vars (ok/err/muted). Remove inline color/layout styles. — `apps/code/src/components/StatusBar.tsx`
- [ ] [SPEC-6] [code-app] `ChatMessage.tsx`: render `.line` with role class `user`/`agent`, a `.ts` slot, `.pre` prefix (`❯` for user), `.body` for content, and `.caret` when `isStreaming`. Remove inline color styles + the legacy `.streaming-cursor` usage. — `apps/code/src/components/ChatMessage.tsx`
- [ ] [SPEC-7] [code-app] `ConsolePage.tsx`: wrap the message list in `.conv`; render `ChatInput` inside the `.cmdline` vocabulary region; remove ad-hoc flex/padding/color inline styles (keep dynamic-only inline styles if any). Empty/error states use theme color classes. — `apps/code/src/pages/ConsolePage.tsx`
- [ ] [SPEC-8] [code-app] `ChatInput.tsx`: restyle with `.cmdline`/`.prompt` vocabulary (prompt glyph + theme-colored textarea using CSS vars, focus border `--ac`), preserving all existing handlers (send, slash autocomplete, Enter/Shift+Enter, disabled-while-loading). Remove the hardcoded hex inline colors. — `apps/code/src/components/ChatInput.tsx`

## Tests

- [x] [TEST-1] tui-theme.css port is loaded and `.term` is NOT fixed-width: assert no `width: 1380px` rule and that phosphor/CRT selectors exist (string assertions reading the css file, OR a render test asserting computed `.term` is not 1380px). — `apps/code/src/theme/__tests__/tuiTheme.test.ts`
- [x] [TEST-2] tokens amber palette: `colors.bg === '#0a0a0a'` and `colors.accent === '#ffd089'` (or the chosen `--ac`/`--fg-0` mapping), and all original exported keys still exist. — `apps/code/src/theme/__tests__/tokens.test.ts`
- [x] [TEST-3] App sets `data-tui="amber"` and `data-crt="on"` on `document.documentElement` after mount, and renders `.shell` + `.term`. — `apps/code/src/__tests__/App.theme.test.tsx`
- [x] [TEST-4] Header renders `.term-title` with `.wm` brand and `.tabs` with the active tab carrying the `.active` class on the current page. — `apps/code/src/components/__tests__/Header.test.tsx`
- [ ] [TEST-5] StatusBar renders `.status` with a `.mode` element and reflects connected/disconnected state. — `apps/code/src/components/__tests__/StatusBar.test.tsx`
- [ ] [TEST-6] ChatMessage renders `.line.user` for a user message (with `.pre`) and `.line.agent` for assistant, and a `.caret` when `isStreaming`. — `apps/code/src/components/__tests__/ChatMessage.test.tsx`
- [ ] [TEST-7] ConsolePage renders a `.conv` container wrapping the messages. — `apps/code/src/pages/__tests__/ConsolePage.test.tsx`
- [ ] [TEST-8] ChatInput renders the `.cmdline` vocabulary and still calls `onSend`/`onSlashCommand` on Enter (behavior preserved). — `apps/code/src/components/__tests__/ChatInput.test.tsx`

## Database / Migrations
- [ ] [DB-0] None

## Block / Contract changes
- [ ] [BLOCK-0] None

## Verification gates (TESTING-PROTOCOL — adapted for apps/code Vite/React/Electron)
- [ ] [GATE-1] Layer 1 Type Check: `cd apps/code && npx tsc --noEmit` (0 errors, no `@ts-nocheck`)
- [ ] [GATE-2] Layer 2 Unit Tests: `cd apps/code && npx vitest run` (all green; baseline 132 + new tests)
- [ ] [GATE-3] Layer 3/4 Visual Gate: `cd apps/code && ELECTRON_DISABLE=true npx vite --port 5180` then load the app and compare the Console + shell + header + status to `mock/claude-design/MaestroCodePure.html` / `pure-page-console.jsx`; describe matches/gaps (phosphor amber, CRT scanlines, box-drawing borders, status line, role-colored lines). No `real-demo-check.cjs` exists for this Vite app — the running dev server screenshot is the equivalent visual gate.
- [ ] [GATE-4] No Legacy scan: old `--tui-bg` palette + `.streaming-cursor` removed; no dual theme; no `@ts-nocheck` in diff.
