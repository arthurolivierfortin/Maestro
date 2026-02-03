#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { MaestroApiClient, ApiError } = require('../shared/api-client');

// Configuration
const API_URL = process.env.MAESTRO_API_URL || 'http://localhost:5000';
const DEBUG = process.env.MAESTRO_DEBUG === 'true';

const client = new MaestroApiClient(API_URL, { debug: DEBUG });

// Legacy fallback functions for backward compatibility
function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e) { return null; }
}

function findWorkflow(id) {
  const wfPath = path.join(__dirname, '../../blocks/workflows', id);
  if (!fs.existsSync(wfPath)) return null;
  const block = loadJson(path.join(wfPath, 'block.json'));
  const nodes = loadJson(path.join(wfPath, 'nodes.json'));
  const conns = loadJson(path.join(wfPath, 'connections.json'));
  return { block, nodes, conns, path: wfPath };
}

function runMockWorkflow(id, inputs) {
  const wf = findWorkflow(id);
  if (!wf) { console.error('workflow not found:', id); process.exitCode = 2; return; }
  const result = {};
  for (const node of wf.nodes) {
    const ref = node.blockRef;
    const parts = ref.split('/');
    const kind = parts[0];
    const refPath = path.join(__dirname, '../../blocks', ...parts);
    const mock = loadJson(path.join(refPath, 'mock-response.json'));
    if (mock) {
      result[node.id] = mock;
    } else {
      result[node.id] = { message: null };
    }
  }
  const validateNode = wf.nodes.find(n => n.blockRef === 'validators/commit-format');
  const describeNode = wf.nodes.find(n => n.blockRef === 'inference/describe-commit');
  const gitDiffNode = wf.nodes.find(n => n.blockRef === 'tools/git-diff');
  const git = gitDiffNode && result[gitDiffNode.id] ? result[gitDiffNode.id] : { diff: '' };
  const described = describeNode && result[describeNode.id] ? result[describeNode.id] : null;
  const validated = validateNode && result[validateNode.id] ? result[validateNode.id] : null;

  const output = {
    workflow: id,
    inputs,
    git,
    describe: described,
    validate: validated
  };
  console.log(JSON.stringify(output, null, 2));
}

// New API-based functions

async function listBlocks() {
  try {
    const blocks = await client.listBlocks();
    if (blocks.length === 0) {
      console.log('No blocks found');
      return;
    }

    console.log('\n📦 Available Blocks:\n');
    console.table(blocks.map(b => ({
      'ID': b.id,
      'Name': b.name,
      'Type': b.blockType,
      'Version': b.version
    })));
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      console.error(`❌ Cannot connect to backend at ${API_URL}`);
      console.error('   Make sure the backend is running:');
      console.error('   $ dotnet run --project backend/src/Maestro.Api');
    } else if (error.status === 404) {
      console.error('❌ Backend API not found. Wrong API URL?');
    } else {
      console.error(`❌ Error listing blocks: ${error.message}`);
    }
    process.exit(1);
  }
}

async function listWorkflows() {
  try {
    const blocks = await client.listBlocks({ type: 'Workflow' });
    if (blocks.length === 0) {
      console.log('No workflows found');
      return;
    }

    console.log('\n⚙️  Available Workflows:\n');
    console.table(blocks.map(b => ({
      'ID': b.id,
      'Name': b.name,
      'Description': b.description || '-'
    })));
  } catch (error) {
    console.error(`❌ Error listing workflows: ${error.message}`);
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      console.error('   Is the backend running? Start it with:');
      console.error('   $ dotnet run --project backend/src/Maestro.Api');
    }
    process.exit(1);
  }
}

async function getBlockInfo(id) {
  try {
    const block = await client.getBlock(id);
    console.log('\n📄 Block Details:\n');
    console.log(`  ID:           ${block.id}`);
    console.log(`  Name:         ${block.name}`);
    console.log(`  Type:         ${block.blockType}`);
    console.log(`  Version:      ${block.version}`);
    console.log(`  Description:  ${block.description || 'N/A'}`);
    console.log(`  Capabilities: ${block.capabilities?.join(', ') || 'None'}`);
    console.log(`  Created:      ${block.createdAt}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Block not found: ${id}`);
    } else {
      console.error(`❌ Error retrieving block: ${error.message}`);
    }
    process.exit(1);
  }
}

async function getBlockChildren(id, recursive = true) {
  try {
    const result = await client.getBlockChildren(id, recursive);

    if (result.isAtomic) {
      console.log(`\n📄 Block '${id}' is atomic (no children)\n`);
      return;
    }

    console.log(`\n📂 Block '${id}' Children (${recursive ? 'recursive' : 'direct only'}):\n`);
    console.log(`  Total Children: ${result.totalChildren}`);
    console.log(`  Atomic Blocks:  ${result.atomicCount}`);
    console.log(`  Composite Blocks: ${result.compositeCount}\n`);

    if (result.children && result.children.length > 0) {
      const formatChild = (child, indent = '') => {
        const icon = child.isAtomic ? '📄' : '📂';
        // Use resolved block info if available, otherwise use node info
        const displayId = child.resolvedBlockId || child.nodeId || child.blockRef || 'unknown';
        const displayName = child.resolvedBlockName || child.nodeName || '';
        const displayType = child.resolvedBlockType || child.nodeType || 'unknown';
        const nameStr = displayName && displayName !== displayId ? ` "${displayName}"` : '';
        console.log(`${indent}${icon} ${displayId}${nameStr} [${displayType}]`);
        if (child.children && child.children.length > 0) {
          child.children.forEach(c => formatChild(c, indent + '  '));
        }
      };

      result.children.forEach(child => formatChild(child, '  '));
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Block not found: ${id}`);
    } else {
      console.error(`❌ Error retrieving block children: ${error.message}`);
    }
    process.exit(1);
  }
}

async function checkHealth() {
  try {
    const health = await client.getHealth();
    console.log('\n✅ Backend Health Check:\n');
    console.log(`  Status:       ${health.status}`);
    console.log(`  Version:      ${health.version}`);
    console.log(`  Uptime:       ${health.uptime || 'N/A'}`);
    console.log(`  Block Count:  ${health.blockCount}`);
    console.log(`  Services:     ${Object.entries(health.services).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    console.log('');
  } catch (error) {
    console.error(`❌ Backend is not responding at ${API_URL}`);
    if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
      console.error('   Start the backend with:');
      console.error('   $ dotnet run --project backend/src/Maestro.Api');
    }
    process.exit(1);
  }
}

async function searchBlocks(query) {
  try {
    const results = await client.searchBlocks(query);
    if (results.length === 0) {
      console.log(`\nNo blocks found matching: "${query}"`);
      return;
    }

    console.log(`\n🔍 Search results for "${query}":\n`);
    console.table(results.map(b => ({
      'ID': b.id,
      'Name': b.name,
      'Type': b.blockType
    })));
  } catch (error) {
    console.error(`❌ Search failed: ${error.message}`);
    process.exit(1);
  }
}

// ============= Workflow Execution Functions =============

async function executeWorkflowReal(workflowId, inputs, options = {}) {
  try {
    console.log(`\n⚙️  Executing workflow: ${workflowId}\n`);
    console.log(`  Inputs:`, JSON.stringify(inputs, null, 2));
    if (options.workingDir) {
      console.log(`  Working Directory: ${options.workingDir}`);
    }
    console.log('');

    const startTime = Date.now();

    const result = await client.executeWorkflow(workflowId, {
      inputs,
      workingDirectory: options.workingDir
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(`✅ Workflow executed successfully in ${duration}ms\n`);
      console.log('📤 Outputs:');
      console.log(JSON.stringify(result.outputs, null, 2));
    } else {
      console.error(`❌ Workflow execution failed\n`);
      if (result.error) {
        console.error(`  Error: ${result.error}`);
      }
      process.exit(1);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Workflow not found: ${workflowId}`);
      console.error('   Use "maestro workflows" to list available workflows');
    } else if (error.status === 400) {
      console.error(`❌ Invalid workflow request: ${error.message}`);
    } else {
      handleApiError(error, 'executing workflow');
    }
    process.exit(1);
  }
}

async function executeBlockReal(blockId, inputs, options = {}) {
  try {
    console.log(`\n⚙️  Executing block: ${blockId}\n`);
    console.log(`  Inputs:`, JSON.stringify(inputs, null, 2));
    if (options.workingDir) {
      console.log(`  Working Directory: ${options.workingDir}`);
    }
    console.log('');

    const startTime = Date.now();

    const result = await client._fetch('POST', `/api/blocks/${blockId}/execute`, {
      body: {
        inputs,
        workingDirectory: options.workingDir
      }
    });

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(`✅ Block executed successfully in ${duration}ms\n`);
      console.log('📤 Outputs:');
      console.log(JSON.stringify(result.outputs, null, 2));
      if (result.logs && result.logs.length > 0) {
        console.log('\n📋 Logs:');
        result.logs.forEach(log => console.log(`  ${log}`));
      }
    } else {
      console.error(`❌ Block execution failed\n`);
      if (result.logs && result.logs.length > 0) {
        console.error('📋 Logs:');
        result.logs.forEach(log => console.error(`  ${log}`));
      }
      process.exit(1);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Block not found: ${blockId}`);
    } else if (error.status === 400) {
      console.error(`❌ Invalid block request: ${error.message}`);
    } else {
      handleApiError(error, 'executing block');
    }
    process.exit(1);
  }
}

// ============= Project Management Functions =============

async function listProjects() {
  try {
    const projects = await client.listProjects();
    if (projects.length === 0) {
      console.log('\nNo projects found');
      console.log('  Create one with: maestro projects create --name "My Project" --path /path/to/project');
      return;
    }

    console.log('\n📁 Available Projects:\n');
    console.table(projects.map(p => ({
      'ID': p.id.substring(0, 8) + '...',
      'Name': p.name,
      'Path': p.rootPath,
      'Runtime': p.runtime?.type || 'none',
      'Version': p.version
    })));
  } catch (error) {
    handleApiError(error, 'listing projects');
  }
}

async function getProjectInfo(id) {
  try {
    const project = await client.getProject(id);
    console.log('\n📁 Project Details:\n');
    console.log(`  ID:           ${project.id}`);
    console.log(`  Name:         ${project.name}`);
    console.log(`  Description:  ${project.description || 'N/A'}`);
    console.log(`  Path:         ${project.rootPath}`);
    console.log(`  Version:      ${project.version}`);
    console.log(`  Created:      ${project.createdAt}`);
    console.log(`  Updated:      ${project.updatedAt}`);
    
    if (project.runtime) {
      console.log('\n  Runtime:');
      console.log(`    Type:       ${project.runtime.type}`);
      if (project.runtime.image) console.log(`    Image:      ${project.runtime.image}`);
      if (project.runtime.workDir) console.log(`    WorkDir:    ${project.runtime.workDir}`);
      if (project.runtime.networkMode) console.log(`    Network:    ${project.runtime.networkMode}`);
      if (project.runtime.resources) {
        const r = project.runtime.resources;
        if (r.cpuLimit) console.log(`    CPU:        ${r.cpuLimit}`);
        if (r.memoryLimit) console.log(`    Memory:     ${r.memoryLimit}`);
        if (r.timeoutSeconds) console.log(`    Timeout:    ${r.timeoutSeconds}s`);
      }
    }
    
    if (project.blockSearchPaths?.length > 0) {
      console.log(`\n  Block Paths:  ${project.blockSearchPaths.join(', ')}`);
    }
    
    if (project.defaultModel) {
      console.log(`\n  Default Model: ${project.defaultModel}`);
    }
    
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Project not found: ${id}`);
    } else {
      handleApiError(error, 'retrieving project');
    }
    process.exit(1);
  }
}

async function createProject(name, rootPath, options = {}) {
  try {
    const request = {
      name,
      rootPath: path.resolve(rootPath),
      description: options.description,
      runtime: options.runtime ? {
        type: options.runtime,
        image: options.image,
        workDir: options.workDir
      } : undefined,
      blockSearchPaths: options.blockPaths ? options.blockPaths.split(',') : undefined,
      defaultModel: options.model
    };

    const project = await client.createProject(request);
    console.log(`\n✅ Project created successfully!\n`);
    console.log(`  ID:   ${project.id}`);
    console.log(`  Name: ${project.name}`);
    console.log(`  Path: ${project.rootPath}`);
    console.log('');
  } catch (error) {
    if (error.status === 400) {
      console.error(`❌ Invalid project configuration: ${error.message}`);
    } else if (error.status === 409) {
      console.error(`❌ Project already exists at: ${rootPath}`);
    } else {
      handleApiError(error, 'creating project');
    }
    process.exit(1);
  }
}

async function openProject(projectPath) {
  try {
    const resolvedPath = path.resolve(projectPath);
    const project = await client.openProject(resolvedPath);
    console.log(`\n✅ Project opened successfully!\n`);
    console.log(`  ID:   ${project.id}`);
    console.log(`  Name: ${project.name}`);
    console.log(`  Path: ${project.rootPath}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ No project found at: ${projectPath}`);
      console.error('   Create one with: maestro projects create --name "Name" --path ' + projectPath);
      console.error('   Or bind an existing directory: maestro projects bind --path ' + projectPath);
    } else {
      handleApiError(error, 'opening project');
    }
    process.exit(1);
  }
}

async function bindProject(projectPath, options = {}) {
  try {
    const resolvedPath = path.resolve(projectPath);
    const request = {
      rootPath: resolvedPath,
      name: options.name,
      description: options.description,
      runtime: options.runtime ? {
        type: options.runtime,
        image: options.image,
        workDir: options.workDir
      } : undefined,
      defaultModel: options.model
    };

    const project = await client.bindProject(request);
    console.log(`\n✅ Project bound successfully!\n`);
    console.log(`  ID:   ${project.id}`);
    console.log(`  Name: ${project.name}`);
    console.log(`  Path: ${project.rootPath}`);
    console.log(`\n  Created .maestro folder with:`);
    console.log(`    - project.json`);
    console.log(`    - blocks/`);
    console.log(`    - workflows/`);
    console.log('');
  } catch (error) {
    if (error.status === 400) {
      console.error(`❌ Cannot bind: ${error.message}`);
    } else if (error.status === 409) {
      console.error(`❌ Project already exists at: ${projectPath}`);
    } else {
      handleApiError(error, 'binding project');
    }
    process.exit(1);
  }
}

async function deleteProject(id, options = {}) {
  try {
    if (!options.force) {
      console.log(`\n⚠️  This will remove the project from Maestro (config file remains on disk)`);
      console.log(`   Use --force to confirm deletion`);
      process.exit(1);
    }
    
    await client.deleteProject(id);
    console.log(`\n✅ Project removed: ${id}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Project not found: ${id}`);
    } else {
      handleApiError(error, 'deleting project');
    }
    process.exit(1);
  }
}

async function listProjectBlocks(projectId) {
  try {
    const blocks = await client.getProjectBlocks(projectId);
    if (blocks.length === 0) {
      console.log('\nNo blocks found in project');
      return;
    }

    console.log(`\n📦 Blocks in Project:\n`);
    console.table(blocks.map(b => ({
      'ID': b.id,
      'Name': b.name,
      'Type': b.blockType,
      'Version': b.version
    })));
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Project not found: ${projectId}`);
    } else {
      handleApiError(error, 'listing project blocks');
    }
    process.exit(1);
  }
}

