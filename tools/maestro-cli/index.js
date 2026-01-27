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

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['mock', 'help', 'h', 'force', 'status'],
    string: ['api-url', 'u', 'name', 'path', 'description', 'runtime', 'image', 'work-dir', 'block-paths', 'model', 'lines', 'since']
  });

  // Update client URL if provided
  if (argv['api-url'] || argv.u) {
    client.baseUrl = (argv['api-url'] || argv.u).replace(/\/$/, '');
  }

  const cmd = argv._[0];
  
  // Help
  if (!cmd || argv.help || argv.h) {
    console.log(`
Maestro CLI v1.2.0

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
  execute <workflow>   Execute a workflow (requires --mock for PoC)
  validate <workflow>  Validate workflow structure

System Commands:
  health               Check backend connection

Options:
  --api-url <url>      Backend API URL (default: http://localhost:5000)
  -u <url>             Shorthand for --api-url
  --mock               Use mock execution (for workflows)
  --input <key=value>  Input parameters for workflow (can be repeated)
  --help, -h           Show this help message

Project Create Options:
  --name <name>        Project name (required for create, optional for bind)
  --path <path>        Project root path (required)
  --description <desc> Project description
  --runtime <type>     Runtime type: none, docker, process
  --image <image>      Docker image (if runtime=docker)
  --model <model>      Default model for agents
  --block-paths <paths> Comma-separated block search paths

Project Bind Options:
  --path <path>        Existing directory to bind (required)
  --name <name>        Project name (defaults to directory name)
  --description <desc> Project description
  --model <model>      Default model for LLM operations

Container Log Options:
  --lines <n>          Number of log lines to show (default: 100)
  --since <time>       Show logs since timestamp (e.g., 2024-01-01T00:00:00Z)

Environment Variables:
  MAESTRO_API_URL      Backend API URL (default: http://localhost:5000)
  MAESTRO_API_TIMEOUT  API request timeout in ms (default: 30000)
  MAESTRO_DEBUG        Enable debug logging (true/false)

Examples:
  maestro blocks
  maestro workflows
  maestro projects
  maestro projects create --name "My App" --path ./my-app --runtime docker
  maestro projects bind --path ./existing-repo --name "My Repo"
  maestro projects start abc123
  maestro projects stop abc123
  maestro projects logs abc123 --lines 50
  maestro projects status abc123
  maestro search agent
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
      if (argv.mock) runMockWorkflow(wf, inputs);
      else {
        console.error('❌ Only --mock execution is supported by this CLI PoC');
        process.exit(1);
      }
      return;
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
