/**
 * Unit tests for git-diff tool block
 * Tests block.json structure, scripts, and mock responses
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BLOCK_PATH = __dirname;

describe('git-diff block', function() {
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
    
    it('should have type "tool"', function() {
      assert.strictEqual(blockJson.type, 'tool');
    });
    
    it('should have name field', function() {
      assert.ok(blockJson.name, 'name field is required');
      assert.strictEqual(blockJson.name, 'Git Diff');
    });
    
    it('should define outputs with diff property', function() {
      assert.ok(blockJson.outputs, 'outputs field is required');
      assert.ok(blockJson.outputs.properties, 'outputs.properties is required');
      assert.ok(blockJson.outputs.properties.diff, 'diff output is required');
      assert.strictEqual(blockJson.outputs.properties.diff.type, 'string');
    });
    
    it('should define files output as array', function() {
      assert.ok(blockJson.outputs.properties.files, 'files output is required');
      assert.strictEqual(blockJson.outputs.properties.files.type, 'array');
    });
    
    it('should have executable configuration', function() {
      assert.ok(blockJson.executable, 'executable field is required');
      assert.strictEqual(blockJson.executable.type, 'script');
      assert.ok(blockJson.executable.unix, 'unix script path required');
      assert.ok(blockJson.executable.win, 'windows script path required');
    });
  });
  
  describe('script files', function() {
    it('should have script.sh for Unix', function() {
      const scriptPath = path.join(BLOCK_PATH, 'script.sh');
      assert.ok(fs.existsSync(scriptPath), 'script.sh should exist');
      const content = fs.readFileSync(scriptPath, 'utf8');
      assert.ok(content.includes('git diff'), 'script should contain git diff command');
      assert.ok(content.includes('--staged'), 'script should use --staged flag');
    });
    
    it('should have script.ps1 for Windows', function() {
      const scriptPath = path.join(BLOCK_PATH, 'script.ps1');
      assert.ok(fs.existsSync(scriptPath), 'script.ps1 should exist');
      const content = fs.readFileSync(scriptPath, 'utf8');
      assert.ok(content.includes('git') || content.includes('diff'), 'script should contain git commands');
    });
  });
  
  describe('mock-response.json', function() {
    let mockResponse;
    
    before(function() {
      const content = fs.readFileSync(path.join(BLOCK_PATH, 'mock-response.json'), 'utf8');
      mockResponse = JSON.parse(content);
    });
    
    it('should have valid mock response structure', function() {
      assert.ok(mockResponse, 'mock-response.json should parse');
    });
    
    it('should have diff property in mock response', function() {
      assert.ok('diff' in mockResponse || ('outputs' in mockResponse && 'diff' in mockResponse.outputs), 
        'mock response should have diff output');
    });
  });
  
  describe('output-schema.json', function() {
    it('should have valid output schema', function() {
      const schemaPath = path.join(BLOCK_PATH, 'output-schema.json');
      assert.ok(fs.existsSync(schemaPath), 'output-schema.json should exist');
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      assert.ok(schema.type || schema.properties, 'schema should have type or properties');
    });
  });
});