async function discoverProjects(searchPath) {
  try {
    const resolvedPath = path.resolve(searchPath);
    console.log(`\n🔍 Discovering projects in: ${resolvedPath}\n`);

    const projects = await client.discoverProjects(resolvedPath);
    if (projects.length === 0) {
      console.log('No projects found');
      console.log('  Projects require a .maestro/project.json file');
      return;
    }

    console.log(`Found ${projects.length} project(s):\n`);
    console.table(projects.map(p => ({
      'ID': p.id.substring(0, 8) + '...',
      'Name': p.name,
      'Path': p.rootPath
    })));
  } catch (error) {
    handleApiError(error, 'discovering projects');
    process.exit(1);
  }
}

// ============= Container Management Functions =============

function formatStatus(status) {
  const statusColors = {
    'running': '\x1b[32m',   // Green
    'stopped': '\x1b[90m',   // Gray
    'starting': '\x1b[33m',  // Yellow
    'stopping': '\x1b[33m',  // Yellow
    'error': '\x1b[31m',     // Red
  };
  const reset = '\x1b[0m';
  const color = statusColors[status] || '';
  return `${color}${status}${reset}`;
}

async function getContainerStatus(id) {
  try {
    const status = await client.getContainerStatus(id);
    console.log('\n🐳 Container Status:\n');
    console.log(`  Project ID:   ${status.projectId}`);
    console.log(`  Status:       ${formatStatus(status.status)}`);
    if (status.containerId) {
      console.log(`  Container ID: ${status.containerId}`);
    }
    if (status.startedAt) {
      const uptime = Math.round((Date.now() - new Date(status.startedAt).getTime()) / 1000);
      console.log(`  Started At:   ${status.startedAt}`);
      console.log(`  Uptime:       ${formatUptime(uptime)}`);
    }
    if (status.error) {
      console.log(`  Error:        ${status.error}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Project not found: ${id}`);
    } else {
      handleApiError(error, 'getting container status');
    }
    process.exit(1);
  }
}

function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

async function startContainer(id) {
  try {
    console.log('\n▶️  Starting container...');
    const status = await client.startContainer(id);
    console.log(`✅ Container started`);
    console.log(`  Status: ${formatStatus(status.status)}`);
    if (status.containerId) {
      console.log(`  Container ID: ${status.containerId}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Project not found: ${id}`);
    } else if (error.status === 400) {
      console.error(`❌ Cannot start: ${error.message}`);
    } else {
      handleApiError(error, 'starting container');
    }
    process.exit(1);
  }
}

async function stopContainer(id) {
  try {
    console.log('\n⏹️  Stopping container...');
    const status = await client.stopContainer(id);
    console.log(`✅ Container stopped`);
    console.log(`  Status: ${formatStatus(status.status)}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Project not found: ${id}`);
    } else if (error.status === 400) {
      console.error(`❌ Cannot stop: ${error.message}`);
    } else {
      handleApiError(error, 'stopping container');
    }
    process.exit(1);
  }
}

async function restartContainer(id) {
  try {
    console.log('\n🔄 Restarting container...');
    const status = await client.restartContainer(id);
    console.log(`✅ Container restarted`);
    console.log(`  Status: ${formatStatus(status.status)}`);
    if (status.containerId) {
      console.log(`  Container ID: ${status.containerId}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Project not found: ${id}`);
    } else if (error.status === 400) {
      console.error(`❌ Cannot restart: ${error.message}`);
    } else {
      handleApiError(error, 'restarting container');
    }
    process.exit(1);
  }
}

async function getContainerLogs(id, options = {}) {
  try {
    const logs = await client.getContainerLogs(id, options);

    if (!logs || logs.length === 0) {
      console.log('\nNo logs available');
      return;
    }

    console.log('\n📋 Container Logs:\n');
    console.log('─'.repeat(60));
    console.log(logs);
    console.log('─'.repeat(60));
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Project not found: ${id}`);
    } else {
      handleApiError(error, 'getting container logs');
    }
    process.exit(1);
  }
}

async function listProjectsWithStatus() {
  try {
    const projects = await client.listProjects();
    if (projects.length === 0) {
      console.log('\nNo projects found');
      console.log('  Create one with: maestro projects create --name "My Project" --path /path/to/project');
      return;
    }

    // Get status for each project
    const projectsWithStatus = await Promise.all(
      projects.map(async (p) => {
        try {
          const status = await client.getContainerStatus(p.id);
          return { ...p, containerStatus: status.status };
        } catch {
          return { ...p, containerStatus: 'unknown' };
        }
      })
    );

    console.log('\n📁 Projects:\n');
    console.table(projectsWithStatus.map(p => ({
      'ID': p.id.substring(0, 8) + '...',
      'Name': p.name,
      'Status': p.containerStatus,
      'Runtime': p.runtime?.type || 'none',
      'Path': p.rootPath.length > 40 ? '...' + p.rootPath.slice(-37) : p.rootPath
    })));
  } catch (error) {
    handleApiError(error, 'listing projects');
  }
}

function handleApiError(error, action) {
  if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
    console.error(`❌ Cannot connect to backend at ${client.baseUrl}`);
    console.error('   Make sure the backend is running:');
    console.error('   $ dotnet run --project backend/src/Maestro.Api');
  } else {
    console.error(`❌ Error ${action}: ${error.message}`);
  }
}

// ============= Interactive Session Commands (Session Server Architecture) =============

async function listSessions(filter = {}) {
  try {
    const sessions = await client.listSessions(filter);
    if (!sessions || sessions.length === 0) {
      console.log('\nNo interactive sessions found');
      console.log('  Create one with: maestro session create --project <id> --authority human');
      return;
    }

    console.log('\n📋 Interactive Sessions:\n');
    console.table(sessions.map(s => ({
      'ID': s.id.substring(0, 12) + '...',
      'Name': s.name || '-',
      'Status': s.status,
      'Authority': s.authority || 'human',
      'Project': s.config?.projectId?.substring(0, 8) + '...' || '-',
      'Commands': s.commandCount || 0,
      'Created': new Date(s.createdAt).toLocaleDateString()
    })));
  } catch (error) {
    handleApiError(error, 'listing sessions');
    process.exit(1);
  }
}

async function getSessionInfo(id) {
  try {
    const session = await client.getSession(id);
    console.log('\n📋 Session Details:\n');
    console.log(`  ID:           ${session.id}`);
    console.log(`  Name:         ${session.name || 'N/A'}`);
    console.log(`  Status:       ${session.status}`);
    console.log(`  Authority:    ${session.authority || 'human'}`);
    console.log(`  Project ID:   ${session.config?.projectId || 'N/A'}`);
    console.log(`  Workflow ID:  ${session.config?.workflowId || 'N/A'}`);
    console.log(`  Task:         ${session.config?.task || 'N/A'}`);
    console.log(`  Access Level: ${session.config?.access?.level || 'controlled'}`);
    console.log(`  Working Dir:  ${session.workingDirectory || 'N/A'}`);
    console.log(`  Commands:     ${session.commandCount || 0}`);
    console.log(`  Created:      ${session.createdAt}`);
    console.log(`  Started:      ${session.startedAt || 'Not started'}`);
    console.log(`  Completed:    ${session.completedAt || 'Not completed'}`);
    if (session.errorMessage) {
      console.log(`  Error:        ${session.errorMessage}`);
    }
    console.log('');
    console.log('  Commands:');
    console.log('    maestro session exec ' + id + ' "ls -la"');
    console.log('    maestro session exec ' + id + ' "blocks list"');
    console.log('    maestro session exec ' + id + ' "diff"');
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Session not found: ${id}`);
    } else {
      handleApiError(error, 'getting session');
    }
    process.exit(1);
  }
}

async function createSession(options) {
  try {
    if (!options.projectId) { console.error('❌ --project is required'); process.exit(1); }

    const request = {
      projectId: options.projectId,
      authority: options.authority || 'human',
      name: options.name,
      workflowId: options.workflowId,
      task: options.task,
      context: options.context,
      access: options.access || 'controlled',
      allowedPaths: options.allowedPaths ? options.allowedPaths.split(',') : undefined,
      deniedPaths: options.deniedPaths ? options.deniedPaths.split(',') : undefined,
      runTests: options.runTests || false,
      testCommand: options.testCommand,
      runLinter: options.runLinter || false,
      linterCommand: options.linterCommand,
      maxSteps: options.maxSteps ? parseInt(options.maxSteps) : 50,
      timeoutMs: options.timeout ? parseInt(options.timeout) : 600000
    };

    const session = await client.createSession(request);
    console.log('\n✅ Session created!\n');
    console.log(`  ID:        ${session.id}`);
    console.log(`  Name:      ${session.name}`);
    console.log(`  Status:    ${session.status}`);
    console.log(`  Authority: ${session.authority || 'human'}`);
    console.log('');
    console.log('  Start it with: maestro session start ' + session.id);
    console.log('  Execute cmd:   maestro session exec ' + session.id + ' "ls -la"');
    console.log('');
  } catch (error) {
    handleApiError(error, 'creating session');
    process.exit(1);
  }
}

async function startSession(id) {
  try {
    console.log(`\n▶️  Starting session: ${id}\n`);
    const session = await client.startSession(id);
    console.log(`✅ Session ${session.status}\n`);
    console.log(`  Authority:    ${session.authority || 'human'}`);
    console.log(`  Working Dir:  ${session.workingDirectory || 'N/A'}`);
    console.log('');
    console.log('  Execute commands with: maestro session exec ' + id + ' "<command>"');
    console.log('  Stop session with:     maestro session stop ' + id);
    console.log('');
  } catch (error) {
    handleApiError(error, 'starting session');
    process.exit(1);
  }
}

async function pauseSession(id) {
  try {
    console.log(`\n⏸️  Pausing session: ${id}\n`);
    const session = await client.pauseSession(id);
    console.log(`✅ Session ${session.status}\n`);
    console.log('  Resume with: maestro session resume ' + id);
    console.log('');
  } catch (error) {
    handleApiError(error, 'pausing session');
    process.exit(1);
  }
}

