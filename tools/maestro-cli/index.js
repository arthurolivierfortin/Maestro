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

    // Validate repository source requires path
    if (options.source === 'repository' && !options.repositoryPath) {
      console.error('❌ --repository-path is required when using --source repository');
      process.exit(1);
    }

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
      timeoutMs: options.timeout ? parseInt(options.timeout) : 600000,
      // Phase 4: Session source configuration
      source: options.source || 'sandbox',
      repositoryConfig: options.source === 'repository' ? {
        repositoryPath: options.repositoryPath,
        accessLevel: options.accessLevel || 'controlled',
        branch: options.branch,
        excludePatterns: options.excludePatterns ? options.excludePatterns.split(',') : undefined
      } : undefined
    };

    const session = await client.createSession(request);
    console.log('\n✅ Session created!\n');
    console.log(`  ID:        ${session.id}`);
    console.log(`  Name:      ${session.name}`);
    console.log(`  Status:    ${session.status}`);
    console.log(`  Authority: ${session.authority || 'human'}`);
    console.log(`  Source:    ${request.source}`);
    if (request.source === 'repository' && request.repositoryConfig) {
      console.log(`  Repo Path: ${request.repositoryConfig.repositoryPath}`);
      console.log(`  Access:    ${request.repositoryConfig.accessLevel}`);
      if (request.repositoryConfig.branch) {
        console.log(`  Branch:    ${request.repositoryConfig.branch}`);
      }
    }
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

// ============= System Block Commands =============

async function listSystemBlocks() {
  try {
    const blocks = await client.get('/api/blocks/system');
    if (!blocks || blocks.length === 0) {
      console.log('\nNo system blocks found');
      console.log('  System blocks are located in blocks/system/');
      return;
    }

    console.log('\n🔧 System Blocks:\n');
    console.table(blocks.map(b => ({
      'ID': b.id,
      'Name': b.name,
      'Type': b.blockType,
      'Overridable': b.overridable ? 'Yes' : 'No',
      'Version': b.version
    })));
  } catch (error) {
    handleApiError(error, 'listing system blocks');
    process.exit(1);
  }
}

async function getSystemBlockInfo(blockId) {
  try {
    const block = await client.get(`/api/blocks/system/${encodeURIComponent(blockId)}`);
    console.log('\n🔧 System Block Details:\n');
    console.log(`  ID:           ${block.id}`);
    console.log(`  Name:         ${block.name}`);
    console.log(`  Type:         ${block.blockType}`);
    console.log(`  Version:      ${block.version}`);
    console.log(`  Description:  ${block.description || 'N/A'}`);
    console.log(`  Overridable:  ${block.overridable ? 'Yes' : 'No'}`);
    console.log(`  Capabilities: ${block.capabilities?.join(', ') || 'None'}`);

    // Check if has override
    const overrideStatus = await client.get(`/api/blocks/system/${encodeURIComponent(blockId)}/has-override`);
    console.log(`  Has Override: ${overrideStatus.hasOverride ? 'Yes' : 'No'}`);
    console.log('');

    if (block.config) {
      console.log('  Configuration:');
      const configStr = JSON.stringify(block.config, null, 2).split('\n');
      configStr.slice(0, 10).forEach(line => console.log('    ' + line));
      if (configStr.length > 10) {
        console.log(`    ... (${configStr.length - 10} more lines)`);
      }
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ System block not found: ${blockId}`);
    } else {
      handleApiError(error, 'getting system block info');
    }
    process.exit(1);
  }
}

async function listUserOverrides() {
  try {
    const overrides = await client.get('/api/blocks/system/overrides');
    if (!overrides || overrides.length === 0) {
      console.log('\nNo user overrides found');
      console.log('  Create an override with: maestro system override <system-block-id>');
      return;
    }

    console.log('\n📝 User Overrides:\n');
    console.table(overrides.map(b => ({
      'ID': b.id,
      'Overrides': b.overridesSystemBlock,
      'Name': b.name,
      'Type': b.blockType
    })));
  } catch (error) {
    handleApiError(error, 'listing user overrides');
    process.exit(1);
  }
}

async function createSystemBlockOverride(blockId, config = null) {
  try {
    const body = {};
    if (config) {
      try {
        body.config = JSON.parse(config);
      } catch (e) {
        console.error('❌ Invalid JSON config:', e.message);
        process.exit(1);
      }
    }

    const override = await client.post(`/api/blocks/system/${encodeURIComponent(blockId)}/override`, body);
    console.log('\n✅ Override created successfully!\n');
    console.log(`  Override ID:    ${override.id}`);
    console.log(`  System Block:   ${override.overridesSystemBlock || blockId}`);
    console.log(`  Name:           ${override.name}`);
    console.log('');
    console.log('  To restore to default:');
    console.log(`    maestro system restore ${blockId}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ System block not found: ${blockId}`);
    } else if (error.status === 400) {
      console.error(`❌ Cannot override: ${error.message || 'Block is not overridable'}`);
    } else {
      handleApiError(error, 'creating override');
    }
    process.exit(1);
  }
}

async function restoreSystemBlock(blockId) {
  try {
    await client.delete(`/api/blocks/system/${encodeURIComponent(blockId)}/override`);
    console.log('\n✅ System block restored to default!\n');
    console.log(`  Block ID: ${blockId}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ System block not found: ${blockId}`);
    } else {
      handleApiError(error, 'restoring system block');
    }
    process.exit(1);
  }
}

async function getEffectiveBlock(blockId) {
  try {
    const block = await client.get(`/api/blocks/system/${encodeURIComponent(blockId)}/effective`);
    const hasOverride = await client.get(`/api/blocks/system/${encodeURIComponent(blockId)}/has-override`);

    console.log(`\n${hasOverride.hasOverride ? '📝' : '🔧'} Effective Block (${hasOverride.hasOverride ? 'with override' : 'system default'}):\n`);
    console.log(`  ID:           ${block.id}`);
    console.log(`  Name:         ${block.name}`);
    console.log(`  Type:         ${block.blockType}`);
    console.log(`  Version:      ${block.version}`);
    console.log(`  Description:  ${block.description || 'N/A'}`);
    console.log(`  Is System:    ${block.isSystem ? 'Yes' : 'No'}`);
    console.log(`  Overridden:   ${hasOverride.hasOverride ? 'Yes' : 'No'}`);
    console.log('');

    if (block.config) {
      console.log('  Effective Configuration:');
      const configStr = JSON.stringify(block.config, null, 2).split('\n');
      configStr.forEach(line => console.log('    ' + line));
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Block not found: ${blockId}`);
    } else {
      handleApiError(error, 'getting effective block');
    }
    process.exit(1);
  }
}

// ============= Workspace Commands =============

async function listWorkspaces(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.type) params.append('type', options.type);

    const workspaces = await client.get(`/api/workspaces?${params.toString()}`);
    if (!workspaces || workspaces.length === 0) {
      console.log('\nNo workspaces found');
      console.log('  Create one with: maestro workspace create --name "My Workspace" --type research');
      return;
    }

    console.log('\n🏢 Workspaces:\n');
    console.table(workspaces.map(w => ({
      'ID': w.id.substring(0, 8) + '...',
      'Name': w.name,
      'Type': w.type,
      'Status': w.status,
      'Sessions': w.sessionIds?.length || 0,
      'Projects': w.projectIds?.length || 0,
      'Isolated': w.isolation?.enabled ? 'Yes' : 'No'
    })));
  } catch (error) {
    handleApiError(error, 'listing workspaces');
    process.exit(1);
  }
}

