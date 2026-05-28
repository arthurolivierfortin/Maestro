# Plan -- Slash Commands + Help Overlay

**Issue:** #70
**Spec:** docs/phases/PHASE-66/specs/2026-05-27-slash-commands-design.md
**Checklist:** docs/phases/PHASE-66/specs/2026-05-27-slash-commands-checklist.md
**Tags:** [code-app]

## SPEC-1 -- SlashCommandParser with COMMANDS registry

**Tag:** [code-app]
**File:** `apps/code/src/slash/SlashCommandParser.ts` (new)
**Existing pattern:** Pure TS module like `apps/code/src/services/apiClient.ts` -- no React, pure functions with types.
**Reference:** `packages/maestro-code/components/SlashAutocomplete.ts` has a `SLASH_COMMANDS` array and `SlashCommand` interface to adapt.
**Pitfalls:** None specific. Keep it pure, no side effects.

### Step 1.1 -- RED (test first)

File: `apps/code/src/slash/__tests__/SlashCommandParser.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseSlashCommand, SLASH_COMMANDS, filterCommands } from '../SlashCommandParser';

describe('SlashCommandParser', () => {
  describe('parseSlashCommand', () => {
    it('returns parsed command for known command', () => {
      const result = parseSlashCommand('/help');
      expect(result).toEqual({ command: 'help', args: '' });
    });

    it('returns parsed command with args', () => {
      const result = parseSlashCommand('/clear all');
      expect(result).toEqual({ command: 'clear', args: 'all' });
    });

    it('returns null for unknown command', () => {
      const result = parseSlashCommand('/unknown');
      expect(result).toBeNull();
    });

    it('returns null for non-slash input', () => {
      const result = parseSlashCommand('hello');
      expect(result).toBeNull();
    });

    it('returns null for empty input', () => {
      const result = parseSlashCommand('');
      expect(result).toBeNull();
    });

    it('is case-insensitive', () => {
      const result = parseSlashCommand('/HELP');
      expect(result).toEqual({ command: 'help', args: '' });
    });
  });

  describe('filterCommands', () => {
    it('returns all commands for "/" input', () => {
      const result = filterCommands('/');
      expect(result.length).toBe(SLASH_COMMANDS.length);
    });

    it('filters commands matching prefix', () => {
      const result = filterCommands('/cl');
      expect(result).toEqual([
        expect.objectContaining({ command: '/clear' }),
      ]);
    });

    it('returns empty array for no matches', () => {
      const result = filterCommands('/xyz');
      expect(result).toEqual([]);
    });
  });

  describe('SLASH_COMMANDS', () => {
    it('contains the 5 V1 commands', () => {
      const names = SLASH_COMMANDS.map(c => c.command);
      expect(names).toContain('/help');
      expect(names).toContain('/clear');
      expect(names).toContain('/quit');
      expect(names).toContain('/new');
      expect(names).toContain('/stop');
    });
  });
});
```

### Step 1.2 -- GREEN (minimal implementation)

File: `apps/code/src/slash/SlashCommandParser.ts`

```typescript
export interface SlashCommand {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/help', description: 'Show shortcuts and commands' },
  { command: '/clear', description: 'Clear conversation' },
  { command: '/new', description: 'Start a new conversation' },
  { command: '/stop', description: 'Stop current generation' },
  { command: '/quit', description: 'Quit application' },
];

export interface ParsedCommand {
  command: string;
  args: string;
}

export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const spaceIdx = trimmed.indexOf(' ');
  const cmdStr = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
  const lowerCmd = cmdStr.toLowerCase();

  const known = SLASH_COMMANDS.find(c => c.command === lowerCmd);
  if (!known) return null;

  return { command: lowerCmd.slice(1), args };
}

export function filterCommands(input: string): SlashCommand[] {
  const query = input.toLowerCase();
  return SLASH_COMMANDS.filter(cmd => cmd.command.startsWith(query));
}
```