async function resumeSession(id) {
  try {
    console.log(`\n▶️  Resuming session: ${id}\n`);
    const session = await client.resumeSession(id);
    console.log(`✅ Session ${session.status}\n`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'resuming session');
    process.exit(1);
  }
}

async function stopSession(id) {
  try {
    console.log(`\n🛑 Stopping session: ${id}\n`);
    const session = await client.stopSession(id);
    console.log(`✅ Session ${session.status}\n`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'stopping session');
    process.exit(1);
  }
}

async function takeControlSession(id, authority) {
  try {
    console.log(`\n🔄 Transferring session control to: ${authority}\n`);
    const session = await client.takeControlSession(id, authority);
    console.log(`✅ Control transferred!\n`);
    console.log(`  New Authority: ${session.authority}`);
    console.log(`  Status:        ${session.status}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'transferring session control');
    process.exit(1);
  }
}

async function executeSessionCommand(id, command, args = null) {
  try {
    const result = await client.executeSessionCommand(id, command, args);

    if (result.success) {
      console.log(`✅ ${result.commandType || 'shell'} [${result.commandId?.substring(0, 8) || ''}]`);
      if (result.output) {
        console.log(result.output);
      }
    } else {
      console.log(`❌ ${result.commandType || 'shell'} [${result.commandId?.substring(0, 8) || ''}]`);
      if (result.error) {
        console.error(result.error);
      }
      if (result.output) {
        console.log(result.output);
      }
      process.exitCode = result.exitCode || 1;
    }
  } catch (error) {
    handleApiError(error, 'executing command');
    process.exit(1);
  }
}

async function getSessionEvents(id, options = {}) {
  try {
    const events = await client.getSessionEvents(id, options);
    if (!events || events.length === 0) {
      console.log('\nNo events found for this session');
      return;
    }

    console.log(`\n📜 Session Events (${events.length}):\n`);
    for (const evt of events) {
      const time = new Date(evt.timestamp).toLocaleTimeString();
      const icon = evt.type === 'error' ? '❌' : evt.type === 'warning' ? '⚠️' : evt.type === 'command' ? '💻' : '📝';
      console.log(`  ${icon} [${time}] ${evt.type}: ${evt.message}`);
      if (evt.data && Object.keys(evt.data).length > 0) {
        console.log(`     Data: ${JSON.stringify(evt.data)}`);
      }
    }
    console.log('');
  } catch (error) {
    handleApiError(error, 'getting session events');
    process.exit(1);
  }
}

async function deleteSession(id) {
  try {
    console.log(`\n🗑️  Deleting session: ${id}\n`);
    await client.deleteSession(id);
    console.log(`✅ Session deleted\n`);
  } catch (error) {
    handleApiError(error, 'deleting session');
    process.exit(1);
  }
}

// Legacy session commands (for backward compatibility)
async function getSessionDiff(id) {
  try {
    const result = await client.executeSessionCommand(id, 'diff');
    if (result.output) {
      console.log(`\n📝 Session Diff:\n`);
      console.log(result.output);
    } else {
      console.log('\nNo changes detected');
    }
  } catch (error) {
    handleApiError(error, 'getting session diff');
    process.exit(1);
  }
}

async function runSessionTests(id, testCommand) {
  try {
    console.log(`\n🧪 Running tests for session: ${id}\n`);
    const command = testCommand ? `test ${testCommand}` : 'test';
    const result = await client.executeSessionCommand(id, command);

    if (result.output) {
      console.log(result.output);
    }

    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    handleApiError(error, 'running tests');
    process.exit(1);
  }
}

async function commitSession(id, options) {
  try {
    if (!options.message) { console.error('❌ --message is required'); process.exit(1); }

    console.log(`\n📦 Committing session: ${id}\n`);
    const command = `commit -m "${options.message}"`;
    const result = await client.executeSessionCommand(id, command);

    if (result.success) {
      console.log(`✅ Changes committed!\n`);
      if (result.output) {
        console.log(result.output);
      }
    } else {
      console.error(`❌ Commit failed\n`);
      if (result.error) {
        console.error(result.error);
      }
      process.exit(1);
    }
  } catch (error) {
    handleApiError(error, 'committing session');
    process.exit(1);
  }
}

async function cancelSession(id) {
  return stopSession(id);
}

// ============= Training Commands =============

async function listTrainingConfigs() {
  try {
    const configs = await client.listTrainingConfigs();
    if (!configs || configs.length === 0) {
      console.log('\nNo training configurations found');
      console.log('  Create one with: maestro training create --name "Config" --workflow <id> --iterations 10');
      return;
    }

    console.log('\n🏋️ Training Configurations:\n');
    console.table(configs.map(c => ({
      'ID': c.id.substring(0, 8) + '...',
      'Name': c.name,
      'Workflow': c.workflowId?.substring(0, 8) + '...',
      'Iterations': c.iterations,
      'Goal': c.optimizationGoal || 'quality'
    })));
  } catch (error) {
    handleApiError(error, 'listing training configs');
    process.exit(1);
  }
}

async function getTrainingConfigInfo(id) {
  try {
    const config = await client.getTrainingConfig(id);
    console.log('\n🏋️ Training Configuration:\n');
    console.log(`  ID:             ${config.id}`);
    console.log(`  Name:           ${config.name}`);
    console.log(`  Description:    ${config.description || 'N/A'}`);
    console.log(`  Workflow:       ${config.workflowId}`);
    console.log(`  Iterations:     ${config.iterations}`);
    console.log(`  Parallel:       ${config.parallelIterations || 1}`);
    console.log(`  Goal:           ${config.optimizationGoal || 'quality'}`);
    console.log(`  Created:        ${config.createdAt}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Training config not found: ${id}`);
    } else {
      handleApiError(error, 'getting training config');
    }
    process.exit(1);
  }
}

async function createTrainingConfig(options) {
  try {
    const config = {
      name: options.name,
      description: options.description,
      workflowId: options.workflow,
      iterations: parseInt(options.iterations) || 10,
      parallelIterations: parseInt(options.parallel) || 1,
      delayBetweenIterationsMs: parseInt(options.delay) || 0,
      optimizationGoal: options.goal || 'quality',
      tags: options.tags ? options.tags.split(',') : []
    };

    const result = await client.createTrainingConfig(config);
    console.log('\n✅ Training configuration created!\n');
    console.log(`  ID:   ${result.id}`);
    console.log(`  Name: ${result.name}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'creating training config');
    process.exit(1);
  }
}

async function listTrainingRuns(filter = {}) {
  try {
    const runs = await client.listTrainingRuns(filter);
    if (!runs || runs.length === 0) {
      console.log('\nNo training runs found');
      return;
    }

    console.log('\n📊 Training Runs:\n');
    console.table(runs.map(r => ({
      'ID': r.id.substring(0, 8) + '...',
      'Name': r.name || '-',
      'Status': r.status,
      'Progress': `${r.completedIterations}/${r.totalIterations}`,
      'Quality': r.averageQualityScore?.toFixed(2) || '-',
      'Cost': r.totalCostUsd ? `$${r.totalCostUsd.toFixed(4)}` : '-'
    })));
  } catch (error) {
    handleApiError(error, 'listing training runs');
    process.exit(1);
  }
}

async function getTrainingRunInfo(id) {
  try {
    const run = await client.getTrainingRun(id);
    console.log('\n📊 Training Run:\n');
    console.log(`  ID:               ${run.id}`);
    console.log(`  Name:             ${run.name || 'N/A'}`);
    console.log(`  Status:           ${run.status}`);
    console.log(`  Workflow:         ${run.workflowId}`);
    console.log(`  Config:           ${run.configurationId}`);
    console.log(`  Progress:         ${run.completedIterations}/${run.totalIterations} (${run.failedIterations} failed)`);
    console.log(`  Started:          ${run.startedAt || 'N/A'}`);
    console.log(`  Completed:        ${run.completedAt || 'N/A'}`);
    if (run.averageQualityScore !== undefined) {
      console.log(`  Avg Quality:      ${run.averageQualityScore.toFixed(2)}`);
    }
    if (run.totalCostUsd !== undefined) {
      console.log(`  Total Cost:       $${run.totalCostUsd.toFixed(4)}`);
    }
    if (run.errorMessage) {
      console.log(`  Error:            ${run.errorMessage}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Training run not found: ${id}`);
    } else {
      handleApiError(error, 'getting training run');
    }
    process.exit(1);
  }
}

async function startTrainingRun(configId, options = {}) {
  try {
    console.log(`\n▶️  Starting training run for config: ${configId}\n`);

    const request = {
      configurationId: configId,
      name: options.name,
      inputs: options.inputs ? JSON.parse(options.inputs) : undefined
    };

    const run = await client.startTrainingRun(request);
    console.log(`✅ Training run started!\n`);
    console.log(`  Run ID:    ${run.id}`);
    console.log(`  Status:    ${run.status}`);
    console.log(`  Iterations: ${run.totalIterations}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'starting training run');
    process.exit(1);
  }
}

async function controlTrainingRun(id, action) {
  try {
    let result;
    const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);

    console.log(`\n⚙️  ${actionLabel}ing training run: ${id}\n`);

    switch (action) {
      case 'pause':
        result = await client.pauseTrainingRun(id);
        break;
      case 'resume':
        result = await client.resumeTrainingRun(id);
        break;
      case 'cancel':
        result = await client.cancelTrainingRun(id);
        break;
      default:
        console.error(`❌ Unknown action: ${action}`);
        process.exit(1);
    }

    console.log(`✅ Training run ${action}d`);
    console.log(`  Status: ${result.status}`);
    console.log('');
  } catch (error) {
    handleApiError(error, `${action}ing training run`);
    process.exit(1);
  }
}

// ============= Fitness Commands =============

async function getFitnessConfig() {
  try {
    const config = await client.get('/api/fitness/config');
    console.log('\n⚖️ Fitness Configuration:\n');
    console.log(`  Lambda (λ):           ${config.lambda.toFixed(2)} (cost sensitivity)`);
    console.log('');
    console.log('  Component Weights:');
    console.log(`    Performance:        ${(config.performanceWeight * 100).toFixed(1)}%`);
    console.log(`    Specialization:     ${(config.specializationWeight * 100).toFixed(1)}%`);
    console.log(`    Composability:      ${(config.composabilityWeight * 100).toFixed(1)}%`);
    console.log('');
    console.log('  Hardware Cost Weights:');
    console.log(`    VRAM:               ${(config.vramWeight * 100).toFixed(1)}%`);
    console.log(`    RAM:                ${(config.ramWeight * 100).toFixed(1)}%`);
    console.log(`    GPU:                ${(config.gpuWeight * 100).toFixed(1)}%`);
    console.log('');
    console.log(`  Baseline Cost:        $${config.baselineCostPerMillion}/M tokens`);
    console.log(`  Retry Penalty:        ${config.retryPenaltyFactor.toFixed(2)} per retry`);
    console.log(`  Min Threshold:        ${config.minimumFitnessThreshold.toFixed(2)}`);
    console.log(`  Updated:              ${config.updatedAt}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'getting fitness config');
    process.exit(1);
  }
}

async function updateFitnessConfig(updates) {
  try {
    const config = await client.put('/api/fitness/config', updates);
    console.log('\n✅ Fitness configuration updated!\n');
    console.log(`  Lambda:               ${config.lambda.toFixed(2)}`);
    console.log(`  Performance Weight:   ${(config.performanceWeight * 100).toFixed(1)}%`);
    console.log(`  Specialization Weight: ${(config.specializationWeight * 100).toFixed(1)}%`);
    console.log(`  Composability Weight: ${(config.composabilityWeight * 100).toFixed(1)}%`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'updating fitness config');
    process.exit(1);
  }
}

async function getFitnessLeaderboard(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.taskType) params.append('taskType', options.taskType);
    params.append('limit', options.limit?.toString() || '10');

    const leaderboard = await client.get(`/api/fitness/leaderboard?${params.toString()}`);

    if (!leaderboard || leaderboard.length === 0) {
      console.log('\nNo fitness data available yet');
      console.log('  Run some training iterations to populate the leaderboard');
      return;
    }

    console.log('\n🏆 Model Fitness Leaderboard:\n');
    console.table(leaderboard.map(r => ({
      'Rank': r.rank,
      'Model': r.displayName || r.modelId,
      'Provider': r.provider,
      'Avg Fitness': r.averageFitness.toFixed(3),
      'Best': r.bestFitness.toFixed(3),
      'Executions': r.executionCount
    })));
  } catch (error) {
    handleApiError(error, 'getting fitness leaderboard');
    process.exit(1);
  }
}

