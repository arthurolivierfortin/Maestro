#!/usr/bin/env node
/**
 * Maestro MCP Server
 * Model Context Protocol server for AI assistants to interact with Maestro
 * 
 * Uses the Maestro API backend instead of direct filesystem access
 */

const { MaestroApiClient, ApiError } = require('../packages/maestro-cli/api-client');

// Configuration
const API_URL = process.env.MAESTRO_API_URL || 'http://localhost:5000';
const DEBUG = process.env.MAESTRO_DEBUG === 'true';

const client = new MaestroApiClient(API_URL, { debug: DEBUG });

// Async request handler
async function handleRequestAsync(req) {
  if (!req || !req.tool) {
    return { error: 'invalid request' };
  }

  try {
    // ============= Block Tools =============
    
    if (req.tool === 'list-blocks') {
      const type = req.arguments?.type;
      const blocks = await client.listBlocks(type ? { type } : undefined);
      return { blocks };
    }

    if (req.tool === 'get-block') {
      const blockId = req.arguments?.blockId;
      if (!blockId) return { error: 'blockId required' };
      const block = await client.getBlock(blockId);
      return { block };
    }

    if (req.tool === 'search-blocks') {
      const query = req.arguments?.query;
      if (!query) return { error: 'query required' };
      const blocks = await client.searchBlocks(query);
      return { blocks };
    }

    // ============= Workflow Tools =============

    if (req.tool === 'list-workflows') {
      const blocks = await client.listBlocks({ type: 'Workflow' });
      return { workflows: blocks.map(b => b.id) };
    }

    if (req.tool === 'get-workflow') {
      const workflowId = req.arguments?.workflowId;
      if (!workflowId) return { error: 'workflowId required' };
      const block = await client.getBlock(workflowId);
      return { workflowId, block };
    }

    if (req.tool === 'execute-workflow') {
      const workflowId = req.arguments?.workflowId;
      const inputs = req.arguments?.inputs || {};
      if (!workflowId) return { error: 'workflowId required' };
      
      // TODO: When workflow execution is implemented in API
      // For now, return a placeholder
      return { 
        error: 'workflow execution not yet implemented via API',
        workflowId,
        inputs
      };
    }

    // ============= Project Tools =============

    if (req.tool === 'list-projects') {
      const projects = await client.listProjects();
      return { projects };
    }

    if (req.tool === 'get-project') {
      const projectId = req.arguments?.projectId;
      if (!projectId) return { error: 'projectId required' };
      const project = await client.getProject(projectId);
      return { project };
    }

    if (req.tool === 'open-project') {
      const projectPath = req.arguments?.path;
      if (!projectPath) return { error: 'path required' };
      const project = await client.openProject(projectPath);
      return { project };
    }

    if (req.tool === 'get-project-blocks') {
      const projectId = req.arguments?.projectId;
      if (!projectId) return { error: 'projectId required' };
      const blocks = await client.getProjectBlocks(projectId);
      return { blocks };
    }

    if (req.tool === 'discover-projects') {
      const searchPath = req.arguments?.path || '.';
      const projects = await client.discoverProjects(searchPath);
      return { projects };
    }

    // ============= Container Tools =============

    if (req.tool === 'get-container-status') {
      const projectId = req.arguments?.projectId;
      if (!projectId) return { error: 'projectId required' };
      const status = await client.getContainerStatus(projectId);
      return { status };
    }

    if (req.tool === 'start-container') {
      const projectId = req.arguments?.projectId;
      if (!projectId) return { error: 'projectId required' };
      const status = await client.startContainer(projectId);
      return { status, message: 'Container started' };
    }

    if (req.tool === 'stop-container') {
      const projectId = req.arguments?.projectId;
      if (!projectId) return { error: 'projectId required' };
      const status = await client.stopContainer(projectId);
      return { status, message: 'Container stopped' };
    }

    if (req.tool === 'restart-container') {
      const projectId = req.arguments?.projectId;
      if (!projectId) return { error: 'projectId required' };
      const status = await client.restartContainer(projectId);
      return { status, message: 'Container restarted' };
    }

    if (req.tool === 'get-container-logs') {
      const projectId = req.arguments?.projectId;
      const lines = req.arguments?.lines;
      const since = req.arguments?.since;
      if (!projectId) return { error: 'projectId required' };
      const logs = await client.getContainerLogs(projectId, { lines, since });
      return { logs };
    }

    // ============= File System Tools =============

    if (req.tool === 'list-directory') {
      const path = req.arguments?.path;
      const entries = await client.listDirectory(path);
      return { entries };
    }

    if (req.tool === 'get-common-directories') {
      const directories = await client.getCommonDirectories();
      return { directories };
    }

    // ============= Permission Tools =============

    if (req.tool === 'get-file-access-rules') {
      const projectId = req.arguments?.projectId;
      if (!projectId) return { error: 'projectId required' };
      const rules = await client.getFileAccessRules(projectId);
      return { rules };
    }

    if (req.tool === 'update-file-access-rules') {
      const projectId = req.arguments?.projectId;
      const rules = req.arguments?.rules;
      if (!projectId) return { error: 'projectId required' };
      if (!rules) return { error: 'rules required' };
      const updated = await client.updateFileAccessRules(projectId, rules);
      return { rules: updated };
    }

    if (req.tool === 'get-block-permissions') {
      const projectId = req.arguments?.projectId;
      if (!projectId) return { error: 'projectId required' };
      const permissions = await client.getBlockPermissions(projectId);
      return { permissions };
    }

    if (req.tool === 'update-block-permissions') {
      const projectId = req.arguments?.projectId;
      const permissions = req.arguments?.permissions;
      if (!projectId) return { error: 'projectId required' };
      if (!permissions) return { error: 'permissions required' };
      const updated = await client.updateBlockPermissions(projectId, permissions);
      return { permissions: updated };
    }

    // ============= System Tools =============

    if (req.tool === 'health') {
      const health = await client.getHealth();
      return { health };
    }

    // ============= Resource Handlers =============
    
    if (req.resource) {
      const res = req.resource.toString();
      
      // blocks://
      if (res === 'blocks://') {
        const blocks = await client.listBlocks();
        return { blocks };
      }
      
      // block://<id>
      if (res.startsWith('block://')) {
        const id = res.substring('block://'.length);
        const block = await client.getBlock(id);
        return { block };
      }
      
      // workflows://
      if (res === 'workflows://') {
        const blocks = await client.listBlocks({ type: 'Workflow' });
        return { workflows: blocks.map(b => b.id) };
      }
      
      // workflow://<id>
      if (res.startsWith('workflow://')) {
        const id = res.substring('workflow://'.length);
        const block = await client.getBlock(id);
        return { workflowId: id, block };
      }
      
      // projects://
      if (res === 'projects://') {
        const projects = await client.listProjects();
        return { projects };
      }
      
      // project://<id>
      if (res.startsWith('project://')) {
        const id = res.substring('project://'.length);
        const project = await client.getProject(id);
        return { project };
      }

      // container://<projectId>
      if (res.startsWith('container://')) {
        const id = res.substring('container://'.length);
        const status = await client.getContainerStatus(id);
        return { status };
      }

      // containers://
      if (res === 'containers://') {
        const projects = await client.listProjects();
        const statuses = await Promise.all(
          projects.map(async (p) => {
            try {
              const status = await client.getContainerStatus(p.id);
              return { projectId: p.id, projectName: p.name, ...status };
            } catch {
              return { projectId: p.id, projectName: p.name, status: 'unknown' };
            }
          })
        );
        return { containers: statuses };
      }

      return { error: 'invalid resource' };
    }

    return { error: 'unknown tool' };
    
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message, status: error.status };
    }
    if (error.code === 'ECONNREFUSED') {
      return { 
        error: `Cannot connect to Maestro backend at ${API_URL}`,
        hint: 'Start the backend with: dotnet run --project backend/src/Maestro.Api'
      };
    }
    return { error: error.message || 'unknown error' };
  }
}

// Synchronous wrapper for handleRequest
function handleRequest(req) {
  // We need to return a promise for async handling
  return handleRequestAsync(req);
}

// Read lines from stdin and process as JSON-RPC style requests
const rl = require('readline').createInterface({ 
  input: process.stdin, 
  output: process.stdout, 
  terminal: false 
});

rl.on('line', async (line) => {
  try {
    const req = JSON.parse(line);
    const res = await handleRequest(req);
    process.stdout.write(JSON.stringify(res) + '\n');
  } catch (e) {
    process.stdout.write(JSON.stringify({ error: 'invalid json' }) + '\n');
  }
});

// Export for testing
module.exports = { handleRequest, handleRequestAsync };