async function getWorkspaceInfo(id) {
  try {
    const workspace = await client.get(`/api/workspaces/${encodeURIComponent(id)}`);
    console.log('\n🏢 Workspace Details:\n');
    console.log(`  ID:           ${workspace.id}`);
    console.log(`  Name:         ${workspace.name}`);
    console.log(`  Type:         ${workspace.type}`);
    console.log(`  Status:       ${workspace.status}`);
    console.log(`  Description:  ${workspace.description || 'N/A'}`);
    console.log(`  Created:      ${workspace.createdAt}`);
    console.log(`  Updated:      ${workspace.updatedAt}`);
    console.log('');
    console.log('  Resources:');
    console.log(`    Sessions:   ${workspace.sessionIds?.length || 0}`);
    console.log(`    Projects:   ${workspace.projectIds?.length || 0}`);
    console.log(`    Catalog:    ${workspace.catalogRef || 'default'}`);
    console.log('');
    console.log('  Isolation:');
    console.log(`    Enabled:    ${workspace.isolation?.enabled ? 'Yes' : 'No'}`);
    if (workspace.isolation?.enabled) {
      console.log(`    Network:    ${workspace.isolation?.network?.networkName || 'N/A'}`);
      if (workspace.isolation?.resources) {
        console.log(`    CPU:        ${workspace.isolation.resources.cpuPercentage}%`);
        console.log(`    Memory:     ${workspace.isolation.resources.memoryMb}MB`);
        console.log(`    Storage:    ${workspace.isolation.resources.storageGb}GB`);
      }
    }
    console.log('');
    console.log('  Settings:');
    console.log(`    Max Sessions:     ${workspace.settings?.maxConcurrentSessions || 10}`);
    console.log(`    Max Training:     ${workspace.settings?.maxConcurrentTrainingRuns || 3}`);
    console.log(`    Auto-Promotion:   ${workspace.settings?.autoPromotionEnabled ? 'Yes' : 'No'}`);
    if (workspace.settings?.autoPromotionEnabled) {
      console.log(`    Min Fitness:      ${workspace.settings.minFitnessForPromotion}`);
    }
    console.log('');

    if (workspace.isolation?.permissions) {
      const perms = workspace.isolation.permissions;
      if (perms.canPromoteTo?.length > 0) {
        console.log(`  Can Promote To: ${perms.canPromoteTo.join(', ')}`);
      }
      if (perms.canReadFrom?.length > 0) {
        console.log(`  Can Read From:  ${perms.canReadFrom.join(', ')}`);
      }
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Workspace not found: ${id}`);
    } else {
      handleApiError(error, 'getting workspace info');
    }
    process.exit(1);
  }
}

async function createWorkspace(options) {
  try {
    const request = {
      name: options.name,
      type: options.type || 'Custom',
      description: options.description,
      isolated: options.isolated || false
    };

    if (options.isolated) {
      request.isolationConfig = {
        enabled: true,
        resources: {
          cpuPercentage: options.cpu || 50,
          memoryMb: options.memory || 4096,
          storageGb: options.storage || 50,
          maxContainers: options.maxContainers || 10
        }
      };

      if (options.canPromoteTo) {
        request.isolationConfig.permissions = {
          canPromoteTo: options.canPromoteTo.split(',').map(s => s.trim())
        };
      }
    }

    const workspace = await client.post('/api/workspaces', request);
    console.log('\n✅ Workspace created successfully!\n');
    console.log(`  ID:       ${workspace.id}`);
    console.log(`  Name:     ${workspace.name}`);
    console.log(`  Type:     ${workspace.type}`);
    console.log(`  Isolated: ${workspace.isolation?.enabled ? 'Yes' : 'No'}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'creating workspace');
    process.exit(1);
  }
}

async function deleteWorkspace(id, options = {}) {
  try {
    if (!options.force) {
      console.log('⚠️  Use --force to confirm workspace deletion');
      process.exit(1);
    }

    await client.delete(`/api/workspaces/${encodeURIComponent(id)}`);
    console.log(`\n✅ Workspace '${id}' deleted\n`);
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Workspace not found: ${id}`);
    } else if (error.status === 400) {
      console.error(`❌ Cannot delete workspace: ${error.message || 'Has active sessions or projects'}`);
    } else {
      handleApiError(error, 'deleting workspace');
    }
    process.exit(1);
  }
}

async function addSessionToWorkspace(workspaceId, sessionId) {
  try {
    const workspace = await client.post(`/api/workspaces/${encodeURIComponent(workspaceId)}/sessions`, {
      sessionId
    });
    console.log(`\n✅ Session '${sessionId}' added to workspace '${workspace.name}'\n`);
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Workspace not found: ${workspaceId}`);
    } else {
      handleApiError(error, 'adding session to workspace');
    }
    process.exit(1);
  }
}

