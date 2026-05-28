# Checklist -- Slash Commands + Help Overlay

**Linked spec:** [2026-05-27-slash-commands-design.md](2026-05-27-slash-commands-design.md)
**Tags:** [code-app]
**Phase:** Phase-66 (sub-phase 66-F)

## Code
- [ ] [SPEC-1] [code-app] Create SlashCommandParser with COMMANDS registry and parseSlashCommand function -- `apps/code/src/slash/SlashCommandParser.ts`
- [ ] [SPEC-2] [code-app] Create SlashAutocomplete dropdown component with filtering and keyboard navigation -- `apps/code/src/components/SlashAutocomplete.tsx`
- [ ] [SPEC-3] [code-app] Create HelpOverlay modal component with shortcuts and commands reference -- `apps/code/src/components/HelpOverlay.tsx`
- [ ] [SPEC-4] [code-app] Integrate slash detection + autocomplete + command execution into ChatInput -- `apps/code/src/components/ChatInput.tsx`
- [ ] [SPEC-5] [code-app] Integrate help overlay toggle + command effects into ConsolePage -- `apps/code/src/pages/ConsolePage.tsx`
- [ ] [SPEC-6] [code-app] Add global "?" keybinding for help overlay toggle in App.tsx -- `apps/code/src/App.tsx`

## Tests
- [ ] [TEST-1] SlashCommandParser: parseSlashCommand returns parsed command for known commands, null for unknown, handles args -- `apps/code/src/slash/__tests__/SlashCommandParser.test.ts`
- [ ] [TEST-2] SlashAutocomplete: renders filtered commands, highlights selected index, hides when no matches -- `apps/code/src/components/__tests__/SlashAutocomplete.test.tsx`
- [ ] [TEST-3] HelpOverlay: renders shortcuts and commands, closes on Escape, closes on backdrop click -- `apps/code/src/components/__tests__/HelpOverlay.test.tsx`
- [ ] [TEST-4] ChatInput: shows autocomplete when "/" typed, hides on Escape, calls onSlashCommand on Enter with command selected -- `apps/code/src/components/__tests__/ChatInput.test.tsx`
- [ ] [TEST-5] ConsolePage: /clear clears messages, /help toggles overlay, /stop calls stopGeneration -- `apps/code/src/pages/__tests__/ConsolePage.test.tsx`

## Database / Migrations
- [ ] [DB-0] None

## Block / Contract changes
- [ ] [BLOCK-0] None

## Verification gates (6 layers TESTING-PROTOCOL)
- [ ] [GATE-1] Layer 1 Type Check: `cd apps/code && npx tsc --noEmit`
- [ ] [GATE-2] Layer 2 Unit Tests: `cd apps/code && npx vitest run`