async function listModelProfiles(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.provider) params.append('provider', options.provider);

    const profiles = await client.get(`/api/fitness/profiles?${params.toString()}`);

    if (!profiles || profiles.length === 0) {
      console.log('\nNo model profiles found');
      console.log('  Run: maestro fitness profiles --initialize');
      return;
    }

    console.log('\n📋 Model Profiles:\n');
    console.table(profiles.map(p => ({
      'Model ID': p.modelId,
      'Name': p.displayName,
      'Provider': p.provider,
      'Params': p.parametersBillions + 'B',
      'VRAM': p.isLocal ? `${p.vramGb}GB` : '-',
      'Cost': p.isLocal ? 'local' : `$${p.averageCostPerMillion}/M`,
      'Local': p.isLocal ? 'Yes' : 'No'
    })));
  } catch (error) {
    handleApiError(error, 'listing model profiles');
    process.exit(1);
  }
}

async function getModelProfile(modelId) {
  try {
    const profile = await client.get(`/api/fitness/profiles/${encodeURIComponent(modelId)}`);
    console.log('\n📋 Model Profile:\n');
    console.log(`  Model ID:       ${profile.modelId}`);
    console.log(`  Display Name:   ${profile.displayName}`);
    console.log(`  Provider:       ${profile.provider}`);
    console.log(`  Parameters:     ${profile.parametersBillions}B`);
    console.log(`  FLOPs/token:    ${profile.flopsPerToken.toExponential(2)}`);
    console.log('');
    console.log('  Hardware Requirements:');
    console.log(`    VRAM:         ${profile.vramGb}GB`);
    console.log(`    RAM:          ${profile.ramGb}GB`);
    console.log(`    GPU:          ${(profile.gpuRequirement * 100).toFixed(0)}%`);
    console.log('');
    console.log('  Costs:');
    console.log(`    Input:        $${profile.costPerMillionInputTokens}/M tokens`);
    console.log(`    Output:       $${profile.costPerMillionOutputTokens}/M tokens`);
    console.log('');
    console.log(`  Context Window: ${profile.contextWindowSize} tokens`);
    console.log(`  Local:          ${profile.isLocal ? 'Yes' : 'No'}`);
    console.log(`  Latency:        ${profile.avgLatencyMsPerToken}ms/token`);
    console.log(`  Specializations: ${profile.specializations?.join(', ') || 'general'}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Model profile not found: ${modelId}`);
    } else {
      handleApiError(error, 'getting model profile');
    }
    process.exit(1);
  }
}

async function listTaskEntropy(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.entityType) params.append('entityType', options.entityType);

    const entropies = await client.get(`/api/fitness/entropy?${params.toString()}`);

    if (!entropies || entropies.length === 0) {
      console.log('\nNo task entropy data found');
      return;
    }

    console.log('\n📊 Task Entropy (Specialization Data):\n');
    console.table(entropies.map(e => ({
      'Entity': e.entityId,
      'Type': e.entityType,
      'Entropy': e.entropyValue.toFixed(3),
      'Specialization': (e.specializationScore * 100).toFixed(1) + '%',
      'Tasks': e.totalTasks,
      'Unique Types': e.uniqueTaskTypes,
      'Dominant': e.dominantTaskType || '-'
    })));
  } catch (error) {
    handleApiError(error, 'listing task entropy');
    process.exit(1);
  }
}

async function getTaskEntropy(entityId, entityType = 'model') {
  try {
    const entropy = await client.get(`/api/fitness/entropy/${encodeURIComponent(entityId)}?entityType=${entityType}`);
    console.log(`\n📊 Task Entropy for ${entityType}:${entityId}\n`);
    console.log(`  Entropy Value:    ${entropy.entropyValue.toFixed(3)}`);
    console.log(`  Max Entropy:      ${entropy.maxEntropy.toFixed(3)}`);
    console.log(`  Normalized:       ${entropy.normalizedEntropy.toFixed(3)}`);
    console.log(`  Specialization:   ${(entropy.specializationScore * 100).toFixed(1)}%`);
    console.log(`  Total Tasks:      ${entropy.totalTasks}`);
    console.log(`  Unique Types:     ${entropy.uniqueTaskTypes}`);
    console.log(`  Dominant Task:    ${entropy.dominantTaskType || 'none'}`);

    if (entropy.taskDistribution && Object.keys(entropy.taskDistribution).length > 0) {
      console.log('\n  Task Distribution:');
      for (const [taskType, count] of Object.entries(entropy.taskDistribution)) {
        const pct = (count / entropy.totalTasks * 100).toFixed(1);
        console.log(`    ${taskType}: ${count} (${pct}%)`);
      }
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Task entropy not found for ${entityType}:${entityId}`);
    } else {
      handleApiError(error, 'getting task entropy');
    }
    process.exit(1);
  }
}

async function calculateFitness(options) {
  try {
    // This requires execution metrics - for now show an info message
    console.log('\n⚠️  Direct fitness calculation requires execution metrics.\n');
    console.log('  Fitness is automatically calculated during training runs.');
    console.log('  To see fitness data, run a training iteration and check:');
    console.log('    maestro fitness leaderboard');
    console.log('    maestro training run <id>');
    console.log('');

    // Show model stats if available
    const stats = await client.get(`/api/fitness/stats/${encodeURIComponent(options.modelId)}?taskType=${options.taskType || 'general'}`).catch(() => null);
    if (stats && stats.sampleCount > 0) {
      console.log(`  Current Stats for ${options.modelId}:`);
      console.log(`    Average Fitness: ${stats.averageFitness.toFixed(3)}`);
      console.log(`    Min/Max: ${stats.minFitness.toFixed(3)} - ${stats.maxFitness.toFixed(3)}`);
      console.log(`    Samples: ${stats.sampleCount}`);
      console.log('');
    }
  } catch (error) {
    handleApiError(error, 'calculating fitness');
    process.exit(1);
  }
}

// ============= Metrics Commands =============

async function listExecutionMetrics(filter = {}) {
  try {
    const metrics = await client.listExecutionMetrics(filter);
    if (!metrics || metrics.length === 0) {
      console.log('\nNo execution metrics found');
      return;
    }

    console.log('\n📈 Execution Metrics:\n');
    console.table(metrics.slice(0, 20).map(m => ({
      'Execution ID': m.executionId?.substring(0, 8) + '...' || '-',
      'Workflow': m.workflowId?.substring(0, 8) + '...' || '-',
      'Status': m.status || '-',
      'Duration': m.durationMs ? `${m.durationMs}ms` : '-',
      'Tokens': m.totalTokens || '-',
      'Cost': m.costUsd ? `$${m.costUsd.toFixed(4)}` : '-'
    })));

    if (metrics.length > 20) {
      console.log(`\n  ... and ${metrics.length - 20} more`);
    }
  } catch (error) {
    handleApiError(error, 'listing metrics');
    process.exit(1);
  }
}

async function getAggregatedMetrics(filter = {}) {
  try {
    const metrics = await client.getAggregatedMetrics(filter);
    console.log('\n📊 Aggregated Metrics:\n');
    console.log(`  Total Executions:    ${metrics.totalExecutions || 0}`);
    console.log(`  Successful:          ${metrics.successfulExecutions || 0}`);
    console.log(`  Failed:              ${metrics.failedExecutions || 0}`);
    console.log(`  Avg Duration:        ${metrics.averageDurationMs ? metrics.averageDurationMs.toFixed(0) + 'ms' : 'N/A'}`);
    console.log(`  Total Tokens:        ${metrics.totalTokens || 0}`);
    console.log(`  Total Cost:          ${metrics.totalCostUsd ? '$' + metrics.totalCostUsd.toFixed(4) : 'N/A'}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'getting aggregated metrics');
    process.exit(1);
  }
}

// ============= Runs / Execution History Commands =============

async function listRuns(filter = {}) {
  try {
    const runs = await client.listRuns({ ...filter, limit: filter.limit || 20 });
    if (!runs || runs.length === 0) {
      console.log('\nNo execution runs found');
      return;
    }

    console.log('\n📜 Execution History:\n');
    console.table(runs.map(r => ({
      'ID': r.id?.substring(0, 8) + '...' || '-',
      'Type': r.type || 'workflow',
      'Status': r.status,
      'Started': r.startedAt ? new Date(r.startedAt).toLocaleString() : '-',
      'Duration': r.durationMs ? `${r.durationMs}ms` : '-'
    })));
  } catch (error) {
    handleApiError(error, 'listing runs');
    process.exit(1);
  }
}

async function getRunInfo(id) {
  try {
    const run = await client.getRun(id);
    console.log('\n📜 Execution Run:\n');
    console.log(`  ID:           ${run.id}`);
    console.log(`  Type:         ${run.type || 'workflow'}`);
    console.log(`  Status:       ${run.status}`);
    console.log(`  Started:      ${run.startedAt || 'N/A'}`);
    console.log(`  Completed:    ${run.completedAt || 'N/A'}`);
    console.log(`  Duration:     ${run.durationMs ? run.durationMs + 'ms' : 'N/A'}`);

    if (run.inputs) {
      console.log('\n  Inputs:');
      console.log(JSON.stringify(run.inputs, null, 4).split('\n').map(l => '    ' + l).join('\n'));
    }

    if (run.outputs) {
      console.log('\n  Outputs:');
      console.log(JSON.stringify(run.outputs, null, 4).split('\n').map(l => '    ' + l).join('\n'));
    }

    if (run.error) {
      console.log(`\n  Error: ${run.error}`);
    }

    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Run not found: ${id}`);
    } else {
      handleApiError(error, 'getting run');
    }
    process.exit(1);
  }
}

// ============= Agent Foundry Commands =============

async function listAgents(filter = {}) {
  try {
    const agents = await client.listAgents(filter);
    if (!agents || agents.length === 0) {
      console.log('\nNo agents found');
      console.log('  Create one with: maestro agents create --name "Agent" --block <block-id>');
      return;
    }

    console.log('\n🤖 Agents:\n');
    console.table(agents.map(a => ({
      'ID': a.id,
      'Name': a.name,
      'Category': a.category || 'general',
      'Score': a.overallScore?.toFixed(0) || '-',
      'Runs': a.totalRuns || 0,
      'Completion': a.completionRate ? `${a.completionRate.toFixed(0)}%` : '-'
    })));
  } catch (error) {
    handleApiError(error, 'listing agents');
    process.exit(1);
  }
}

async function getAgentInfo(id) {
  try {
    const agent = await client.getAgent(id);
    console.log('\n🤖 Agent Details:\n');
    console.log(`  ID:           ${agent.id}`);
    console.log(`  Name:         ${agent.name}`);
    console.log(`  Description:  ${agent.description || 'N/A'}`);
    console.log(`  Version:      ${agent.version}`);
    console.log(`  Category:     ${agent.category || 'general'}`);
    console.log(`  Block ID:     ${agent.blockId}`);
    console.log(`  Capabilities: ${agent.capabilities?.join(', ') || 'None'}`);
    console.log(`  Tools:        ${agent.availableTools?.join(', ') || 'None'}`);
    console.log(`  Sub-agents:   ${agent.availableAgents?.join(', ') || 'None'}`);
    console.log(`  Tags:         ${agent.tags?.join(', ') || 'None'}`);
    console.log(`  Author:       ${agent.author || 'N/A'}`);
    console.log(`  Created:      ${agent.createdAt}`);
    console.log(`  Updated:      ${agent.updatedAt}`);

    if (agent.metrics) {
      console.log('\n  Metrics:');
      console.log(`    Total Runs:       ${agent.metrics.totalRuns || 0}`);
      console.log(`    Successful:       ${agent.metrics.successfulRuns || 0}`);
      console.log(`    Completion Rate:  ${agent.metrics.completionRate?.toFixed(1) || 0}%`);
      console.log(`    Overall Score:    ${agent.metrics.overallScore?.toFixed(1) || 0}`);
      if (agent.metrics.lastRunAt) {
        console.log(`    Last Run:         ${new Date(agent.metrics.lastRunAt).toLocaleString()}`);
      }
    }

    if (agent.toolDetails && agent.toolDetails.length > 0) {
      console.log('\n  Tool Details:');
      agent.toolDetails.forEach(t => {
        console.log(`    - ${t.name} (${t.id}): Score ${t.overallScore?.toFixed(0) || '-'}`);
      });
    }

    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Agent not found: ${id}`);
    } else {
      handleApiError(error, 'getting agent');
    }
    process.exit(1);
  }
}