### Step 1.3 -- Verification

```bash
cd C:/Meastro/apps/code && npx vitest run src/slash/__tests__/SlashCommandParser.test.ts
```

---

## SPEC-2 -- SlashAutocomplete dropdown component

**Tag:** [code-app]
**File:** `apps/code/src/components/SlashAutocomplete.tsx` (new)
**Existing pattern:** Components use inline styles with theme tokens (see `ChatMessage.tsx`, `Header.tsx`). No CSS modules.
**Reference:** `packages/maestro-code/components/SlashAutocomplete.ts` -- Ink version to adapt for React DOM.
**Pitfalls:** z-index must be below HelpOverlay.

### Step 2.1 -- RED (test first)

File: `apps/code/src/components/__tests__/SlashAutocomplete.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlashAutocomplete } from '../SlashAutocomplete';

describe('SlashAutocomplete', () => {
  it('renders filtered commands matching input', () => {
    render(<SlashAutocomplete input="/cl" selectedIndex={0} />);
    expect(screen.getByText('/clear')).toBeDefined();
  });

  it('does not render commands that do not match', () => {
    render(<SlashAutocomplete input="/cl" selectedIndex={0} />);
    expect(screen.queryByText('/help')).toBeNull();
  });

  it('highlights the selected index', () => {
    render(<SlashAutocomplete input="/" selectedIndex={1} />);
    // Second item should have accent color styling
    const items = screen.getAllByTestId('slash-item');
    expect(items[1].style.color).toContain(/* accent color */);
  });

  it('renders nothing when no commands match', () => {
    const { container } = render(<SlashAutocomplete input="/xyz" selectedIndex={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows all commands for "/" input', () => {
    render(<SlashAutocomplete input="/" selectedIndex={0} />);
    expect(screen.getByText('/help')).toBeDefined();
    expect(screen.getByText('/clear')).toBeDefined();
    expect(screen.getByText('/quit')).toBeDefined();
  });
});
```

### Step 2.2 -- GREEN (minimal implementation)

```tsx
import { filterCommands } from '../slash/SlashCommandParser';
import { colors, spacing, fontFamily } from '../theme/tokens';

interface SlashAutocompleteProps {
  input: string;
  selectedIndex: number;
}

export function SlashAutocomplete({ input, selectedIndex }: SlashAutocompleteProps) {
  const filtered = filterCommands(input);
  if (filtered.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0,
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.bg, fontFamily, fontSize: '13px',
      zIndex: 10, maxHeight: '200px', overflowY: 'auto',
    }}>
      {filtered.map((cmd, i) => (
        <div key={cmd.command} data-testid="slash-item" style={{
          padding: `${spacing.xs} ${spacing.sm}`,
          color: i === selectedIndex ? colors.accent : colors.fg,
          backgroundColor: i === selectedIndex ? colors.border : 'transparent',
          cursor: 'pointer',
        }}>
          <span style={{ fontWeight: 700, marginRight: spacing.sm }}>{cmd.command}</span>
          <span style={{ color: colors.muted }}>{cmd.description}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## SPEC-3 -- HelpOverlay modal component

**Tag:** [code-app]
**File:** `apps/code/src/components/HelpOverlay.tsx` (new)
**Existing pattern:** Same inline style pattern.
**Pitfalls:** Must handle Escape key to close. Must not capture keyboard events when not visible.

### Step 3.1 -- RED

File: `apps/code/src/components/__tests__/HelpOverlay.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpOverlay } from '../HelpOverlay';

