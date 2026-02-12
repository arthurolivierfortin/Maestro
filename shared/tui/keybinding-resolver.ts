/**
 * Keybinding Resolver — Translates Ink input events to semantic action names.
 *
 * Parses binding strings like 'Ctrl+Right', 'Shift+Tab', 'j', 'Escape', 'Enter'
 * into structured key descriptors, then matches against Ink's useInput events.
 */

import { loadKeybindings, flattenBindings } from './keybindings.ts';

// ── Key descriptor (parsed from a binding string) ─────────────────

export interface KeyDescriptor {
  key: string;        // 'right', 'left', 'up', 'down', 'tab', 'return', 'escape', or a character
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

// ── Parse binding string → KeyDescriptor ──────────────────────────

const SPECIAL_KEYS: Record<string, string> = {
  'up': 'up',
  'down': 'down',
  'left': 'left',
  'right': 'right',
  'tab': 'tab',
  'enter': 'return',
  'return': 'return',
  'escape': 'escape',
  'esc': 'escape',
  'space': 'space',
};

export function parseBinding(binding: string): KeyDescriptor {
  const parts = binding.split('+');
  let ctrl = false;
  let shift = false;
  let meta = false;
  let keyPart = '';

  for (const part of parts) {
    const lower = part.trim().toLowerCase();
    if (lower === 'ctrl') { ctrl = true; continue; }
    if (lower === 'shift') { shift = true; continue; }
    if (lower === 'meta' || lower === 'alt') { meta = true; continue; }
    keyPart = lower;
  }

  const key = SPECIAL_KEYS[keyPart] || keyPart;
  return { key, ctrl, shift, meta };
}

// ── Build a reverse lookup: KeyDescriptor hash → action name ──────

function descriptorHash(d: KeyDescriptor): string {
  const mods = [
    d.ctrl ? 'C' : '',
    d.shift ? 'S' : '',
    d.meta ? 'M' : '',
  ].join('');
  return `${mods}:${d.key}`;
}

export interface ResolvedBindings {
  /** Map from descriptor hash → action name(s) */
  hashToActions: Map<string, string[]>;
  /** Map from action name → binding string */
  actionToBinding: Record<string, string>;
}

export function resolveBindings(context: 'toplevel' | 'detail' = 'toplevel'): ResolvedBindings {
  const flat = flattenBindings();
  const hashToActions = new Map<string, string[]>();
  const actionToBinding: Record<string, string> = {};

  for (const [action, binding] of Object.entries(flat)) {
    // Skip context-dependent duplicates:
    // In toplevel: page.prev/page.next take priority over panel.prev/panel.next
    // In detail: panel.prev/panel.next take priority over page.prev/page.next
    if (context === 'toplevel' && (action === 'panel.prev' || action === 'panel.next')) continue;
    if (context === 'detail' && (action === 'page.prev' || action === 'page.next')) continue;

    const desc = parseBinding(binding);
    const hash = descriptorHash(desc);

    if (!hashToActions.has(hash)) {
      hashToActions.set(hash, []);
    }
    hashToActions.get(hash)!.push(action);
    actionToBinding[action] = binding;
  }

  return { hashToActions, actionToBinding };
}

// ── Match Ink input event → action names ──────────────────────────

/**
 * InkKey matches the shape of Ink's useInput key parameter.
 */
export interface InkKey {
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
}

export function matchInput(input: string, key: InkKey, resolved: ResolvedBindings): string[] {
  // Determine the base key
  let baseKey: string;
  if (key.upArrow) baseKey = 'up';
  else if (key.downArrow) baseKey = 'down';
  else if (key.leftArrow) baseKey = 'left';
  else if (key.rightArrow) baseKey = 'right';
  else if (key.return) baseKey = 'return';
  else if (key.escape) baseKey = 'escape';
  else if (key.tab) baseKey = 'tab';
  else if (input === ' ') baseKey = 'space';
  else baseKey = input.toLowerCase();

  // Build descriptor
  const desc: KeyDescriptor = {
    key: baseKey,
    ctrl: !!key.ctrl,
    shift: !!key.shift,
    meta: !!key.meta,
  };

  const hash = descriptorHash(desc);
  return resolved.hashToActions.get(hash) || [];
}

// ── Human-readable label for a binding ────────────────────────────

const DISPLAY_KEYS: Record<string, string> = {
  'up': '\u2191',
  'down': '\u2193',
  'left': '\u2190',
  'right': '\u2192',
  'return': 'Enter',
  'escape': 'Esc',
  'tab': 'Tab',
  'space': 'Space',
};

export function bindingLabel(binding: string): string {
  const desc = parseBinding(binding);
  const parts: string[] = [];
  if (desc.ctrl) parts.push('Ctrl');
  if (desc.shift) parts.push('Shift');
  if (desc.meta) parts.push('Alt');
  const display = DISPLAY_KEYS[desc.key] || desc.key.toUpperCase();
  parts.push(display);
  return parts.join('+');
}
