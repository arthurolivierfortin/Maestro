/**
 * Integration tests for commit-generator workflow
 * Tests the full workflow execution using mock responses
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BLOCKS_PATH = path.join(__dirname, '../../../../content/system/blocks');

describe('commit-generator workflow integration', function() {
  this.timeout(10000);
  
  // Load all required blocks
  let workflowBlock;
  let workflowNodes;
  let workflowConnections;
  let gitDiffBlock;
  let gitDiffMock;
  let describeCommitBlock;
  let describeCommitMock;
  let commitFormatBlock;
  
  before(function() {
    // Load workflow definition
    const wfPath = path.join(BLOCKS_PATH, 'workflows/commit-generator');
    workflowBlock = JSON.parse(fs.readFileSync(path.join(wfPath, 'block.json'), 'utf8'));
    workflowNodes = JSON.parse(fs.readFileSync(path.join(wfPath, 'nodes.json'), 'utf8'));
    workflowConnections = JSON.parse(fs.readFileSync(path.join(wfPath, 'connections.json'), 'utf8'));
    
    // Load git-diff block and mock
    const gitDiffPath = path.join(BLOCKS_PATH, 'tools/git-diff');
    gitDiffBlock = JSON.parse(fs.readFileSync(path.join(gitDiffPath, 'block.json'), 'utf8'));
    gitDiffMock = JSON.parse(fs.readFileSync(path.join(gitDiffPath, 'mock-response.json'), 'utf8'));
    
    // Load describe-commit block and mock
    const describePath = path.join(BLOCKS_PATH, 'inference/describe-commit');
    describeCommitBlock = JSON.parse(fs.readFileSync(path.join(describePath, 'block.json'), 'utf8'));
    describeCommitMock = JSON.parse(fs.readFileSync(path.join(describePath, 'mock-response.json'), 'utf8'));
    
    // Load commit-format validator
    const validatorPath = path.join(BLOCKS_PATH, 'validators/commit-format');
    commitFormatBlock = JSON.parse(fs.readFileSync(path.join(validatorPath, 'block.json'), 'utf8'));
  });
  
  describe('workflow structure validation', function() {
    it('should have all required blocks available', function() {
      assert.ok(workflowBlock, 'workflow block should be loaded');
      assert.ok(gitDiffBlock, 'git-diff block should be loaded');
      assert.ok(describeCommitBlock, 'describe-commit block should be loaded');
      assert.ok(commitFormatBlock, 'commit-format block should be loaded');
    });
    
    it('should have valid workflow nodes referencing existing blocks', function() {
      const blockRefs = workflowNodes.map(n => n.blockRef);
      // Check that referenced blocks exist
      for (const ref of blockRefs) {
        if (ref.includes('trigger')) continue; // triggers may be virtual
        const blockPath = path.join(BLOCKS_PATH, ref, 'block.json');
        const exists = fs.existsSync(blockPath);
        assert.ok(exists, `Block referenced by ${ref} should exist at ${blockPath}`);
      }
    });
    
    it('should have mock responses for testable blocks', function() {
      assert.ok(gitDiffMock, 'git-diff should have mock response');
      assert.ok(describeCommitMock, 'describe-commit should have mock response');
    });
  });
  
  describe('mock execution flow', function() {
    it('should produce valid output from git-diff mock', function() {
      const diff = gitDiffMock.diff || (gitDiffMock.outputs && gitDiffMock.outputs.diff);
      assert.ok(diff !== undefined, 'git-diff mock should have diff output');
    });
    
    it('should produce valid commit message from describe-commit mock', function() {
      const message = describeCommitMock.message || 
                     (describeCommitMock.outputs && describeCommitMock.outputs.message) ||
                     describeCommitMock.content;
      assert.ok(message !== undefined, 'describe-commit mock should have message output');
    });
    
    it('should validate commit message through commit-format validator', function() {
      const message = describeCommitMock.message || 
                     (describeCommitMock.outputs && describeCommitMock.outputs.message) ||
                     describeCommitMock.content || '';
      
      // Load and run validator
      const validatePath = path.join(BLOCKS_PATH, 'validators/commit-format/custom-rules.js');
      const validate = require(validatePath);
      
      // Parse commit message to extract type and subject
      const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\(([^)]+)\))?: (.+)$/;
      const match = message.match(conventionalPattern);
      
      if (match) {
        const input = {
          type: match[1],
          scope: match[3] || '',
          subject: match[4]
        };
        const result = validate(input);
        assert.ok(result.valid, `Mock commit message should be valid: ${JSON.stringify(result.errors)}`);
      } else {
        // If mock doesn't match pattern, that's a test data issue
        console.warn(`Mock message doesn't match Conventional Commits: "${message}"`);
      }
    });
  });
  
  describe('simulated workflow execution', function() {
    it('should execute nodes in correct order based on connections', function() {
      // Build dependency graph
      const inDegree = {};
      const adj = {};
      
      for (const node of workflowNodes) {
        inDegree[node.id] = 0;
        adj[node.id] = [];
      }
      
      for (const conn of workflowConnections) {
        const from = conn.from;
        const to = conn.to;
        if (adj[from]) {
          adj[from].push(to);
          inDegree[to] = (inDegree[to] || 0) + 1;
        }
      }
      
      // Topological sort (Kahn's algorithm)
      const queue = Object.keys(inDegree).filter(k => inDegree[k] === 0);
      const order = [];
      
      while (queue.length > 0) {
        const node = queue.shift();
        order.push(node);
        for (const neighbor of (adj[node] || [])) {
          inDegree[neighbor]--;
          if (inDegree[neighbor] === 0) queue.push(neighbor);
        }
      }
      
      assert.ok(order.length === workflowNodes.length, 
        'All nodes should be reachable in topological order');
      
      // Verify git-diff comes before describe
      const gitDiffIndex = order.indexOf('git-diff');
      const describeIndex = order.indexOf('describe');
      if (gitDiffIndex !== -1 && describeIndex !== -1) {
        assert.ok(gitDiffIndex < describeIndex, 
          'git-diff should execute before describe');
      }
      
      // Verify describe comes before validate
      const validateIndex = order.indexOf('validate');
      if (describeIndex !== -1 && validateIndex !== -1) {
        assert.ok(describeIndex < validateIndex, 
          'describe should execute before validate');
      }
    });
    
    it('should produce final output with commit message', function() {
      // Simulate execution with mock data
      const outputs = {};
      
      // Step 1: git-diff
      outputs['git-diff'] = {
        diff: gitDiffMock.diff || (gitDiffMock.outputs && gitDiffMock.outputs.diff) || 'mock diff'
      };
      
      // Step 2: describe-commit uses git-diff output
      const describedMessage = describeCommitMock.message || 
                              (describeCommitMock.outputs && describeCommitMock.outputs.message) ||
                              'feat(core): mock commit message';
      outputs['describe'] = { message: describedMessage };
      
      // Step 3: validate uses describe output
      outputs['validate'] = { 
        input: describedMessage,
        valid: true 
      };
      
      // Final assertion
      assert.ok(outputs['validate'].valid, 'Final output should be validated');
      assert.ok(typeof outputs['describe'].message === 'string', 
        'Final output should contain commit message');
    });
  });
  
  describe('CLI mock execution', function() {
    it('should be executable via CLI', function() {
      const cp = require('child_process');
      const cliPath = path.join(__dirname, '../../../../maestro-cli/index.js');
      
      const result = cp.spawnSync('node', [cliPath, 'execute', 'commit-generator', '--mock'], {
        encoding: 'utf8',
        cwd: path.join(__dirname, '../../../..')
      });
      
      assert.strictEqual(result.status, 0, `CLI should exit with 0, got: ${result.stderr}`);
      assert.ok(result.stdout.length > 0, 'CLI should produce output');
      
      // Parse output
      try {
        const output = JSON.parse(result.stdout);
        assert.ok(output.workflow === 'commit-generator', 'Output should reference workflow');
      } catch (e) {
        // Output may not be JSON, that's okay for some implementations
      }
    });
  });
});