describe('HelpOverlay', () => {
  it('renders shortcuts section', () => {
    render(<HelpOverlay onClose={vi.fn()} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();
  });

  it('renders slash commands section', () => {
    render(<HelpOverlay onClose={vi.fn()} />);
    expect(screen.getByText('/help')).toBeDefined();
    expect(screen.getByText('/clear')).toBeDefined();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    fireEvent.click(screen.getByTestId('help-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

### Step 3.2 -- GREEN

```tsx
import { useEffect } from 'react';
import { SLASH_COMMANDS } from '../slash/SlashCommandParser';
import { colors, spacing, fontFamily } from '../theme/tokens';

interface HelpOverlayProps { onClose: () => void; }

const SHORTCUTS = [
  { key: '1-5', description: 'Navigate pages' },
  { key: '?', description: 'Toggle this help' },
  { key: 'Esc', description: 'Close overlay / cancel' },
  { key: 'Enter', description: 'Send message' },
  { key: 'Shift+Enter', description: 'New line' },
];

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div data-testid="help-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        backgroundColor: colors.bg, border: `1px solid ${colors.border}`,
        padding: spacing.lg, borderRadius: '8px', fontFamily, maxWidth: '600px', width: '90%',
      }}>
        <h2 style={{ color: colors.accent, margin: 0 }}>Keyboard Shortcuts</h2>
        {/* shortcuts + commands in 2 sections */}
      </div>
    </div>
  );
}
```

---

## SPEC-4 -- ChatInput integration

**Tag:** [code-app]
**File:** `apps/code/src/components/ChatInput.tsx` (modify)
**Existing pattern:** Current ChatInput has `onSend` prop, manages `value` state, handles Enter keydown.
**Changes:** Add `onSlashCommand` prop, add `showAutocomplete` state, add `selectedIndex` state, intercept arrow keys + Escape.
**Pitfalls:** Enter key must either select autocomplete item OR send message, never both.

### Step 4.1 -- RED

File: `apps/code/src/components/__tests__/ChatInput.test.tsx`

Test that typing "/" shows autocomplete, Escape hides it, Enter with autocomplete visible calls onSlashCommand.

### Step 4.2 -- GREEN

Modify ChatInput to detect "/" prefix, manage autocomplete visibility, dispatch commands.

---

## SPEC-5 -- ConsolePage integration

**Tag:** [code-app]
**File:** `apps/code/src/pages/ConsolePage.tsx` (modify)
**Existing pattern:** Uses `useChat` hook which already exposes `clearMessages` and `stopGeneration`.
**Changes:** Add `showHelp` state, add `handleSlashCommand` callback, render HelpOverlay conditionally.
**Pitfalls:** None specific.

### Step 5.1 -- RED

File: `apps/code/src/pages/__tests__/ConsolePage.test.tsx`

Test /clear calls clearMessages, /help toggles overlay.

### Step 5.2 -- GREEN

Add state and handler to ConsolePage.

---

## SPEC-6 -- Global "?" keybinding in App.tsx

**Tag:** [code-app]
**File:** `apps/code/src/App.tsx` (modify)
**Existing pattern:** App.tsx is simple -- useState for currentPage, renders Header + pages + StatusBar.
**Changes:** Add useEffect for global keydown "?" (only when not typing in textarea/input), pass showHelp + setShowHelp down to ConsolePage, or lift help state to App level.
**Design decision:** Help overlay state lives in App.tsx so "?" works from any page. ConsolePage's /help command calls the same setter via prop or context.
**Pitfalls:** Must not fire "?" when user is typing in textarea. Check `e.target` tagName.

### Step 6.1 -- RED

Extend Navigation.test.tsx or add new test: pressing "?" key toggles help overlay.

### Step 6.2 -- GREEN

Add useEffect with keydown listener and showHelp state to App.

---

## Cross-cutting

- No DI registration needed (all client-side)
- No backend changes
- No block/contract changes
- Theme tokens already sufficient (colors.bg, colors.accent, colors.border, colors.muted, colors.fg)
- Test infrastructure: vitest + @testing-library/react already in devDependencies

## Implementation order

SPEC-1 -> SPEC-2 -> SPEC-3 -> SPEC-4 -> SPEC-5 -> SPEC-6

This order ensures dependencies are met: parser first, then components that use it, then integration.