async function addProjectToWorkspace(workspaceId, projectId) {
  try {
    const workspace = await client.post(`/api/workspaces/${encodeURIComponent(workspaceId)}/projects`, {
      projectId
    });
    console.log(`\n✅ Project '${projectId}' added to workspace '${workspace.name}'\n`);
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Workspace not found: ${workspaceId}`);
    } else {
      handleApiError(error, 'adding project to workspace');
    }
    process.exit(1);
  }
}

async function updateWorkspacePermissions(workspaceId, options) {
  try {
    const workspace = await client.get(`/api/workspaces/${encodeURIComponent(workspaceId)}`);

    const isolation = workspace.isolation || { enabled: false, permissions: {} };
    const permissions = isolation.permissions || {};

    if (options.canPromoteTo) {
      permissions.canPromoteTo = options.canPromoteTo.split(',').map(s => s.trim());
    }
    if (options.canReadFrom) {
      permissions.canReadFrom = options.canReadFrom.split(',').map(s => s.trim());
    }
    if (options.canWriteTo) {
      permissions.canWriteTo = options.canWriteTo.split(',').map(s => s.trim());
    }

    const updated = await client.put(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
      isolation: {
        ...isolation,
        permissions
      }
    });

    console.log(`\n✅ Permissions updated for workspace '${updated.name}'\n`);
    console.log('  New Permissions:');
    if (permissions.canPromoteTo?.length > 0) {
      console.log(`    Can Promote To: ${permissions.canPromoteTo.join(', ')}`);
    }
    if (permissions.canReadFrom?.length > 0) {
      console.log(`    Can Read From:  ${permissions.canReadFrom.join(', ')}`);
    }
    if (permissions.canWriteTo?.length > 0) {
      console.log(`    Can Write To:   ${permissions.canWriteTo.join(', ')}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Workspace not found: ${workspaceId}`);
    } else {
      handleApiError(error, 'updating workspace permissions');
    }
    process.exit(1);
  }
}

async function getWorkspaceTopology() {
  try {
    const topology = await client.get('/api/workspaces/topology');

    if (!topology.nodes || topology.nodes.length === 0) {
      console.log('\nNo workspaces found');
      return;
    }

    console.log('\n🗺️  Workspace Topology:\n');
    console.log('  Workspaces:');
    topology.nodes.forEach(node => {
      const icon = node.isIsolated ? '🔒' : '🔓';
      console.log(`    ${icon} ${node.name} (${node.type}) - ${node.sessionCount} sessions, ${node.projectCount} projects`);
    });

    if (topology.edges && topology.edges.length > 0) {
      console.log('\n  Connections:');
      const promotionEdges = topology.edges.filter(e => e.edgeType === 'promotion');
      const readEdges = topology.edges.filter(e => e.edgeType === 'read');

      if (promotionEdges.length > 0) {
        console.log('    Promotion paths:');
        promotionEdges.forEach(edge => {
          const source = topology.nodes.find(n => n.workspaceId === edge.sourceWorkspaceId);
          const target = topology.nodes.find(n => n.workspaceId === edge.targetWorkspaceId);
          console.log(`      ${source?.name || edge.sourceWorkspaceId} → ${target?.name || edge.targetWorkspaceId}`);
        });
      }

      if (readEdges.length > 0) {
        console.log('    Read access:');
        readEdges.forEach(edge => {
          const source = topology.nodes.find(n => n.workspaceId === edge.sourceWorkspaceId);
          const target = topology.nodes.find(n => n.workspaceId === edge.targetWorkspaceId);
          console.log(`      ${source?.name || edge.sourceWorkspaceId} ← ${target?.name || edge.targetWorkspaceId}`);
        });
      }
    }
    console.log('');
  } catch (error) {
    handleApiError(error, 'getting workspace topology');
    process.exit(1);
  }
}

async function promoteAgent(sourceWorkspaceId, options) {
  try {
    if (!options.target) {
      console.error('❌ --target workspace is required');
      process.exit(1);
    }
    if (!options.agent) {
      console.error('❌ --agent block ID is required');
      process.exit(1);
    }

    const result = await client.post(`/api/workspaces/${encodeURIComponent(sourceWorkspaceId)}/promote`, {
      targetWorkspaceId: options.target,
      agentBlockId: options.agent,
      version: options.version
    });

    if (result.success) {
      console.log('\n✅ Agent promoted successfully!\n');
      console.log(`  Agent:    ${result.promotedBlockId}`);
      console.log(`  Version:  ${result.targetVersion}`);
      console.log(`  Audit ID: ${result.auditLogId}`);
    } else {
      console.error(`\n❌ Promotion failed: ${result.errorMessage}\n`);
      process.exit(1);
    }
    console.log('');
  } catch (error) {
    handleApiError(error, 'promoting agent');
    process.exit(1);
  }
}

// ============= Orchestrator Commands (Phase 5) =============

async function getOrchestratorStatus() {
  try {
    const status = await client.get('/api/orchestrator/status');

    console.log('\n🎯 Orchestrator Status:\n');
    console.log(`  Running:          ${status.isRunning ? '✅ Yes' : '⏸️  No'}`);
    console.log(`  Auto-Promotion:   ${status.autoPromotionEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`  Last Cycle:       ${status.lastMonitoringCycle ? new Date(status.lastMonitoringCycle).toLocaleString() : 'Never'}`);
    console.log(`  Next Cycle:       ${status.nextScheduledCycle ? new Date(status.nextScheduledCycle).toLocaleString() : 'Not scheduled'}`);
    console.log(`  Pending:          ${status.pendingPromotions} promotions`);
    console.log(`  Monitored Agents: ${status.activeMonitoredAgents}`);
    console.log(`  Recent (24h):     ${status.recentPromotions} promotions, ${status.recentRollbacks} rollbacks`);
    console.log(`  Workspaces:       ${status.monitoredWorkspaces?.join(', ') || 'None'}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'getting orchestrator status');
    process.exit(1);
  }
}

async function getOrchestratorPending() {
  try {
    const pending = await client.get('/api/orchestrator/pending');

    if (!pending || pending.length === 0) {
      console.log('\n✅ No pending promotions');
      return;
    }

    console.log(`\n⏳ Pending Promotions (${pending.length}):\n`);
    pending.forEach(p => {
      const status = p.meetsCriteria ? '✅' : '⏸️';
      console.log(`  ${status} ${p.agentName} (${p.agentId})`);
      console.log(`     From: ${p.fromWorkspace} → To: ${p.toWorkspace}`);
      console.log(`     Fitness: ${(p.currentFitness * 100).toFixed(1)}% (required: ${(p.requiredFitness * 100).toFixed(1)}%)`);
      console.log(`     Iterations: ${p.iterations} (required: ${p.requiredIterations})`);
      console.log(`     Tests: ${p.testsPassed ? '✅ Passed' : '❌ Failed'}`);
      if (p.requiresApproval) console.log(`     ⚠️  Requires manual approval`);
      if (p.blockingReason) console.log(`     ❌ Blocked: ${p.blockingReason}`);
      console.log('');
    });
  } catch (error) {
    handleApiError(error, 'getting pending promotions');
    process.exit(1);
  }
}

async function orchestratorPromote(options) {
  try {
    if (!options.agent) { console.error('❌ --agent is required'); process.exit(1); }
    if (!options.from) { console.error('❌ --from workspace is required'); process.exit(1); }
    if (!options.to) { console.error('❌ --to workspace is required'); process.exit(1); }

    console.log(`\n🚀 Promoting agent ${options.agent} from ${options.from} to ${options.to}...\n`);

    const result = await client.post('/api/orchestrator/promote', {
      agentId: options.agent,
      fromWorkspace: options.from,
      toWorkspace: options.to,
      force: options.force || false
    });

    if (result.success) {
      console.log('✅ Promotion successful!\n');
      console.log(`  Agent:   ${result.agentId}`);
      console.log(`  Version: ${result.toVersion}`);
      console.log(`  Fitness: ${(result.fitnessAtPromotion * 100).toFixed(1)}%`);
    } else {
      console.error(`❌ Promotion failed: ${result.errorMessage}\n`);
      process.exit(1);
    }
    console.log('');
  } catch (error) {
    handleApiError(error, 'promoting agent');
    process.exit(1);
  }
}

async function orchestratorRollback(options) {
  try {
    if (!options.agent) { console.error('❌ --agent is required'); process.exit(1); }
    if (!options.workspace) { console.error('❌ --workspace is required'); process.exit(1); }

    console.log(`\n⏪ Rolling back agent ${options.agent} in ${options.workspace}...\n`);

    const result = await client.post('/api/orchestrator/rollback', {
      agentId: options.agent,
      workspaceId: options.workspace,
      toVersion: options.version
    });

    if (result.success) {
      console.log('✅ Rollback successful!\n');
      console.log(`  Agent:        ${result.agentId}`);
      console.log(`  From Version: ${result.fromVersion}`);
      console.log(`  To Version:   ${result.toVersion}`);
      console.log(`  Reason:       ${result.reason}`);
    } else {
      console.error(`❌ Rollback failed: ${result.errorMessage}\n`);
      process.exit(1);
    }
    console.log('');
  } catch (error) {
    handleApiError(error, 'rolling back agent');
    process.exit(1);
  }
}

async function getOrchestratorHistory(options) {
  try {
    let url = '/api/orchestrator/history';
    const params = [];
    if (options.workspace) params.push(`workspaceId=${encodeURIComponent(options.workspace)}`);
    if (options.agent) params.push(`agentId=${encodeURIComponent(options.agent)}`);
    if (options.limit) params.push(`limit=${options.limit}`);
    if (params.length > 0) url += '?' + params.join('&');

    const history = await client.get(url);

    if (!history || history.length === 0) {
      console.log('\nNo promotion history found');
      return;
    }

    console.log(`\n📜 Promotion History (${history.length}):\n`);
    history.forEach(h => {
      const status = h.success ? '✅' : '❌';
      const forced = h.wasForced ? ' [FORCED]' : '';
      console.log(`  ${status} ${new Date(h.timestamp).toLocaleString()}${forced}`);
      console.log(`     ${h.agentName || h.agentId}: ${h.fromWorkspace} → ${h.toWorkspace}`);
      console.log(`     Version: ${h.fromVersion} → ${h.toVersion}`);
      console.log(`     Fitness: ${(h.fitnessAtPromotion * 100).toFixed(1)}%`);
      if (h.errorMessage) console.log(`     Error: ${h.errorMessage}`);
      console.log('');
    });
  } catch (error) {
    handleApiError(error, 'getting orchestrator history');
    process.exit(1);
  }
}

async function getOrchestratorConfig() {
  try {
    const config = await client.get('/api/orchestrator/config');

    console.log('\n⚙️  Orchestrator Configuration:\n');
    console.log(`  Auto-Promotion:      ${config.autoPromotionEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`  Monitoring Interval: ${config.monitoringInterval}`);

    console.log('\n  Promotion Rules:');
    config.promotionRules?.forEach(rule => {
      console.log(`    ${rule.fromWorkspace} → ${rule.toWorkspace}`);
      console.log(`      Min Fitness:    ${(rule.minFitness * 100).toFixed(0)}%`);
      console.log(`      Min Iterations: ${rule.minIterations}`);
      console.log(`      Tests Required: ${rule.allTestsPass ? 'Yes' : 'No'}`);
      console.log(`      Approval:       ${rule.approvalRequired ? 'Required' : 'Automatic'}`);
    });

    console.log('\n  Rollback Settings:');
    console.log(`    Auto-Rollback:        ${config.rollbackConfig?.autoRollback ? 'Enabled' : 'Disabled'}`);
    console.log(`    Fitness Drop Thresh:  ${((config.rollbackConfig?.fitnessDropThreshold || 0.1) * 100).toFixed(0)}%`);
    console.log(`    Error Rate Thresh:    ${((config.rollbackConfig?.errorRateThreshold || 0.05) * 100).toFixed(0)}%`);
    console.log(`    Max Versions:         ${config.rollbackConfig?.maxRollbackVersions || 3}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'getting orchestrator config');
    process.exit(1);
  }
}

async function updateOrchestratorConfig(options) {
  try {
    const update = {};
    if (options.minFitness !== undefined) {
      update.minFitnessResearchToStaging = parseFloat(options.minFitness);
    }
    if (options.minFitnessProduction !== undefined) {
      update.minFitnessStagingToProduction = parseFloat(options.minFitnessProduction);
    }
    if (options.interval !== undefined) {
      update.monitoringIntervalMinutes = parseInt(options.interval);
    }
    if (options.fitnessDropThreshold !== undefined) {
      update.fitnessDropThreshold = parseFloat(options.fitnessDropThreshold);
    }
    if (options.errorRateThreshold !== undefined) {
      update.errorRateThreshold = parseFloat(options.errorRateThreshold);
    }

    const config = await client.put('/api/orchestrator/config', update);

    console.log('\n✅ Configuration updated!\n');
    await getOrchestratorConfig();
  } catch (error) {
    handleApiError(error, 'updating orchestrator config');
    process.exit(1);
  }
}

async function setOrchestratorAutoPromote(enabled) {
  try {
    await client.post('/api/orchestrator/auto-promote', { enabled });
    console.log(`\n✅ Auto-promotion ${enabled ? 'enabled' : 'disabled'}\n`);
  } catch (error) {
    handleApiError(error, 'setting auto-promote');
    process.exit(1);
  }
}

async function runOrchestratorMonitor() {
  try {
    console.log('\n🔍 Running monitoring cycle...\n');
    const result = await client.post('/api/orchestrator/monitor', {});

    console.log('✅ Monitoring cycle complete!\n');
    console.log(`  Agents Checked:      ${result.agentsChecked}`);
    console.log(`  Promotion Candidates: ${result.promotionCandidates}`);
    console.log(`  Promotions Executed:  ${result.promotionsExecuted}`);
    console.log(`  Rollback Candidates:  ${result.rollbackCandidates}`);
    console.log(`  Rollbacks Executed:   ${result.rollbacksExecuted}`);
    console.log(`  Alerts Generated:     ${result.alertsGenerated}`);

    if (result.actions?.length > 0) {
      console.log('\n  Actions:');
      result.actions.forEach(a => console.log(`    • ${a}`));
    }

    if (result.warnings?.length > 0) {
      console.log('\n  ⚠️  Warnings:');
      result.warnings.forEach(w => console.log(`    • ${w}`));
    }
    console.log('');
  } catch (error) {
    handleApiError(error, 'running monitoring cycle');
    process.exit(1);
  }
}

// ============= Research Team Commands (Phase 6) =============

async function startResearchCycle(options) {
  try {
    if (!options.agent) { console.error('❌ --agent is required'); process.exit(1); }

    console.log(`\n🔬 Starting research cycle for agent ${options.agent}...\n`);

    const result = await client.post('/api/research/cycles', {
      agentId: options.agent,
      improvementGoal: options.goal,
      fitnessTarget: options.target ? parseFloat(options.target) : undefined,
      maxIterations: options.iterations ? parseInt(options.iterations) : undefined,
      maxCycles: options.cycles ? parseInt(options.cycles) : undefined,
      autoPublish: options.publish || false,
      workspaceId: options.workspace
    });

    if (result.success) {
      console.log('✅ Research cycle completed successfully!\n');
      console.log(`  Cycle ID:      ${result.cycleId}`);
      console.log(`  Agent:         ${result.agentId}`);
      console.log(`  Cycles Run:    ${result.cyclesRun}`);
      console.log(`  Iterations:    ${result.totalIterations}`);
      console.log(`  Fitness:       ${(result.initialFitness * 100).toFixed(1)}% → ${(result.finalFitness * 100).toFixed(1)}%`);
      console.log(`  Improvement:   ${result.fitnessImprovement >= 0 ? '+' : ''}${(result.fitnessImprovement * 100).toFixed(1)}%`);
      if (result.publishedVersion) {
        console.log(`  Published:     v${result.publishedVersion}`);
      }
      if (result.duration) {
        console.log(`  Duration:      ${result.duration}`);
      }
    } else {
      console.log(`❌ Research cycle failed: ${result.errorMessage}\n`);
      console.log(`  Final Phase:   ${result.finalPhase}`);
      console.log(`  Final Fitness: ${(result.finalFitness * 100).toFixed(1)}%`);
    }
    console.log('');
  } catch (error) {
    handleApiError(error, 'starting research cycle');
    process.exit(1);
  }
}

async function getResearchCycleStatus(cycleId) {
  try {
    const status = await client.get(`/api/research/cycles/${encodeURIComponent(cycleId)}/status`);

    console.log(`\n🔬 Research Cycle Status: ${cycleId}\n`);
    console.log(`  Agent:         ${status.agentId}`);
    console.log(`  Phase:         ${status.currentPhase}`);
    console.log(`  Cycle:         ${status.currentCycle}/${status.maxCycles}`);
    console.log(`  Iteration:     ${status.currentIteration}/${status.maxIterations}`);
    console.log(`  Fitness:       ${(status.currentFitness * 100).toFixed(1)}% (target: ${(status.targetFitness * 100).toFixed(1)}%)`);
    console.log(`  Progress:      ${status.progressPercent.toFixed(0)}%`);
    console.log(`  Activity:      ${status.currentActivity || 'N/A'}`);
    console.log(`  Elapsed:       ${status.elapsed || 'N/A'}`);

    if (status.recentEvents?.length > 0) {
      console.log('\n  Recent Events:');
      status.recentEvents.slice(-5).forEach(e => console.log(`    • ${e}`));
    }
    console.log('');
  } catch (error) {
    handleApiError(error, 'getting research cycle status');
    process.exit(1);
  }
}

async function stopResearchCycle(cycleId) {
  try {
    await client.post(`/api/research/cycles/${encodeURIComponent(cycleId)}/stop`, {});
    console.log(`\n✅ Research cycle ${cycleId} stopped\n`);
  } catch (error) {
    handleApiError(error, 'stopping research cycle');
    process.exit(1);
  }
}

async function getResearchHistory(options) {
  try {
    let url = '/api/research/history';
    const params = [];
    if (options.agent) params.push(`agentId=${encodeURIComponent(options.agent)}`);
    if (options.limit) params.push(`limit=${options.limit}`);
    if (params.length > 0) url += '?' + params.join('&');

    const history = await client.get(url);

    if (!history || history.length === 0) {
      console.log('\nNo research history found');
      return;
    }

    console.log(`\n📜 Research History (${history.length}):\n`);
    history.forEach(h => {
      const status = h.success ? '✅' : '❌';
      const improvement = h.fitnessImprovement >= 0 ? '+' : '';
      console.log(`  ${status} ${new Date(h.startedAt).toLocaleString()}`);
      console.log(`     Agent: ${h.agentName || h.agentId}`);
      console.log(`     Phase: ${h.finalPhase}`);
      console.log(`     Fitness: ${(h.initialFitness * 100).toFixed(1)}% → ${(h.finalFitness * 100).toFixed(1)}% (${improvement}${(h.fitnessImprovement * 100).toFixed(1)}%)`);
      console.log(`     Cycles: ${h.cyclesRun}, Iterations: ${h.totalIterations}`);
      if (h.publishedVersion) console.log(`     Published: v${h.publishedVersion}`);
      if (h.errorMessage) console.log(`     Error: ${h.errorMessage}`);
      console.log('');
    });
  } catch (error) {
    handleApiError(error, 'getting research history');
    process.exit(1);
  }
}

async function getResearchProposals(options) {
  try {
    let url = '/api/research/proposals';
    if (options.agent) url += `?agentId=${encodeURIComponent(options.agent)}`;

    const proposals = await client.get(url);

    if (!proposals || proposals.length === 0) {
      console.log('\nNo pending proposals found');
      return;
    }

    console.log(`\n📋 Pending Proposals (${proposals.length}):\n`);
    proposals.forEach(p => {
      const priority = { 'Low': '🟢', 'Medium': '🟡', 'High': '🟠', 'Critical': '🔴' }[p.priority] || '⚪';
      console.log(`  ${priority} ${p.title} [${p.id.substring(0, 8)}...]`);
      console.log(`     Agent: ${p.agentId}`);
      console.log(`     Type: ${p.type}`);
      console.log(`     Confidence: ${(p.confidence * 100).toFixed(0)}%`);
      console.log(`     Expected Improvement: +${(p.expectedImprovement * 100).toFixed(1)}%`);
      console.log(`     Description: ${p.description}`);
      console.log('');
    });
    console.log('  To approve: maestro research approve <proposal-id>');
    console.log('  To reject:  maestro research reject <proposal-id> --reason "..."');
    console.log('');
  } catch (error) {
    handleApiError(error, 'getting research proposals');
    process.exit(1);
  }
}

async function approveResearchProposal(proposalId, approvedBy) {
  try {
    await client.post(`/api/research/proposals/${encodeURIComponent(proposalId)}/approve`, {
      approvedBy
    });
    console.log(`\n✅ Proposal ${proposalId} approved\n`);
  } catch (error) {
    handleApiError(error, 'approving proposal');
    process.exit(1);
  }
}

async function rejectResearchProposal(proposalId, reason, rejectedBy) {
  try {
    await client.post(`/api/research/proposals/${encodeURIComponent(proposalId)}/reject`, {
      reason,
      rejectedBy
    });
    console.log(`\n✅ Proposal ${proposalId} rejected\n`);
  } catch (error) {
    handleApiError(error, 'rejecting proposal');
    process.exit(1);
  }
}

async function getResearchConfig() {
  try {
    const config = await client.get('/api/research/config');

    console.log('\n⚙️  Research Team Configuration:\n');
    console.log(`  Enabled:              ${config.enabled ? 'Yes' : 'No'}`);
    console.log(`  Fitness Threshold:    ${(config.fitnessThreshold * 100).toFixed(0)}%`);
    console.log(`  Default Iterations:   ${config.defaultMaxIterations}`);
    console.log(`  Default Max Cycles:   ${config.defaultMaxCycles}`);
    console.log(`  Auto-Approve:         ${config.autoApproveProposals ? 'Yes' : 'No'}`);
    if (config.autoApproveProposals) {
      console.log(`    Min Confidence:     ${(config.autoApproveMinConfidence * 100).toFixed(0)}%`);
    }
    console.log(`  Auto-Publish:         ${config.autoPublishOnSuccess ? 'Yes' : 'No'}`);
    console.log(`  Cycle Timeout:        ${config.cycleTimeout}`);
    if (config.priorityAgents?.length > 0) {
      console.log(`  Priority Agents:      ${config.priorityAgents.join(', ')}`);
    }
    if (config.excludedAgents?.length > 0) {
      console.log(`  Excluded Agents:      ${config.excludedAgents.join(', ')}`);
    }
    console.log('');
  } catch (error) {
    handleApiError(error, 'getting research config');
    process.exit(1);
  }
}

async function updateResearchConfig(options) {
  try {
    const update = {};
    if (options.enabled !== undefined) update.enabled = options.enabled;
    if (options.threshold !== undefined) update.fitnessThreshold = parseFloat(options.threshold);
    if (options.iterations !== undefined) update.defaultMaxIterations = parseInt(options.iterations);
    if (options.cycles !== undefined) update.defaultMaxCycles = parseInt(options.cycles);
    if (options.autoApprove !== undefined) update.autoApproveProposals = options.autoApprove;
    if (options.autoPublish !== undefined) update.autoPublishOnSuccess = options.autoPublish;
    if (options.timeout !== undefined) update.cycleTimeoutMinutes = parseInt(options.timeout);

    await client.put('/api/research/config', update);
    console.log('\n✅ Research configuration updated!\n');
    await getResearchConfig();
  } catch (error) {
    handleApiError(error, 'updating research config');
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

// ============= Experiment Commands (Phase 7 - Training Strategies) =============

async function listExperiments(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.workspace) params.append('workspaceId', options.workspace);
    if (options.status) params.append('status', options.status);
    if (options.agent) params.append('agentId', options.agent);
    if (options.strategy) params.append('strategyId', options.strategy);

    const experiments = await client.get(`/api/experiments?${params.toString()}`);
    if (!experiments || experiments.length === 0) {
      console.log('\nNo experiments found');
      console.log('  Create one with: maestro experiment create --name "Test" --workspace <ws-id> --agent <agent-id> --strategy system:strategy-sft');
      return;
    }

    console.log('\n🧪 Training Experiments:\n');
    console.table(experiments.map(e => ({
      'ID': e.id.substring(0, 12) + '...',
      'Name': e.name,
      'Status': e.status,
      'Strategy': e.strategyBlockId.replace('system:strategy-', ''),
      'Iteration': e.currentIteration,
      'Fitness': e.currentFitness.toFixed(3)
    })));
  } catch (error) {
    handleApiError(error, 'listing experiments');
    process.exit(1);
  }
}

async function getExperimentInfo(id) {
  try {
    const exp = await client.get(`/api/experiments/${encodeURIComponent(id)}`);
    console.log('\n🧪 Experiment Details:\n');
    console.log(`  ID:           ${exp.id}`);
    console.log(`  Name:         ${exp.name}`);
    console.log(`  Status:       ${exp.status}`);
    console.log(`  Workspace:    ${exp.workspaceId}`);
    console.log(`  Agent:        ${exp.targetAgentId}`);
    console.log(`  Strategy:     ${exp.strategyBlockId}`);
    console.log(`  Created:      ${exp.createdAt}`);
    console.log(`  Started:      ${exp.startedAt || 'N/A'}`);
    console.log(`  Completed:    ${exp.completedAt || 'N/A'}`);
    console.log('');
    console.log('  Progress:');
    console.log(`    Iteration:  ${exp.currentIteration}`);
    console.log(`    Fitness:    ${exp.currentFitness.toFixed(4)}`);

    if (exp.results) {
      console.log('');
      console.log('  Results:');
      console.log(`    Initial:    ${exp.results.initialFitness.toFixed(4)}`);
      console.log(`    Final:      ${exp.results.finalFitness.toFixed(4)}`);
      console.log(`    Improve:    ${exp.results.fitnessImprovementPercent.toFixed(1)}%`);
      console.log(`    Iterations: ${exp.results.totalIterations}`);
      console.log(`    Success:    ${(exp.results.successRate * 100).toFixed(1)}%`);
      console.log(`    Cost:       $${exp.results.totalCost.toFixed(4)}`);
      console.log(`    Duration:   ${exp.results.totalDuration}`);
      console.log(`    Stop:       ${exp.results.stopReason}`);
    }

    if (exp.error) {
      console.log('');
      console.log(`  Error:        ${exp.error}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Experiment not found: ${id}`);
    } else {
      handleApiError(error, 'getting experiment info');
    }
    process.exit(1);
  }
}

async function createExperiment(options) {
  try {
    if (!options.name) { console.error('❌ --name required'); process.exit(1); }
    if (!options.workspace) { console.error('❌ --workspace required'); process.exit(1); }
    if (!options.agent) { console.error('❌ --agent required'); process.exit(1); }
    if (!options.strategy) { console.error('❌ --strategy required'); process.exit(1); }

    let strategyId = options.strategy;
    if (!strategyId.includes(':')) {
      strategyId = `system:strategy-${strategyId}`;
    }

    const config = options.config ? JSON.parse(options.config) : undefined;

    const exp = await client.post('/api/experiments', {
      name: options.name,
      workspaceId: options.workspace,
      agentId: options.agent,
      strategyId: strategyId,
      config: config
    });

    console.log('\n✅ Experiment created!\n');
    console.log(`  ID:       ${exp.id}`);
    console.log(`  Name:     ${exp.name}`);
    console.log(`  Strategy: ${exp.strategyBlockId}`);
    console.log('');
    console.log('  Start with: maestro experiment start ' + exp.id);
    console.log('');
  } catch (error) {
    handleApiError(error, 'creating experiment');
    process.exit(1);
  }
}

async function startExperiment(id) {
  try {
    const exp = await client.post(`/api/experiments/${encodeURIComponent(id)}/start`);
    console.log(`\n✅ Experiment started: ${exp.name}`);
    console.log(`   Status: ${exp.status}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Experiment not found: ${id}`);
    } else {
      handleApiError(error, 'starting experiment');
    }
    process.exit(1);
  }
}

async function startAllExperiments(workspaceId, parallel = true) {
  try {
    const experiments = await client.get(`/api/experiments?workspaceId=${encodeURIComponent(workspaceId)}`);
    const toStart = experiments.filter(e => e.status === 'Created' || e.status === 'Paused');

    if (toStart.length === 0) {
      console.log('\nNo experiments to start in this workspace');
      return;
    }

    console.log(`\n🚀 Starting ${toStart.length} experiments ${parallel ? 'in parallel' : 'sequentially'}...\n`);

    for (const exp of toStart) {
      try {
        await client.post(`/api/experiments/${encodeURIComponent(exp.id)}/start`);
        console.log(`  ✅ ${exp.name}`);
      } catch (err) {
        console.log(`  ❌ ${exp.name}: ${err.message}`);
      }
    }
    console.log('');
  } catch (error) {
    handleApiError(error, 'starting experiments');
    process.exit(1);
  }
}

async function pauseExperiment(id) {
  try {
    const exp = await client.post(`/api/experiments/${encodeURIComponent(id)}/pause`);
    console.log(`\n⏸️  Experiment paused: ${exp.name}`);
    console.log(`   Status: ${exp.status}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Experiment not found: ${id}`);
    } else {
      handleApiError(error, 'pausing experiment');
    }
    process.exit(1);
  }
}

async function stopExperiment(id) {
  try {
    const exp = await client.post(`/api/experiments/${encodeURIComponent(id)}/stop`);
    console.log(`\n⏹️  Experiment stopped: ${exp.name}`);
    console.log(`   Status: ${exp.status}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Experiment not found: ${id}`);
    } else {
      handleApiError(error, 'stopping experiment');
    }
    process.exit(1);
  }
}

async function deleteExperiment(id, force = false) {
  try {
    if (!force) {
      console.log('⚠️  Use --force to confirm experiment deletion');
      process.exit(1);
    }

    await client.delete(`/api/experiments/${encodeURIComponent(id)}`);
    console.log(`\n✅ Experiment deleted: ${id}\n`);
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Experiment not found: ${id}`);
    } else {
      handleApiError(error, 'deleting experiment');
    }
    process.exit(1);
  }
}

