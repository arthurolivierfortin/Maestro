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
      // 10 types: workflow, task, prompt, instruction, command, decision, validator, trigger, inference, script
      expect(allTypes).toHaveLength(10);
      expect(allTypes.map((t) => t.type)).toContain('workflow');
      expect(allTypes.map((t) => t.type)).toContain('task');
      expect(allTypes.map((t) => t.type)).toContain('command');
      expect(allTypes.map((t) => t.type)).toContain('inference');
      expect(allTypes.map((t) => t.type)).toContain('script');
    });
  });

  describe('canContain', () => {
    it('should allow workflow to contain task', () => {
      expect(BlockTypeRegistry.canContain('workflow', 'task')).toBe(true);
    });

    it('should allow workflow to contain command', () => {
      expect(BlockTypeRegistry.canContain('workflow', 'command')).toBe(true);
    });

    it('should allow task to contain command', () => {
      expect(BlockTypeRegistry.canContain('task', 'command')).toBe(true);
    });

    it('should not allow prompt to contain anything (atomic)', () => {
      expect(BlockTypeRegistry.canContain('prompt', 'command')).toBe(false);
    });

    it('should allow workflow to contain prompt directly', () => {
      // Workflow allows prompt blocks for flexibility
      expect(BlockTypeRegistry.canContain('workflow', 'prompt')).toBe(true);
    });

    it('should return false for unknown types', () => {
      expect(BlockTypeRegistry.canContain('invalid' as BlockType, 'task')).toBe(false);
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

    it('should create default task block', () => {
      const block = BlockTypeRegistry.getDefaultBlock('task');
      expect(block.blockType).toBe('task');
      expect(block.name).toBe('New Task');
      expect(block.isAtomic).toBe(false);
      expect(block.config.type).toBe('task');
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
    it('should validate valid command config', () => {
      const config = {
        type: 'command',
        commandType: 'Bash',
        command: 'ls -la',
      };
      const result = BlockTypeRegistry.validateConfig('command', config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject command config without commandType', () => {
      const config = {
        type: 'command',
      };
      const result = BlockTypeRegistry.validateConfig('command', config);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject config with wrong type field', () => {
      const config = {
        type: 'workflow',
        commandType: 'Bash',
      };
      const result = BlockTypeRegistry.validateConfig('command', config);
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
      const result = BlockTypeRegistry.validateConfig('command', 'invalid');
      expect(result.isValid).toBe(false);
    });

    it('should reject unknown block type', () => {
      const result = BlockTypeRegistry.validateConfig('invalid' as BlockType, {});
      expect(result.isValid).toBe(false);
    });
  });
});
