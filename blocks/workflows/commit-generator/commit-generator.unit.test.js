/**
 * Unit tests for commit-generator workflow block
 * Tests workflow structure, nodes, and connections
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BLOCK_PATH = __dirname;

describe('commit-generator workflow block', function() {
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
    
    it('should have type "workflow"', function() {
      const type = blockJson.type || blockJson.blockType;
      assert.ok(type === 'workflow', 'block type should be workflow');
    });
    
    it('should have name field', function() {
      assert.ok(blockJson.name, 'name field is required');
    });
    
    it('should have description', function() {
      assert.ok(blockJson.description, 'description is recommended');
    });
    
    it('should have version', function() {
      assert.ok(blockJson.version, 'version is recommended');
    });
  });
  
  describe('nodes.json', function() {
    let nodes;
    
    before(function() {
      const nodesPath = path.join(BLOCK_PATH, 'nodes.json');
      nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf8'));
    });
    
    it('should have nodes.json file', function() {
      const nodesPath = path.join(BLOCK_PATH, 'nodes.json');
      assert.ok(fs.existsSync(nodesPath), 'nodes.json should exist');
    });
    
    it('should be an array of nodes', function() {
      assert.ok(Array.isArray(nodes), 'nodes should be an array');
      assert.ok(nodes.length > 0, 'nodes should not be empty');
    });
    
    it('each node should have id and blockRef', function() {
      for (const node of nodes) {
        assert.ok(node.id, `node should have id: ${JSON.stringify(node)}`);
        assert.ok(node.blockRef, `node should have blockRef: ${JSON.stringify(node)}`);
      }
    });
    
    it('should have trigger node', function() {
      const triggerNode = nodes.find(n => n.id === 'trigger' || n.blockRef.includes('trigger'));
      assert.ok(triggerNode, 'workflow should have a trigger node');
    });
    
    it('should have git-diff node', function() {
      const gitDiffNode = nodes.find(n => n.blockRef.includes('git-diff'));
      assert.ok(gitDiffNode, 'workflow should have git-diff tool node');
    });
    
    it('should have describe/inference node', function() {
      const describeNode = nodes.find(n => n.blockRef.includes('inference') || n.blockRef.includes('describe'));
      assert.ok(describeNode, 'workflow should have describe-commit inference node');
    });
    
    it('should have validator node', function() {
      const validatorNode = nodes.find(n => n.blockRef.includes('validator') || n.blockRef.includes('commit-format'));
      assert.ok(validatorNode, 'workflow should have commit-format validator node');
    });
    
    it('each node should have position', function() {
      for (const node of nodes) {
        assert.ok(node.position, `node ${node.id} should have position`);
        assert.ok(typeof node.position.x === 'number', 'position.x should be number');
        assert.ok(typeof node.position.y === 'number', 'position.y should be number');
      }
    });
  });
  
  describe('connections.json', function() {
    let connections;
    let nodes;
    
    before(function() {
      const connsPath = path.join(BLOCK_PATH, 'connections.json');
      const nodesPath = path.join(BLOCK_PATH, 'nodes.json');
      connections = JSON.parse(fs.readFileSync(connsPath, 'utf8'));
      nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf8'));
    });
    
    it('should have connections.json file', function() {
      const connsPath = path.join(BLOCK_PATH, 'connections.json');
      assert.ok(fs.existsSync(connsPath), 'connections.json should exist');
    });
    
    it('should be an array of connections', function() {
      assert.ok(Array.isArray(connections), 'connections should be an array');
      assert.ok(connections.length > 0, 'connections should not be empty');
    });
    
    it('each connection should have from and to', function() {
      for (const conn of connections) {
        assert.ok(conn.from, `connection should have from: ${JSON.stringify(conn)}`);
        assert.ok(conn.to, `connection should have to: ${JSON.stringify(conn)}`);
      }
    });
    
    it('connections should reference valid node ids', function() {
      const nodeIds = nodes.map(n => n.id);
      for (const conn of connections) {
        const fromId = typeof conn.from === 'object' ? conn.from.nodeId : conn.from;
        const toId = typeof conn.to === 'object' ? conn.to.nodeId : conn.to;
        // from is the node id string directly in this format
        assert.ok(nodeIds.includes(fromId) || typeof conn.from === 'string' && nodeIds.includes(conn.from), 
          `from "${fromId || conn.from}" should be a valid node id`);
        assert.ok(nodeIds.includes(toId) || typeof conn.to === 'string' && nodeIds.includes(conn.to), 
          `to "${toId || conn.to}" should be a valid node id`);
      }
    });
    
    it('should have connection from git-diff to describe', function() {
      const hasGitToDescribe = connections.some(c => 
        (c.from === 'git-diff' || (c.from && c.from.includes && c.from.includes('git-diff'))) &&
        (c.to === 'describe' || (c.to && c.to.includes && c.to.includes('describe')))
      );
      assert.ok(hasGitToDescribe, 'should connect git-diff to describe');
    });
  });
  
  describe('workflow data flow', function() {
    it('nodes and connections should form a valid DAG', function() {
      // Simple cycle detection
      const nodesPath = path.join(BLOCK_PATH, 'nodes.json');
      const connsPath = path.join(BLOCK_PATH, 'connections.json');
      const nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf8'));
      const connections = JSON.parse(fs.readFileSync(connsPath, 'utf8'));
      
      const nodeIds = new Set(nodes.map(n => n.id));
      const edges = connections.map(c => ({
        from: typeof c.from === 'string' ? c.from : c.from,
        to: typeof c.to === 'string' ? c.to : c.to
      }));
      
      // Build adjacency list
      const adj = {};
      for (const id of nodeIds) adj[id] = [];
      for (const e of edges) {
        if (adj[e.from]) adj[e.from].push(e.to);
      }
      
      // DFS cycle detection
      const visited = new Set();
      const recStack = new Set();
      
      function hasCycle(node) {
        if (recStack.has(node)) return true;
        if (visited.has(node)) return false;
        visited.add(node);
        recStack.add(node);
        for (const neighbor of (adj[node] || [])) {
          if (hasCycle(neighbor)) return true;
        }
        recStack.delete(node);
        return false;
      }
      
      let cycleFound = false;
      for (const id of nodeIds) {
        if (hasCycle(id)) {
          cycleFound = true;
          break;
        }
      }
      
      assert.ok(!cycleFound, 'workflow should not have cycles');
    });
  });
});