async function getExperimentProgress(id) {
  try {
    const progress = await client.get(`/api/experiments/${encodeURIComponent(id)}/progress`);
    console.log('\n📊 Experiment Progress:\n');
    console.log(`  Status:      ${progress.status}`);
    console.log(`  Progress:    ${progress.progress}%`);
    console.log(`  Iteration:   ${progress.currentIteration} / ${progress.maxIterations}`);
    console.log(`  Fitness:     ${progress.currentFitness.toFixed(4)}`);
    if (progress.elapsedTime) {
      console.log(`  Elapsed:     ${progress.elapsedTime}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Experiment not found: ${id}`);
    } else {
      handleApiError(error, 'getting experiment progress');
    }
    process.exit(1);
  }
}

async function compareExperiments(ids) {
  try {
    const comparison = await client.post('/api/experiments/compare', { experimentIds: ids });

    console.log('\n📊 Experiment Comparison:\n');
    console.log(`  Best Experiment: ${comparison.bestExperimentId}`);
    console.log(`  Recommended:     ${comparison.recommendedStrategyId}`);
    console.log('');

    if (comparison.summary) {
      console.log('  Summary:');
      console.log(`    Best Fitness:     ${comparison.summary.bestFitness.toFixed(4)}`);
      console.log(`    Average Fitness:  ${comparison.summary.averageFitness.toFixed(4)}`);
      console.log(`    Total Iterations: ${comparison.summary.totalIterationsAcrossAll}`);
      console.log(`    Total Cost:       $${comparison.summary.totalCostAcrossAll.toFixed(4)}`);
      console.log('');
    }

    console.log('  Rankings:');
    Object.entries(comparison.rankings).forEach(([expId, rank]) => {
      console.log(`    ${expId.substring(0, 12)}... - Overall: #${rank.overallRank} (Fitness: #${rank.fitnessRank}, Cost: #${rank.costEfficiencyRank})`);
    });
    console.log('');
  } catch (error) {
    handleApiError(error, 'comparing experiments');
    process.exit(1);
  }
}

