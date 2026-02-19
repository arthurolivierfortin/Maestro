// Quick verification that shared modules load correctly
import { DEFAULT_KEYBINDINGS, loadKeybindings, flattenBindings } from '@maestro/tui/keybindings';
import { parseBinding, resolveBindings, matchInput, bindingLabel } from '@maestro/tui/keybindings/keybinding-resolver.ts';
import { palette, semantic } from '@maestro/tui/theme/colors.ts';
import { brand } from '@maestro/tui/theme/brand.ts';
import { icons, layout } from '@maestro/tui/theme/tokens.ts';
import { setTerminalBg, resetTerminalBg } from '@maestro/tui/theme/terminal.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  \u2713 ${msg}`);
  } else {
    failed++;
    console.log(`  \u2717 ${msg}`);
  }
}

console.log('=== Shared Theme ===');
assert(palette.bg === '#1e1e1e', 'palette.bg is #1e1e1e');
assert(palette.brand === '#00d8ff', 'palette.brand is #00d8ff');
assert(semantic.status.success === 'green', 'semantic.status.success is green');
assert(semantic.panel.borderFocused === 'cyan', 'semantic.panel.borderFocused is cyan');
assert(typeof brand.name === 'string' && brand.name === 'MAESTRO', 'brand.name is MAESTRO');
assert(icons.done === '\u2713', 'icons.done is checkmark');
assert(layout.headerHeight === 9, 'layout.headerHeight is 9');
assert(typeof setTerminalBg === 'function', 'setTerminalBg is a function');
assert(typeof resetTerminalBg === 'function', 'resetTerminalBg is a function');

console.log('\n=== Keybindings ===');
assert(!!DEFAULT_KEYBINDINGS.navigation, 'DEFAULT_KEYBINDINGS has navigation');
assert(!!DEFAULT_KEYBINDINGS.content, 'DEFAULT_KEYBINDINGS has content');
assert(!!DEFAULT_KEYBINDINGS.actions, 'DEFAULT_KEYBINDINGS has actions');
assert(DEFAULT_KEYBINDINGS.navigation['page.prev'] === 'Ctrl+Left', 'page.prev default is Ctrl+Left');
assert(DEFAULT_KEYBINDINGS.content['cursor.upAlt'] === 'k', 'cursor.upAlt default is k');
assert(DEFAULT_KEYBINDINGS.actions['quit'] === 'q', 'quit default is q');

const bindings = loadKeybindings(true);
assert(bindings.navigation['page.prev'] === 'Ctrl+Left', 'loaded bindings contain page.prev');

const flat = flattenBindings(bindings);
assert(typeof flat['quit'] === 'string', 'flattenBindings includes quit');
assert(typeof flat['panel.next'] === 'string', 'flattenBindings includes panel.next');

console.log('\n=== Keybinding Resolver ===');
const desc = parseBinding('Ctrl+Right');
assert(desc.key === 'right', 'parseBinding Ctrl+Right key=right');
assert(desc.ctrl === true, 'parseBinding Ctrl+Right ctrl=true');
assert(desc.shift === false, 'parseBinding Ctrl+Right shift=false');

const descEsc = parseBinding('Escape');
assert(descEsc.key === 'escape', 'parseBinding Escape key=escape');

const label = bindingLabel('Ctrl+Left');
assert(label === 'Ctrl+\u2190', 'bindingLabel Ctrl+Left = Ctrl+←');

const labelQ = bindingLabel('q');
assert(labelQ === 'Q', 'bindingLabel q = Q');

const resolved = resolveBindings('detail');
assert(resolved.hashToActions.size > 0, 'resolveBindings returns non-empty map');
// In detail context, panel.next should exist but page.next should not
const allActions = [...resolved.hashToActions.values()].flat();
assert(allActions.includes('panel.next'), 'detail context includes panel.next');
assert(!allActions.includes('page.next'), 'detail context excludes page.next');

const resolvedToplevel = resolveBindings('toplevel');
const allToplevel = [...resolvedToplevel.hashToActions.values()].flat();
assert(allToplevel.includes('page.next'), 'toplevel context includes page.next');
assert(!allToplevel.includes('panel.next'), 'toplevel context excludes panel.next');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
