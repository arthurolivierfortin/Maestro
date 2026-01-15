/**
 * Unit tests for commit-description prompt block
 * Tests block.json structure and template
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BLOCK_PATH = __dirname;

describe('commit-description prompt block', function() {
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
    
    it('should have type "prompt"', function() {
      assert.ok(blockJson.type === 'prompt' || blockJson.blockType === 'prompt', 
        'block type should be prompt');
    });
    
    it('should have name field', function() {
      assert.ok(blockJson.name, 'name field is required');
    });
    
    it('should have description', function() {
      assert.ok(blockJson.description, 'description is recommended');
    });
  });
  
  describe('template.md', function() {
    let template;
    
    before(function() {
      const templatePath = path.join(BLOCK_PATH, 'template.md');
      if (fs.existsSync(templatePath)) {
        template = fs.readFileSync(templatePath, 'utf8');
      }
    });
    
    it('should have template.md file', function() {
      const templatePath = path.join(BLOCK_PATH, 'template.md');
      assert.ok(fs.existsSync(templatePath), 'template.md should exist');
    });
    
    it('should have non-empty template content', function() {
      assert.ok(template && template.length > 0, 'template should have content');
    });
    
    it('should contain variable placeholders or instructions', function() {
      // Check for common template patterns
      const hasVariables = template.includes('{{') || template.includes('${') || 
                          template.includes('diff') || template.includes('commit');
      assert.ok(hasVariables, 'template should reference variables or provide instructions');
    });
    
    it('should mention Conventional Commits format', function() {
      const hasConventional = template.toLowerCase().includes('conventional') || 
                             template.includes('feat') || template.includes('fix');
      assert.ok(hasConventional, 'template should reference Conventional Commits');
    });
  });
  
  describe('examples directory', function() {
    it('should have examples directory', function() {
      const examplesPath = path.join(BLOCK_PATH, 'examples');
      assert.ok(fs.existsSync(examplesPath), 'examples directory should exist');
    });
    
    it('should have at least one example file', function() {
      const examplesPath = path.join(BLOCK_PATH, 'examples');
      if (fs.existsSync(examplesPath)) {
        const files = fs.readdirSync(examplesPath);
        assert.ok(files.length > 0, 'examples directory should contain files');
      }
    });
  });
});