async function listStrategies(options = {}) {
  try {
    const params = options.category ? `?category=${options.category}` : '';
    const strategies = await client.get(`/api/experiments/strategies${params}`);

    if (!strategies || strategies.length === 0) {
      console.log('\nNo strategies found');
      return;
    }

    console.log('\n📋 Training Strategies:\n');
    strategies.forEach(s => {
      const icon = s.isSystem ? '🔒' : '📝';
      console.log(`  ${icon} ${s.name}`);
      console.log(`     ID:       ${s.id}`);
      console.log(`     Method:   ${s.method}`);
      console.log(`     Category: ${s.category}`);
      console.log(`     For:      ${s.suitableFor.join(', ')}`);
      if (s.estimatedResources) {
        console.log(`     Typical:  ${s.estimatedResources.typicalIterations} iterations`);
      }
      console.log('');
    });
  } catch (error) {
    handleApiError(error, 'listing strategies');
    process.exit(1);
  }
}

async function getStrategyInfo(id) {
  try {
    let strategyId = id;
    if (!strategyId.includes(':')) {
      strategyId = `system:strategy-${strategyId}`;
    }

    const strategy = await client.get(`/api/experiments/strategies/${encodeURIComponent(strategyId)}`);
    console.log('\n📋 Strategy Details:\n');
    console.log(`  ID:          ${strategy.id}`);
    console.log(`  Name:        ${strategy.name}`);
    console.log(`  Method:      ${strategy.method}`);
    console.log(`  Category:    ${strategy.category}`);
    console.log(`  System:      ${strategy.isSystem ? 'Yes' : 'No'}`);
    console.log(`  Overridable: ${strategy.isOverridable ? 'Yes' : 'No'}`);
    console.log('');
    console.log(`  Suitable For: ${strategy.suitableFor.join(', ')}`);
    console.log('');
    console.log('  Strengths:');
    strategy.strengths.forEach(s => console.log(`    ✅ ${s}`));
    console.log('');
    console.log('  Weaknesses:');
    strategy.weaknesses.forEach(w => console.log(`    ⚠️  ${w}`));
    console.log('');
    if (strategy.estimatedResources) {
      console.log('  Resources:');
      console.log(`    Min iterations:     ${strategy.estimatedResources.minIterations}`);
      console.log(`    Typical iterations: ${strategy.estimatedResources.typicalIterations}`);
      console.log(`    Max iterations:     ${strategy.estimatedResources.maxIterations}`);
      console.log(`    Cost per iteration: ${strategy.estimatedResources.costPerIteration}`);
      console.log('');
    }
  } catch (error) {
    if (error.status === 404) {
      console.error(`❌ Strategy not found: ${id}`);
    } else {
      handleApiError(error, 'getting strategy info');
    }
    process.exit(1);
  }
}