async function createAgent(options) {
  try {
    const agent = {
      name: options.name,
      description: options.description,
      blockId: options.block,
      version: options.version || '1.0.0',
      category: options.category || 'general',
      capabilities: options.capabilities ? options.capabilities.split(',') : [],
      availableTools: options.tools ? options.tools.split(',') : [],
      availableAgents: options.agents ? options.agents.split(',') : [],
      tags: options.tags ? options.tags.split(',') : [],
      author: options.author
    };

    const result = await client.createAgent(agent);
    console.log('\n✅ Agent created!\n');
    console.log(`  ID:   ${result.id}`);
    console.log(`  Name: ${result.name}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'creating agent');
    process.exit(1);
  }
}

async function deleteAgentCmd(id, options = {}) {
  try {
    if (!options.force) {
      console.log(`\n⚠️  This will delete the agent '${id}'`);
      console.log('   Use --force to confirm deletion');
      process.exit(1);
    }
    await client.deleteAgent(id);
    console.log(`\n✅ Agent deleted: ${id}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Agent not found: ${id}`);
    } else {
      handleApiError(error, 'deleting agent');
    }
    process.exit(1);
  }
}

async function getAgentMetricsCmd(id) {
  try {
    const metrics = await client.getAgentMetrics(id);
    console.log('\n📊 Agent Metrics:\n');
    console.log(`  Total Runs:       ${metrics.totalRuns || 0}`);
    console.log(`  Successful:       ${metrics.successfulRuns || 0}`);
    console.log(`  Failed:           ${metrics.failedRuns || 0}`);
    console.log(`  Completion Rate:  ${metrics.completionRate?.toFixed(1) || 0}%`);
    console.log(`  Avg Exec Time:    ${metrics.averageExecutionTimeMs?.toFixed(0) || 0}ms`);
    console.log(`  Avg Token Cost:   ${metrics.averageTokenCost?.toFixed(0) || 0}`);
    console.log(`  Avg Task Score:   ${metrics.averageTaskCompletionScore?.toFixed(1) || 0}`);
    console.log(`  Avg Efficiency:   ${metrics.averageEfficiencyScore?.toFixed(1) || 0}`);
    console.log(`  Avg Quality:      ${metrics.averageQualityScore?.toFixed(1) || 0}`);
    console.log(`  Overall Score:    ${metrics.overallScore?.toFixed(1) || 0}`);
    if (metrics.lastRunAt) {
      console.log(`  Last Run:         ${new Date(metrics.lastRunAt).toLocaleString()}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Agent not found: ${id}`);
    } else {
      handleApiError(error, 'getting agent metrics');
    }
    process.exit(1);
  }
}

async function listTools(filter = {}) {
  try {
    const tools = await client.listTools(filter);
    if (!tools || tools.length === 0) {
      console.log('\nNo tools found');
      console.log('  Create one with: maestro tools create --name "Tool" --block <block-id>');
      return;
    }

    console.log('\n🔧 Tools:\n');
    console.table(tools.map(t => ({
      'ID': t.id,
      'Name': t.name,
      'Category': t.category || 'general',
      'Score': t.overallScore?.toFixed(0) || '-',
      'Runs': t.totalRuns || 0,
      'Success': t.successRate ? `${t.successRate.toFixed(0)}%` : '-'
    })));
  } catch (error) {
    handleApiError(error, 'listing tools');
    process.exit(1);
  }
}

async function getToolInfo(id) {
  try {
    const tool = await client.getTool(id);
    console.log('\n🔧 Tool Details:\n');
    console.log(`  ID:           ${tool.id}`);
    console.log(`  Name:         ${tool.name}`);
    console.log(`  Description:  ${tool.description || 'N/A'}`);
    console.log(`  Version:      ${tool.version}`);
    console.log(`  Category:     ${tool.category || 'general'}`);
    console.log(`  Block ID:     ${tool.blockId}`);
    console.log(`  Tags:         ${tool.tags?.join(', ') || 'None'}`);
    console.log(`  Author:       ${tool.author || 'N/A'}`);
    console.log(`  Created:      ${tool.createdAt}`);
    console.log(`  Updated:      ${tool.updatedAt}`);

    if (tool.metrics) {
      console.log('\n  Metrics:');
      console.log(`    Total Runs:       ${tool.metrics.totalRuns || 0}`);
      console.log(`    Successful:       ${tool.metrics.successfulRuns || 0}`);
      console.log(`    Success Rate:     ${tool.metrics.successRate?.toFixed(1) || 0}%`);
      console.log(`    Overall Score:    ${tool.metrics.overallScore?.toFixed(1) || 0}`);
      console.log(`    Used by Agents:   ${tool.metrics.usedByAgents?.length || 0}`);
      if (tool.metrics.lastRunAt) {
        console.log(`    Last Run:         ${new Date(tool.metrics.lastRunAt).toLocaleString()}`);
      }
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Tool not found: ${id}`);
    } else {
      handleApiError(error, 'getting tool');
    }
    process.exit(1);
  }
}

async function createTool(options) {
  try {
    const tool = {
      name: options.name,
      description: options.description,
      blockId: options.block,
      version: options.version || '1.0.0',
      category: options.category || 'general',
      tags: options.tags ? options.tags.split(',') : [],
      author: options.author
    };

    const result = await client.createTool(tool);
    console.log('\n✅ Tool created!\n');
    console.log(`  ID:   ${result.id}`);
    console.log(`  Name: ${result.name}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'creating tool');
    process.exit(1);
  }
}

async function deleteToolCmd(id, options = {}) {
  try {
    if (!options.force) {
      console.log(`\n⚠️  This will delete the tool '${id}'`);
      console.log('   Use --force to confirm deletion');
      process.exit(1);
    }
    await client.deleteTool(id);
    console.log(`\n✅ Tool deleted: ${id}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Tool not found: ${id}`);
    } else {
      handleApiError(error, 'deleting tool');
    }
    process.exit(1);
  }
}

// ============= Block Testing Commands (Generic for all block types) =============

async function startBlockTest(blockId, options = {}) {
  try {
    console.log(`\n🧪 Starting test for block: ${blockId}\n`);

    const request = {
      blockId,
      iterations: options.iterations || 5,
      variantId: options.variant,
      variantDescription: options.variantDescription,
      evaluatorType: options.evaluator || 'manual',
      evaluatorModelId: options.evaluatorModel,
      tags: options.tags ? options.tags.split(',') : []
    };

    const run = await client.createBlockTestRun(request);

    console.log(`✅ Test run created!\n`);
    console.log(`  Run ID:       ${run.id}`);
    console.log(`  Block:        ${run.blockId} (${run.blockType})`);
    console.log(`  Status:       ${run.status}`);
    console.log(`  Iterations:   ${run.completedIterations}/${run.totalIterations}`);
    console.log(`  Evaluator:    ${run.evaluatorType}`);

    if (run.criteria && run.criteria.length > 0) {
      console.log(`\n  Evaluation Criteria:`);
      run.criteria.forEach(c => {
        console.log(`    - ${c.name} (weight: ${c.weight})`);
      });
    }

    if (run.status === 'AwaitingEvaluation') {
      console.log(`\n⏳ Iterations complete. Awaiting evaluation.`);
      console.log(`   View pending: maestro test pending ${run.id}`);
      console.log(`   Evaluate:     maestro test evaluate ${run.id} --iteration <id> --score <0-100>`);
    }

    console.log('');
    return run;
  } catch (error) {
    handleApiError(error, 'starting block test');
    process.exit(1);
  }
}

async function listBlockTestRuns(filter = {}) {
  try {
    const runs = await client.listBlockTestRuns(filter);

    if (!runs || runs.length === 0) {
      console.log('\nNo test runs found');
      console.log('  Start one with: maestro test start <block-id> --iterations 5');
      return;
    }

    console.log('\n🧪 Block Test Runs:\n');
    console.table(runs.map(r => ({
      'ID': r.id.substring(0, 8) + '...',
      'Block': r.blockId,
      'Type': r.blockType,
      'Variant': r.variantId,
      'Status': r.status,
      'Progress': `${r.evaluatedIterations}/${r.totalIterations}`,
      'Score': r.metrics?.overallScore || '-',
      'Created': new Date(r.createdAt).toLocaleString()
    })));
  } catch (error) {
    handleApiError(error, 'listing test runs');
    process.exit(1);
  }
}

async function getBlockTestRunInfo(id) {
  try {
    const run = await client.getBlockTestRun(id);

    console.log('\n🧪 Test Run Details:\n');
    console.log(`  ID:           ${run.id}`);
    console.log(`  Block:        ${run.blockId} (${run.blockType})`);
    console.log(`  Variant:      ${run.variantId}`);
    console.log(`  Description:  ${run.variantDescription || 'N/A'}`);
    console.log(`  Status:       ${run.status}`);
    console.log(`  Progress:     ${run.completedIterations} executed, ${run.evaluatedIterations} evaluated`);
    console.log(`  Evaluator:    ${run.evaluatorType}`);
    console.log(`  Created:      ${new Date(run.createdAt).toLocaleString()}`);

    if (run.metrics) {
      console.log('\n  📊 Metrics:');
      console.log(`    Overall Score:  ${run.metrics.overallScore}`);
      console.log(`    Min/Max:        ${run.metrics.minScore} - ${run.metrics.maxScore}`);
      console.log(`    Variance:       ${run.metrics.scoreVariance.toFixed(2)}`);

      if (Object.keys(run.metrics.criterionAverages || {}).length > 0) {
        console.log('\n    Criterion Averages:');
        for (const [name, score] of Object.entries(run.metrics.criterionAverages)) {
          console.log(`      ${name}: ${score.toFixed(1)}`);
        }
      }
    }

    if (run.iterations && run.iterations.length > 0) {
      console.log('\n  📝 Iterations:');
      for (const iter of run.iterations) {
        const status = iter.evaluation ? `✓ Score: ${iter.evaluation.score}` : '⏳ Pending';
        console.log(`    #${iter.iterationNumber} [${iter.id.substring(0, 8)}] - ${status}`);
        if (iter.outputContent) {
          const preview = iter.outputContent.length > 80
            ? iter.outputContent.substring(0, 80) + '...'
            : iter.outputContent;
          console.log(`       Output: ${preview}`);
        }
      }
    }

    if (run.improvementSuggestions && run.improvementSuggestions.length > 0) {
      console.log('\n  💡 Improvement Suggestions:');
      run.improvementSuggestions.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
    }

    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Test run not found: ${id}`);
    } else {
      handleApiError(error, 'getting test run');
    }
    process.exit(1);
  }
}

async function showBlockTestPendingEvaluations(runId) {
  try {
    const pending = await client.getBlockTestPendingEvaluations(runId);

    if (!pending || pending.length === 0) {
      console.log('\n✅ No pending evaluations for this run');
      return;
    }

    console.log(`\n⏳ Pending Evaluations (${pending.length}):\n`);

    for (const iter of pending) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`  Iteration #${iter.iterationNumber} [ID: ${iter.id}]`);
      console.log(`  Duration:    ${iter.durationMs}ms`);
      console.log(`  Success:     ${iter.success ? 'Yes' : 'No'}`);

      if (iter.outputContent) {
        console.log(`\n  Output:`);
        console.log(`  ${'-'.repeat(50)}`);
        console.log(`  ${iter.outputContent}`);
        console.log(`  ${'-'.repeat(50)}`);
      }

      console.log(`\n  To evaluate: maestro test evaluate ${runId} --iteration ${iter.id} --score <0-100>`);
      console.log('');
    }
  } catch (error) {
    handleApiError(error, 'getting pending evaluations');
    process.exit(1);
  }
}

async function evaluateBlockTestRun(runId, options) {
  try {
    if (!options.iteration) {
      // Show pending evaluations if no iteration specified
      return await showBlockTestPendingEvaluations(runId);
    }

    const score = parseInt(options.score);
    if (isNaN(score) || score < 0 || score > 100) {
      console.error('❌ Score must be between 0 and 100');
      process.exit(1);
    }

    const evaluation = {
      iterationId: options.iteration,
      overallScore: score,
      explanation: options.explanation || options.comment,
      evaluatorType: options.evaluator || 'claude-code',
      confidence: options.confidence ? parseFloat(options.confidence) : 1.0
    };

    const run = await client.submitBlockTestEvaluation(runId, evaluation);

    console.log(`\n✅ Evaluation submitted!`);
    console.log(`  Iteration:  ${options.iteration}`);
    console.log(`  Score:      ${score}`);
    console.log(`  Progress:   ${run.evaluatedIterations}/${run.totalIterations} evaluated`);

    if (run.status === 'Completed' && run.metrics) {
      console.log(`\n🎉 Test run complete!`);
      console.log(`  Overall Score: ${run.metrics.overallScore}`);
    }

    console.log('');
  } catch (error) {
    handleApiError(error, 'submitting evaluation');
    process.exit(1);
  }
}

