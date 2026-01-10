/**
 * BlockTypeRegistry Tests
 */

import { describe, it, expect } from 'vitest';
import { BlockTypeRegistry } from './BlockTypeRegistry';
import type { BlockType } from '../types/block.types';

describe('BlockTypeRegistry', () => {
  describe('get', () => {
    it('should return type info for valid type', () => {
      const info = BlockTypeRegistry.get('workflow');
      expect(info).toBeDefined();
      expect(info?.type).toBe('workflow');
      expect(info?.label).toBe('Workflow');
    });

    it('should return undefined for invalid type', () => {
      const info = BlockTypeRegistry.get('invalid' as BlockType);
      expect(info).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered types', () => {
      const allTypes = BlockTypeRegistry.getAll();
      expect(allTypes).toHaveLength(9);
      expect(allTypes.map((t) => t.type)).toContain('workflow');
      expect(allTypes.map((t) => t.type)).toContain('agent');
      expect(allTypes.map((t) => t.type)).toContain('task');
    });
  });

  describe('canContain', () => {
    it('should allow workflow to contain agent', () => {
      expect(BlockTypeRegistry.canContain('workflow', 'agent')).toBe(true);
    });

    it('should allow workflow to contain task', () => {
      expect(BlockTypeRegistry.canContain('workflow', 'task')).toBe(true);
    });

    it('should allow agent to contain prompt', () => {
      expect(BlockTypeRegistry.canContain('agent', 'prompt')).toBe(true);
    });

    it('should not allow prompt to contain anything (atomic)', () => {
      expect(BlockTypeRegistry.canContain('prompt', 'agent')).toBe(false);
    });

    it('should not allow workflow to contain prompt directly', () => {
      expect(BlockTypeRegistry.canContain('workflow', 'prompt')).toBe(false);
    });

    it('should return false for unknown types', () => {
      expect(BlockTypeRegistry.canContain('invalid' as BlockType, 'agent')).toBe(false);
    });
  });

  describe('getDefaultBlock', () => {
    it('should create default workflow block', () => {
      const block = BlockTypeRegistry.getDefaultBlock('workflow');
      expect(block.blockType).toBe('workflow');
      expect(block.name).toBe('New Workflow');
      expect(block.isAtomic).toBe(false);
      expect(block.children).toEqual([]);
    });

    it('should create default agent block', () => {
      const block = BlockTypeRegistry.getDefaultBlock('agent');
      expect(block.blockType).toBe('agent');
      expect(block.name).toBe('New Agent');
      expect(block.isAtomic).toBe(false);
      expect(block.config.type).toBe('agent');
    });

    it('should create default atomic prompt block', () => {
      const block = BlockTypeRegistry.getDefaultBlock('prompt');
      expect(block.blockType).toBe('prompt');
      expect(block.isAtomic).toBe(true);
      expect(block.children).toBeUndefined();
    });

    it('should throw error for unknown type', () => {
      expect(() => BlockTypeRegistry.getDefaultBlock('invalid' as BlockType)).toThrow();
    });
  });

  describe('validateConfig', () => {
    it('should validate valid agent config', () => {
      const config = {
        type: 'agent',
        agentType: 'Planner',
        temperature: 0.7,
      };
      const result = BlockTypeRegistry.validateConfig('agent', config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject agent config without agentType', () => {
      const config = {
        type: 'agent',
      };
      const result = BlockTypeRegistry.validateConfig('agent', config);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject config with wrong type field', () => {
      const config = {
        type: 'workflow',
        agentType: 'Planner',
      };
      const result = BlockTypeRegistry.validateConfig('agent', config);
      expect(result.isValid).toBe(false);
    });

    it('should validate valid task config', () => {
      const config = {
        type: 'task',
        description: 'Test task',
      };
      const result = BlockTypeRegistry.validateConfig('task', config);
      expect(result.isValid).toBe(true);
    });

    it('should reject task config without description', () => {
      const config = {
        type: 'task',
      };
      const result = BlockTypeRegistry.validateConfig('task', config);
      expect(result.isValid).toBe(false);
    });

    it('should reject non-object config', () => {
      const result = BlockTypeRegistry.validateConfig('agent', 'invalid');
      expect(result.isValid).toBe(false);
    });

    it('should reject unknown block type', () => {
      const result = BlockTypeRegistry.validateConfig('invalid' as BlockType, {});
      expect(result.isValid).toBe(false);
    });
  });
});
