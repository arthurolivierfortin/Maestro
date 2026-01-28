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
    boolean: ['mock', 'help', 'h', 'force', 'status'],
    string: ['api-url', 'u', 'name', 'path', 'description', 'runtime', 'image', 'work-dir', 'block-paths', 'model', 'lines', 'since', 'working-dir', 'workdir', 'workflow', 'iterations', 'parallel', 'delay', 'goal', 'tags', 'inputs', 'config', 'from', 'to', 'limit']
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

Metrics Commands:
  metrics              List recent execution metrics
  metrics summary      Show aggregated metrics summary
  runs                 List execution history
  runs info <id>       Show run details

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

Training Create Options:
  --name <name>        Configuration name (required)
  --workflow <id>      Workflow ID to train (required)
  --iterations <n>     Number of iterations (default: 10)
  --parallel <n>       Parallel iterations (default: 1)
  --delay <ms>         Delay between iterations in ms (default: 0)
  --goal <goal>        Optimization goal: quality, cost, speed (default: quality)
  --tags <tags>        Comma-separated tags

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
  maestro metrics summary
  maestro runs --limit 10
  maestro llm
  maestro health
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

    console.error(`❌ Unknown command: ${cmd}`);
    console.error('   Run "maestro --help" for usage information');
    process.exit(1);
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();
