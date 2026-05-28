import { describe, it, expect } from 'vitest';
import { colors, fontFamily, spacing } from '../tokens';

describe('tokens amber phosphor palette', () => {
  it('uses the phosphor bg + accent', () => {
    expect(colors.bg).toBe('#0a0a0a');
    expect(colors.accent).toBe('#ffd089');
  });

  it('keeps all original exported keys', () => {
    expect(Object.keys(colors).sort()).toEqual(
      ['accent', 'bg', 'border', 'error', 'fg', 'muted', 'success'].sort()
    );
    expect(fontFamily).toContain('mono');
    expect(spacing.md).toBeDefined();
  });
});
