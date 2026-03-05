import { describe, it, expect } from 'vitest';
import { computeActiveFeatures, type ContractDefinition } from '../services/contract-resolver.ts';

const maestroAssistantContract: ContractDefinition = {
  id: 'maestro-assistant',
  name: 'Maestro Assistant',
  description: 'The primary conversational assistant',
  requiredCapabilities: ['conversation'],
  features: {
    'conversation': {
      description: 'Basic conversational interaction',
      requires: ['conversation'],
    },
    'tool-use': {
      description: 'Execute tools',
      requires: ['tool-calling'],
    },
    'json-config': {
      description: 'Generate structured JSON',
      requires: ['structured-output'],
    },
    'deep-context': {
      description: 'Handle large codebases',
      requires: ['long-context'],
    },
    'session-orchestration': {
      description: 'Create and manage sessions',
      requires: ['orchestration', 'tool-calling'],
    },
  },
};

describe('computeActiveFeatures', () => {
  it('returns all features active when all capabilities present', () => {
    const caps = ['conversation', 'tool-calling', 'structured-output', 'long-context', 'orchestration'];
    const { active, inactive } = computeActiveFeatures(maestroAssistantContract, caps);

    expect(active).toContain('conversation');
    expect(active).toContain('tool-use');
    expect(active).toContain('json-config');
    expect(active).toContain('deep-context');
    expect(active).toContain('session-orchestration');
    expect(inactive).toHaveLength(0);
  });

  it('returns only conversation active for minimal capabilities', () => {
    const caps = ['conversation'];
    const { active, inactive } = computeActiveFeatures(maestroAssistantContract, caps);

    expect(active).toEqual(['conversation']);
    expect(inactive).toContain('tool-use');
    expect(inactive).toContain('json-config');
    expect(inactive).toContain('deep-context');
    expect(inactive).toContain('session-orchestration');
  });

  it('session-orchestration requires BOTH orchestration and tool-calling', () => {
    const capsWithOrchOnly = ['conversation', 'orchestration'];
    const result1 = computeActiveFeatures(maestroAssistantContract, capsWithOrchOnly);
    expect(result1.inactive).toContain('session-orchestration');

    const capsWithToolOnly = ['conversation', 'tool-calling'];
    const result2 = computeActiveFeatures(maestroAssistantContract, capsWithToolOnly);
    expect(result2.inactive).toContain('session-orchestration');

    const capsWithBoth = ['conversation', 'orchestration', 'tool-calling'];
    const result3 = computeActiveFeatures(maestroAssistantContract, capsWithBoth);
    expect(result3.active).toContain('session-orchestration');
  });

  it('returns empty lists when contract is null', () => {
    const { active, inactive } = computeActiveFeatures(null, ['conversation']);
    expect(active).toHaveLength(0);
    expect(inactive).toHaveLength(0);
  });

  it('returns all features inactive when no capabilities', () => {
    const { active, inactive } = computeActiveFeatures(maestroAssistantContract, []);
    expect(active).toHaveLength(0);
    expect(inactive).toHaveLength(5);
  });
});
