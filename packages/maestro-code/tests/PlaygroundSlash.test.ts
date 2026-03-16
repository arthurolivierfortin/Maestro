import { describe, it, expect } from 'vitest';
import { parsePlayground } from '../App.ts';

describe('parsePlayground', () => {
  it("'/playground' returns action 'select-model'", () => {
    expect(parsePlayground('/playground')).toEqual({ action: 'select-model' });
  });

  it("'/playground  ' with trailing spaces returns action 'select-model'", () => {
    expect(parsePlayground('/playground  ')).toEqual({ action: 'select-model' });
  });

  it("'/playground gpt-4o' returns action 'playground' with modelId", () => {
    expect(parsePlayground('/playground gpt-4o')).toEqual({
      action: 'playground',
      modelId: 'gpt-4o',
    });
  });

  it("'/playground claude-haiku-4-5-20251001' handles versioned model IDs", () => {
    expect(parsePlayground('/playground claude-haiku-4-5-20251001')).toEqual({
      action: 'playground',
      modelId: 'claude-haiku-4-5-20251001',
    });
  });

  it("'/playground --invalid' returns null", () => {
    expect(parsePlayground('/playground --invalid')).toBeNull();
  });

  it("'/playground -x' returns null for flag-like args", () => {
    expect(parsePlayground('/playground -x')).toBeNull();
  });

  it("returns null for unrelated commands", () => {
    expect(parsePlayground('/help')).toBeNull();
    expect(parsePlayground('/costs summary')).toBeNull();
    expect(parsePlayground('playground gpt-4o')).toBeNull();
  });
});
