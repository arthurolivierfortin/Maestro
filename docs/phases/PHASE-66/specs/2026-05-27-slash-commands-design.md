# Slash Commands + Help Overlay -- Design

**Goal:** Add slash command parsing, autocomplete dropdown, and help overlay to the Console page so users can type /help, /clear, /quit, /new, /stop and see available shortcuts.
**Roadmap phase:** Phase-66 (sub-phase 66-F)
**Tags:** [code-app]
**Scope (in):**
- SlashCommandParser: pure function parsing input string into `{ command, args }` or `null`
- SLASH_COMMANDS registry: static array of known V1 commands with descriptions
- SlashAutocomplete component: dropdown shown when input starts with `/`, filters live, arrow-key navigation + Enter to select
- HelpOverlay component: modal overlay showing shortcuts and navigation, toggled by `?` key or `/help` command, closed by Escape
- ChatInput integration: intercept `/` prefix, show autocomplete, execute command on Enter instead of sending to chat
- ConsolePage integration: handle command effects (clear, stop, help toggle, new, quit)
- Unit tests for parser, autocomplete filtering, and command execution

**Scope (out):**
- Backend slash commands (all V1 commands are client-side)
- Custom/extensible slash commands -- future cycle
- Vim-style page navigation (`:console`, `:spaces`) -- future cycle
- Slash commands that require session context (e.g., `/session <id>`) -- future cycle

**Constraints:**
- Must work in both Electron and web mode
- No new dependencies -- use existing React, vitest, @testing-library/react
- Commands V1: /help, /clear, /quit, /new, /stop (minimal set)
- Pattern reference: `packages/maestro-code/components/SlashAutocomplete.ts` (Ink TUI version, adapt for React DOM)

## Cardinal Rule check

This change adds only client-side UI components and a pure parser function. No session type logic, no backend changes, no block definitions. A new session type can still be created by JSON only. **No violation.**

## No Legacy Support check

Nothing is being replaced. This is a new feature addition. No deprecated code exists for slash commands in `apps/code/`. **Nothing to remove.**

## Architecture

### Data flow

```
User types "/" in ChatInput
  -> ChatInput detects slash prefix
  -> Shows SlashAutocomplete dropdown (filtered by typed text)
  -> User selects command (arrow keys + Enter) or types full command + Enter
  -> ChatInput calls onSlashCommand(command) instead of onSend(text)
  -> ConsolePage handles command effect:
     - /help -> toggle showHelp state
     - /clear -> call clearMessages() from useChat
     - /stop -> call stopGeneration() from useChat
     - /new -> call clearMessages() (reset conversation)
     - /quit -> window.close() or no-op in web mode
```

### File layout

```
apps/code/src/
  slash/
    SlashCommandParser.ts       -- pure parser + COMMANDS registry
    SlashCommandParser.test.ts  -- unit tests
  components/
    SlashAutocomplete.tsx       -- dropdown UI component
    HelpOverlay.tsx             -- modal overlay component
    ChatInput.tsx               -- MODIFIED: add slash detection + autocomplete
  pages/
    ConsolePage.tsx              -- MODIFIED: add help overlay + command handling
  App.tsx                        -- MODIFIED: add global "?" keydown listener
```

### SlashCommandParser

Pure function. No React, no side effects. Input: string. Output: `{ command: string, args: string } | null`. Validates against known COMMANDS array. Unknown commands return null (treated as regular message).

### SlashAutocomplete

Positioned above the textarea in ChatInput. Shows filtered list of commands matching the typed prefix. Arrow Up/Down to navigate, Enter to select, Escape to dismiss. Styled with existing theme tokens (colors.bg, colors.accent, etc.).

### HelpOverlay

Full-screen overlay (position: fixed, z-index high). Semi-transparent background. Content: 2-column layout showing shortcuts (1-5 for pages, ? for help, Esc to close) and slash commands. Closed by Escape key or clicking the backdrop.

## Affected systems

- Backend C#: None
- LLM-Provider: None
- TUI (packages/maestro-code): None (reference only, not modified)
- CLI: None
- Blocks: None
- Contracts: None
- DI: None
- **apps/code/src/**: ChatInput.tsx, ConsolePage.tsx, App.tsx modified; new files in slash/, components/

## Risks

- **Keyboard event conflicts**: The `?` key for help overlay must not fire when the textarea is focused (user is typing). Must check `document.activeElement` or use a flag.
- **Autocomplete z-index**: Dropdown must appear above the message list but below the help overlay.
- **Enter key dual behavior**: When autocomplete is visible, Enter selects the command; when hidden, Enter sends the message. Must handle state transitions cleanly.
