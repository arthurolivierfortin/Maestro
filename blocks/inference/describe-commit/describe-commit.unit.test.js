/**
 * Unit tests for describe-commit inference block
 * Tests block.json structure, output schema, and mock response
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BLOCK_PATH = __dirname;

describe('describe-commit inference block', function() {
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
    
    it('should have type "inference"', function() {
      assert.ok(blockJson.type === 'inference' || blockJson.blockType === 'inference', 
        'block type should be inference');
    });
    
    it('should have name field', function() {
      assert.ok(blockJson.name, 'name field is required');
    });
    
    it('should define inputs for diff and context', function() {
      assert.ok(blockJson.inputs, 'inputs field is required');
      const props = blockJson.inputs.properties || blockJson.inputs;
      assert.ok(props.diff || props.context, 'should have diff or context input');
    });
    
    it('should reference output schema', function() {
      assert.ok(blockJson.outputs, 'outputs field is required');
    });
    
    it('should optionally reference prompt block', function() {
      // promptRef is optional but recommended
      if (blockJson.promptRef) {
        assert.strictEqual(typeof blockJson.promptRef, 'string');
      }
    });
  });
  
  describe('output-schema.json', function() {
    let outputSchema;
    
    before(function() {
      const schemaPath = path.join(BLOCK_PATH, 'output-schema.json');
      if (fs.existsSync(schemaPath)) {
        outputSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      }
    });
    
    it('should have output-schema.json file', function() {
      const schemaPath = path.join(BLOCK_PATH, 'output-schema.json');
      assert.ok(fs.existsSync(schemaPath), 'output-schema.json should exist');
    });
    
    it('should define commit message structure', function() {
      assert.ok(outputSchema, 'output schema should parse');
      const hasMessageField = (outputSchema.properties && outputSchema.properties.message) ||
                             (outputSchema.type === 'string');
      assert.ok(hasMessageField || outputSchema.properties, 'should define message output or properties');
    });
  });
  
  describe('mock-response.json', function() {
    let mockResponse;
    
    before(function() {
      const mockPath = path.join(BLOCK_PATH, 'mock-response.json');
      if (fs.existsSync(mockPath)) {
        mockResponse = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
      }
    });
    
    it('should have mock-response.json file', function() {
      const mockPath = path.join(BLOCK_PATH, 'mock-response.json');
      assert.ok(fs.existsSync(mockPath), 'mock-response.json should exist');
    });
    
    it('should have valid mock response structure', function() {
      assert.ok(mockResponse, 'mock response should parse');
    });
    
    it('should contain a commit message in mock response', function() {
      const hasMessage = mockResponse.message || 
                        (mockResponse.outputs && mockResponse.outputs.message) ||
                        mockResponse.content;
      assert.ok(hasMessage !== undefined, 'mock response should have message content');
    });
    
    it('mock message should follow Conventional Commits format', function() {
      const message = mockResponse.message || 
                     (mockResponse.outputs && mockResponse.outputs.message) ||
                     mockResponse.content || '';
      // Check for type prefix pattern
      const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\([^)]+\))?:/i;
      if (typeof message === 'string' && message.length > 0) {
        assert.ok(conventionalPattern.test(message), 
          `Mock message should follow Conventional Commits format: "${message}"`);
      }
    });
  });
});