async function recommendStrategy(options) {
  try {
    if (!options.task) { console.error('❌ --task required (e.g., code, reasoning, classification)'); process.exit(1); }

    const strategies = await client.get('/api/experiments/strategies');
    const taskLower = options.task.toLowerCase();

    const recommended = strategies.filter(s =>
      s.suitableFor.some(t => t.toLowerCase().includes(taskLower))
    );

    if (recommended.length === 0) {
      console.log(`\n❓ No strategies specifically recommend for "${options.task}"`);
      console.log('   Consider: sft (general), rl-fitness (agentic), execution (code)');
      return;
    }

    console.log(`\n💡 Recommended Strategies for "${options.task}":\n`);
    recommended.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name}`);
      console.log(`     ID: ${s.id}`);
      console.log(`     Method: ${s.method}`);
      console.log(`     ✅ ${s.strengths[0]}`);
      console.log('');
    });
  } catch (error) {
    handleApiError(error, 'getting strategy recommendations');
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

System Block Commands:
  system               List all system blocks
  system info <id>     Show system block details
  system overrides     List user overrides
  system override <id> Create override for a system block
  system restore <id>  Restore system block to default
  system effective <id> Show effective block (with override if present)

Workspace Commands:
  workspace            List all workspaces
  workspace info <id>  Show workspace details
  workspace create     Create a new workspace
  workspace delete <id> Delete a workspace (--force required)
  workspace add-session <ws-id> <session-id>  Add session to workspace
  workspace add-project <ws-id> <project-id>  Add project to workspace
  workspace permissions <id>  Update workspace permissions
  workspace topology   Show workspace topology and promotion paths
  workspace promote <ws-id>   Promote an agent to another workspace

Orchestrator Commands:
  orchestrator         Show orchestrator status
  orchestrator status  Show orchestrator status
  orchestrator pending Show agents pending promotion
  orchestrator promote --agent <id> --from <ws> --to <ws> [--force]
  orchestrator rollback --agent <id> --workspace <ws> [--to-version <v>]
  orchestrator history [--workspace <ws>] [--agent <id>] [--limit <n>]
  orchestrator config  Show orchestrator configuration
  orchestrator config set --min-fitness <n> --from <ws> --to <ws>
  orchestrator auto-promote --enable|--disable
  orchestrator monitor Run monitoring cycle manually

Experiment Commands (Training Strategies):
  experiment           List all experiments
  experiment list      List experiments with filters
  experiment info <id> Show experiment details
  experiment create    Create a new experiment
  experiment start <id> Start an experiment
  experiment start-all Start all experiments in workspace
  experiment pause <id> Pause an experiment
  experiment stop <id>  Stop/cancel an experiment
  experiment delete <id> Delete an experiment (--force required)
  experiment progress <id> Show experiment progress
  experiment compare <ids...> Compare multiple experiments
  experiment strategies List available training strategies
  experiment strategy <id> Show strategy details
  experiment recommend Recommend strategy for task type

Research Team Commands:
  research             Show pending improvement proposals
  research start --agent <id> [--goal "..."] [--target 0.85]
  research status <cycle-id>   Get status of running cycle
  research stop <cycle-id>     Stop a running cycle
  research history [--agent <id>] [--limit <n>]
  research proposals [--agent <id>]
  research approve <proposal-id>
  research reject <proposal-id> --reason "..."
  research config      Show research team configuration
  research config set --threshold 0.85 --iterations 50

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
  maestro session create --project proj-123 --source sandbox                    # Default: isolated sandbox
  maestro session create --project proj-123 --source repository --repository-path /path/to/repo
  maestro session create --project proj-123 --source repository --repository-path ./app --access-level readonly
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

  # Orchestrator (Phase 5)
  maestro orchestrator                          # Show orchestrator status
  maestro orchestrator pending                  # Show agents pending promotion
  maestro orchestrator promote --agent agent-123 --from research --to staging
  maestro orchestrator promote --agent agent-123 --from staging --to production --force
  maestro orchestrator rollback --agent agent-123 --workspace production --to-version v1.0.0
  maestro orchestrator history --workspace staging --limit 10
  maestro orchestrator config                   # Show configuration
  maestro orchestrator config set --min-fitness 0.8
  maestro orchestrator auto-promote --enable    # Enable automatic promotions
  maestro orchestrator monitor                  # Run monitoring cycle manually

  # Research Team (Phase 6)
  maestro research                              # Show pending improvement proposals
  maestro research start --agent my-agent       # Start research cycle
  maestro research start --agent my-agent --target 0.9 --iterations 100
  maestro research start --agent my-agent --goal "Improve response quality" --auto-publish
  maestro research status cycle-123             # Check cycle status
  maestro research stop cycle-123               # Stop a running cycle
  maestro research history --agent my-agent     # View research history
  maestro research proposals                    # View pending proposals
  maestro research approve proposal-123         # Approve an improvement
  maestro research reject proposal-123 --reason "Not aligned with goals"
  maestro research config                       # Show configuration
  maestro research config set --threshold 0.85 --auto-approve

  # Experiments (Phase 7 - Training Strategies)
  maestro experiment                              # List all experiments
  maestro experiment strategies                   # List available strategies
  maestro experiment strategy sft                 # Show SFT strategy details
  maestro experiment recommend --task code        # Recommend strategies for task type
  maestro experiment create --name "Test SFT" --workspace ws-123 --agent agent-1 --strategy sft
  maestro experiment create --name "Test RL" --workspace ws-123 --agent agent-1 --strategy rl-fitness
  maestro experiment start exp-123                # Start single experiment
  maestro experiment start-all --workspace ws-123 # Start all in workspace
  maestro experiment progress exp-123             # Check progress
  maestro experiment compare exp-1 exp-2 exp-3    # Compare results
  maestro experiment info exp-123                 # Show full details
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
          timeout: argv.timeout,
          // Phase 4: Session source options
          source: argv.source,
          repositoryPath: argv['repository-path'],
          accessLevel: argv['access-level'],
          branch: argv.branch,
          excludePatterns: argv['exclude-patterns']
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

    // System block commands
    if (cmd === 'system') {
      const subCmd = argv._[1];

      if (!subCmd) return await listSystemBlocks();

      if (subCmd === 'info') {
        const blockId = argv._[2];
        if (!blockId) { console.error('❌ Block ID required'); process.exit(1); }
        return await getSystemBlockInfo(blockId);
      }

      if (subCmd === 'overrides') {
        return await listUserOverrides();
      }

      if (subCmd === 'override') {
        const blockId = argv._[2];
        if (!blockId) { console.error('❌ Block ID required'); process.exit(1); }
        return await createSystemBlockOverride(blockId, argv.config);
      }

      if (subCmd === 'restore') {
        const blockId = argv._[2];
        if (!blockId) { console.error('❌ Block ID required'); process.exit(1); }
        return await restoreSystemBlock(blockId);
      }

      if (subCmd === 'effective') {
        const blockId = argv._[2];
        if (!blockId) { console.error('❌ Block ID required'); process.exit(1); }
        return await getEffectiveBlock(blockId);
      }

      console.error(`❌ Unknown system subcommand: ${subCmd}`);
      console.error('   Available commands: info, overrides, override, restore, effective');
      process.exit(1);
    }

    // Workspace commands
    if (cmd === 'workspace') {
      const subCmd = argv._[1];

      if (!subCmd) return await listWorkspaces();

      if (subCmd === 'info') {
        const workspaceId = argv._[2];
        if (!workspaceId) { console.error('❌ Workspace ID required'); process.exit(1); }
        return await getWorkspaceInfo(workspaceId);
      }

      if (subCmd === 'create') {
        const name = argv._[2] || argv.name;
        if (!name) { console.error('❌ Workspace name required'); process.exit(1); }
        return await createWorkspace(name, {
          type: argv.type,
          description: argv.description,
          isolated: argv.isolated
        });
      }

      if (subCmd === 'delete') {
        const workspaceId = argv._[2];
        if (!workspaceId) { console.error('❌ Workspace ID required'); process.exit(1); }
        return await deleteWorkspace(workspaceId);
      }

      if (subCmd === 'add-session') {
        const workspaceId = argv._[2];
        const sessionId = argv._[3] || argv.session;
        if (!workspaceId) { console.error('❌ Workspace ID required'); process.exit(1); }
        if (!sessionId) { console.error('❌ Session ID required (--session or as argument)'); process.exit(1); }
        return await addSessionToWorkspace(workspaceId, sessionId);
      }

      if (subCmd === 'add-project') {
        const workspaceId = argv._[2];
        const projectId = argv._[3] || argv.project;
        if (!workspaceId) { console.error('❌ Workspace ID required'); process.exit(1); }
        if (!projectId) { console.error('❌ Project ID required (--project or as argument)'); process.exit(1); }
        return await addProjectToWorkspace(workspaceId, projectId);
      }

      if (subCmd === 'permissions') {
        const workspaceId = argv._[2];
        if (!workspaceId) { console.error('❌ Workspace ID required'); process.exit(1); }
        return await updateWorkspacePermissions(workspaceId, {
          canReadFrom: argv['read-from'] ? argv['read-from'].split(',') : undefined,
          canWriteTo: argv['write-to'] ? argv['write-to'].split(',') : undefined,
          canPromoteTo: argv['promote-to'] ? argv['promote-to'].split(',') : undefined
        });
      }

      if (subCmd === 'topology') {
        return await getWorkspaceTopology();
      }

      if (subCmd === 'promote') {
        const sourceId = argv.source || argv._[2];
        const targetId = argv.target || argv._[3];
        const agentId = argv.agent || argv._[4];
        if (!sourceId) { console.error('❌ Source workspace ID required (--source)'); process.exit(1); }
        if (!targetId) { console.error('❌ Target workspace ID required (--target)'); process.exit(1); }
        if (!agentId) { console.error('❌ Agent block ID required (--agent)'); process.exit(1); }
        return await promoteAgent(sourceId, targetId, agentId, argv.version);
      }

      console.error(`❌ Unknown workspace subcommand: ${subCmd}`);
      console.error('   Available commands: info, create, delete, add-session, add-project, permissions, topology, promote');
      process.exit(1);
    }

    // Orchestrator commands (Phase 5)
    if (cmd === 'orchestrator') {
      const subCmd = argv._[1];

      if (!subCmd) return await getOrchestratorStatus();

      if (subCmd === 'status') {
        return await getOrchestratorStatus();
      }

      if (subCmd === 'pending') {
        return await getOrchestratorPending();
      }

      if (subCmd === 'promote') {
        return await orchestratorPromote({
          agent: argv.agent || argv._[2],
          from: argv.from,
          to: argv.to,
          force: argv.force
        });
      }

      if (subCmd === 'rollback') {
        return await orchestratorRollback({
          agent: argv.agent || argv._[2],
          workspace: argv.workspace,
          version: argv.version || argv['to-version']
        });
      }

      if (subCmd === 'history') {
        return await getOrchestratorHistory({
          workspace: argv.workspace,
          agent: argv.agent,
          limit: argv.limit ? parseInt(argv.limit) : 20
        });
      }

      if (subCmd === 'config') {
        if (argv.set || argv['min-fitness'] || argv.interval) {
          return await updateOrchestratorConfig({
            minFitness: argv['min-fitness'],
            minFitnessProduction: argv['min-fitness-production'],
            interval: argv.interval,
            fitnessDropThreshold: argv['fitness-drop-threshold'],
            errorRateThreshold: argv['error-rate-threshold']
          });
        }
        return await getOrchestratorConfig();
      }

      if (subCmd === 'auto-promote') {
        const enabled = argv.enable || argv._[2] === 'enable';
        const disabled = argv.disable || argv._[2] === 'disable';
        if (!enabled && !disabled) {
          console.error('❌ Specify --enable or --disable');
          process.exit(1);
        }
        return await setOrchestratorAutoPromote(!disabled);
      }

      if (subCmd === 'monitor' || subCmd === 'run') {
        return await runOrchestratorMonitor();
      }

      if (subCmd === 'metrics') {
        const agentId = argv.agent || argv._[2];
        if (!agentId) { console.error('❌ Agent ID required'); process.exit(1); }
        // TODO: Implement agent-specific metrics
        console.log(`\n📊 Metrics for agent: ${agentId}\n`);
        console.log('  (Not yet implemented)');
        return;
      }

      console.error(`❌ Unknown orchestrator subcommand: ${subCmd}`);
      console.error('   Available commands: status, pending, promote, rollback, history, config, auto-promote, monitor, metrics');
      process.exit(1);
    }

    // Research team commands (Phase 6)
    if (cmd === 'research') {
      const subCmd = argv._[1];

      if (!subCmd) return await getResearchProposals({});

      if (subCmd === 'start' || subCmd === 'cycle') {
        return await startResearchCycle({
          agent: argv.agent || argv._[2],
          goal: argv.goal,
          target: argv.target,
          iterations: argv.iterations,
          cycles: argv.cycles,
          publish: argv.publish || argv['auto-publish'],
          workspace: argv.workspace
        });
      }

      if (subCmd === 'status') {
        const cycleId = argv._[2] || argv.cycle;
        if (!cycleId) { console.error('❌ Cycle ID required'); process.exit(1); }
        return await getResearchCycleStatus(cycleId);
      }

      if (subCmd === 'stop') {
        const cycleId = argv._[2] || argv.cycle;
        if (!cycleId) { console.error('❌ Cycle ID required'); process.exit(1); }
        return await stopResearchCycle(cycleId);
      }

      if (subCmd === 'history') {
        return await getResearchHistory({
          agent: argv.agent,
          limit: argv.limit ? parseInt(argv.limit) : 20
        });
      }

      if (subCmd === 'proposals') {
        return await getResearchProposals({ agent: argv.agent });
      }

      if (subCmd === 'approve') {
        const proposalId = argv._[2] || argv.proposal;
        if (!proposalId) { console.error('❌ Proposal ID required'); process.exit(1); }
        return await approveResearchProposal(proposalId, argv.by);
      }

      if (subCmd === 'reject') {
        const proposalId = argv._[2] || argv.proposal;
        const reason = argv.reason;
        if (!proposalId) { console.error('❌ Proposal ID required'); process.exit(1); }
        if (!reason) { console.error('❌ --reason is required'); process.exit(1); }
        return await rejectResearchProposal(proposalId, reason, argv.by);
      }

      if (subCmd === 'config') {
        if (argv.set || argv.threshold || argv.iterations || argv.cycles) {
          return await updateResearchConfig({
            enabled: argv.enabled,
            threshold: argv.threshold,
            iterations: argv.iterations,
            cycles: argv.cycles,
            autoApprove: argv['auto-approve'],
            autoPublish: argv['auto-publish'],
            timeout: argv.timeout
          });
        }
        return await getResearchConfig();
      }

      console.error(`❌ Unknown research subcommand: ${subCmd}`);
      console.error('   Available commands: start, status, stop, history, proposals, approve, reject, config');
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

    // Experiment commands (Phase 7 - Training Strategies)
    if (cmd === 'experiment' || cmd === 'experiments') {
      const subCmd = argv._[1];

      if (!subCmd) return await listExperiments({});

      if (subCmd === 'list') {
        return await listExperiments({
          workspace: argv.workspace || argv.w,
          status: argv.status || argv.s,
          agent: argv.agent || argv.a,
          strategy: argv.strategy
        });
      }

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('❌ Experiment ID required'); process.exit(1); }
        return await getExperimentInfo(id);
      }

      if (subCmd === 'create') {
        return await createExperiment({
          name: argv.name || argv.n,
          workspace: argv.workspace || argv.w,
          agent: argv.agent || argv.a,
          strategy: argv.strategy || argv.s,
          config: argv.config
        });
      }

      if (subCmd === 'start') {
        const id = argv._[2];
        if (!id) { console.error('❌ Experiment ID required'); process.exit(1); }
        return await startExperiment(id);
      }

      if (subCmd === 'start-all') {
        const workspaceId = argv.workspace || argv.w || argv._[2];
        if (!workspaceId) { console.error('❌ Workspace ID required (--workspace)'); process.exit(1); }
        return await startAllExperiments(workspaceId, !argv.sequential);
      }

      if (subCmd === 'pause') {
        const id = argv._[2];
        if (!id) { console.error('❌ Experiment ID required'); process.exit(1); }
        return await pauseExperiment(id);
      }

      if (subCmd === 'stop') {
        const id = argv._[2];
        if (!id) { console.error('❌ Experiment ID required'); process.exit(1); }
        return await stopExperiment(id);
      }

      if (subCmd === 'delete') {
        const id = argv._[2];
        if (!id) { console.error('❌ Experiment ID required'); process.exit(1); }
        return await deleteExperiment(id, argv.force);
      }

      if (subCmd === 'progress') {
        const id = argv._[2];
        if (!id) { console.error('❌ Experiment ID required'); process.exit(1); }
        return await getExperimentProgress(id);
      }

      if (subCmd === 'compare') {
        const ids = argv._.slice(2);
        if (ids.length < 2) { console.error('❌ At least 2 experiment IDs required'); process.exit(1); }
        return await compareExperiments(ids);
      }

      if (subCmd === 'strategies') {
        return await listStrategies({
          category: argv.category || argv.c
        });
      }

      if (subCmd === 'strategy') {
        const id = argv._[2];
        if (!id) { console.error('❌ Strategy ID required'); process.exit(1); }
        return await getStrategyInfo(id);
      }

      if (subCmd === 'recommend') {
        return await recommendStrategy({
          agent: argv.agent || argv.a,
          task: argv.task || argv.t
        });
      }

      console.error(`❌ Unknown experiment subcommand: ${subCmd}`);
      console.error('   Available: list, info, create, start, start-all, pause, stop, delete, progress, compare, strategies, strategy, recommend');
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
