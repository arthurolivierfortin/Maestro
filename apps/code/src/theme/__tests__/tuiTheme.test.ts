import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(
  resolve(process.cwd(), 'src/theme/tui-theme.css'),
  'utf8'
);

describe('tui-theme.css port', () => {
  it('defines the three phosphor presets', () => {
    expect(css).toContain('[data-tui="amber"]');
    expect(css).toContain('[data-tui="green"]');
    expect(css).toContain('[data-tui="white"]');
  });

  it('defines CRT scanlines that can be turned off', () => {
    expect(css).toContain('.shell::before');
    expect(css).toContain('[data-crt="off"]');
    expect(css).toContain('pointer-events: none');
  });

  it('uses a fluid .term (no fixed 1380px width)', () => {
    expect(css).not.toMatch(/\.term\s*\{[^}]*width:\s*1380px/s);
    expect(css).toContain('grid-template-rows');
  });

  it('ports the amber phosphor primary color', () => {
    expect(css).toContain('#ffb454');
  });

  it('defines the box-drawing panel and status vocabulary', () => {
    expect(css).toContain('.term-title');
    expect(css).toContain('.tabs');
    expect(css).toContain('.box');
    expect(css).toContain('.status');
    expect(css).toContain('.cmdline');
    expect(css).toContain('.conv');
    expect(css).toContain('.line');
  });
});
