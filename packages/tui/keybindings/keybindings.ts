/**
 * Keybindings — Default bindings + user config loader.
 *
 * Actions are semantic names like 'panel.next', 'cursor.up', etc.
 * Bindings map actions to key descriptions like 'Ctrl+Right', 'j', 'Escape'.
 *
 * User overrides are loaded from ~/.maestro/keybindings.json if it exists.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Action categories ────────────────────────────────────────────

export interface KeybindingMap {
  navigation: Record<string, string>;
  content: Record<string, string>;
  actions: Record<string, string>;
}

// ── Default bindings (Schema A) ──────────────────────────────────

export const DEFAULT_KEYBINDINGS: KeybindingMap = {
  navigation: {
    'page.prev': 'Ctrl+Left',
    'page.next': 'Ctrl+Right',
    'page.home': 'h',
    'page.agent': 'a',
    'page.spaces': 's',
    'page.foundry': 'f',
    'page.catalog': 'c',
    'page.models': 'm',
    'panel.prev': 'Ctrl+Left',
    'panel.next': 'Ctrl+Right',
    'panel.cycle': 'Tab',
    'panel.cycleBack': 'Shift+Tab',
    'panel.1': '1',
    'panel.2': '2',
    'panel.3': '3',
  },
  content: {
    'cursor.up': 'Up',
    'cursor.down': 'Down',
    'cursor.upAlt': 'k',
    'cursor.downAlt': 'j',
    'tree.expand': 'Right',
    'tree.collapse': 'Left',
    'tree.toggle': 'Enter',
    'scroll.up': 'Ctrl+Up',
    'scroll.down': 'Ctrl+Down',
    'scroll.top': 'g',
    'scroll.bottom': 'G',
  },
  actions: {
    'quit': 'q',
    'back': 'Escape',
    'refresh': 'r',
    'help': '?',
    'zoom': 'z',
    'toggle.tree': 't',
    'toggle.files': 'f',
    'toggle.widgets': 'w',
    'toggle.vars': 'v',
    'toggle.logs': 'l',
    'voice.toggle': 'Ctrl+v',
  },
};

// ── User config path ──────────────────────────────────────────────

const MAESTRO_DIR = path.join(os.homedir(), '.maestro');
const KEYBINDINGS_FILE = path.join(MAESTRO_DIR, 'keybindings.json');

export function getKeybindingsPath(): string {
  return KEYBINDINGS_FILE;
}

// ── Deep merge ────────────────────────────────────────────────────

function deepMerge(defaults: KeybindingMap, overrides: Partial<KeybindingMap>): KeybindingMap {
  const result: KeybindingMap = {
    navigation: { ...defaults.navigation },
    content: { ...defaults.content },
    actions: { ...defaults.actions },
  };
  if (overrides.navigation) Object.assign(result.navigation, overrides.navigation);
  if (overrides.content) Object.assign(result.content, overrides.content);
  if (overrides.actions) Object.assign(result.actions, overrides.actions);
  return result;
}

// ── Load user keybindings ─────────────────────────────────────────

let _cached: KeybindingMap | null = null;

export function loadKeybindings(forceReload = false): KeybindingMap {
  if (_cached && !forceReload) return _cached;

  let userBindings: Partial<KeybindingMap> = {};
  try {
    if (fs.existsSync(KEYBINDINGS_FILE)) {
      const raw = fs.readFileSync(KEYBINDINGS_FILE, 'utf8');
      userBindings = JSON.parse(raw);
    }
  } catch {
    // Invalid JSON or missing file — use defaults
  }

  _cached = deepMerge(DEFAULT_KEYBINDINGS, userBindings);
  return _cached;
}

export function resetKeybindings(): void {
  _cached = null;
}

// ── Save user keybindings ─────────────────────────────────────────

export function saveKeybindings(bindings: KeybindingMap): void {
  try {
    if (!fs.existsSync(MAESTRO_DIR)) {
      fs.mkdirSync(MAESTRO_DIR, { recursive: true });
    }
    fs.writeFileSync(KEYBINDINGS_FILE, JSON.stringify(bindings, null, 2) + '\n', 'utf8');
    _cached = bindings;
  } catch (err) {
    throw new Error(`Failed to save keybindings: ${(err as Error).message}`);
  }
}

// ── Flatten all bindings into action→key map ──────────────────────

export function flattenBindings(bindings?: KeybindingMap): Record<string, string> {
  const kb = bindings || loadKeybindings();
  return {
    ...kb.navigation,
    ...kb.content,
    ...kb.actions,
  };
}
