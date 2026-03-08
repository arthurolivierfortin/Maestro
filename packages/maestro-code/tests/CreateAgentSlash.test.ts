import { describe, it, expect } from 'vitest';
import { parseCreateAgent } from '../App.ts';

describe('parseCreateAgent', () => {
  it('returns null for empty input', () => {
    expect(parseCreateAgent('')).toBeNull();
    expect(parseCreateAgent('  ')).toBeNull();
  });

  it('parses description only', () => {
    const result = parseCreateAgent('An agent that reviews code');
    expect(result).toEqual({
      description: 'An agent that reviews code',
      contract: '',
      model: '',
    });
  });

  it('parses description with --contract flag', () => {
    const result = parseCreateAgent('An agent that reviews code --contract code-reviewer');
    expect(result).toEqual({
      description: 'An agent that reviews code',
      contract: 'code-reviewer',
      model: '',
    });
  });

  it('parses description with --model flag', () => {
    const result = parseCreateAgent('An agent --model claude-haiku-4-5-20251001');
    expect(result).toEqual({
      description: 'An agent',
      contract: '',
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('parses description with both --contract and --model flags', () => {
    const result = parseCreateAgent('An agent that reviews code --contract code-reviewer --model haiku');
    expect(result).toEqual({
      description: 'An agent that reviews code',
      contract: 'code-reviewer',
      model: 'haiku',
    });
  });

  it('handles flags before description tokens', () => {
    const result = parseCreateAgent('--contract my-contract A code review agent');
    expect(result).toEqual({
      description: 'A code review agent',
      contract: 'my-contract',
      model: '',
    });
  });

  it('handles flags interspersed with description', () => {
    const result = parseCreateAgent('Review --model haiku agent for TypeScript');
    expect(result).toEqual({
      description: 'Review agent for TypeScript',
      contract: '',
      model: 'haiku',
    });
  });

  it('returns null when only flags are provided (no description)', () => {
    const result = parseCreateAgent('--contract code-reviewer --model haiku');
    expect(result).toBeNull();
  });
});
