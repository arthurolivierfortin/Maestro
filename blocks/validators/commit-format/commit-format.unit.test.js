/**
 * Unit tests for commit-format validator block
 * Tests block.json structure, validation schema, and custom rules
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BLOCK_PATH = __dirname;

describe('commit-format validator block', function() {
  describe('block.json validation', function() {
    let blockJson;
    
    before(function() {
      const content = fs.readFileSync(path.join(BLOCK_PATH, 'block.json'), 'utf8');
      blockJson = JSON.parse(content);
    });
    
    it('should have required id field', function() {
      assert.ok(blockJson.id, 'id field is required');
      assert.strictEqual(typeof blockJson.id, 'string');
    });
    
    it('should have type "validator"', function() {
      const type = blockJson.type || blockJson.blockType;
      assert.ok(type === 'validator', 'block type should be validator');
    });
    
    it('should have name field', function() {
      assert.ok(blockJson.name, 'name field is required');
    });
  });
  
  describe('validation-schema.json', function() {
    it('should have validation-schema.json file', function() {
      const schemaPath = path.join(BLOCK_PATH, 'validation-schema.json');
      assert.ok(fs.existsSync(schemaPath), 'validation-schema.json should exist');
    });
    
    it('should have valid JSON schema', function() {
      const schemaPath = path.join(BLOCK_PATH, 'validation-schema.json');
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      assert.ok(schema, 'schema should parse');
      assert.ok(schema.type || schema.properties || schema.pattern, 
        'schema should have type, properties, or pattern');
    });
  });
  
  describe('custom-rules.js', function() {
    let validate;
    
    before(function() {
      const rulesPath = path.join(BLOCK_PATH, 'custom-rules.js');
      if (fs.existsSync(rulesPath)) {
        validate = require(rulesPath);
      }
    });
    
    it('should have custom-rules.js file', function() {
      const rulesPath = path.join(BLOCK_PATH, 'custom-rules.js');
      assert.ok(fs.existsSync(rulesPath), 'custom-rules.js should exist');
    });
    
    it('should export a validate function', function() {
      assert.ok(typeof validate === 'function', 'custom-rules should export a function');
    });
    
    it('should validate correct commit message', function() {
      const result = validate({ type: 'feat', scope: 'core', subject: 'add new feature' });
      assert.ok(result.valid === true, 'valid commit should pass validation');
    });
    
    it('should reject invalid type', function() {
      const result = validate({ type: 'invalid', subject: 'some change' });
      assert.ok(result.valid === false, 'invalid type should fail');
      assert.ok(result.errors.some(e => e.includes('type')), 'should report type error');
    });
    
    it('should reject empty subject', function() {
      const result = validate({ type: 'feat', subject: '' });
      assert.ok(result.valid === false, 'empty subject should fail');
      assert.ok(result.errors.some(e => e.toLowerCase().includes('subject')), 
        'should report subject error');
    });
    
    it('should reject subject over 72 characters', function() {
      const longSubject = 'a'.repeat(73);
      const result = validate({ type: 'feat', subject: longSubject });
      assert.ok(result.valid === false, 'long subject should fail');
      assert.ok(result.errors.some(e => e.includes('72')), 'should report length error');
    });
    
    it('should accept all standard commit types', function() {
      const types = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore'];
      for (const type of types) {
        const result = validate({ type, subject: 'valid subject' });
        assert.ok(result.valid === true, `type "${type}" should be valid`);
      }
    });
  });
});