async function compareBlockTestRuns(runIds) {
  try {
    const comparison = await client.compareBlockTestRuns(runIds);

    console.log('\n📊 Test Run Comparison:\n');

    if (comparison.bestRunId) {
      console.log(`  🏆 Best Run: ${comparison.bestRunId} (Score: ${comparison.bestScore})`);
    }

    console.log('\n  Scores by Variant:');
    for (const [variant, score] of Object.entries(comparison.scoresByVariant)) {
      console.log(`    ${variant}: ${score}`);
    }

    if (comparison.runs && comparison.runs.length > 0) {
      console.log('\n  Run Details:');
      console.table(comparison.runs.map(r => ({
        'ID': r.id.substring(0, 8) + '...',
        'Variant': r.variantId,
        'Score': r.metrics?.overallScore || '-',
        'Status': r.status
      })));
    }

    console.log('');
  } catch (error) {
    handleApiError(error, 'comparing test runs');
    process.exit(1);
  }
}

// Legacy aliases for backward compatibility
async function startToolTest(blockId, options) { return startBlockTest(blockId, options); }
async function listToolTestRuns(filter) { return listBlockTestRuns(filter); }
async function getToolTestRunInfo(id) { return getBlockTestRunInfo(id); }
async function showPendingEvaluations(runId) { return showBlockTestPendingEvaluations(runId); }
async function evaluateToolTestRun(runId, options) { return evaluateBlockTestRun(runId, options); }
async function compareToolTestRuns(runIds) { return compareBlockTestRuns(runIds); }

async function getToolMetricsCmd(id) {
  try {
    const metrics = await client.getToolMetrics(id);
    console.log('\n📊 Tool Metrics:\n');
    console.log(`  Total Runs:       ${metrics.totalRuns || 0}`);
    console.log(`  Successful:       ${metrics.successfulRuns || 0}`);
    console.log(`  Success Rate:     ${metrics.successRate?.toFixed(1) || 0}%`);
    console.log(`  Avg Exec Time:    ${metrics.averageExecutionTimeMs?.toFixed(0) || 0}ms`);
    console.log(`  Avg Token Cost:   ${metrics.averageTokenCost?.toFixed(0) || 0}`);
    console.log(`  Avg Score:        ${metrics.averageScore?.toFixed(1) || 0}`);
    console.log(`  Overall Score:    ${metrics.overallScore?.toFixed(1) || 0}`);
    console.log(`  Used by Agents:   ${metrics.usedByAgents?.length || 0}`);
    if (metrics.usedByAgents?.length > 0) {
      console.log(`    Agents:         ${metrics.usedByAgents.join(', ')}`);
    }
    if (metrics.lastRunAt) {
      console.log(`  Last Run:         ${new Date(metrics.lastRunAt).toLocaleString()}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Tool not found: ${id}`);
    } else {
      handleApiError(error, 'getting tool metrics');
    }
    process.exit(1);
  }
}

async function getFoundryOverview() {
  try {
    const overview = await client.getFoundryOverview();
    console.log('\n🏭 Agent Foundry Overview:\n');
    console.log(`  Agents:          ${overview.agentCount || 0}`);
    console.log(`  Tools:           ${overview.toolCount || 0}`);
    console.log(`  Agent Runs:      ${overview.totalAgentRuns || 0}`);
    console.log(`  Tool Runs:       ${overview.totalToolRuns || 0}`);
    console.log(`  Avg Agent Score: ${overview.avgAgentScore?.toFixed(1) || 0}`);
    console.log(`  Avg Tool Score:  ${overview.avgToolScore?.toFixed(1) || 0}`);

    if (overview.topAgents?.length > 0) {
      console.log('\n  Top Agents:');
      overview.topAgents.forEach((a, i) => {
        console.log(`    ${i + 1}. ${a.name} - Score: ${a.score?.toFixed(0) || '-'} (${a.runs} runs)`);
      });
    }

    if (overview.topTools?.length > 0) {
      console.log('\n  Top Tools:');
      overview.topTools.forEach((t, i) => {
        console.log(`    ${i + 1}. ${t.name} - Score: ${t.score?.toFixed(0) || '-'} (${t.runs} runs)`);
      });
    }

    if (overview.recentActivity?.length > 0) {
      console.log('\n  Recent Activity:');
      overview.recentActivity.slice(0, 5).forEach(a => {
        const icon = a.type === 'agent' ? '🤖' : '🔧';
        console.log(`    ${icon} ${a.name} - ${a.action} (Score: ${a.score?.toFixed(0) || '-'})`);
      });
    }

    console.log('');
  } catch (error) {
    handleApiError(error, 'getting foundry overview');
    process.exit(1);
  }
}

async function getFoundryLeaderboard(limit = 10) {
  try {
    const leaderboard = await client.getFoundryLeaderboard(limit);
    console.log('\n🏆 Agent Foundry Leaderboard:\n');

    if (leaderboard.agents?.length > 0) {
      console.log('  Top Agents:');
      console.table(leaderboard.agents.map((a, i) => ({
        'Rank': i + 1,
        'Name': a.name,
        'Category': a.category || 'general',
        'Score': a.score?.toFixed(0) || '-',
        'Runs': a.runs || 0,
        'Success': a.successRate ? `${a.successRate.toFixed(0)}%` : '-'
      })));
    }

    if (leaderboard.tools?.length > 0) {
      console.log('\n  Top Tools:');
      console.table(leaderboard.tools.map((t, i) => ({
        'Rank': i + 1,
        'Name': t.name,
        'Category': t.category || 'general',
        'Score': t.score?.toFixed(0) || '-',
        'Runs': t.runs || 0,
        'Success': t.successRate ? `${t.successRate.toFixed(0)}%` : '-'
      })));
    }
  } catch (error) {
    handleApiError(error, 'getting foundry leaderboard');
    process.exit(1);
  }
}

async function promoteBlock(options) {
  try {
    const request = {
      blockId: options.block,
      name: options.name,
      description: options.description,
      designationType: options.type, // 'tool' or 'agent'
      category: options.category,
      tags: options.tags ? options.tags.split(',') : [],
      availableTools: options.tools ? options.tools.split(',') : []
    };

    const result = await client.promoteToFoundry(request);
    console.log(`\n✅ ${result.message}\n`);
    console.log(`  Type: ${result.type}`);
    console.log(`  ID:   ${result.id}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'promoting block');
    process.exit(1);
  }
}

// ============= LLM Commands =============

async function checkLLMStatus() {
  try {
    // Try to get LLM health from backend
    const health = await client.getLLMHealth().catch(() => null);

    // Also try to call LLM-Provider directly
    const llmProviderUrl = process.env.LLM_PROVIDER_URL || 'http://localhost:8000';
    let llmProviderHealth = null;
    try {
      const response = await fetch(`${llmProviderUrl}/health`);
      llmProviderHealth = await response.json();
    } catch (e) {
      // LLM-Provider not available
    }

    console.log('\n🤖 LLM Status:\n');

    if (llmProviderHealth) {
      console.log('  LLM-Provider (localhost:8000):');
      console.log(`    Status:        ${llmProviderHealth.status}`);
      console.log(`    Active Model:  ${llmProviderHealth.active_model || 'none'}`);
      console.log(`    Models Loaded: ${llmProviderHealth.models_loaded || 0}`);
      console.log(`    Device:        ${llmProviderHealth.device || 'N/A'}`);
      if (llmProviderHealth.cuda_available) {
        console.log(`    GPU:           ${llmProviderHealth.cuda_device_name || 'CUDA'}`);
      }
    } else {
      console.log('  LLM-Provider:    ❌ Not available');
    }

    if (health) {
      console.log('\n  Backend LLM Integration:');
      console.log(`    Status:        ${health.status}`);
    }

    console.log('');
  } catch (error) {
    handleApiError(error, 'checking LLM status');
    process.exit(1);
  }
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['mock', 'help', 'h', 'force', 'status', 'push', 'run-tests', 'run-linter', 'keep-changes'],
    string: ['api-url', 'u', 'name', 'path', 'description', 'runtime', 'image', 'work-dir', 'block-paths', 'model', 'lines', 'since', 'working-dir', 'workdir', 'workflow', 'iterations', 'parallel', 'delay', 'goal', 'tags', 'inputs', 'config', 'from', 'to', 'limit', 'block', 'category', 'version', 'author', 'capabilities', 'tools', 'agents', 'type', 'project', 'task', 'context', 'access', 'test-command', 'linter-command', 'max-steps', 'timeout', 'message', 'branch', 'scope', 'authority', 'allowed-paths', 'denied-paths', 'filter', 'offset', 'command']
  });

  // Update client URL if provided
  if (argv['api-url'] || argv.u) {
    client.baseUrl = (argv['api-url'] || argv.u).replace(/\/$/, '');
  }

  const cmd = argv._[0];

  // Help
  if (!cmd || argv.help || argv.h) {
    console.log(`
Maestro CLI v2.0.0

Usage: maestro <command> [options]

Block Commands:
  blocks               List all available blocks
  workflows            List all workflows
  info <block-id>      Show block details
  children <block-id>  List children of a composite block (--recursive=false for direct only)
  search <query>       Search blocks by name or description

Project Commands:
  projects             List all projects with container status
  projects info <id>   Show project details
  projects create      Create a new project
  projects bind        Bind an existing directory as a Maestro project
  projects open <path> Open an existing project
  projects delete <id> Remove a project (--force required)
  projects blocks <id> List blocks in a project
  projects discover    Discover projects in a directory

Container Commands:
  projects status <id>  Show container status
  projects start <id>   Start project container
  projects stop <id>    Stop project container
  projects restart <id> Restart project container
  projects logs <id>    Show container logs

Execution Commands:
  execute <workflow>   Execute a workflow (use --mock for offline testing)
  run <block-id>       Execute a single block directly
  validate <workflow>  Validate workflow structure

Interactive Session Commands (Session Server Architecture):
  session              List all interactive sessions
  session list         List sessions with filters (--status, --project, --limit)
  session info <id>    Show session details
  session create       Create a new session (--project required, --authority optional)
  session start <id>   Start a session
  session pause <id>   Pause a running session
  session resume <id>  Resume a paused session
  session stop <id>    Stop a session
  session take-control <id> Transfer session authority (--authority)
  session exec <id> "<cmd>"  Execute command in session (shell, maestro, or control)
  session events <id>  Show session event history
  session delete <id>  Delete a session
  session diff <id>    Show changes made in session (legacy)
  session test <id>    Run tests for session (legacy)
  session commit <id>  Commit session changes (legacy)

Training Commands:
  training             List all training configurations
  training info <id>   Show training config details
  training create      Create a training configuration
  training runs        List all training runs
  training run <id>    Show training run details
  training start <cfg> Start a training run for a configuration
  training pause <id>  Pause a training run
  training resume <id> Resume a paused training run
  training cancel <id> Cancel a training run

Fitness Commands:
  fitness              Show fitness configuration
  fitness config       Show/update fitness configuration
  fitness leaderboard  Show model fitness rankings
  fitness profiles     List all model profiles
  fitness profile <id> Show/update a model profile
  fitness entropy      Show task entropy data
  fitness calculate    Calculate fitness for an execution

Metrics Commands:
  metrics              List recent execution metrics
  metrics summary      Show aggregated metrics summary
  runs                 List execution history
  runs info <id>       Show run details

Agent Foundry Commands:
  foundry              Show foundry overview dashboard
  foundry leaderboard  Show top agents and tools by score
  foundry promote      Promote a block to agent or tool

Agent Commands:
  agents               List all agents
  agents info <id>     Show agent details
  agents create        Create a new agent
  agents delete <id>   Delete an agent (--force required)
  agents metrics <id>  Show agent metrics

Tool Commands:
  tools                List all tools
  tools info <id>      Show tool details
  tools create         Create a new tool
  tools delete <id>    Delete a tool (--force required)
  tools metrics <id>   Show tool metrics

Block Testing Commands (works with any block type: tool, agent, workflow, task):
  test start <block-id>  Start a test run for any block
  test runs              List all test runs
  test runs <id>         Show test run details
  test pending <id>      Show iterations awaiting evaluation
  test evaluate <id>     Submit evaluation for a test run
  test compare <ids>     Compare multiple test runs
  test improve <id>      Submit improvement suggestions

LLM Commands:
  llm                  Show LLM provider status

System Commands:
  health               Check backend connection

Options:
  --api-url <url>      Backend API URL (default: http://localhost:5000)
  -u <url>             Shorthand for --api-url
  --mock               Use mock execution (for offline workflow testing)
  --input <key=value>  Input parameters for execution (can be repeated)
  --working-dir <path> Working directory for execution (e.g., git repo path)
  --help, -h           Show this help message

Project Create Options:
  --name <name>        Project name (required for create, optional for bind)
  --path <path>        Project root path (required)
  --description <desc> Project description
  --runtime <type>     Runtime type: none, docker, process
  --image <image>      Docker image (if runtime=docker)
  --model <model>      Default model for agents
  --block-paths <paths> Comma-separated block search paths

Session Create Options:
  --project <id>        Project ID (required)
  --authority <auth>    Authority type: human, ai:<name>, agent:<id> (default: human)
  --workflow <id>       Workflow ID (optional, for automated sessions)
  --task <desc>         Task description (optional)
  --name <name>         Session name (optional)
  --context <ctx>       Additional context (optional)
  --access <level>      Access level: readonly, sandbox, controlled, full (default: controlled)
  --allowed-paths <p>   Comma-separated allowed file paths
  --denied-paths <p>    Comma-separated denied file paths
  --run-tests           Run tests on commit
  --test-command <cmd>  Custom test command
  --run-linter          Run linter on commit
  --linter-command <cmd> Custom linter command
  --max-steps <n>       Maximum steps (default: 50)
  --timeout <ms>        Timeout in ms (default: 600000)

Session Take-Control Options:
  --authority <auth>    New authority: human, ai:<name>, agent:<id> (default: human)

Session Events Options:
  --limit <n>           Maximum events to show
  --offset <n>          Offset for pagination
  --filter <type>       Filter by event type

Session Commit Options:
  --message <msg>      Commit message (required)
  --branch <name>      Branch name (optional, uses current if not specified)
  --push               Push to remote after commit
  --type <type>        Commit type (feat, fix, etc.)
  --scope <scope>      Commit scope

Training Create Options:
  --name <name>        Configuration name (required)
  --workflow <id>      Workflow ID to train (required)
  --iterations <n>     Number of iterations (default: 10)
  --parallel <n>       Parallel iterations (default: 1)
  --delay <ms>         Delay between iterations in ms (default: 0)
  --goal <goal>        Optimization goal: quality, cost, speed (default: quality)
  --tags <tags>        Comma-separated tags

Agent/Tool Create Options:
  --name <name>        Name (required)
  --block <id>         Block ID (required for create)
  --description <desc> Description
  --category <cat>     Category (default: general)
  --version <ver>      Version (default: 1.0.0)
  --tags <tags>        Comma-separated tags
  --author <author>    Author name
  --capabilities <caps> Comma-separated capabilities (agents only)
  --tools <ids>        Comma-separated tool IDs (agents only)
  --agents <ids>       Comma-separated sub-agent IDs (agents only)

Foundry Promote Options:
  --block <id>         Block ID to promote (required)
  --name <name>        Name for the promoted item (required)
  --type <type>        Designation type: tool or agent (required)
  --description <desc> Description
  --category <cat>     Category
  --tags <tags>        Comma-separated tags
  --tools <ids>        Comma-separated tool IDs (for agents)

Metrics Filter Options:
  --from <date>        Start date (ISO format)
  --to <date>          End date (ISO format)
  --limit <n>          Maximum results to show

Environment Variables:
  MAESTRO_API_URL      Backend API URL (default: http://localhost:5000)
  MAESTRO_API_TIMEOUT  API request timeout in ms (default: 30000)
  MAESTRO_DEBUG        Enable debug logging (true/false)
  LLM_PROVIDER_URL     LLM Provider URL (default: http://localhost:8000)

Examples:
  maestro blocks
  maestro workflows
  maestro projects
  maestro projects create --name "My App" --path ./my-app --runtime docker
  maestro projects bind --path ./existing-repo --name "My Repo"
  maestro execute my-workflow --input key=value
  maestro training create --name "Quality Test" --workflow wf-123 --iterations 100
  maestro training start cfg-123
  maestro training runs
  maestro session
  maestro session create --project proj-123 --authority human
  maestro session create --project proj-123 --authority "ai:claude-code" --task "Fix login bug"
  maestro session start sess-123
  maestro session exec sess-123 "ls -la"
  maestro session exec sess-123 "blocks list"
  maestro session exec sess-123 "diff"
  maestro session take-control sess-123 --authority human
  maestro session pause sess-123
  maestro session resume sess-123
  maestro session stop sess-123
  maestro session events sess-123 --limit 50
  maestro sessions test sess-123
  maestro sessions commit sess-123 --message "Fix login validation" --push
  maestro metrics summary
  maestro runs --limit 10
  maestro llm
  maestro health

  # Agent Foundry
  maestro foundry
  maestro foundry leaderboard --limit 5
  maestro agents
  maestro agents info my-agent
  maestro agents create --name "Code Review Agent" --block review-workflow --tools lint,test
  maestro tools
  maestro tools info commit-helper
  maestro tools create --name "Git Diff" --block git-diff-block
  maestro foundry promote --block my-workflow --name "My Tool" --type tool
`);
    return;
  }

  try {
    if (cmd === 'blocks') return await listBlocks();
    if (cmd === 'workflows') return await listWorkflows();
    if (cmd === 'info') {
      const blockId = argv._[1];
      if (!blockId) { console.error('❌ Block ID required'); process.exit(1); }
      return await getBlockInfo(blockId);
    }
    if (cmd === 'children') {
      const blockId = argv._[1];
      if (!blockId) { console.error('❌ Block ID required'); process.exit(1); }
      const recursive = argv.recursive !== false; // default true
      return await getBlockChildren(blockId, recursive);
    }
    if (cmd === 'search') {
      const query = argv._[1];
      if (!query) { console.error('❌ Search query required'); process.exit(1); }
      return await searchBlocks(query);
    }
    if (cmd === 'health') return await checkHealth();
    
    // Project commands
    if (cmd === 'projects') {
      const subCmd = argv._[1];

      if (!subCmd) return await listProjectsWithStatus();

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('❌ Project ID required'); process.exit(1); }
        return await getProjectInfo(id);
      }

      if (subCmd === 'create') {
        const name = argv.name;
        const projectPath = argv.path;
        if (!name) { console.error('❌ --name is required'); process.exit(1); }
        if (!projectPath) { console.error('❌ --path is required'); process.exit(1); }
        return await createProject(name, projectPath, {
          description: argv.description,
          runtime: argv.runtime,
          image: argv.image,
          workDir: argv['work-dir'],
          blockPaths: argv['block-paths'],
          model: argv.model
        });
      }

      if (subCmd === 'bind') {
        const projectPath = argv.path || argv._[2];
        if (!projectPath) { console.error('❌ --path is required'); process.exit(1); }
        return await bindProject(projectPath, {
          name: argv.name,
          description: argv.description,
          runtime: argv.runtime,
          image: argv.image,
          workDir: argv['work-dir'],
          model: argv.model
        });
      }

      if (subCmd === 'open') {
        const projectPath = argv._[2];
        if (!projectPath) { console.error('❌ Project path required'); process.exit(1); }
        return await openProject(projectPath);
      }

      if (subCmd === 'delete') {
        const id = argv._[2];
        if (!id) { console.error('❌ Project ID required'); process.exit(1); }
        return await deleteProject(id, { force: argv.force });
      }

      if (subCmd === 'blocks') {
        const id = argv._[2];
        if (!id) { console.error('❌ Project ID required'); process.exit(1); }
        return await listProjectBlocks(id);
      }

      if (subCmd === 'discover') {
        const searchPath = argv._[2] || '.';
        return await discoverProjects(searchPath);
      }

      // Container commands
      if (subCmd === 'status') {
        const id = argv._[2];
        if (!id) { console.error('❌ Project ID required'); process.exit(1); }
        return await getContainerStatus(id);
      }

      if (subCmd === 'start') {
        const id = argv._[2];
        if (!id) { console.error('❌ Project ID required'); process.exit(1); }
        return await startContainer(id);
      }

      if (subCmd === 'stop') {
        const id = argv._[2];
        if (!id) { console.error('❌ Project ID required'); process.exit(1); }
        return await stopContainer(id);
      }

      if (subCmd === 'restart') {
        const id = argv._[2];
        if (!id) { console.error('❌ Project ID required'); process.exit(1); }
        return await restartContainer(id);
      }

      if (subCmd === 'logs') {
        const id = argv._[2];
        if (!id) { console.error('❌ Project ID required'); process.exit(1); }
        return await getContainerLogs(id, {
          lines: argv.lines ? parseInt(argv.lines) : undefined,
          since: argv.since
        });
      }

      console.error(`❌ Unknown projects subcommand: ${subCmd}`);
      console.error('   Run "maestro --help" for usage information');
      process.exit(1);
    }
    
    // Run single block command
    if (cmd === 'run') {
      const blockId = argv._[1];
      if (!blockId) { console.error('❌ Block ID required'); process.exit(1); }
      const inputs = {};
      if (argv.input) {
        const raw = Array.isArray(argv.input) ? argv.input : [argv.input];
        for (const kv of raw) {
          const [k,v] = kv.split('=');
          inputs[k] = v;
        }
      }
      return await executeBlockReal(blockId, inputs, { workingDir: argv['working-dir'] || argv.workdir });
    }

    if (cmd === 'validate') {
      const wf = argv._[1];
      if (!wf) { console.error('❌ Workflow ID required'); process.exit(1); }
      const w = findWorkflow(wf);
      if (!w) { console.error('❌ Workflow not found:', wf); process.exit(2); }
      const ok = Array.isArray(w.nodes) && w.nodes.length > 0;
      if (!ok) { console.error('❌ Invalid workflow:', wf); process.exit(3); }
      console.log(JSON.stringify({ workflow: wf, valid: ok, nodeCount: w.nodes.length }, null, 2));
      return;
    }
    if (cmd === 'execute') {
      const wf = argv._[1];
      if (!wf) { console.error('❌ Workflow ID required'); process.exit(1); }
      const inputs = {};
      if (argv.input) {
        const raw = Array.isArray(argv.input) ? argv.input : [argv.input];
        for (const kv of raw) {
          const [k,v] = kv.split('=');
          inputs[k] = v;
        }
      }
      if (argv.mock) {
        runMockWorkflow(wf, inputs);
      } else {
        // Real workflow execution via API
        return await executeWorkflowReal(wf, inputs, { workingDir: argv['working-dir'] || argv.workdir });
      }
      return;
    }

    // Session commands (both 'session' and 'sessions' for convenience)
    if (cmd === 'session' || cmd === 'sessions') {
      const subCmd = argv._[1];

      if (!subCmd) return await listSessions();

      if (subCmd === 'list') {
        return await listSessions({
          status: argv.status,
          projectId: argv.project,
          limit: argv.limit
        });
      }

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await getSessionInfo(id);
      }

      if (subCmd === 'create') {
        return await createSession({
          projectId: argv.project,
          authority: argv.authority,
          workflowId: argv.workflow,
          task: argv.task,
          name: argv.name,
          context: argv.context,
          access: argv.access,
          allowedPaths: argv['allowed-paths'],
          deniedPaths: argv['denied-paths'],
          runTests: argv['run-tests'],
          testCommand: argv['test-command'],
          runLinter: argv['run-linter'],
          linterCommand: argv['linter-command'],
          maxSteps: argv['max-steps'],
          timeout: argv.timeout
        });
      }

      if (subCmd === 'start') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await startSession(id);
      }

      if (subCmd === 'pause') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await pauseSession(id);
      }

      if (subCmd === 'resume') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await resumeSession(id);
      }

      if (subCmd === 'stop') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await stopSession(id);
      }

      if (subCmd === 'take-control') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        const authority = argv.authority || argv._[3] || 'human';
        return await takeControlSession(id, authority);
      }

      if (subCmd === 'exec') {
        const id = argv._[2];
        const command = argv._[3] || argv.command;
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        if (!command) { console.error('❌ Command required'); process.exit(1); }
        return await executeSessionCommand(id, command);
      }

      if (subCmd === 'events') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await getSessionEvents(id, {
          limit: argv.limit,
          offset: argv.offset,
          filter: argv.filter
        });
      }

      if (subCmd === 'delete') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await deleteSession(id);
      }

      // Legacy commands for backward compatibility
      if (subCmd === 'diff') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await getSessionDiff(id);
      }

      if (subCmd === 'test') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await runSessionTests(id, argv['test-command']);
      }

      if (subCmd === 'commit') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await commitSession(id, {
          message: argv.message,
          branch: argv.branch,
          push: argv.push,
          type: argv.type,
          scope: argv.scope
        });
      }

      if (subCmd === 'cancel') {
        const id = argv._[2];
        if (!id) { console.error('❌ Session ID required'); process.exit(1); }
        return await cancelSession(id);
      }

      console.error(`❌ Unknown session command: ${subCmd}`);
      console.error('   Available commands: list, info, create, start, pause, resume, stop, take-control, exec, events, delete');
      process.exit(1);
    }

    // Training commands
    if (cmd === 'training') {
      const subCmd = argv._[1];

      if (!subCmd) return await listTrainingConfigs();

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('❌ Configuration ID required'); process.exit(1); }
        return await getTrainingConfigInfo(id);
      }

      if (subCmd === 'create') {
        if (!argv.name) { console.error('❌ --name is required'); process.exit(1); }
        if (!argv.workflow) { console.error('❌ --workflow is required'); process.exit(1); }
        return await createTrainingConfig({
          name: argv.name,
          description: argv.description,
          workflow: argv.workflow,
          iterations: argv.iterations,
          parallel: argv.parallel,
          delay: argv.delay,
          goal: argv.goal,
          tags: argv.tags
        });
      }

      if (subCmd === 'runs') {
        return await listTrainingRuns({
          configId: argv.config,
          workflowId: argv.workflow,
          status: argv.status
        });
      }

      if (subCmd === 'run') {
        const id = argv._[2];
        if (!id) { console.error('❌ Training run ID required'); process.exit(1); }
        return await getTrainingRunInfo(id);
      }

      if (subCmd === 'start') {
        const configId = argv._[2];
        if (!configId) { console.error('❌ Configuration ID required'); process.exit(1); }
        return await startTrainingRun(configId, {
          name: argv.name,
          inputs: argv.inputs
        });
      }

      if (subCmd === 'pause') {
        const id = argv._[2];
        if (!id) { console.error('❌ Training run ID required'); process.exit(1); }
        return await controlTrainingRun(id, 'pause');
      }

      if (subCmd === 'resume') {
        const id = argv._[2];
        if (!id) { console.error('❌ Training run ID required'); process.exit(1); }
        return await controlTrainingRun(id, 'resume');
      }

      if (subCmd === 'cancel') {
        const id = argv._[2];
        if (!id) { console.error('❌ Training run ID required'); process.exit(1); }
        return await controlTrainingRun(id, 'cancel');
      }

      console.error(`❌ Unknown training subcommand: ${subCmd}`);
      process.exit(1);
    }

    // Fitness commands
    if (cmd === 'fitness') {
      const subCmd = argv._[1];

      if (!subCmd) return await getFitnessConfig();

      if (subCmd === 'config') {
        if (argv.lambda || argv['performance-weight'] || argv['specialization-weight'] || argv['composability-weight']) {
          return await updateFitnessConfig({
            lambda: argv.lambda ? parseFloat(argv.lambda) : undefined,
            performanceWeight: argv['performance-weight'] ? parseFloat(argv['performance-weight']) : undefined,
            specializationWeight: argv['specialization-weight'] ? parseFloat(argv['specialization-weight']) : undefined,
            composabilityWeight: argv['composability-weight'] ? parseFloat(argv['composability-weight']) : undefined
          });
        }
        return await getFitnessConfig();
      }

      if (subCmd === 'leaderboard') {
        return await getFitnessLeaderboard({
          taskType: argv['task-type'],
          limit: argv.limit ? parseInt(argv.limit) : 10
        });
      }

      if (subCmd === 'profiles') {
        return await listModelProfiles({ provider: argv.provider });
      }

      if (subCmd === 'profile') {
        const modelId = argv._[2];
        if (!modelId) { console.error('❌ Model ID required'); process.exit(1); }
        return await getModelProfile(modelId);
      }

      if (subCmd === 'entropy') {
        const entityId = argv._[2];
        if (entityId) {
          return await getTaskEntropy(entityId, argv['entity-type'] || 'model');
        }
        return await listTaskEntropy({ entityType: argv['entity-type'] });
      }

      if (subCmd === 'calculate') {
        if (!argv.model) { console.error('❌ --model is required'); process.exit(1); }
        if (!argv['task-type']) { console.error('❌ --task-type is required'); process.exit(1); }
        return await calculateFitness({
          modelId: argv.model,
          taskType: argv['task-type'],
          executionId: argv.execution
        });
      }

      console.error(`❌ Unknown fitness subcommand: ${subCmd}`);
      console.error('   Available commands: config, leaderboard, profiles, profile, entropy, calculate');
      process.exit(1);
    }

    // Metrics commands
    if (cmd === 'metrics') {
      const subCmd = argv._[1];

      if (!subCmd) {
        return await listExecutionMetrics({
          workflowId: argv.workflow,
          from: argv.from,
          to: argv.to,
          limit: argv.limit
        });
      }

      if (subCmd === 'summary') {
        return await getAggregatedMetrics({
          from: argv.from,
          to: argv.to,
          groupBy: argv['group-by']
        });
      }

      console.error(`❌ Unknown metrics subcommand: ${subCmd}`);
      process.exit(1);
    }

    // Runs / execution history commands
    if (cmd === 'runs') {
      const subCmd = argv._[1];

      if (!subCmd) {
        return await listRuns({
          workflowId: argv.workflow,
          blockId: argv.block,
          status: argv.status,
          from: argv.from,
          to: argv.to,
          limit: argv.limit ? parseInt(argv.limit) : 20
        });
      }

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('❌ Run ID required'); process.exit(1); }
        return await getRunInfo(id);
      }

      console.error(`❌ Unknown runs subcommand: ${subCmd}`);
      process.exit(1);
    }

    // LLM commands
    if (cmd === 'llm') {
      return await checkLLMStatus();
    }

    // Agent Foundry commands
    if (cmd === 'foundry') {
      const subCmd = argv._[1];

      if (!subCmd) return await getFoundryOverview();

      if (subCmd === 'leaderboard') {
        return await getFoundryLeaderboard(argv.limit ? parseInt(argv.limit) : 10);
      }

      if (subCmd === 'promote') {
        if (!argv.block) { console.error('❌ --block is required'); process.exit(1); }
        if (!argv.name) { console.error('❌ --name is required'); process.exit(1); }
        if (!argv.type || (argv.type !== 'tool' && argv.type !== 'agent')) {
          console.error('❌ --type must be "tool" or "agent"');
          process.exit(1);
        }
        return await promoteBlock({
          block: argv.block,
          name: argv.name,
          description: argv.description,
          type: argv.type,
          category: argv.category,
          tags: argv.tags,
          tools: argv.tools
        });
      }

      console.error(`❌ Unknown foundry subcommand: ${subCmd}`);
      process.exit(1);
    }

    // Agent commands
    if (cmd === 'agents') {
      const subCmd = argv._[1];

      if (!subCmd) return await listAgents({ category: argv.category });

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('❌ Agent ID required'); process.exit(1); }
        return await getAgentInfo(id);
      }

      if (subCmd === 'create') {
        if (!argv.name) { console.error('❌ --name is required'); process.exit(1); }
        if (!argv.block) { console.error('❌ --block is required'); process.exit(1); }
        return await createAgent({
          name: argv.name,
          block: argv.block,
          description: argv.description,
          version: argv.version,
          category: argv.category,
          capabilities: argv.capabilities,
          tools: argv.tools,
          agents: argv.agents,
          tags: argv.tags,
          author: argv.author
        });
      }

      if (subCmd === 'delete') {
        const id = argv._[2];
        if (!id) { console.error('❌ Agent ID required'); process.exit(1); }
        return await deleteAgentCmd(id, { force: argv.force });
      }

      if (subCmd === 'metrics') {
        const id = argv._[2];
        if (!id) { console.error('❌ Agent ID required'); process.exit(1); }
        return await getAgentMetricsCmd(id);
      }

      console.error(`❌ Unknown agents subcommand: ${subCmd}`);
      process.exit(1);
    }

    // Tool commands
    if (cmd === 'tools') {
      const subCmd = argv._[1];

      if (!subCmd) return await listTools({ category: argv.category });

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('❌ Tool ID required'); process.exit(1); }
        return await getToolInfo(id);
      }

      if (subCmd === 'create') {
        if (!argv.name) { console.error('❌ --name is required'); process.exit(1); }
        if (!argv.block) { console.error('❌ --block is required'); process.exit(1); }
        return await createTool({
          name: argv.name,
          block: argv.block,
          description: argv.description,
          version: argv.version,
          category: argv.category,
          tags: argv.tags,
          author: argv.author
        });
      }

      if (subCmd === 'delete') {
        const id = argv._[2];
        if (!id) { console.error('❌ Tool ID required'); process.exit(1); }
        return await deleteToolCmd(id, { force: argv.force });
      }

      if (subCmd === 'metrics') {
        const id = argv._[2];
        if (!id) { console.error('❌ Tool ID required'); process.exit(1); }
        return await getToolMetricsCmd(id);
      }

      // Tool testing commands
      if (subCmd === 'test') {
        const blockId = argv._[2];
        if (!blockId) { console.error('❌ Block ID required'); process.exit(1); }
        return await startToolTest(blockId, {
          iterations: argv.iterations ? parseInt(argv.iterations) : 5,
          variant: argv.variant,
          variantDescription: argv['variant-desc'],
          evaluator: argv.evaluator || 'manual',
          evaluatorModel: argv['evaluator-model'],
          tags: argv.tags
        });
      }

      if (subCmd === 'testruns') {
        const id = argv._[2];
        if (id) {
          return await getToolTestRunInfo(id);
        }
        return await listToolTestRuns({ blockId: argv.block, status: argv.status });
      }

      if (subCmd === 'evaluate') {
        const runId = argv._[2];
        if (!runId) { console.error('❌ Test run ID required'); process.exit(1); }
        return await evaluateToolTestRun(runId, argv);
      }

      if (subCmd === 'pending') {
        const runId = argv._[2];
        if (!runId) { console.error('❌ Test run ID required'); process.exit(1); }
        return await showPendingEvaluations(runId);
      }

      console.error(`❌ Unknown tools subcommand: ${subCmd}`);
      process.exit(1);
    }

    // Block Testing commands (generic for all block types)
    if (cmd === 'test') {
      const subCmd = argv._[1];

      if (!subCmd) {
        console.log('Usage: maestro test <command>');
        console.log('  start <block-id>  Start a test run for any block');
        console.log('  runs              List all test runs');
        console.log('  runs <id>         Show test run details');
        console.log('  pending <id>      Show iterations awaiting evaluation');
        console.log('  evaluate <id>     Submit evaluation for a test run');
        console.log('  compare <ids>     Compare multiple test runs');
        return;
      }

      if (subCmd === 'start') {
        const blockId = argv._[2];
        if (!blockId) { console.error('❌ Block ID required'); process.exit(1); }
        return await startBlockTest(blockId, {
          iterations: argv.iterations ? parseInt(argv.iterations) : 5,
          variant: argv.variant,
          variantDescription: argv['variant-desc'],
          evaluator: argv.evaluator || 'manual',
          evaluatorModel: argv['evaluator-model'],
          tags: argv.tags
        });
      }

      if (subCmd === 'runs') {
        const id = argv._[2];
        if (id) {
          return await getBlockTestRunInfo(id);
        }
        return await listBlockTestRuns({
          blockId: argv.block,
          blockType: argv.type,
          status: argv.status
        });
      }

      if (subCmd === 'pending') {
        const runId = argv._[2];
        if (!runId) { console.error('❌ Test run ID required'); process.exit(1); }
        return await showBlockTestPendingEvaluations(runId);
      }

      if (subCmd === 'evaluate') {
        const runId = argv._[2];
        if (!runId) { console.error('❌ Test run ID required'); process.exit(1); }
        return await evaluateBlockTestRun(runId, argv);
      }

      if (subCmd === 'compare') {
        const runIds = argv._[2];
        if (!runIds) { console.error('❌ Run IDs required (comma-separated)'); process.exit(1); }
        return await compareBlockTestRuns(runIds.split(','));
      }

      if (subCmd === 'improve') {
        const runId = argv._[2];
        if (!runId) { console.error('❌ Test run ID required'); process.exit(1); }
        const suggestions = argv.suggestions ? argv.suggestions.split(',') : [];
        if (suggestions.length === 0) {
          console.error('❌ --suggestions required (comma-separated)');
          process.exit(1);
        }
        try {
          const run = await client.submitBlockImprovement(runId, suggestions);
          console.log(`\n✅ Improvement suggestions added to run ${runId}`);
          console.log(`   Total suggestions: ${run.improvementSuggestions?.length || 0}`);
        } catch (error) {
          handleApiError(error, 'submitting improvements');
          process.exit(1);
        }
        return;
      }

      console.error(`❌ Unknown test subcommand: ${subCmd}`);
      process.exit(1);
    }

    console.error(`❌ Unknown command: ${cmd}`);
    console.error('   Run "maestro --help" for usage information');
    process.exit(1);
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();
