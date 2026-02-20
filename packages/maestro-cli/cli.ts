// @ts-nocheck
// CLI entry point — loaded by index.js shim via tsx
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { MaestroApiClient, ApiError } = require('./api-client.js');
const { OutputFormatter, formatDate, suggestCommand } = require('./output-formatter.ts');
const { JsonInputParser } = require('./json-parser.ts');
const c = require('./utils/cli-colors.ts');

// Configuration (Phase 20: config.ts provides getBackendUrl/getApiKey)
const { getBackendUrl, getApiKey } = require('./config.ts');
const API_URL = getBackendUrl();
const DEBUG = process.env.MAESTRO_DEBUG === 'true';

const client = new MaestroApiClient(API_URL, { debug: DEBUG, apiKey: getApiKey() });

// Module-level formatter — set to JSON mode in main() when --json is used
let formatter = new OutputFormatter(false);

// Exit code constants (P2 item 17)
const EXIT = { OK: 0, USER_ERROR: 1, NOT_FOUND: 2, SERVER_ERROR: 3, TIMEOUT: 4 };

/**
 * Resolve a short ID prefix to a full ID by querying the relevant resource list.
 * Supports session, project, workspace, and other resource types.
 * If the ID is already a full UUID (36 chars), returns it as-is.
 */
async function resolveId(shortId, resourceType = 'session') {
  if (!shortId) return shortId;
  // If already a full UUID, return as-is
  if (shortId.length >= 32) return shortId;

  try {
    let items = [];
    if (resourceType === 'session') {
      items = await client.listSessions();
    } else if (resourceType === 'project') {
      items = await client.listProjects();
    } else if (resourceType === 'workspace') {
      items = await client._fetch('GET', '/api/workspaces');
    }

    const matches = items.filter(item => item.id.startsWith(shortId));
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) {
      formatter.error(`Ambiguous ID prefix '${shortId}' — matches ${matches.length} ${resourceType}s. Use more characters.`, 'AMBIGUOUS_ID');
      process.exit(EXIT.USER_ERROR);
    }
    // No match by prefix — return original (let the API return 404)
    return shortId;
  } catch (e) {
    // If list fails, return original and let specific API call handle error
    return shortId;
  }
}

/**
 * List available session templates by scanning the template directory.
 */
function listAvailableTemplates() {
  const templateDir = path.join(__dirname, '../../content/system/templates/sessions');
  try {
    return fs.readdirSync(templateDir)
      .filter(f => f.endsWith('.session.json'))
      .map(f => f.replace('.session.json', ''));
  } catch (e) {
    return [];
  }
}

/**
 * Logs a command to the session's command history variable.
 * This allows the TUI monitor to display commands in real-time.
 */
async function logSessionCommand(sessionId, command, result = null, status = 'completed') {
  try {
    // Get current command log
    const session = await client.getSession(sessionId);
    const currentLog = session.variables?._commandLog || [];

    // Add new command entry
    const entry = {
      timestamp: new Date().toISOString(),
      command: command,
      result: result,
      status: status
    };

    // Keep only last 50 commands
    const newLog = [...currentLog, entry].slice(-50);

    // Save back to session
    await client._fetch('PUT', `/api/sessions/${sessionId}/variables/_commandLog`, {
      body: { value: newLog }
    });
  } catch (e) {
    // Silently fail - logging shouldn't break the main command
    if (DEBUG) console.error('Command logging failed:', e.message);
  }
}

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch(e) { return null; }
}

// Content path helper
function getContentPath(scope = 'user') {
  const root = path.resolve(__dirname, '../..');
  return path.join(root, 'content', scope);
}

// New API-based functions

async function listBlocks(filter: any = {}) {
  try {
    let blocks = await client.listBlocks(filter);
    if (!blocks || blocks.length === 0) {
      const filterDesc = filter.designation ? ` (designation: ${filter.designation})` : filter.type ? ` (type: ${filter.type})` : '';
      console.log(c.gray(`\nNo blocks found${filterDesc}`));
      return;
    }

    // Sort
    if (filter.sort) {
      const sortKey = filter.sort.toLowerCase();
      blocks.sort((a, b) => {
        if (sortKey === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sortKey === 'type') return (a.blockType || '').localeCompare(b.blockType || '');
        if (sortKey === 'score') return (b.metrics?.overallScore || 0) - (a.metrics?.overallScore || 0);
        if (sortKey === 'runs') return (b.metrics?.totalRuns || 0) - (a.metrics?.totalRuns || 0);
        return 0;
      });
    }

    const total = blocks.length;
    const limit = filter.limit || 25;
    if (blocks.length > limit) blocks = blocks.slice(0, limit);

    const label = filter.designation
      ? filter.designation.charAt(0).toUpperCase() + filter.designation.slice(1) + 's'
      : filter.type
        ? filter.type + 's'
        : 'Blocks';

    const countLabel = total > limit ? `showing ${limit} of ${total}` : `${total}`;
    console.log('\n' + c.bold(`${label}:`) + c.gray(` (${countLabel})`) + '\n');
    formatter.table(blocks.map(b => ({
      'ID': b.id,
      'Name': b.name,
      'Type': b.blockType,
      'Designation': b.designation || '—',
      'Category': b.category || '—',
      'Version': b.version,
      'Score': b.metrics?.overallScore?.toFixed(1) || '—',
      'Runs': b.metrics?.totalRuns || 0,
    })), null, { hideEmpty: true });
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      console.error(c.fail(`Cannot connect to backend at ${API_URL}`));
      console.error(c.gray('   Make sure the backend is running:'));
      console.error(c.gray('   $ dotnet run --project backend/src/Maestro.Api'));
    } else if (error.status === 404) {
      console.error(c.fail('Backend API not found. Wrong API URL?'));
    } else {
      console.error(c.fail(`Error listing blocks: ${error.message}`));
    }
    process.exit(1);
  }
}

// ============= Interactive Tables (Phase 33-B-D) =============

async function launchInteractiveBlocksTable(filter: any = {}) {
  // TTY check: fall back to text mode if not interactive
  if (!process.stdout.isTTY) {
    return await listBlocks(filter);
  }
  try {
    const blocks = await client.listBlocks(filter);
    if (!blocks || blocks.length === 0) {
      console.log(c.gray('\nNo blocks found'));
      return;
    }
    const rows = blocks.map(b => ({
      ID: b.id,
      Name: b.name,
      Type: b.blockType,
      Designation: b.designation || '—',
      Category: b.category || '—',
      Version: b.version,
      Score: b.metrics?.overallScore?.toFixed(1) || '—',
    }));
    const columns = [
      { key: 'ID', label: 'ID', width: 30 },
      { key: 'Name', label: 'Name', width: 30 },
      { key: 'Type', label: 'Type', width: 10 },
      { key: 'Designation', label: 'Designation', width: 12 },
      { key: 'Category', label: 'Category', width: 14 },
      { key: 'Version', label: 'Version', width: 8 },
      { key: 'Score', label: 'Score', width: 6, align: 'right' as const },
    ];
    const { launchInkTable } = require('@maestro/code/ink-table-launcher.ts');
    await launchInkTable({ title: 'Blocks', columns, rows });
  } catch (error) {
    console.error(c.fail(`Error: ${error.message}`));
    process.exit(1);
  }
}

async function launchInteractiveSessionsTable() {
  if (!process.stdout.isTTY) {
    return await listSessions();
  }
  try {
    const sessions = await client.listSessions();
    if (!sessions || sessions.length === 0) {
      console.log(c.gray('\nNo sessions found'));
      return;
    }
    const rows = sessions.map(s => ({
      ID: s.id.substring(0, 12) + '...',
      Name: s.name || '—',
      Status: s.status,
      Authority: s.authority || 'human',
      Created: formatDate(s.createdAt),
    }));
    const columns = [
      { key: 'ID', label: 'ID', width: 16 },
      { key: 'Name', label: 'Name', width: 45 },
      { key: 'Status', label: 'Status', width: 10 },
      { key: 'Authority', label: 'Authority', width: 10 },
      { key: 'Created', label: 'Created', width: 14 },
    ];
    const { launchInkTable } = require('@maestro/code/ink-table-launcher.ts');
    await launchInkTable({ title: 'Sessions', columns, rows });
  } catch (error) {
    console.error(c.fail(`Error: ${error.message}`));
    process.exit(1);
  }
}

async function getBlockMetricsCmd(id) {
  try {
    const metrics = await client.getBlockMetrics(id);
    console.log('\n' + c.bold('Block Metrics:') + '\n');
    console.log(`  ${c.gray('Total Runs:')}       ${metrics.totalRuns || 0}`);
    console.log(`  ${c.gray('Successful:')}       ${metrics.successfulRuns || 0}`);
    console.log(`  ${c.gray('Failed:')}           ${metrics.failedRuns || 0}`);
    console.log(`  ${c.gray('Success Rate:')}     ${metrics.successRate?.toFixed(1) || 0}%`);
    console.log(`  ${c.gray('Avg Exec Time:')}    ${metrics.avgExecutionTimeMs?.toFixed(0) || 0}ms`);
    console.log(`  ${c.gray('Avg Token Cost:')}   ${metrics.avgTokenCost?.toFixed(0) || 0}`);
    console.log(`  ${c.gray('Avg Score:')}        ${metrics.avgScore?.toFixed(1) || 0}`);
    console.log(`  ${c.gray('Overall Score:')}    ${metrics.overallScore?.toFixed(1) || 0}`);
    if (metrics.lastRunAt) {
      console.log(`  ${c.gray('Last Run:')}         ${new Date(metrics.lastRunAt).toLocaleString()}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(c.fail(`Block not found: ${id}`));
    } else {
      handleApiError(error, 'getting block metrics');
    }
    process.exit(1);
  }
}

async function getTopBlocksCmd(options: any = {}) {
  try {
    const blocks = await client.getTopBlocks(options);
    if (!blocks || blocks.length === 0) {
      console.log(c.gray('\nNo blocks with scores found'));
      return;
    }
    const label = options.designation
      ? `Top ${options.designation.charAt(0).toUpperCase() + options.designation.slice(1)}s`
      : 'Top Blocks';
    console.log('\n' + c.bold(`${label}:`) + c.gray(` (${blocks.length})`) + '\n');
    formatter.table(blocks.map(b => ({
      'ID': b.id,
      'Name': b.name,
      'Type': b.blockType,
      'Score': b.metrics?.overallScore?.toFixed(1) || '-',
      'Runs': b.metrics?.totalRuns || 0,
      'Success': b.metrics?.successRate ? `${b.metrics.successRate.toFixed(0)}%` : '-',
    })), null, { hideEmpty: true });
  } catch (error) {
    handleApiError(error, 'getting top blocks');
    process.exit(1);
  }
}

async function designateBlockCmd(id, designation) {
  try {
    await client.designateBlock(id, designation);
    console.log(c.ok(`Block '${id}' designated as '${designation}'`));
  } catch (error) {
    if (error.status === 404) {
      console.error(c.fail(`Block not found: ${id}`));
    } else {
      handleApiError(error, 'designating block');
    }
    process.exit(1);
  }
}

// ── Phase 26: Block CRUD commands ──

async function createBlockCmd(options) {
  const { name, type, description, tags, designation, category, config } = options;
  try {
    const body: any = {
      name,
      blockType: type,
      description: description || '',
      tags: tags ? tags.split(',').map((t: string) => t.trim()) : [],
    };
    if (config) {
      body.config = JSON.parse(config);
    }
    const result = await client.createBlock(body);
    console.log(c.ok(`Block created: ${result.id}`));
    console.log(`  ${c.gray('Name:')}  ${result.name}`);
    console.log(`  ${c.gray('Type:')}  ${result.blockType}`);
    if (result.path) console.log(`  ${c.gray('Path:')}  ${result.path}`);

    // Set designation if provided
    if (designation) {
      await client.designateBlock(result.id, designation);
      console.log(`  ${c.gray('Designation:')}  ${designation}`);
    }
    // Set category if provided (via designate endpoint)
    if (category && !designation) {
      await client.designateBlock(result.id, 'none');
    }
  } catch (error) {
    if (error.status === 409) {
      formatter.error(`Block already exists with that name`, 'CONFLICT');
      process.exitCode = EXIT.USER_ERROR;
    } else {
      handleApiError(error, 'creating block');
    }
  }
}

async function updateBlockCmd(id, options) {
  try {
    const body: any = {};
    if (options.name) body.name = options.name;
    if (options.description) body.description = options.description;
    if (options.tags) body.tags = options.tags.split(',').map((t: string) => t.trim());
    if (options.config) body.config = JSON.parse(options.config);
    const result = await client.updateBlock(id, body);
    console.log(c.ok(`Block '${id}' updated`));
    if (result.name) console.log(`  ${c.gray('Name:')}  ${result.name}`);
    if (result.blockType) console.log(`  ${c.gray('Type:')}  ${result.blockType}`);
  } catch (error) {
    if (error.status === 404) {
      formatter.error(`Block not found: ${id}`, 'NOT_FOUND');
      process.exitCode = EXIT.NOT_FOUND;
    } else {
      handleApiError(error, 'updating block');
    }
  }
}

async function deleteBlockCmd(id, force) {
  if (!force) {
    console.error(c.fail('Use --force to confirm deletion'));
    process.exitCode = EXIT.USER_ERROR;
    return;
  }
  try {
    await client.deleteBlock(id);
    console.log(c.ok(`Block '${id}' deleted`));
  } catch (error) {
    if (error.status === 404) {
      formatter.error(`Block not found: ${id}`, 'NOT_FOUND');
      process.exitCode = EXIT.NOT_FOUND;
    } else {
      handleApiError(error, 'deleting block');
    }
  }
}

async function getBlockContentCmd(id, filePath) {
  try {
    const content = await client.getBlockContent(id, filePath);
    // Raw output — no decoration so it can be piped
    process.stdout.write(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  } catch (error) {
    if (error.status === 404) {
      formatter.error(`Block or file not found: ${id}/${filePath}`, 'NOT_FOUND');
      process.exitCode = EXIT.NOT_FOUND;
    } else {
      handleApiError(error, 'reading block content');
    }
  }
}

async function setBlockContentCmd(id, filePath, content) {
  try {
    await client.updateBlockContent(id, filePath, content);
    console.log(c.ok(`Written to ${id}/${filePath}`));
  } catch (error) {
    if (error.status === 404) {
      formatter.error(`Block not found: ${id}`, 'NOT_FOUND');
      process.exitCode = EXIT.NOT_FOUND;
    } else {
      handleApiError(error, 'writing block content');
    }
  }
}

async function listWorkflows() {
  return await listBlocks({ type: 'Workflow' });
}

async function getBlockInfo(id) {
  try {
    const block = await client.getBlock(id);
    console.log('\n' + c.bold('Block Details:') + '\n');
    console.log(`  ${c.gray('ID:')}           ${block.id}`);
    console.log(`  ${c.gray('Name:')}         ${block.name}`);
    console.log(`  ${c.gray('Type:')}         ${c.color(require('./utils/status.ts').typeBadgeColorMap[block.blockType?.toLowerCase()] || 'white', block.blockType)}`);
    if (block.designation) {
      console.log(`  ${c.gray('Designation:')}  ${block.designation}`);
    }
    console.log(`  ${c.gray('Version:')}      ${block.version}`);
    console.log(`  ${c.gray('Description:')}  ${block.description || 'N/A'}`);
    if (block.category) {
      console.log(`  ${c.gray('Category:')}    ${block.category}`);
    }
    if (block.author) {
      console.log(`  ${c.gray('Author:')}      ${block.author}`);
    }
    console.log(`  ${c.gray('Capabilities:')} ${block.capabilities?.join(', ') || 'None'}`);
    if (block.tags && block.tags.length > 0) {
      console.log(`  ${c.gray('Tags:')}         ${block.tags.join(', ')}`);
    }
    console.log(`  ${c.gray('Created:')}      ${block.createdAt}`);

    // Phase 18: Show metrics if available
    if (block.metrics && block.metrics.totalRuns > 0) {
      console.log('\n  ' + c.bold('Metrics:'));
      console.log(`    ${c.gray('Total Runs:')}     ${block.metrics.totalRuns}`);
      console.log(`    ${c.gray('Success Rate:')}   ${block.metrics.successRate?.toFixed(1) || 0}%`);
      console.log(`    ${c.gray('Overall Score:')}  ${block.metrics.overallScore?.toFixed(1) || 0}`);
      if (block.metrics.lastRunAt) {
        console.log(`    ${c.gray('Last Run:')}       ${new Date(block.metrics.lastRunAt).toLocaleString()}`);
      }
    }

    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(c.fail(`Block not found: ${id}`));
    } else {
      console.error(c.fail(`Error retrieving block: ${error.message}`));
    }
    process.exit(1);
  }
}

async function getBlockChildren(id, recursive = true) {
  try {
    const result = await client.getBlockChildren(id, recursive);

    if (result.isAtomic) {
      console.log(`\nBlock '${id}' is atomic (no children)\n`);
      return;
    }

    console.log(`\nBlock '${id}' Children (${recursive ? 'recursive' : 'direct only'}):\n`);
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
          child.children.forEach(ch => formatChild(ch, indent + '  '));
        }
      };

      result.children.forEach(child => formatChild(child, '  '));
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Block not found: ${id}`);
    } else {
      console.error(`Error retrieving block children: ${error.message}`);
    }
    process.exit(1);
  }
}

async function checkHealth(options = {}) {
  formatter.setCommand('health');
  try {
    const health = await client.getHealth();
    const svcStr = Object.entries(health.services || {}).map(([k, v]) => {
      const col = v === 'ok' || v === 'healthy' ? c.green : c.yellow;
      return `${k}=${col(v)}`;
    }).join(', ');
    // Always check LLM and auth status for health summary
    let llmLine = '';
    let authLine = '';
    let providerLine = '';
    try {
      const llmHealth = await client.getLLMHealth();
      llmLine = `  ${c.gray('LLM:')}          ${c.green(llmHealth.status || 'connected')}`;
      if (llmHealth.activeModel) llmLine += ` (${llmHealth.activeModel})`;
    } catch {
      llmLine = `  ${c.gray('LLM:')}          ${c.yellow('not available — chat and inference disabled')}`;
    }

    try {
      const active = await client.getActiveProvider();
      providerLine = `  ${c.gray('Provider:')}     ${active.provider === 'azure' ? c.cyan('Azure OpenAI') : c.green('Local')}`;
    } catch {
      providerLine = '';
    }

    try {
      const authStatus = await client.getAuthStatus();
      authLine = `  ${c.gray('Security:')}     ${authStatus.enabled ? c.green('enabled') : c.gray('disabled')}`;
    } catch {
      authLine = '';
    }

    formatter.success(health,
      `\n${c.ok('Maestro Health Check:')}\n\n` +
      `  ${c.gray('Status:')}       ${c.green(health.status)}\n` +
      `  ${c.gray('Version:')}      ${health.version}\n` +
      `  ${c.gray('Blocks:')}       ${health.blockCount || 'N/A'}\n` +
      llmLine + '\n' +
      (providerLine ? providerLine + '\n' : '') +
      (authLine ? authLine + '\n' : '') +
      ''
    );

    // Phase 22: --verbose mode shows extended diagnostics
    if (options.verbose) {
      console.log(`  ${c.gray('API URL:')}      ${API_URL}`);
      console.log(`  ${c.gray('Uptime:')}       ${health.uptime || 'N/A'}`);
      console.log(`  ${c.gray('Timestamp:')}    ${health.timestamp || new Date().toISOString()}`);
      const svcStr2 = Object.entries(health.services || {}).map(([k, v]) => {
        const col = v === 'ok' || v === 'healthy' ? c.green : c.yellow;
        return `${k}=${col(v)}`;
      }).join(', ');
      if (svcStr2) console.log(`  ${c.gray('Services:')}     ${svcStr2}`);

      // Session summary
      try {
        const sessions = await client.listSessions();
        const running = sessions.filter(s => s.status === 'Running' || s.status === 'Active').length;
        const idle = sessions.filter(s => s.status === 'Idle' || s.status === 'Created').length;
        const total = sessions.length;
        console.log(`  ${c.gray('Sessions:')}     ${total} total (${c.green(running + ' active')}, ${c.gray(idle + ' idle')})`);
      } catch { /* skip session info */ }

      // Config file
      const os = require('os');
      const configPath = path.join(os.homedir(), '.maestro', 'config.json');
      console.log(`  ${c.gray('Config:')}       ${fs.existsSync(configPath) ? configPath : c.yellow('not found')}`);
      console.log('');
    }
  } catch (error) {
    formatter.error(`Backend is not responding at ${API_URL}`, 'ECONNREFUSED',
      'Start the backend with: dotnet run --project backend/src/Maestro.Api');
    process.exit(1);
  }
}

// Phase 22: Logs command — read audit and execution logs
async function showLogs(options = {}) {
  const os = require('os');
  const maestroHome = path.join(os.homedir(), '.maestro');
  const logType = options.type || 'audit';

  let logFile;
  if (logType === 'audit') {
    logFile = path.join(maestroHome, 'logs', 'audit.jsonl');
  } else {
    formatter.error(`Unknown log type: ${logType}. Available: audit`, 'INVALID_PARAM');
    return;
  }

  if (!fs.existsSync(logFile)) {
    console.log(`  No ${logType} logs found at ${logFile}`);
    return;
  }

  const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
  const limit = options.limit ? parseInt(options.limit) : 20;
  const recent = lines.slice(-limit);

  formatter.info(`${logType} logs (last ${recent.length} of ${lines.length})`);
  console.log('');

  for (const line of recent) {
    try {
      const entry = JSON.parse(line);
      const time = new Date(entry.timestamp).toLocaleTimeString();
      console.log(`  ${c.gray(time)} ${c.cyan(entry.action)} ${entry.userId || ''} ${entry.detail || ''}`);
    } catch {
      console.log(`  ${c.gray(line)}`);
    }
  }
  console.log('');
}

async function searchBlocks(query) {
  try {
    const results = await client.searchBlocks(query);
    if (results.length === 0) {
      console.log(`\nNo blocks found matching: "${query}"`);
      return;
    }

    console.log('\n' + c.bold('Search results for') + ` "${c.cyan(query)}":` + c.gray(` (${results.length})`) + '\n');
    formatter.table(results.map(b => ({
      'ID': b.id,
      'Name': b.name,
      'Type': b.blockType
    })), null, { hideEmpty: true });
  } catch (error) {
    console.error(c.fail(`Search failed: ${error.message}`));
    process.exit(1);
  }
}

// ============= Block Execution (unified run) =============

async function runBlockUnified(blockId, inputs, options = {}) {
  formatter.setCommand('run');
  try {
    // Detect block type to route correctly
    let isWorkflow = false;
    try {
      const block = await client._fetch('GET', `/api/blocks/${blockId}`);
      if (block && block.blockType === 'workflow') isWorkflow = true;
    } catch (e) {
      // Block lookup failed — try executing directly, let the API decide
    }

    console.log(`\n${c.bold('Running:')} ${c.cyan(blockId)}${isWorkflow ? c.gray(' (workflow)') : ''}\n`);
    if (Object.keys(inputs).length > 0) {
      console.log(`  ${c.gray('Inputs:')}`, JSON.stringify(inputs, null, 2));
    }
    if (options.workingDir) {
      console.log(`  ${c.gray('Working Dir:')} ${options.workingDir}`);
    }
    if (Object.keys(inputs).length > 0 || options.workingDir) console.log('');

    const startTime = Date.now();
    let result;

    if (isWorkflow) {
      result = await client.executeWorkflow(blockId, {
        inputs,
        workingDirectory: options.workingDir
      });
    } else {
      result = await client._fetch('POST', `/api/blocks/${blockId}/execute`, {
        body: { inputs, workingDirectory: options.workingDir }
      });
    }

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(c.ok(`Executed in ${duration}ms`) + '\n');
      if (result.outputs) {
        console.log(c.gray('Outputs:'));
        console.log(JSON.stringify(result.outputs, null, 2));
      }
      if (result.logs && result.logs.length > 0) {
        console.log(c.gray('\nLogs:'));
        result.logs.forEach(log => console.log(`  ${log}`));
      }
    } else {
      console.error(c.fail('Execution failed') + '\n');
      if (result.error) console.error(`  ${result.error}`);
      if (result.logs && result.logs.length > 0) {
        result.logs.forEach(log => console.error(`  ${log}`));
      }
      process.exit(EXIT.SERVER_ERROR);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      formatter.error(`Block not found: ${blockId}`, 'NOT_FOUND');
      process.exit(EXIT.NOT_FOUND);
    } else if (error.status === 400) {
      formatter.error(`Invalid request: ${error.message}`, 'BAD_REQUEST');
      process.exit(EXIT.USER_ERROR);
    } else {
      handleApiError(error, 'running block');
    }
    process.exit(EXIT.SERVER_ERROR);
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

    console.log('\nAvailable Projects:\n');
    formatter.table(projects.map(p => ({
      'ID': p.id.substring(0, 8) + '...',
      'Name': p.name,
      'Path': p.rootPath,
      'Runtime': p.runtime?.type || 'none',
      'Version': p.version
    })), null, { hideEmpty: true });
  } catch (error) {
    handleApiError(error, 'listing projects');
  }
}

async function getProjectInfo(id) {
  try {
    const project = await client.getProject(id);
    console.log('\nProject Details:\n');
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
      console.error(`Project not found: ${id}`);
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
    console.log(`\nProject created successfully!\n`);
    console.log(`  ID:   ${project.id}`);
    console.log(`  Name: ${project.name}`);
    console.log(`  Path: ${project.rootPath}`);
    console.log('');
  } catch (error) {
    if (error.status === 400) {
      console.error(`Invalid project configuration: ${error.message}`);
    } else if (error.status === 409) {
      console.error(`Project already exists at: ${rootPath}`);
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
    console.log(`\nProject opened successfully!\n`);
    console.log(`  ID:   ${project.id}`);
    console.log(`  Name: ${project.name}`);
    console.log(`  Path: ${project.rootPath}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`No project found at: ${projectPath}`);
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
    console.log(`\nProject bound successfully!\n`);
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
      console.error(`Cannot bind: ${error.message}`);
    } else if (error.status === 409) {
      console.error(`Project already exists at: ${projectPath}`);
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
    console.log(`\nProject removed: ${id}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Project not found: ${id}`);
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

    console.log(`\nBlocks in Project:\n`);
    formatter.table(blocks.map(b => ({
      'ID': b.id,
      'Name': b.name,
      'Type': b.blockType,
      'Version': b.version
    })), null, { hideEmpty: true });
  } catch (error) {
    if (error.status === 404) {
      console.error(`Project not found: ${projectId}`);
    } else {
      handleApiError(error, 'listing project blocks');
    }
    process.exit(1);
  }
}

async function discoverProjects(searchPath) {
  try {
    const resolvedPath = path.resolve(searchPath);
    console.log(`\nDiscovering projects in: ${resolvedPath}\n`);

    const projects = await client.discoverProjects(resolvedPath);
    if (projects.length === 0) {
      console.log('No projects found');
      console.log('  Projects require a .maestro/project.json file');
      return;
    }

    console.log(`Found ${projects.length} project(s):\n`);
    formatter.table(projects.map(p => ({
      'ID': p.id.substring(0, 8) + '...',
      'Name': p.name,
      'Path': p.rootPath
    })), null, { hideEmpty: true });
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
      console.error(`Project not found: ${id}`);
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
    console.log('\nStarting container...');
    const status = await client.startContainer(id);
    console.log(`Container started`);
    console.log(`  Status: ${formatStatus(status.status)}`);
    if (status.containerId) {
      console.log(`  Container ID: ${status.containerId}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Project not found: ${id}`);
    } else if (error.status === 400) {
      console.error(`Cannot start: ${error.message}`);
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
    console.log(`Container stopped`);
    console.log(`  Status: ${formatStatus(status.status)}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Project not found: ${id}`);
    } else if (error.status === 400) {
      console.error(`Cannot stop: ${error.message}`);
    } else {
      handleApiError(error, 'stopping container');
    }
    process.exit(1);
  }
}

async function restartContainer(id) {
  try {
    console.log('\nRestarting container...');
    const status = await client.restartContainer(id);
    console.log(`Container restarted`);
    console.log(`  Status: ${formatStatus(status.status)}`);
    if (status.containerId) {
      console.log(`  Container ID: ${status.containerId}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Project not found: ${id}`);
    } else if (error.status === 400) {
      console.error(`Cannot restart: ${error.message}`);
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

    console.log('\nContainer Logs:\n');
    console.log('─'.repeat(60));
    console.log(logs);
    console.log('─'.repeat(60));
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Project not found: ${id}`);
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

    console.log('\n' + c.bold('Projects:') + c.gray(` (${projectsWithStatus.length})`) + '\n');
    formatter.table(projectsWithStatus.map(p => ({
      'ID': p.id.substring(0, 8) + '...',
      'Name': p.name,
      'Status': p.containerStatus,
      'Runtime': p.runtime?.type || 'none',
      'Path': p.rootPath.length > 40 ? '...' + p.rootPath.slice(-37) : p.rootPath
    })), null, { hideEmpty: true });
  } catch (error) {
    handleApiError(error, 'listing projects');
  }
}

function handleApiError(error, action) {
  if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
    formatter.error(`Cannot connect to backend at ${client.baseUrl}`, 'ECONNREFUSED',
      'Start the backend: powershell -File dev-scripts/dev-start.ps1');
    process.exitCode = EXIT.SERVER_ERROR;
  } else if (error.status === 404) {
    // Phase 22/32: Context-specific 404 messages
    const suggestions = {
      'session': "Run 'maestro session list' to see available sessions.",
      'workspace': "Run 'maestro workspace list' to see available workspaces.",
      'block': "Run 'maestro block list' to see available blocks.",
      'project': "Run 'maestro projects' to see available projects.",
      'template': "Run 'maestro templates' to see available templates.",
      'entry point': "Run 'maestro session info <id>' to see entry points.",
      'approval': "Run 'maestro block --pending-approval' to see pending approvals.",
      'invoking': "Run 'maestro session info <id>' to check session status and entry points.",
    };
    const hint = Object.entries(suggestions).find(([key]) => action.toLowerCase().includes(key))?.[1];
    formatter.error(`Not found: ${error.message || action}`, 'NOT_FOUND', hint);
    process.exitCode = EXIT.NOT_FOUND;
  } else if (error.status === 408 || error.message?.includes('timeout')) {
    formatter.error(`Timeout while ${action}`, 'TIMEOUT',
      'The server might be overloaded. Try again or check backend logs.');
    process.exitCode = EXIT.TIMEOUT;
  } else if (error.status === 503 || error.message?.includes('LLM') || error.message?.includes('llm_provider')) {
    formatter.error('LLM server is not responding.', 'LLM_UNAVAILABLE',
      "Start the LLM provider or configure Azure: maestro config azure set --endpoint <url> --api-key <key>");
    process.exitCode = EXIT.SERVER_ERROR;
  } else if (error.status === 401 || error.status === 403) {
    formatter.error(`Access denied while ${action}`, error.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
      "Check your API key: maestro config set apiKey <key>");
    process.exitCode = EXIT.USER_ERROR;
  } else {
    formatter.error(`Error ${action}: ${error.message}`, error.status ? `HTTP_${error.status}` : 'ERROR');
    process.exitCode = error.status >= 500 ? EXIT.SERVER_ERROR : EXIT.USER_ERROR;
  }
}

// ============= Interactive Session Commands (Session Server Architecture) =============

async function listSessions(filter = {}) {
  formatter.setCommand('session.list');
  try {
    const sessions = await client.listSessions(filter);
    if (!sessions || sessions.length === 0) {
      formatter.success([], '\nNo interactive sessions found\n  Create one with: maestro session create --project <id> --authority human');
      return;
    }

    const rows = sessions.map(s => ({
      'ID': s.id.substring(0, 12) + '...',
      'Name': s.name || '-',
      'Status': s.status,
      'Authority': s.authority || 'human',
      'Project': s.config?.projectId ? s.config.projectId.substring(0, 8) + '...' : '—',
      'Commands': s.commandCount || 0,
      'Created': formatDate(s.createdAt)
    }));
    formatter.table(rows, '\n' + c.bold('Interactive Sessions:') + c.gray(` (${sessions.length})`) + '\n');
  } catch (error) {
    handleApiError(error, 'listing sessions');
    process.exit(1);
  }
}

async function getSessionInfo(id) {
  formatter.setCommand('session.info');
  try {
    const session = await client.getSession(id);
    const statusStr = c.status(session.status, session.status);

    // Entry points summary
    const epKeys = session.entryPoints ? Object.keys(session.entryPoints) : [];
    const epLine = epKeys.length > 0
      ? `${epKeys.length} (${epKeys.join(', ')})`
      : 'none';

    // Truncate long names with full name on next line
    const fullName = session.name || 'N/A';
    const nameDisplay = fullName.length > 72
      ? fullName.substring(0, 69) + '...\n                    ' + c.gray(fullName)
      : fullName;

    const message =
      `\n${c.bold('Session Details:')}\n\n` +
      `  ${c.gray('ID:')}           ${session.id}\n` +
      `  ${c.gray('Name:')}         ${nameDisplay}\n` +
      `  ${c.gray('Status:')}       ${statusStr}\n` +
      `  ${c.gray('Authority:')}    ${session.authority || 'human'}\n` +
      `  ${c.gray('Project ID:')}   ${session.config?.projectId || 'N/A'}\n` +
      `  ${c.gray('Workflow ID:')}  ${session.config?.workflowId || 'N/A'}\n` +
      `  ${c.gray('Task:')}         ${session.config?.task || 'N/A'}\n` +
      `  ${c.gray('Access Level:')} ${session.config?.access?.level || 'controlled'}\n` +
      `  ${c.gray('Working Dir:')}  ${session.workingDirectory || 'N/A'}\n` +
      `  ${c.gray('Commands:')}     ${session.commandCount || 0}\n` +
      `  ${c.gray('Entry Points:')} ${epLine}\n` +
      `  ${c.gray('Created:')}      ${formatDate(session.createdAt)}\n` +
      `  ${c.gray('Started:')}      ${session.startedAt ? formatDate(session.startedAt) : 'Not started'}\n` +
      `  ${c.gray('Completed:')}    ${session.completedAt ? formatDate(session.completedAt) : 'Not completed'}` +
      `${session.errorMessage ? '\n  ' + c.red('Error:') + '        ' + session.errorMessage : ''}\n`;
    formatter.success(session, message);
  } catch (error) {
    if (error.status === 404) {
      formatter.error(`Session not found: ${id}`, 'NOT_FOUND');
    } else {
      handleApiError(error, 'getting session');
    }
    process.exit(1);
  }
}

async function createSession(options) {
  formatter.setCommand('session.create');
  try {
    if (!options.projectId && !options.repo) {
      formatter.error('Either --project or --repo is required', 'MISSING_PARAM');
      process.exit(1);
    }

    // Validate repository source requires path
    if (options.source === 'repository' && !options.repositoryPath) {
      formatter.error('--repository-path is required when using --source repository', 'MISSING_PARAM');
      process.exit(1);
    }

    const request = {
      projectId: options.projectId || undefined,
      repositoryPath: options.repo || undefined,
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

    // P1-8: Auto-import template if --template provided
    if (options.template) {
      await importSessionTemplate(session.id, options.template);
    }

    // P1-8: Auto-start if --start provided
    if (options.autoStart) {
      await client.startSession(session.id);
      const message = `\n${c.ok('Session created and started!')}\n\n  ${c.gray('ID:')}        ${session.id}\n  ${c.gray('Name:')}      ${session.name}\n  ${c.gray('Status:')}    running\n  ${c.gray('Template:')}  ${options.template || 'none'}\n\n  ${c.gray('Next steps:')}\n    maestro session invoke ${session.id.substring(0, 8)}... start\n    maestro monitor ${session.id.substring(0, 8)}...\n`;
      formatter.success(session, message);
    } else {
      const nextStep = options.template
        ? `maestro session start ${session.id.substring(0, 8)}...`
        : `maestro session import ${session.id.substring(0, 8)}... --template <name>`;
      const message = `\n${c.ok('Session created!')}\n\n  ${c.gray('ID:')}        ${session.id}\n  ${c.gray('Name:')}      ${session.name}\n  ${c.gray('Status:')}    ${session.status}\n  ${c.gray('Authority:')} ${session.authority || 'human'}\n  ${c.gray('Template:')}  ${options.template || 'none'}\n\n  ${c.gray('Next step:')} ${nextStep}\n`;
      formatter.success(session, message);
    }
  } catch (error) {
    handleApiError(error, 'creating session');
    process.exit(EXIT.USER_ERROR);
  }
}

async function startSession(id, options = {}) {
  formatter.setCommand('session.start');
  try {
    const session = await client.startSession(id);

    // In JSON mode, return data without launching monitor
    if (formatter.jsonMode) {
      formatter.success(session);
      return;
    }

    console.log(`\n${c.ok('Session started')}\n`);
    console.log(`  ${c.gray('ID:')}          ${session.id}`);
    console.log(`  ${c.gray('Status:')}      ${c.status(session.status, session.status)}`);
    console.log(`  ${c.gray('Authority:')}   ${session.authority || 'human'}`);
    console.log(`  ${c.gray('Working Dir:')} ${session.workingDirectory || 'N/A'}`);
    console.log('');

    // Launch monitor only if --monitor flag is explicitly set
    if (options.monitor) {
      const { spawn } = require('child_process');
      const cliPath = path.resolve(__dirname, 'index.js');

      // On Windows, use cmd /c start to open a new detached window
      if (process.platform === 'win32') {
        const child = spawn('cmd', [
          '/c', 'start',
          `Maestro Monitor - ${id.substring(0, 8)}`,
          'powershell', '-NoExit', '-Command',
          `node "${cliPath}" monitor ${id}`
        ], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
        child.unref();
      } else {
        // On Unix-like systems, try to open a new terminal
        const terminals = ['gnome-terminal', 'xterm', 'konsole'];
        for (const term of terminals) {
          try {
            spawn(term, ['--', 'node', cliPath, 'monitor', id], {
              detached: true,
              stdio: 'ignore'
            }).unref();
            break;
          } catch (e) {
            continue;
          }
        }
      }

      console.log(`  ${c.info('Monitor launched in new window.')}`);
      console.log('');
    }

    const short = id.substring(0, 8);
    console.log(`  ${c.gray('Next:')}`);
    console.log(`    maestro session invoke ${short} start`);
    console.log('');
    console.log(`  ${c.gray('Tip:')}  maestro monitor ${short}     ${c.gray('(TUI monitor)')}`);
    console.log(`        http://localhost:5173       ${c.gray('(Web dashboard)')}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'starting session');
    process.exit(1);
  }
}

async function pauseSession(id) {
  formatter.setCommand('session.pause');
  try {
    const session = await client.pauseSession(id);
    formatter.success(session, `\nSession ${session.status}\n\n  Resume with: maestro session resume ${id}\n`);
  } catch (error) {
    handleApiError(error, 'pausing session');
    process.exit(1);
  }
}

async function resumeSession(id) {
  formatter.setCommand('session.resume');
  try {
    const session = await client.resumeSession(id);
    formatter.success(session, `\nSession ${session.status}\n`);
  } catch (error) {
    handleApiError(error, 'resuming session');
    process.exit(1);
  }
}

async function stopSession(id) {
  formatter.setCommand('session.stop');
  try {
    const session = await client.stopSession(id);
    formatter.success(session, `\n🛑 Session ${session.status}\n`);
  } catch (error) {
    handleApiError(error, 'stopping session');
    process.exit(1);
  }
}

async function takeControlSession(id, authority) {
  formatter.setCommand('session.take-control');
  try {
    const session = await client.takeControlSession(id, authority);
    formatter.success(session, `\nControl transferred!\n\n  New Authority: ${session.authority}\n  Status:        ${session.status}\n`);
  } catch (error) {
    handleApiError(error, 'transferring session control');
    process.exit(1);
  }
}

async function bindSessionToRepository(id, repoPath) {
  formatter.setCommand('session.bind-repo');
  try {
    const session = await client.post(`/api/sessions/${id}/bind-repository`, {
      repositoryPath: repoPath
    });
    formatter.success(session, `\nSession ${id} bound to repository: ${repoPath}\n`);
  } catch (error) {
    handleApiError(error, 'binding session to repository');
    process.exit(1);
  }
}

async function executeSessionCommand(id, command, args = null) {
  formatter.setCommand('session.exec');
  try {
    const result = await client.executeSessionCommand(id, command, args);

    if (result.success) {
      formatter.success(result, `${result.commandType || 'shell'} [${result.commandId?.substring(0, 8) || ''}]${result.output ? '\n' + result.output : ''}`);
    } else {
      formatter.error(`${result.commandType || 'shell'} failed`, 'EXEC_FAILED',
        result.error || result.output || null);
      process.exitCode = result.exitCode || 1;
    }
  } catch (error) {
    handleApiError(error, 'executing command');
    process.exit(1);
  }
}

async function getSessionEvents(id, options = {}) {
  formatter.setCommand('session.events');
  try {
    const events = await client.getSessionEvents(id, options);
    if (!events || events.length === 0) {
      formatter.success([], '\nNo events found for this session');
      return;
    }

    if (formatter.jsonMode) {
      formatter.success(events);
    } else {
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
    }
  } catch (error) {
    handleApiError(error, 'getting session events');
    process.exit(1);
  }
}

async function deleteSession(id, options = {}) {
  formatter.setCommand('session.delete');
  try {
    if (!options.force && !formatter.jsonMode) {
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve) => {
        rl.question(`  Delete session ${id.substring(0, 12)}...? This cannot be undone. [y/N] `, resolve);
      });
      rl.close();
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        formatter.info('  Delete cancelled.');
        return;
      }
    }
    await client.deleteSession(id);
    formatter.success({ id, deleted: true }, `\n${c.ok('Session deleted')}\n`);
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
      console.log(`\nSession Diff:\n`);
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
    console.log(`\nRunning tests for session: ${id}\n`);
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
    if (!options.message) { console.error('--message is required'); process.exit(1); }

    console.log(`\nCommitting session: ${id}\n`);
    const command = `commit -m "${options.message}"`;
    const result = await client.executeSessionCommand(id, command);

    if (result.success) {
      console.log(`Changes committed!\n`);
      if (result.output) {
        console.log(result.output);
      }
    } else {
      console.error(`Commit failed\n`);
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

async function importSessionTemplate(sessionId, templateName, options: { quiet?: boolean } = {}) {
  try {
    // Load template from foundry templates
    const fs = require('fs');
    const path = require('path');
    const verbose = !formatter.jsonMode && !options.quiet;

    // Look for template in content/system/templates/sessions/
    const templatePath = path.join(__dirname, '../../content/system/templates/sessions', `${templateName}.session.json`);

    if (!fs.existsSync(templatePath)) {
      const available = listAvailableTemplates();
      formatter.error(`Template not found: ${templateName}. Available: ${available.join(', ')}`, 'NOT_FOUND');
      process.exit(EXIT.NOT_FOUND);
    }

    const templateContent = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    if (verbose) {
      console.log(`\n${c.bold('Importing template:')} ${c.cyan(templateName)}\n`);
    }

    // Import variables
    if (templateContent.variables) {
      if (verbose) console.log(`  ${c.gray('Variables...')}`);
      for (const [key, value] of Object.entries(templateContent.variables)) {
        await client._fetch('PUT', `/api/sessions/${sessionId}/variables/${key}`, {
          body: { value }
        });
        if (verbose) console.log(`    ${c.green('+')} ${key}`);
      }
    }

    // Import entry points
    if (templateContent.entryPoints) {
      if (verbose) console.log(`  ${c.gray('Entry points...')}`);
      for (const [name, workflowId] of Object.entries(templateContent.entryPoints)) {
        await client._fetch('PUT', `/api/sessions/${sessionId}/entry-points/${encodeURIComponent(name)}`, {
          body: { workflowId }
        });
        if (verbose) console.log(`    ${c.green('+')} ${name} ${c.gray('->')} ${workflowId}`);
      }
    }

    // Import widgets
    if (templateContent.monitorWidgets) {
      if (verbose) console.log(`  ${c.gray('Widgets...')}`);
      for (const widget of templateContent.monitorWidgets) {
        await client._fetch('POST', `/api/sessions/${sessionId}/widgets`, {
          body: widget
        });
        if (verbose) console.log(`    ${c.green('+')} ${widget.id} (${widget.type})`);
      }
    }

    const varCount = templateContent.variables ? Object.keys(templateContent.variables).length : 0;
    const epCount = templateContent.entryPoints ? Object.keys(templateContent.entryPoints).length : 0;
    const widgetCount = templateContent.monitorWidgets ? templateContent.monitorWidgets.length : 0;

    if (!options.quiet) {
      formatter.success(
        { template: templateName, variables: varCount, entryPoints: epCount, widgets: widgetCount },
        `\n${c.ok('Template imported!')} ${varCount} variables, ${epCount} entry points, ${widgetCount} widgets.\n`
      );
    }

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Template file not found: ${templateName}`);
    } else if (error.status === 404) {
      console.error(`Session not found: ${sessionId}`);
    } else {
      handleApiError(error, 'importing session template');
    }
    process.exit(1);
  }
}

// ============= Init Command (Phase 32-A) =============

/**
 * Detect the project stack by looking for known marker files.
 * Returns: 'node' | 'csharp' | 'python' | 'java' | 'rust' | 'unknown'
 */
function detectProjectStack(repoPath: string): string {
  const markers = [
    { file: 'package.json', stack: 'node' },
    { file: '*.csproj', stack: 'csharp', glob: true },
    { file: 'pyproject.toml', stack: 'python' },
    { file: 'setup.py', stack: 'python' },
    { file: 'requirements.txt', stack: 'python' },
    { file: 'pom.xml', stack: 'java' },
    { file: 'build.gradle', stack: 'java' },
    { file: 'Cargo.toml', stack: 'rust' },
  ];

  for (const marker of markers) {
    if (marker.glob) {
      // Check for glob pattern (e.g. *.csproj)
      try {
        const files = fs.readdirSync(repoPath);
        const ext = marker.file.replace('*', '');
        if (files.some((f: string) => f.endsWith(ext))) return marker.stack;
      } catch { /* ignore */ }
    } else {
      if (fs.existsSync(path.join(repoPath, marker.file))) return marker.stack;
    }
  }
  return 'unknown';
}

/**
 * Load a CONVENTIONS.md template for the detected stack.
 * Templates live in content/system/templates/init/<stack>.md
 */
function loadConventionsTemplate(stack: string): string {
  const templateDir = path.join(__dirname, '..', '..', 'content', 'system', 'templates', 'init');
  const templateFile = stack === 'unknown' ? 'default.md' : `${stack}.md`;
  const templatePath = path.join(templateDir, templateFile);

  try {
    return fs.readFileSync(templatePath, 'utf-8');
  } catch {
    // Fallback if template is missing
    return `# Project Conventions\n\n<!-- Fill in your project conventions here -->\n`;
  }
}

async function initRepo(targetPath, options: { force?: boolean } = {}) {
  const repoPath = targetPath || process.cwd();
  const maestroDir = path.join(repoPath, '.maestro');

  if (fs.existsSync(maestroDir) && !options.force) {
    // Show existing config summary instead of just "already exists"
    formatter.info(`.maestro/ already exists in ${repoPath}`);
    console.log('');
    try {
      // Try config.json (new format) or project.json (legacy)
      for (const cfgFile of ['config.json', 'project.json']) {
        const configPath = path.join(maestroDir, cfgFile);
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config.template) console.log(`  ${c.gray('Template:')}  ${config.template}`);
          if (config.stack) console.log(`  ${c.gray('Stack:')}     ${config.stack}`);
          if (config.model) console.log(`  ${c.gray('Model:')}     ${config.model}`);
          if (config.name) console.log(`  ${c.gray('Name:')}      ${config.name}`);
          const files = fs.readdirSync(maestroDir);
          console.log(`  ${c.gray('Contents:')}  ${files.length} items (${files.join(', ')})`);
          break;
        }
      }
      const aliasesPath = path.join(maestroDir, 'aliases.json');
      if (fs.existsSync(aliasesPath)) {
        const aliases = JSON.parse(fs.readFileSync(aliasesPath, 'utf8'));
        const count = Object.keys(aliases).length;
        console.log(`  ${c.gray('Aliases:')}   ${count} (${Object.keys(aliases).join(', ')})`);
      }
    } catch { /* ignore parse errors */ }
    console.log('');
    console.log(c.gray(`  To reinitialize: maestro init ${targetPath ? targetPath + ' ' : ''}--force`));
    return;
  }

  // If --force, remove existing
  if (fs.existsSync(maestroDir) && options.force) {
    fs.rmSync(maestroDir, { recursive: true, force: true });
  }

  // 1. Detect project stack
  const stack = detectProjectStack(repoPath);
  const stackLabel = stack === 'unknown' ? 'unknown (generic)' : stack;

  // 2. Create directory structure
  const dirs = ['blocks', 'docs', 'logs', 'artifacts', 'metrics'];
  for (const dir of dirs) {
    fs.mkdirSync(path.join(maestroDir, dir), { recursive: true });
  }

  // 3. Create config.json
  const config = {
    template: 'project-autonomous',
    model: null,
    stack: stack === 'unknown' ? null : stack,
  };
  fs.writeFileSync(
    path.join(maestroDir, 'config.json'),
    JSON.stringify(config, null, 2) + '\n'
  );

  // 4. Create CONVENTIONS.md from stack template
  const conventions = loadConventionsTemplate(stack);
  fs.writeFileSync(path.join(maestroDir, 'CONVENTIONS.md'), conventions);

  // 5. Create README.md
  const readme = `# Maestro

This directory contains Maestro configuration for this repository.

## Files

- \`config.json\` — Maestro configuration (template, model, stack)
- \`CONVENTIONS.md\` — Project conventions for AI agents (edit this!)
- \`blocks/\` — Custom blocks for this project
- \`docs/\` — Project documentation
- \`logs/\` — Execution logs
- \`artifacts/\` — Generated artifacts
- \`metrics/\` — Metrics data

## Getting Started

1. Edit \`CONVENTIONS.md\` to describe your project's conventions
2. Start the Maestro backend: \`powershell.exe -File dev-scripts/dev-start.ps1\`
3. Create a session: \`maestro session create --template project-autonomous --start\`
4. Launch the monitor: \`maestro monitor <session-id>\`
5. Run a task: \`maestro session invoke <session-id> dev --input task="your task"\`
`;
  fs.writeFileSync(path.join(maestroDir, 'README.md'), readme);

  // 6. Copy default aliases
  const defaultAliasesPath = path.join(__dirname, '..', '..', 'content', 'system', 'templates', 'init', 'aliases-default.json');
  try {
    const aliasesContent = fs.readFileSync(defaultAliasesPath, 'utf-8');
    fs.writeFileSync(path.join(maestroDir, 'aliases.json'), aliasesContent);
  } catch {
    // If template missing, create a minimal aliases file
    fs.writeFileSync(path.join(maestroDir, 'aliases.json'), JSON.stringify({
      agent: {
        workflow: 'autonomous-development',
        template: 'project-autonomous',
        entryPoint: 'dev',
        description: 'Autonomous development agent'
      }
    }, null, 2) + '\n');
  }

  // 7. Output results
  console.log('');
  formatter.info(`Initialized .maestro/ in ${repoPath}`);
  console.log(`  ${c.gray('Stack detected:')} ${c.cyan(stackLabel)}`);
  console.log('');
  console.log(`  ${c.green('created')} .maestro/config.json`);
  console.log(`  ${c.green('created')} .maestro/CONVENTIONS.md`);
  console.log(`  ${c.green('created')} .maestro/README.md`);
  console.log(`  ${c.green('created')} .maestro/aliases.json`);
  dirs.forEach(d => console.log(`  ${c.green('created')} .maestro/${d}/`));

  // 8. Next steps
  console.log('');
  console.log(c.bold('Next steps:'));
  console.log(`  1. ${c.cyan('Edit .maestro/CONVENTIONS.md')} — describe your project's conventions`);
  console.log(`  2. ${c.cyan('maestro agent "your task"')} — run the dev agent (alias)`);
  console.log(`  3. ${c.cyan('maestro monitor <session-id>')} — launch the TUI monitor`);
  console.log('');
}

// ============= Alias System (Phase 32-B) =============

/**
 * Load aliases from local (.maestro/aliases.json) and global (~/.maestro/aliases.json).
 * Local aliases take priority over global ones.
 */
function loadAliases(): Record<string, { workflow: string; template: string; entryPoint: string; description?: string }> {
  const os = require('os');
  const aliases: Record<string, any> = {};

  // Load global aliases first (~/.maestro/aliases.json)
  const globalPath = path.join(os.homedir(), '.maestro', 'aliases.json');
  const globalAliases = loadJson(globalPath);
  if (globalAliases) Object.assign(aliases, globalAliases);

  // Load local aliases (override global) — .maestro/aliases.json in cwd
  const localPath = path.join(process.cwd(), '.maestro', 'aliases.json');
  const localAliases = loadJson(localPath);
  if (localAliases) Object.assign(aliases, localAliases);

  return aliases;
}

/**
 * Execute an alias: create a session, import template, start it, invoke the entry point.
 * This is the full flow for `maestro <alias> "task description"`.
 */
async function executeAlias(aliasName: string, aliasDef: any, taskArg: string) {
  const repoPath = process.cwd();
  const template = aliasDef.template || 'project-autonomous';
  const entryPoint = aliasDef.entryPoint || 'dev';

  console.log('');
  console.log(`${c.bold('Alias:')} ${c.cyan(aliasName)}${aliasDef.description ? c.gray(` — ${aliasDef.description}`) : ''}`);
  console.log(`  ${c.gray('Template:')}    ${template}`);
  console.log(`  ${c.gray('Entry point:')} ${entryPoint}`);
  console.log(`  ${c.gray('Repo:')}        ${repoPath}`);
  if (taskArg) console.log(`  ${c.gray('Task:')}        ${taskArg}`);
  console.log('');

  try {
    // 1. Create session
    console.log(`  ${c.gray('Creating session...')}`);
    const session = await client.createSession({
      repositoryPath: repoPath,
      authority: 'human',
      name: `${path.basename(repoPath)} - ${taskArg || aliasName}`,
    });

    // 2. Import template
    console.log(`  ${c.gray('Importing template...')}`);
    await importSessionTemplate(session.id, template);

    // 3. Start session
    console.log(`  ${c.gray('Starting session...')}`);
    await client.startSession(session.id);

    // 4. Invoke entry point
    const inputs: Record<string, string> = { repoPath };
    if (taskArg) inputs.task = taskArg;

    console.log(`  ${c.gray('Invoking')} ${entryPoint}${c.gray('...')}`);
    const response = await client._fetch('POST', `/api/sessions/${session.id}/invoke/${entryPoint}`, {
      body: { inputs }
    });

    console.log('');
    console.log(c.ok('Session running!'));
    console.log('');
    console.log(`  ${c.gray('Session ID:')} ${session.id}`);
    console.log(`  ${c.gray('Workflow:')}   ${response.workflowId || 'N/A'}`);
    console.log(`  ${c.gray('Status:')}     ${response.status || 'running'}`);
    console.log('');
    const short = session.id.substring(0, 8);
    console.log(`  ${c.gray('Monitor:')}  maestro monitor ${short}`);
    console.log(`  ${c.gray('Info:')}     maestro session info ${short}`);
    console.log('');
  } catch (error) {
    handleApiError(error, `executing alias '${aliasName}'`);
    process.exit(EXIT.SERVER_ERROR);
  }
}

// ============= Session Variables Functions =============

async function listSessionVariables(sessionId) {
  formatter.setCommand('session.vars.list');
  try {
    const response = await client._fetch('GET', `/api/sessions/${sessionId}/variables`);

    if (!response || Object.keys(response).length === 0) {
      formatter.success({}, '\nNo variables set for this session\n');
      return;
    }

    if (formatter.jsonMode) {
      formatter.success(response);
    } else {
      console.log('\nSession Variables:\n');
      for (const [key, value] of Object.entries(response)) {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
        console.log(`  ${key}: ${displayValue}`);
      }
      console.log('');
    }
  } catch (error) {
    if (error.status === 404) {
      formatter.error(`Session not found: ${sessionId}`, 'NOT_FOUND');
    } else {
      handleApiError(error, 'listing session variables');
    }
    process.exit(1);
  }
}

async function getSessionVariable(sessionId, key) {
  formatter.setCommand('session.vars.get');
  try {
    const response = await client._fetch('GET', `/api/sessions/${sessionId}/variables/${key}`);
    formatter.success(response.value, `\n${key}:\n\n  ${typeof response.value === 'object' ? JSON.stringify(response.value, null, 2) : response.value}\n`);
  } catch (error) {
    if (error.status === 404) {
      const msg = error.message?.includes('Variable')
        ? `Variable '${key}' not found in session ${sessionId}`
        : `Session not found: ${sessionId}`;
      formatter.error(msg, 'NOT_FOUND');
    } else {
      handleApiError(error, 'getting session variable');
    }
    process.exit(1);
  }
}

async function setSessionVariable(sessionId, key, value) {
  formatter.setCommand('session.vars.set');
  try {
    // Don't log internal command log updates
    const isInternalVar = key.startsWith('_');

    // Try to parse as JSON if it looks like JSON
    let parsedValue = value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
          trimmed === 'true' || trimmed === 'false' ||
          !isNaN(Number(trimmed))) {
        try {
          parsedValue = JSON.parse(trimmed);
        } catch (e) {
          // Keep as string
        }
      }
    }

    await client._fetch('PUT', `/api/sessions/${sessionId}/variables/${key}`, {
      body: { value: parsedValue }
    });

    const displayValue = typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : parsedValue;

    // Log the command to session history (but not for internal vars)
    if (!isInternalVar) {
      await logSessionCommand(sessionId, `vars set ${key} ${value}`, `${key}: ${displayValue}`);
    }

    formatter.success({ key, value: parsedValue }, `\nVariable '${key}' set successfully\n\n  ${key}: ${displayValue}\n`);
  } catch (error) {
    if (error.status === 404) {
      formatter.error(`Session not found: ${sessionId}`, 'NOT_FOUND');
    } else {
      handleApiError(error, 'setting session variable');
    }
    process.exit(1);
  }
}

async function removeSessionVariable(sessionId, key) {
  formatter.setCommand('session.vars.remove');
  try {
    await client._fetch('DELETE', `/api/sessions/${sessionId}/variables/${key}`);
    formatter.success({ key, removed: true }, `\nVariable '${key}' removed from session ${sessionId}\n`);
  } catch (error) {
    if (error.status === 404) {
      const msg = error.message?.includes('Variable')
        ? `Variable '${key}' not found in session ${sessionId}`
        : `Session not found: ${sessionId}`;
      formatter.error(msg, 'NOT_FOUND');
    } else {
      handleApiError(error, 'removing session variable');
    }
    process.exit(1);
  }
}

// ============= Session Entry Points Functions =============

async function listSessionEntryPoints(sessionId) {
  formatter.setCommand('session.entry-points');
  try {
    const response = await client._fetch('GET', `/api/sessions/${sessionId}/entry-points`);

    if (!response || Object.keys(response).length === 0) {
      formatter.success({}, '\n📍 No entry points defined for this session\n');
      return;
    }

    if (formatter.jsonMode) {
      formatter.success(response);
    } else {
      console.log('\n📍 Session Entry Points:\n');
      for (const [name, workflowId] of Object.entries(response)) {
        console.log(`  ${name}: ${workflowId}`);
      }
      console.log('');
      console.log('  Invoke with: maestro session invoke ' + sessionId + ' <entry-point>');
      console.log('');
    }
  } catch (error) {
    if (error.status === 404) {
      formatter.error(`Session not found: ${sessionId}`, 'NOT_FOUND');
    } else {
      handleApiError(error, 'listing session entry points');
    }
    process.exit(1);
  }
}

async function registerSessionEntryPoint(sessionId, name, workflowId) {
  formatter.setCommand('session.entry-points.register');
  try {
    await client._fetch('PUT', `/api/sessions/${sessionId}/entry-points/${name}`, {
      body: { workflowId }
    });
    formatter.success({ name, workflowId }, `\nEntry point '${name}' registered successfully\n\n  ${name} -> ${workflowId}\n`);
  } catch (error) {
    if (error.status === 404) {
      formatter.error(`Session not found: ${sessionId}`, 'NOT_FOUND');
    } else {
      handleApiError(error, 'registering entry point');
    }
    process.exit(1);
  }
}

async function removeSessionEntryPoint(sessionId, name) {
  formatter.setCommand('session.entry-points.remove');
  try {
    await client._fetch('DELETE', `/api/sessions/${sessionId}/entry-points/${name}`);
    formatter.success({ name, removed: true }, `\nEntry point '${name}' removed from session ${sessionId}\n`);
  } catch (error) {
    if (error.status === 404) {
      const msg = error.message?.includes('Entry point')
        ? `Entry point '${name}' not found in session ${sessionId}`
        : `Session not found: ${sessionId}`;
      formatter.error(msg, 'NOT_FOUND');
    } else {
      handleApiError(error, 'removing entry point');
    }
    process.exit(1);
  }
}

async function invokeSessionEntryPoint(sessionId, entryPoint, inputs?: Record<string, string>) {
  formatter.setCommand('session.invoke');
  try {
    const body: any = {};
    if (inputs) body.inputs = inputs;
    const response = await client._fetch('POST', `/api/sessions/${sessionId}/invoke/${entryPoint}`, {
      body
    });
    formatter.success(response, `\nEntry Point Invoked: ${entryPoint}\n\n  Workflow: ${response.workflowId}\n  Status: ${response.status}${response.message ? '\n  Message: ' + response.message : ''}\n`);
  } catch (error) {
    if (error.status === 404) {
      const msg = error.message?.includes('Entry point')
        ? `Entry point '${entryPoint}' not found in session ${sessionId}`
        : `Session not found: ${sessionId}`;
      formatter.error(msg, 'NOT_FOUND');
    } else {
      handleApiError(error, 'invoking entry point');
    }
    process.exit(1);
  }
}

// ============= Session Widgets Functions =============

async function listSessionWidgets(sessionId) {
  try {
    const widgets = await client._fetch('GET', `/api/sessions/${sessionId}/widgets`);

    if (!widgets || widgets.length === 0) {
      console.log('\n🔲 No widgets registered for this session\n');
      console.log('  Register one: maestro session widgets ' + sessionId + ' add --type progress-bar --id my-widget --config \'{"label": "Progress"}\'');
      console.log('');
      return;
    }

    console.log('\n🔲 Session Widgets:\n');
    for (const widget of widgets) {
      console.log(`  ${widget.id} (${widget.type})`);
      if (widget.config && Object.keys(widget.config).length > 0) {
        console.log(`    Config: ${JSON.stringify(widget.config)}`);
      }
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Session not found: ${sessionId}`);
    } else {
      handleApiError(error, 'listing session widgets');
    }
    process.exit(1);
  }
}

async function registerSessionWidget(sessionId, widgetId, widgetType, config) {
  try {
    await client._fetch('POST', `/api/sessions/${sessionId}/widgets`, {
      body: {
        id: widgetId,
        type: widgetType,
        config: config || {}
      }
    });

    console.log(`\nWidget '${widgetId}' registered successfully\n`);
    console.log(`  Type: ${widgetType}`);
    if (config && Object.keys(config).length > 0) {
      console.log(`  Config: ${JSON.stringify(config)}`);
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Session not found: ${sessionId}`);
    } else {
      handleApiError(error, 'registering widget');
    }
    process.exit(1);
  }
}

async function removeSessionWidget(sessionId, widgetId) {
  try {
    await client._fetch('DELETE', `/api/sessions/${sessionId}/widgets/${widgetId}`);

    console.log(`\nWidget '${widgetId}' removed from session ${sessionId}\n`);
  } catch (error) {
    if (error.status === 404) {
      if (error.message?.includes('Widget')) {
        console.error(`Widget '${widgetId}' not found in session ${sessionId}`);
      } else {
        console.error(`Session not found: ${sessionId}`);
      }
    } else {
      handleApiError(error, 'removing widget');
    }
    process.exit(1);
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
    formatter.table(configs.map(cfg => ({
      'ID': cfg.id.substring(0, 8) + '...',
      'Name': cfg.name,
      'Workflow': cfg.workflowId ? cfg.workflowId.substring(0, 8) + '...' : '—',
      'Iterations': cfg.iterations,
      'Goal': cfg.optimizationGoal || 'quality'
    })), null, { hideEmpty: true });
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
      console.error(`Training config not found: ${id}`);
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
    console.log('\nTraining configuration created!\n');
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

    console.log('\nTraining Runs:\n');
    formatter.table(runs.map(r => ({
      'ID': r.id.substring(0, 8) + '...',
      'Name': r.name || '-',
      'Status': r.status,
      'Progress': `${r.completedIterations}/${r.totalIterations}`,
      'Quality': r.averageQualityScore?.toFixed(2) || '-',
      'Cost': r.totalCostUsd ? `$${r.totalCostUsd.toFixed(4)}` : '-'
    })), null, { hideEmpty: true });
  } catch (error) {
    handleApiError(error, 'listing training runs');
    process.exit(1);
  }
}

async function getTrainingRunInfo(id) {
  try {
    const run = await client.getTrainingRun(id);
    console.log('\nTraining Run:\n');
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
      console.error(`Training run not found: ${id}`);
    } else {
      handleApiError(error, 'getting training run');
    }
    process.exit(1);
  }
}

async function startTrainingRun(configId, options = {}) {
  try {
    console.log(`\nStarting training run for config: ${configId}\n`);

    const request = {
      configurationId: configId,
      name: options.name,
      inputs: options.inputs ? JSON.parse(options.inputs) : undefined
    };

    const run = await client.startTrainingRun(request);
    console.log(`Training run started!\n`);
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

    console.log(`\n${actionLabel}ing training run: ${id}\n`);

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
        console.error(`Unknown action: ${action}`);
        process.exit(1);
    }

    console.log(`Training run ${action}d`);
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
    console.log('\nFitness configuration updated!\n');
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

    console.log('\nModel Fitness Leaderboard:\n');
    formatter.table(leaderboard.map(r => ({
      'Rank': r.rank,
      'Model': r.displayName || r.modelId,
      'Provider': r.provider,
      'Avg Fitness': r.averageFitness.toFixed(3),
      'Best': r.bestFitness.toFixed(3),
      'Executions': r.executionCount
    })), null, { hideEmpty: true });
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

    console.log('\nModel Profiles:\n');
    formatter.table(profiles.map(p => ({
      'Model ID': p.modelId,
      'Name': p.displayName,
      'Provider': p.provider,
      'Params': p.parametersBillions + 'B',
      'VRAM': p.isLocal ? `${p.vramGb}GB` : '-',
      'Cost': p.isLocal ? 'local' : `$${p.averageCostPerMillion}/M`,
      'Local': p.isLocal ? 'Yes' : 'No'
    })), null, { hideEmpty: true });
  } catch (error) {
    handleApiError(error, 'listing model profiles');
    process.exit(1);
  }
}

async function getModelProfile(modelId) {
  try {
    const profile = await client.get(`/api/fitness/profiles/${encodeURIComponent(modelId)}`);
    console.log('\nModel Profile:\n');
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
      console.error(`Model profile not found: ${modelId}`);
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

    console.log('\nTask Entropy (Specialization Data):\n');
    formatter.table(entropies.map(e => ({
      'Entity': e.entityId,
      'Type': e.entityType,
      'Entropy': e.entropyValue.toFixed(3),
      'Specialization': (e.specializationScore * 100).toFixed(1) + '%',
      'Tasks': e.totalTasks,
      'Unique Types': e.uniqueTaskTypes,
      'Dominant': e.dominantTaskType || '-'
    })), null, { hideEmpty: true });
  } catch (error) {
    handleApiError(error, 'listing task entropy');
    process.exit(1);
  }
}

async function getTaskEntropy(entityId, entityType = 'model') {
  try {
    const entropy = await client.get(`/api/fitness/entropy/${encodeURIComponent(entityId)}?entityType=${entityType}`);
    console.log(`\nTask Entropy for ${entityType}:${entityId}\n`);
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
      console.error(`Task entropy not found for ${entityType}:${entityId}`);
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

    console.log('\nSystem Blocks:\n');
    formatter.table(blocks.map(b => ({
      'ID': b.id,
      'Name': b.name,
      'Type': b.blockType,
      'Overridable': b.overridable ? 'Yes' : 'No',
      'Version': b.version
    })), null, { hideEmpty: true });
  } catch (error) {
    handleApiError(error, 'listing system blocks');
    process.exit(1);
  }
}

async function getSystemBlockInfo(blockId) {
  try {
    const block = await client.get(`/api/blocks/system/${encodeURIComponent(blockId)}`);
    console.log('\nSystem Block Details:\n');
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
      console.error(`System block not found: ${blockId}`);
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

    console.log('\nUser Overrides:\n');
    formatter.table(overrides.map(b => ({
      'ID': b.id,
      'Overrides': b.overridesSystemBlock,
      'Name': b.name,
      'Type': b.blockType
    })), null, { hideEmpty: true });
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
        console.error('Invalid JSON config:', e.message);
        process.exit(1);
      }
    }

    const override = await client.post(`/api/blocks/system/${encodeURIComponent(blockId)}/override`, body);
    console.log('\nOverride created successfully!\n');
    console.log(`  Override ID:    ${override.id}`);
    console.log(`  System Block:   ${override.overridesSystemBlock || blockId}`);
    console.log(`  Name:           ${override.name}`);
    console.log('');
    console.log('  To restore to default:');
    console.log(`    maestro system restore ${blockId}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`System block not found: ${blockId}`);
    } else if (error.status === 400) {
      console.error(`Cannot override: ${error.message || 'Block is not overridable'}`);
    } else {
      handleApiError(error, 'creating override');
    }
    process.exit(1);
  }
}

async function restoreSystemBlock(blockId) {
  try {
    await client.delete(`/api/blocks/system/${encodeURIComponent(blockId)}/override`);
    console.log('\nSystem block restored to default!\n');
    console.log(`  Block ID: ${blockId}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`System block not found: ${blockId}`);
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
      console.error(`Block not found: ${blockId}`);
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
    formatter.table(workspaces.map(w => ({
      'ID': w.id.substring(0, 8) + '...',
      'Name': w.name,
      'Type': w.type,
      'Status': w.status,
      'Sessions': w.sessionIds?.length || 0,
      'Projects': w.projectIds?.length || 0,
      'Isolated': w.isolation?.enabled ? 'Yes' : 'No'
    })), null, { hideEmpty: true });
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
      console.error(`Workspace not found: ${id}`);
    } else {
      handleApiError(error, 'getting workspace info');
    }
    process.exit(1);
  }
}

async function createWorkspace(options) {
  formatter.setCommand('workspace.create');
  try {
    const request = {
      name: options.name,
      type: options.type || 'Custom',
      description: options.description,
      repositoryPath: options.repoPath || null,
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
    const repoInfo = workspace.repositoryPath ? `\n  Repo:     ${workspace.repositoryPath}` : '';
    formatter.success(workspace, `\nWorkspace created successfully!\n\n  ID:       ${workspace.id}\n  Name:     ${workspace.name}\n  Type:     ${workspace.type}\n  Isolated: ${workspace.isolation?.enabled ? 'Yes' : 'No'}${repoInfo}\n`);
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
    console.log(`\nWorkspace '${id}' deleted\n`);
  } catch (error) {
    if (error.status === 404) {
      console.error(`Workspace not found: ${id}`);
    } else if (error.status === 400) {
      console.error(`Cannot delete workspace: ${error.message || 'Has active sessions or projects'}`);
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
    console.log(`\nSession '${sessionId}' added to workspace '${workspace.name}'\n`);
  } catch (error) {
    if (error.status === 404) {
      console.error(`Workspace not found: ${workspaceId}`);
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
    console.log(`\nProject '${projectId}' added to workspace '${workspace.name}'\n`);
  } catch (error) {
    if (error.status === 404) {
      console.error(`Workspace not found: ${workspaceId}`);
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

    console.log(`\nPermissions updated for workspace '${updated.name}'\n`);
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
      console.error(`Workspace not found: ${workspaceId}`);
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
      console.error('--target workspace is required');
      process.exit(1);
    }
    if (!options.agent) {
      console.error('--agent block ID is required');
      process.exit(1);
    }

    const result = await client.post(`/api/workspaces/${encodeURIComponent(sourceWorkspaceId)}/promote`, {
      targetWorkspaceId: options.target,
      agentBlockId: options.agent,
      version: options.version
    });

    if (result.success) {
      console.log('\nAgent promoted successfully!\n');
      console.log(`  Agent:    ${result.promotedBlockId}`);
      console.log(`  Version:  ${result.targetVersion}`);
      console.log(`  Audit ID: ${result.auditLogId}`);
    } else {
      console.error(`\nPromotion failed: ${result.errorMessage}\n`);
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

    console.log('\nOrchestrator Status:\n');
    console.log(`  Running:          ${status.isRunning ? 'Yes' : 'No'}`);
    console.log(`  Auto-Promotion:   ${status.autoPromotionEnabled ? 'Enabled' : 'Disabled'}`);
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
      console.log('\nNo pending promotions');
      return;
    }

    console.log(`\n⏳ Pending Promotions (${pending.length}):\n`);
    pending.forEach(p => {
      const status = p.meetsCriteria ? '✅' : '⏸️';
      console.log(`  ${status} ${p.agentName} (${p.agentId})`);
      console.log(`     From: ${p.fromWorkspace} → To: ${p.toWorkspace}`);
      console.log(`     Fitness: ${(p.currentFitness * 100).toFixed(1)}% (required: ${(p.requiredFitness * 100).toFixed(1)}%)`);
      console.log(`     Iterations: ${p.iterations} (required: ${p.requiredIterations})`);
      console.log(`     Tests: ${p.testsPassed ? 'Passed' : 'Failed'}`);
      if (p.requiresApproval) console.log(`     ⚠️  Requires manual approval`);
      if (p.blockingReason) console.log(`     Blocked: ${p.blockingReason}`);
      console.log('');
    });
  } catch (error) {
    handleApiError(error, 'getting pending promotions');
    process.exit(1);
  }
}

async function orchestratorPromote(options) {
  try {
    if (!options.agent) { console.error('--agent is required'); process.exit(1); }
    if (!options.from) { console.error('--from workspace is required'); process.exit(1); }
    if (!options.to) { console.error('--to workspace is required'); process.exit(1); }

    console.log(`\nPromoting agent ${options.agent} from ${options.from} to ${options.to}...\n`);

    const result = await client.post('/api/orchestrator/promote', {
      agentId: options.agent,
      fromWorkspace: options.from,
      toWorkspace: options.to,
      force: options.force || false
    });

    if (result.success) {
      console.log('Promotion successful!\n');
      console.log(`  Agent:   ${result.agentId}`);
      console.log(`  Version: ${result.toVersion}`);
      console.log(`  Fitness: ${(result.fitnessAtPromotion * 100).toFixed(1)}%`);
    } else {
      console.error(`Promotion failed: ${result.errorMessage}\n`);
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
    if (!options.agent) { console.error('--agent is required'); process.exit(1); }
    if (!options.workspace) { console.error('--workspace is required'); process.exit(1); }

    console.log(`\n⏪ Rolling back agent ${options.agent} in ${options.workspace}...\n`);

    const result = await client.post('/api/orchestrator/rollback', {
      agentId: options.agent,
      workspaceId: options.workspace,
      toVersion: options.version
    });

    if (result.success) {
      console.log('Rollback successful!\n');
      console.log(`  Agent:        ${result.agentId}`);
      console.log(`  From Version: ${result.fromVersion}`);
      console.log(`  To Version:   ${result.toVersion}`);
      console.log(`  Reason:       ${result.reason}`);
    } else {
      console.error(`Rollback failed: ${result.errorMessage}\n`);
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

    console.log('\nOrchestrator Configuration:\n');
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

    console.log('\nConfiguration updated!\n');
    await getOrchestratorConfig();
  } catch (error) {
    handleApiError(error, 'updating orchestrator config');
    process.exit(1);
  }
}

async function setOrchestratorAutoPromote(enabled) {
  try {
    await client.post('/api/orchestrator/auto-promote', { enabled });
    console.log(`\nAuto-promotion ${enabled ? 'enabled' : 'disabled'}\n`);
  } catch (error) {
    handleApiError(error, 'setting auto-promote');
    process.exit(1);
  }
}

async function runOrchestratorMonitor() {
  try {
    console.log('\nRunning monitoring cycle...\n');
    const result = await client.post('/api/orchestrator/monitor', {});

    console.log('Monitoring cycle complete!\n');
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
    if (!options.agent) { console.error('--agent is required'); process.exit(1); }

    console.log(`\nStarting research cycle for agent ${options.agent}...\n`);

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
      console.log('Research cycle completed successfully!\n');
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
      console.log(`Research cycle failed: ${result.errorMessage}\n`);
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

    console.log(`\nResearch Cycle Status: ${cycleId}\n`);
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
    console.log(`\nResearch cycle ${cycleId} stopped\n`);
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

    console.log(`\nPending Proposals (${proposals.length}):\n`);
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
    console.log(`\nProposal ${proposalId} approved\n`);
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
    console.log(`\nProposal ${proposalId} rejected\n`);
  } catch (error) {
    handleApiError(error, 'rejecting proposal');
    process.exit(1);
  }
}

async function getResearchConfig() {
  try {
    const config = await client.get('/api/research/config');

    console.log('\nResearch Team Configuration:\n');
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
    console.log('\nResearch configuration updated!\n');
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

    console.log('\nExecution Metrics:\n');
    formatter.table(metrics.slice(0, 20).map(m => ({
      'Execution ID': m.executionId ? m.executionId.substring(0, 8) + '...' : '—',
      'Workflow': m.workflowId ? m.workflowId.substring(0, 8) + '...' : '—',
      'Status': m.status || '-',
      'Duration': m.durationMs ? `${m.durationMs}ms` : '-',
      'Tokens': m.totalTokens || '-',
      'Cost': m.costUsd ? `$${m.costUsd.toFixed(4)}` : '-'
    })), null, { hideEmpty: true });

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
    console.log('\nAggregated Metrics:\n');
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
    formatter.table(runs.map(r => ({
      'ID': r.id ? r.id.substring(0, 8) + '...' : '—',
      'Type': r.type || 'workflow',
      'Status': r.status,
      'Started': r.startedAt ? formatDate(r.startedAt) : '-',
      'Duration': r.durationMs ? `${r.durationMs}ms` : '-'
    })), null, { hideEmpty: true });
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
      console.error(`Run not found: ${id}`);
    } else {
      handleApiError(error, 'getting run');
    }
    process.exit(1);
  }
}

// ============= Agent Foundry Commands =============

// ============= Block Testing Commands (Generic for all block types) =============

async function startBlockTest(blockId, options = {}) {
  try {
    console.log(`\nStarting test for block: ${blockId}\n`);

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

    console.log(`Test run created!\n`);
    console.log(`  Run ID:       ${run.id}`);
    console.log(`  Block:        ${run.blockId} (${run.blockType})`);
    console.log(`  Status:       ${run.status}`);
    console.log(`  Iterations:   ${run.completedIterations}/${run.totalIterations}`);
    console.log(`  Evaluator:    ${run.evaluatorType}`);

    if (run.criteria && run.criteria.length > 0) {
      console.log(`\n  Evaluation Criteria:`);
      run.criteria.forEach(cr => {
        console.log(`    - ${cr.name} (weight: ${cr.weight})`);
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

    console.log('\nBlock Test Runs:\n');
    formatter.table(runs.map(r => ({
      'ID': r.id.substring(0, 8) + '...',
      'Block': r.blockId,
      'Type': r.blockType,
      'Variant': r.variantId,
      'Status': r.status,
      'Progress': `${r.evaluatedIterations}/${r.totalIterations}`,
      'Score': r.metrics?.overallScore || '-',
      'Created': formatDate(r.createdAt)
    })), null, { hideEmpty: true });
  } catch (error) {
    handleApiError(error, 'listing test runs');
    process.exit(1);
  }
}

async function getBlockTestRunInfo(id) {
  try {
    const run = await client.getBlockTestRun(id);

    console.log('\nTest Run Details:\n');
    console.log(`  ID:           ${run.id}`);
    console.log(`  Block:        ${run.blockId} (${run.blockType})`);
    console.log(`  Variant:      ${run.variantId}`);
    console.log(`  Description:  ${run.variantDescription || 'N/A'}`);
    console.log(`  Status:       ${run.status}`);
    console.log(`  Progress:     ${run.completedIterations} executed, ${run.evaluatedIterations} evaluated`);
    console.log(`  Evaluator:    ${run.evaluatorType}`);
    console.log(`  Created:      ${new Date(run.createdAt).toLocaleString()}`);

    if (run.metrics) {
      console.log('\n  Metrics:');
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
      console.log('\n  Iterations:');
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
      console.log('\n  Improvement Suggestions:');
      run.improvementSuggestions.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
    }

    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Test run not found: ${id}`);
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
      console.log('\nNo pending evaluations for this run');
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
      console.error('Score must be between 0 and 100');
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

    console.log(`\nEvaluation submitted!`);
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

    console.log('\nTest Run Comparison:\n');

    if (comparison.bestRunId) {
      console.log(`  Best Run: ${comparison.bestRunId} (Score: ${comparison.bestScore})`);
    }

    console.log('\n  Scores by Variant:');
    for (const [variant, score] of Object.entries(comparison.scoresByVariant)) {
      console.log(`    ${variant}: ${score}`);
    }

    if (comparison.runs && comparison.runs.length > 0) {
      console.log('\n  Run Details:');
      formatter.table(comparison.runs.map(r => ({
        'ID': r.id.substring(0, 8) + '...',
        'Variant': r.variantId,
        'Score': r.metrics?.overallScore || '-',
        'Status': r.status
      })), null, { hideEmpty: true });
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
    console.log('\nAgent Foundry Leaderboard:\n');

    if (leaderboard.agents?.length > 0) {
      console.log('  Top Agents:');
      formatter.table(leaderboard.agents.map((a, i) => ({
        'Rank': i + 1,
        'Name': a.name,
        'Category': a.category || 'general',
        'Score': a.score?.toFixed(0) || '-',
        'Runs': a.runs || 0,
        'Success': a.successRate ? `${a.successRate.toFixed(0)}%` : '-'
      })), null, { hideEmpty: true });
    }

    if (leaderboard.tools?.length > 0) {
      console.log('\n  Top Tools:');
      formatter.table(leaderboard.tools.map((t, i) => ({
        'Rank': i + 1,
        'Name': t.name,
        'Category': t.category || 'general',
        'Score': t.score?.toFixed(0) || '-',
        'Runs': t.runs || 0,
        'Success': t.successRate ? `${t.successRate.toFixed(0)}%` : '-'
      })), null, { hideEmpty: true });
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
    console.log(`\n${result.message}\n`);
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

    console.log('\n' + c.bold('Provider Status:') + '\n');

    if (llmProviderHealth) {
      console.log('  ' + c.bold('Provider') + c.gray(' (localhost:8000):'));
      console.log(`    ${c.gray('Status:')}        ${c.green(llmProviderHealth.status)}`);
      console.log(`    ${c.gray('Active Model:')}  ${c.cyan(llmProviderHealth.active_model || 'none')}`);
      console.log(`    ${c.gray('Models Loaded:')} ${llmProviderHealth.models_loaded || 0}`);
      console.log(`    ${c.gray('Device:')}        ${llmProviderHealth.device || 'N/A'}`);
      if (llmProviderHealth.cuda_available) {
        console.log(`    ${c.gray('GPU:')}           ${c.green(llmProviderHealth.cuda_device_name || 'CUDA')}`);
      }
    } else {
      console.log('  ' + c.gray('LLM-Provider:') + '    ' + c.red('Not available'));
    }

    if (health) {
      console.log('\n  ' + c.bold('Backend LLM Integration:'));
      console.log(`    ${c.gray('Status:')}        ${c.status(health.status, health.status)}`);
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

    console.log('\nTraining Experiments:\n');
    formatter.table(experiments.map(e => ({
      'ID': e.id.substring(0, 12) + '...',
      'Name': e.name,
      'Status': e.status,
      'Strategy': e.strategyBlockId.replace('system:strategy-', ''),
      'Iteration': e.currentIteration,
      'Fitness': e.currentFitness.toFixed(3)
    })), null, { hideEmpty: true });
  } catch (error) {
    handleApiError(error, 'listing experiments');
    process.exit(1);
  }
}

async function getExperimentInfo(id) {
  try {
    const exp = await client.get(`/api/experiments/${encodeURIComponent(id)}`);
    console.log('\nExperiment Details:\n');
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
      console.error(`Experiment not found: ${id}`);
    } else {
      handleApiError(error, 'getting experiment info');
    }
    process.exit(1);
  }
}

async function createExperiment(options) {
  try {
    if (!options.name) { console.error('--name required'); process.exit(1); }
    if (!options.workspace) { console.error('--workspace required'); process.exit(1); }
    if (!options.agent) { console.error('--agent required'); process.exit(1); }
    if (!options.strategy) { console.error('--strategy required'); process.exit(1); }

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

    console.log('\nExperiment created!\n');
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
    console.log(`\nExperiment started: ${exp.name}`);
    console.log(`   Status: ${exp.status}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Experiment not found: ${id}`);
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

    console.log(`\nStarting ${toStart.length} experiments ${parallel ? 'in parallel' : 'sequentially'}...\n`);

    for (const exp of toStart) {
      try {
        await client.post(`/api/experiments/${encodeURIComponent(exp.id)}/start`);
        console.log(`  ${exp.name}`);
      } catch (err) {
        console.log(`  ${exp.name}: ${err.message}`);
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
    console.log(`\nExperiment paused: ${exp.name}`);
    console.log(`   Status: ${exp.status}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Experiment not found: ${id}`);
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
      console.error(`Experiment not found: ${id}`);
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
    console.log(`\nExperiment deleted: ${id}\n`);
  } catch (error) {
    if (error.status === 404) {
      console.error(`Experiment not found: ${id}`);
    } else {
      handleApiError(error, 'deleting experiment');
    }
    process.exit(1);
  }
}

async function getExperimentProgress(id) {
  try {
    const progress = await client.get(`/api/experiments/${encodeURIComponent(id)}/progress`);
    console.log('\nExperiment Progress:\n');
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
      console.error(`Experiment not found: ${id}`);
    } else {
      handleApiError(error, 'getting experiment progress');
    }
    process.exit(1);
  }
}

async function compareExperiments(ids) {
  try {
    const comparison = await client.post('/api/experiments/compare', { experimentIds: ids });

    console.log('\nExperiment Comparison:\n');
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

    console.log('\nTraining Strategies:\n');
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
    console.log('\nStrategy Details:\n');
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
    strategy.strengths.forEach(s => console.log(`    ${s}`));
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
      console.error(`Strategy not found: ${id}`);
    } else {
      handleApiError(error, 'getting strategy info');
    }
    process.exit(1);
  }
}

async function recommendStrategy(options) {
  try {
    if (!options.task) { console.error('--task required (e.g., code, reasoning, classification)'); process.exit(1); }

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

    console.log(`\nRecommended Strategies for "${options.task}":\n`);
    recommended.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name}`);
      console.log(`     ID: ${s.id}`);
      console.log(`     Method: ${s.method}`);
      console.log(`     ${s.strengths[0]}`);
      console.log('');
    });
  } catch (error) {
    handleApiError(error, 'getting strategy recommendations');
    process.exit(1);
  }
}

// ===== Block Approval Functions =====

async function listApprovals(options = {}) {
  try {
    const approvals = await client.get('/api/approvals/pending');

    if (approvals.length === 0) {
      console.log('\nNo pending approvals\n');
      return;
    }

    console.log('\nPending Block Approvals:\n');
    formatter.table(approvals.map(a => ({
      'ID': a.id.substring(0, 8) + '...',
      'Block': a.blockName,
      'Type': a.blockType,
      'Status': a.status,
      'Submitted': formatDate(a.submittedAt),
      'By': a.submittedBy || 'unknown'
    })), null, { hideEmpty: true });
    console.log(`\nTotal: ${approvals.length} pending approval(s)\n`);
  } catch (error) {
    handleApiError(error, 'listing approvals');
    process.exit(1);
  }
}

async function getApprovalInfo(id) {
  try {
    const approval = await client.get(`/api/approvals/${encodeURIComponent(id)}`);

    console.log('\nApproval Details:\n');
    console.log(`  ID:          ${approval.id}`);
    console.log(`  Block ID:    ${approval.blockId}`);
    console.log(`  Block Name:  ${approval.blockName}`);
    console.log(`  Block Type:  ${approval.blockType}`);
    console.log(`  Status:      ${approval.status}`);
    console.log(`  Session:     ${approval.sourceSessionId || 'N/A'}`);
    console.log(`  Submitted:   ${new Date(approval.submittedAt).toLocaleString()}`);
    console.log(`  Submitted By: ${approval.submittedBy || 'unknown'}`);

    if (approval.reviewedAt) {
      console.log(`  Reviewed:    ${new Date(approval.reviewedAt).toLocaleString()}`);
      console.log(`  Reviewed By: ${approval.reviewedBy || 'unknown'}`);
    }

    if (approval.rejectionReason) {
      console.log(`  Rejection:   ${approval.rejectionReason}`);
    }

    if (approval.metadata && Object.keys(approval.metadata).length > 0) {
      console.log('\n  Metadata:');
      for (const [key, value] of Object.entries(approval.metadata)) {
        console.log(`    ${key}: ${JSON.stringify(value)}`);
      }
    }
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      // Re-throw 404 so callers can fall back (e.g., block info tries approval then block)
      throw error;
    }
    handleApiError(error, 'getting approval info');
    process.exit(1);
  }
}

async function submitBlockForApproval(blockId, options = {}) {
  try {
    const body = {
      blockId,
      sessionId: options.session,
      submittedBy: options.submittedBy || 'cli-user',
      metadata: options.metadata ? JSON.parse(options.metadata) : undefined
    };

    const approval = await client.post('/api/approvals', body);

    console.log('\nBlock submitted for approval:\n');
    console.log(`  Approval ID: ${approval.id}`);
    console.log(`  Block:       ${approval.blockName} (${approval.blockType})`);
    console.log(`  Status:      ${approval.status}`);
    console.log('');
  } catch (error) {
    handleApiError(error, 'submitting block for approval');
    process.exit(1);
  }
}

async function approveBlock(id, options = {}) {
  try {
    const body = {
      reviewedBy: options.reviewedBy || 'cli-user'
    };

    const approval = await client.post(`/api/approvals/${encodeURIComponent(id)}/approve`, body);

    console.log('\nBlock approved:\n');
    console.log(`  Approval ID: ${approval.id}`);
    console.log(`  Block:       ${approval.blockName} (${approval.blockType})`);
    console.log(`  Status:      ${approval.status}`);
    console.log(`  Reviewed By: ${approval.reviewedBy}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Approval not found: ${id}`);
    } else {
      handleApiError(error, 'approving block');
    }
    process.exit(1);
  }
}

async function rejectBlock(id, reason, options = {}) {
  try {
    const body = {
      reason,
      reviewedBy: options.reviewedBy || 'cli-user'
    };

    const approval = await client.post(`/api/approvals/${encodeURIComponent(id)}/reject`, body);

    console.log('\nBlock rejected:\n');
    console.log(`  Approval ID: ${approval.id}`);
    console.log(`  Block:       ${approval.blockName} (${approval.blockType})`);
    console.log(`  Status:      ${approval.status}`);
    console.log(`  Reason:      ${approval.rejectionReason}`);
    console.log(`  Reviewed By: ${approval.reviewedBy}`);
    console.log('');
  } catch (error) {
    if (error.status === 404) {
      console.error(`Approval not found: ${id}`);
    } else {
      handleApiError(error, 'rejecting block');
    }
    process.exit(1);
  }
}

async function main() {
  // Check if first argument is a JSON object (agent input mode)
  const firstArg = process.argv[2];
  let argv;

  if (firstArg && firstArg.trim().startsWith('{')) {
    try {
      argv = JsonInputParser.parse(firstArg);
    } catch (e) {
      formatter = new OutputFormatter(true);
      formatter.error(e.message, 'PARSE_ERROR');
      process.exit(1);
    }
  } else {
    argv = minimist(process.argv.slice(2), {
      boolean: ['mock', 'help', 'h', 'force', 'push', 'run-tests', 'run-linter', 'keep-changes', 'pending-approval', 'monitor', 'list', 'no-back', 'debug', 'knowledge', 'metrics', 'full', 'start', 'json-output', 'verbose'],
      string: ['api-url', 'u', 'name', 'path', 'description', 'runtime', 'image', 'work-dir', 'block-paths', 'model', 'lines', 'since', 'working-dir', 'workdir', 'workflow', 'iterations', 'parallel', 'delay', 'goal', 'tags', 'inputs', 'config', 'from', 'to', 'limit', 'block', 'category', 'version', 'author', 'capabilities', 'tools', 'agents', 'type', 'project', 'task', 'context', 'access', 'test-command', 'linter-command', 'max-steps', 'timeout', 'message', 'branch', 'scope', 'authority', 'allowed-paths', 'denied-paths', 'filter', 'offset', 'command', 'from-session', 'template', 'reason', 'repo-path', 'status', 'recent', 'json-value'],
      alias: { 'json-output': 'json' }
    });
  }

  // Detect JSON output mode (--json flag without value, or set by JsonInputParser)
  // --json (boolean alias of --json-output) = output mode
  // --json-value <string> = legacy JSON value input
  const isJsonMode = argv.json === true || argv['json-output'] === true;
  formatter = new OutputFormatter(isJsonMode);

  // Update client URL if provided
  if (argv['api-url'] || argv.u) {
    client.baseUrl = (argv['api-url'] || argv.u).replace(/\/$/, '');
  }

  const cmd = argv._[0];

  // No command but JSON mode requested: show error instead of opening shell
  if (!cmd && isJsonMode && !argv.help && !argv.h) {
    formatter.error('No command specified. Use: maestro <command> --json', 'MISSING_COMMAND');
    process.exit(1);
  }

  // No command: launch interactive shell
  if (!cmd && !argv.help && !argv.h) {
    const { MaestroShell } = require('./shell.ts');
    const shell = new MaestroShell(async (args) => {
      // Create a new argv-like object for the command
      const innerArgv = minimist(args, {
        boolean: ['mock', 'help', 'h', 'force', 'push', 'run-tests', 'run-linter', 'keep-changes', 'pending-approval', 'monitor', 'list', 'no-back', 'debug', 'knowledge', 'metrics', 'full', 'start', 'json-output', 'verbose'],
        string: ['api-url', 'u', 'name', 'path', 'description', 'runtime', 'image', 'work-dir', 'block-paths', 'model', 'lines', 'since', 'working-dir', 'workdir', 'workflow', 'iterations', 'parallel', 'delay', 'goal', 'tags', 'inputs', 'config', 'from', 'to', 'limit', 'block', 'category', 'version', 'author', 'capabilities', 'tools', 'agents', 'type', 'project', 'task', 'context', 'access', 'test-command', 'linter-command', 'max-steps', 'timeout', 'message', 'branch', 'scope', 'authority', 'allowed-paths', 'denied-paths', 'filter', 'offset', 'command', 'from-session', 'template', 'reason', 'repo-path', 'status', 'recent', 'json-value'],
        alias: { 'json-output': 'json' }
      });
      await executeWithArgv(innerArgv);
    });
    return shell.start();
  }

  // Help flag — progressive help (P1-10)
  if (argv.help || argv.h) {
    // Check if a specific command is targeted for help
    const helpCmd = cmd;

    // Commands with their own --help: forward to executeWithArgv
    if (helpCmd === 'session' || helpCmd === 'sessions' || helpCmd === 'code') {
      return await executeWithArgv(argv);
    }

    if (helpCmd === 'block' || helpCmd === 'blocks') {
      console.log(`
${c.boldColor('cyan', 'Block Commands')}

${c.bold('Usage:')} maestro block <command> [options]

${c.bold('Read Commands:')}
  ${c.gray('(none)')} / list       List all blocks
  info <id>           Block details
  metrics <id>        Block metrics (runs, score, success rate)
  top                 Top blocks by score
  search <query>      Search blocks by name/description
  children <id>       Show block hierarchy [--recursive]
  content <id> <path> Read a file within a block

${c.bold('Write Commands:')}
  create              Create a new block (--name, --type required)
  update <id>         Update block properties
  delete <id>         Delete a block (--force required)
  content <id> <path> Write with --set <content> or --set-file <path>
  designate <id> <d>  Set designation (tool, agent)

${c.bold('Approval Commands:')}
  publish <id>        Submit block for approval
  approve <id>        Approve a pending block
  reject <id>         Reject with --reason

${c.bold('Create Options:')}
  --name <name>       Block name (required)
  --type <type>       Block type: tool, prompt, workflow, agent, etc. (required)
  --description <d>   Block description
  --tags <t1,t2>      Comma-separated tags
  --designation <d>   Set designation: tool, agent
  --category <cat>    Block category (e.g., git, code, analysis)
  --config '{...}'    JSON config object

${c.bold('Filters:')}
  --designation <d>   Filter by designation (tool, agent)
  --type <t>          Filter by block type (Workflow, prompt, etc.)
  --category <c>      Filter by category
  --limit <n>         Limit results (for top)

${c.bold('Shortcuts:')} ${c.gray('These are shorthand for block list with filters')}
  maestro agents      ${c.gray('=')} maestro block list --designation agent
  maestro tools       ${c.gray('=')} maestro block list --designation tool
  maestro workflows   ${c.gray('=')} maestro block list --type Workflow

${c.bold('Examples:')}
  maestro block create --name context-builder --type tool --description "Builds focused context"
  maestro block update context-builder --config '{"nodes":[...]}'
  maestro block content context-builder scripts/run.ps1 --set-file ./my-script.ps1
  maestro block delete old-block --force
  maestro block list --designation tool --category inference
  maestro block metrics my-block-id
  maestro block top --designation agent --limit 5
`);
      return;
    }

    if (helpCmd === 'projects') {
      console.log(`
${c.boldColor('cyan', 'Project Commands')}

${c.bold('Usage:')} maestro projects <command> [options]

${c.bold('Commands:')}
  ${c.gray('(none)')}             List all projects
  info <id>           Show project details
  create              Create project (--name, --path required)
  bind --path <p>     Bind existing directory
  open <path>         Open existing project
  delete <id>         Delete project (--force required)
  blocks <id>         List blocks in project
  discover            Discover projects in directory
  status/start/stop/restart/logs <id>  Container management

${c.bold('Create Options:')}
  --name <name>       Project name (required)
  --path <path>       Root path (required)
  --runtime <type>    Runtime: none, docker, process
  --model <model>     Default model
`);
      return;
    }

    // Default: top-level help (streamlined)
    console.log(`
${c.boldColor('cyan', 'Maestro CLI')} ${c.gray('v2.0.0')}

${c.bold('Usage:')} maestro <command> [options]
       maestro                    Launch interactive shell

${c.bold('Quick Start:')}
  ${c.cyan('maestro code')}                 Interactive mode — type tasks, see results
  ${c.cyan('maestro agent "Add login"')}    Run autonomous dev agent on a task (alias)
  ${c.cyan('maestro monitor <id>')}         Launch TUI monitor for a session

${c.bold('Status & Info:')}
  health               Check backend status (--verbose for full diagnostics)
  llm                  LLM provider status and active model
  logs [type]          View logs (audit). --limit N for count

${c.bold('Interactive:')}
  code                 Interactive mode — REPL with live session feedback
  monitor [id]         Launch TUI monitor

${c.bold('Sessions:')}
  session              Session management (--help for details)
  session create       Create (--project, --template, --start)
  session list         List sessions (--status, --recent)
  session last         Show most recent session
  session info <id>    Session details
  session invoke <id>  Invoke entry point
  session vars <id>    Variables (list/get/set/remove)
  templates            List available session templates

${c.bold('Blocks:')}
  blocks               List all blocks (--designation, --type, --category)
  block list           List blocks with filters
  block info <id>      Block details
  block metrics <id>   Block metrics (runs, score, success rate)
  block top            Top blocks by score (--designation, --type)
  block designate <id> Set block designation (tool, agent)
  search <query>       Search blocks
  children <id>        List block children (--recursive)
  catalog              Browse block catalog

${c.bold('Execution:')}
  run <block-id>       Execute any block (--input key=val, --mock)
  validate <id>        Validate a workflow

${c.bold('Projects & Workspaces:')}
  projects             Project management (--help for details)
  workspace            Workspace management
  docs                 Documentation browser

${c.bold('Training & Fitness:')}
  training             Training config and runs
  fitness              Fitness metrics and leaderboard
  experiment           Training experiments
  research             Research team cycles

${c.bold('Foundry & Testing:')}
  foundry              Agent foundry dashboard
  test                 Block testing
  approval             Block approval workflow

${c.bold('Security:')}
  auth status          Auth status (enabled/disabled)
  auth setup           Create initial admin API key
  auth create-key      Create a new API key (--name, --scope)
  auth list-keys       List all API keys
  auth revoke <id>     Revoke an API key

${c.bold('Setup:')}
  init [path]          Initialize .maestro/ in a repository
  aliases              List available command aliases

${c.bold('System:')}
  system               System block overrides
  orchestrator         Promotion orchestrator
  metrics              Execution metrics
  runs                 Execution history
  config               CLI configuration (keybindings)
  schema               Command schema (JSON output)

${c.bold('Shortcuts:')} ${c.gray('(shorthand for block list --designation/--type)')}
  agents               ${c.gray('=')} block list --designation agent
  tools                ${c.gray('=')} block list --designation tool
  workflows            ${c.gray('=')} block list --type Workflow

${c.bold('Options:')}
  --json               Structured JSON output (for agents)
  --json-value <val>   Pass JSON value to commands
  --api-url <url>      Backend URL (default: ${API_URL})
  --help, -h           Show help (use with command for details)

${c.bold('ID Shortcuts:')}
  Use ID prefixes: ${c.cyan('maestro session info f2e8')} instead of full UUID.

${c.bold('Subcommand Help:')}
  maestro session --help     Session commands
  maestro projects --help    Project commands

${c.bold('Environment:')}
  MAESTRO_API_URL      Backend URL     MAESTRO_DEBUG   Debug logging
`);
    return;
  }

  // Execute with the parsed argv
  return await executeWithArgv(argv);
}

// ============================================================
// Documentation commands
// ============================================================

async function listDocs(options = {}) {
  try {
    // Read system docs index
    const systemIndexPath = path.join(getContentPath('system'), 'docs', 'index.json');
    const systemIndex = loadJson(systemIndexPath);

    // Read user docs index
    const userIndexPath = path.join(getContentPath('user'), 'docs', 'index.json');
    const userIndex = loadJson(userIndexPath);

    // Display system docs
    formatter.info('System Documentation');
    if (systemIndex && systemIndex.categories) {
      const cats = Object.entries(systemIndex.categories);
      if (options.category) {
        const filtered = cats.filter(([key]) => key === options.category);
        if (filtered.length === 0) {
          console.log(`  No system category matching "${options.category}"`);
        }
        filtered.forEach(([key, val]) => {
          console.log(`  [${key}] ${val.description} (${val.path})`);
        });
      } else {
        cats.forEach(([key, val]) => {
          console.log(`  [${key}] ${val.description} (${val.path})`);
        });
      }

      // List model entries if models category exists
      const modelsIndexPath = path.join(getContentPath('system'), 'docs', 'models', 'index.json');
      const modelsIndex = loadJson(modelsIndexPath);
      if (modelsIndex && modelsIndex.entries && (!options.category || options.category === 'models')) {
        console.log('');
        formatter.info('Model Documentation');
        const rows = modelsIndex.entries.map(e => ({
          'Model': e.modelId,
          'Parameters': e.parameters,
          'Fitness': Array.isArray(e.fitnessRange) ? e.fitnessRange.join(' - ') : 'N/A',
          'Status': e.status,
          'Doc': e.docPath
        }));
        formatter.table(rows);
      }
    } else {
      console.log('  No system documentation index found.');
    }

    // Display user docs
    console.log('');
    formatter.info('User Documentation');
    if (userIndex && userIndex.categories) {
      const cats = Object.entries(userIndex.categories);
      if (options.category) {
        const filtered = cats.filter(([key]) => key === options.category);
        if (filtered.length === 0) {
          console.log(`  No user category matching "${options.category}"`);
        }
        filtered.forEach(([key, val]) => {
          console.log(`  [${key}] ${val.description} (${val.path})`);
        });
      } else {
        cats.forEach(([key, val]) => {
          console.log(`  [${key}] ${val.description} (${val.path})`);
        });
      }
    } else {
      console.log('  No user documentation index found.');
    }

    // Display knowledge articles if --knowledge flag
    if (options.knowledge) {
      console.log('');
      formatter.info('Knowledge Articles');
      const knowledgeIndexPath = path.join(getContentPath('user'), 'docs', 'knowledge', 'index.json');
      const knowledgeIndex = loadJson(knowledgeIndexPath);
      if (knowledgeIndex && knowledgeIndex.articles && knowledgeIndex.articles.length > 0) {
        const rows = knowledgeIndex.articles.map(a => ({
          'Title': a.title || a.id || 'Untitled',
          'Category': a.category || 'N/A',
          'Confidence': a.confidence || 'N/A',
          'Status': a.status || 'N/A'
        }));
        formatter.table(rows);
      } else {
        console.log('  No knowledge articles found.');
      }
      if (knowledgeIndex && knowledgeIndex.statistics) {
        console.log(`  Statistics: ${knowledgeIndex.statistics.totalArticles || 0} total articles`);
      }
    }
  } catch (error) {
    formatter.error(`Failed to list docs: ${error.message}`, 'DOCS_ERROR');
  }
}

async function showDoc(topic, options = {}) {
  try {
    let filePath = null;

    // Search in system docs models
    const modelsDir = path.join(getContentPath('system'), 'docs', 'models');
    if (fs.existsSync(modelsDir)) {
      const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.md'));
      const match = files.find(f => {
        const name = f.replace(/\.md$/, '');
        return name === topic || name.toLowerCase() === topic.toLowerCase();
      });
      if (match) {
        filePath = path.join(modelsDir, match);
      }
    }

    // Search in user docs knowledge subdirs
    if (!filePath) {
      const knowledgeDir = path.join(getContentPath('user'), 'docs', 'knowledge');
      if (fs.existsSync(knowledgeDir)) {
        const subdirs = fs.readdirSync(knowledgeDir).filter(d => {
          try { return fs.statSync(path.join(knowledgeDir, d)).isDirectory(); } catch { return false; }
        });
        for (const subdir of subdirs) {
          const subPath = path.join(knowledgeDir, subdir);
          const files = fs.readdirSync(subPath).filter(f => f.endsWith('.md'));
          const match = files.find(f => {
            const name = f.replace(/\.md$/, '');
            return name === topic || name.toLowerCase() === topic.toLowerCase();
          });
          if (match) {
            filePath = path.join(subPath, match);
            break;
          }
        }
      }
    }

    // Also search in system docs guides, blocks dirs
    if (!filePath) {
      const searchDirs = [
        path.join(getContentPath('system'), 'docs', 'guides'),
        path.join(getContentPath('system'), 'docs', 'blocks'),
        path.join(getContentPath('user'), 'docs', 'metrics')
      ];
      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
        const match = files.find(f => {
          const name = f.replace(/\.md$/, '');
          return name === topic || name.toLowerCase() === topic.toLowerCase();
        });
        if (match) {
          filePath = path.join(dir, match);
          break;
        }
      }
    }

    if (!filePath) {
      formatter.error(`Documentation not found for topic: ${topic}`, 'NOT_FOUND');
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    if (options.json) {
      // Extract YAML frontmatter
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (fmMatch) {
        const fmText = fmMatch[1];
        const frontmatter = {};
        fmText.split('\n').forEach(line => {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            const key = line.substring(0, colonIdx).trim();
            const value = line.substring(colonIdx + 1).trim();
            frontmatter[key] = value;
          }
        });
        formatter.success({ path: filePath, frontmatter }, JSON.stringify({ path: filePath, frontmatter }, null, 2));
      } else {
        formatter.success({ path: filePath, frontmatter: null }, JSON.stringify({ path: filePath, frontmatter: null }, null, 2));
      }
    } else {
      formatter.info(`Documentation: ${topic} (${filePath})`);
      console.log('');
      console.log(content);
    }
  } catch (error) {
    formatter.error(`Failed to show doc: ${error.message}`, 'DOCS_ERROR');
  }
}

async function searchDocs(query) {
  try {
    const results = [];
    const queryLower = query.toLowerCase();

    // Search index files
    const indexFiles = [
      { path: path.join(getContentPath('system'), 'docs', 'index.json'), scope: 'system' },
      { path: path.join(getContentPath('user'), 'docs', 'index.json'), scope: 'user' },
      { path: path.join(getContentPath('system'), 'docs', 'models', 'index.json'), scope: 'system/models' },
      { path: path.join(getContentPath('user'), 'docs', 'knowledge', 'index.json'), scope: 'user/knowledge' }
    ];

    for (const idx of indexFiles) {
      if (!fs.existsSync(idx.path)) continue;
      const content = fs.readFileSync(idx.path, 'utf8');
      if (content.toLowerCase().includes(queryLower)) {
        results.push({ File: idx.path, Scope: idx.scope, Type: 'index' });
      }
    }

    // Search .md files in docs directories
    const searchDirs = [
      { dir: path.join(getContentPath('system'), 'docs', 'models'), scope: 'system/models' },
      { dir: path.join(getContentPath('system'), 'docs', 'guides'), scope: 'system/guides' },
      { dir: path.join(getContentPath('system'), 'docs', 'blocks'), scope: 'system/blocks' },
      { dir: path.join(getContentPath('user'), 'docs', 'metrics'), scope: 'user/metrics' }
    ];

    // Also search knowledge subdirs
    const knowledgeDir = path.join(getContentPath('user'), 'docs', 'knowledge');
    if (fs.existsSync(knowledgeDir)) {
      const subdirs = fs.readdirSync(knowledgeDir).filter(d => {
        try { return fs.statSync(path.join(knowledgeDir, d)).isDirectory(); } catch { return false; }
      });
      for (const subdir of subdirs) {
        searchDirs.push({ dir: path.join(knowledgeDir, subdir), scope: `user/knowledge/${subdir}` });
      }
    }

    for (const { dir, scope } of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      let files;
      try { files = fs.readdirSync(dir).filter(f => f.endsWith('.md')); } catch { continue; }
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.toLowerCase().includes(queryLower)) {
            // Extract a snippet around the match
            const idx = content.toLowerCase().indexOf(queryLower);
            const start = Math.max(0, idx - 40);
            const end = Math.min(content.length, idx + query.length + 40);
            const snippet = content.substring(start, end).replace(/\n/g, ' ').trim();
            results.push({ File: file, Scope: scope, Type: 'doc', Snippet: `...${snippet}...` });
          }
        } catch { /* skip unreadable files */ }
      }
    }

    if (results.length === 0) {
      console.log(`No documentation found matching "${query}"`);
      return;
    }

    formatter.info(`Search results for "${query}" (${results.length} matches)`);
    formatter.table(results);
  } catch (error) {
    formatter.error(`Failed to search docs: ${error.message}`, 'DOCS_ERROR');
  }
}

async function generateDocs(options = {}) {
  try {
    if (options.metrics) {
      formatter.info('Metrics Documentation Pipeline');
      console.log('  This would invoke the metrics documentation pipeline workflow.');
      console.log('  The pipeline reads session metrics from content/user/training/ and content/user/testing/');
      console.log('  and generates documentation in content/user/docs/metrics/.');
      console.log('');
      console.log('  To run this pipeline, start a session with the docs-metrics workflow:');
      console.log('    maestro session create --type foundry --name "Metrics Docs"');
      console.log('    maestro session invoke <id> generate-metrics-docs');
      return;
    }

    if (options.knowledge) {
      formatter.info('Knowledge Documentation Pipeline');
      console.log('  This would invoke the knowledge synthesis pipeline workflow.');
      console.log('  The pipeline reads observations and metrics to generate knowledge articles');
      console.log('  in content/user/docs/knowledge/.');
      console.log('');
      console.log('  To run this pipeline, start a session with the docs-knowledge workflow:');
      console.log('    maestro session create --type foundry --name "Knowledge Synthesis"');
      console.log('    maestro session invoke <id> generate-knowledge');
      return;
    }

    // Default: show both pipelines
    formatter.info('Documentation Generation Pipelines');
    console.log('');
    console.log('  Available pipelines:');
    console.log('    --metrics     Generate metrics documentation (deterministic pipeline)');
    console.log('    --knowledge   Generate knowledge articles (LLM-powered pipeline)');
    console.log('');
    console.log(`  Scope: ${options.scope || 'user'}`);
    console.log('');
    console.log('  Usage:');
    console.log('    maestro docs generate --metrics');
    console.log('    maestro docs generate --knowledge');
    console.log('    maestro docs generate --knowledge --scope system');
  } catch (error) {
    formatter.error(`Failed to generate docs: ${error.message}`, 'DOCS_ERROR');
  }
}

// ============================================================
// Catalog commands
// ============================================================

async function listCatalog(options = {}) {
  try {
    const allEntries = [];

    // Read system catalog
    const systemCatalogPath = path.join(getContentPath('system'), 'catalog', 'index.json');
    const systemCatalog = loadJson(systemCatalogPath);
    if (systemCatalog && systemCatalog.entries) {
      systemCatalog.entries.forEach(e => {
        allEntries.push({ ...e, scope: 'system' });
      });
    }

    // Read user catalog
    const userCatalogPath = path.join(getContentPath('user'), 'catalog', 'index.json');
    const userCatalog = loadJson(userCatalogPath);
    if (userCatalog && userCatalog.entries) {
      userCatalog.entries.forEach(e => {
        allEntries.push({ ...e, scope: 'user' });
      });
    }

    if (allEntries.length === 0) {
      console.log('No catalog entries found.');
      console.log('  System catalog: ' + systemCatalogPath);
      console.log('  User catalog:   ' + userCatalogPath);
      return;
    }

    // Filter by category if specified
    let filtered = allEntries;
    if (options.category) {
      filtered = allEntries.filter(e =>
        (e.category || '').toLowerCase() === options.category.toLowerCase() ||
        (e.type || '').toLowerCase() === options.category.toLowerCase()
      );
    }

    if (filtered.length === 0) {
      console.log(`No catalog entries matching category "${options.category}"`);
      return;
    }

    formatter.info(`Block Catalog (${filtered.length} entries)`);
    const rows = filtered.map(e => ({
      'ID': e.id || e.blockId || 'N/A',
      'Type': e.type || 'N/A',
      'Fitness': e.fitness != null ? String(e.fitness) : (Array.isArray(e.fitnessRange) ? e.fitnessRange.join('-') : 'N/A'),
      'Requires': Array.isArray(e.requires) ? e.requires.join(', ') : (e.requires || 'N/A'),
      'Author': e.author || 'N/A',
      'Scope': e.scope
    }));
    formatter.table(rows);
  } catch (error) {
    formatter.error(`Failed to list catalog: ${error.message}`, 'CATALOG_ERROR');
  }
}

async function showCatalogEntry(blockId) {
  try {
    let entry = null;
    let catalogScope = null;

    // Search system catalog
    const systemCatalogPath = path.join(getContentPath('system'), 'catalog', 'index.json');
    const systemCatalog = loadJson(systemCatalogPath);
    if (systemCatalog && systemCatalog.entries) {
      entry = systemCatalog.entries.find(e => (e.id || e.blockId) === blockId);
      if (entry) catalogScope = 'system';
    }

    // Search user catalog if not found
    if (!entry) {
      const userCatalogPath = path.join(getContentPath('user'), 'catalog', 'index.json');
      const userCatalog = loadJson(userCatalogPath);
      if (userCatalog && userCatalog.entries) {
        entry = userCatalog.entries.find(e => (e.id || e.blockId) === blockId);
        if (entry) catalogScope = 'user';
      }
    }

    if (!entry) {
      formatter.error(`Catalog entry not found: ${blockId}`, 'NOT_FOUND');
      return;
    }

    formatter.info(`Catalog Entry: ${blockId} (${catalogScope})`);
    console.log('');

    // Display all entry fields
    Object.entries(entry).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        console.log(`  ${key}: ${value.join(', ')}`);
      } else if (typeof value === 'object' && value !== null) {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });

    // Look for manifest.json in the block directory
    const manifestPaths = [
      path.join(getContentPath('system'), 'catalog', blockId, 'manifest.json'),
      path.join(getContentPath('user'), 'catalog', blockId, 'manifest.json'),
      path.join(getContentPath('system'), 'blocks', blockId, 'manifest.json'),
      path.join(getContentPath('user'), 'blocks', blockId, 'manifest.json')
    ];

    for (const mp of manifestPaths) {
      if (fs.existsSync(mp)) {
        console.log('');
        formatter.info('Manifest');
        const manifest = loadJson(mp);
        if (manifest) {
          if (manifest.fitness) {
            console.log('  Fitness Levels:');
            Object.entries(manifest.fitness).forEach(([key, val]) => {
              console.log(`    ${key}: ${val}`);
            });
          }
          if (manifest.requirements) {
            console.log('  Requirements:');
            (Array.isArray(manifest.requirements) ? manifest.requirements : [manifest.requirements]).forEach(r => {
              console.log(`    - ${typeof r === 'string' ? r : JSON.stringify(r)}`);
            });
          }
          if (manifest.metrics) {
            console.log('  Metrics:');
            Object.entries(manifest.metrics).forEach(([key, val]) => {
              console.log(`    ${key}: ${val}`);
            });
          }
        }
        break;
      }
    }
  } catch (error) {
    formatter.error(`Failed to show catalog entry: ${error.message}`, 'CATALOG_ERROR');
  }
}

async function searchCatalog(query) {
  try {
    const queryLower = query.toLowerCase();
    const allEntries = [];

    // Read both catalogs
    const catalogPaths = [
      { path: path.join(getContentPath('system'), 'catalog', 'index.json'), scope: 'system' },
      { path: path.join(getContentPath('user'), 'catalog', 'index.json'), scope: 'user' }
    ];

    for (const cp of catalogPaths) {
      const catalog = loadJson(cp.path);
      if (catalog && catalog.entries) {
        catalog.entries.forEach(e => {
          allEntries.push({ ...e, scope: cp.scope });
        });
      }
    }

    // Search by name, description, tags, id
    const results = allEntries.filter(e => {
      const searchable = [
        e.id, e.blockId, e.name, e.description,
        ...(Array.isArray(e.tags) ? e.tags : []),
        e.type, e.category, e.author
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(queryLower);
    });

    if (results.length === 0) {
      console.log(`No catalog entries matching "${query}"`);
      return;
    }

    formatter.info(`Catalog search results for "${query}" (${results.length} matches)`);
    const rows = results.map(e => ({
      'ID': e.id || e.blockId || 'N/A',
      'Type': e.type || 'N/A',
      'Name': e.name || 'N/A',
      'Description': (e.description || '').substring(0, 60),
      'Scope': e.scope
    }));
    formatter.table(rows);
  } catch (error) {
    formatter.error(`Failed to search catalog: ${error.message}`, 'CATALOG_ERROR');
  }
}

async function getBlockInfoExtended(blockId) {
  try {
    // Try API first
    let block = null;
    try {
      block = await client.getBlock(blockId);
    } catch {
      // API may not be running, that's OK
    }

    if (block) {
      formatter.info(`Block: ${block.name || blockId}`);
      console.log(`  ID:       ${block.id}`);
      console.log(`  Type:     ${block.type}`);
      console.log(`  Atomic:   ${block.isAtomic}`);
      if (block.description) console.log(`  Desc:     ${block.description}`);
      if (block.parentId) console.log(`  Parent:   ${block.parentId}`);
    } else {
      formatter.info(`Block: ${blockId} (API unavailable, showing local data only)`);
    }

    // Look for manifest.json to add fitness data
    const manifestPaths = [
      path.join(getContentPath('system'), 'blocks', blockId, 'manifest.json'),
      path.join(getContentPath('user'), 'blocks', blockId, 'manifest.json'),
      path.join(getContentPath('system'), 'catalog', blockId, 'manifest.json'),
      path.join(getContentPath('user'), 'catalog', blockId, 'manifest.json')
    ];

    let manifestFound = false;
    for (const mp of manifestPaths) {
      if (fs.existsSync(mp)) {
        const manifest = loadJson(mp);
        if (manifest) {
          manifestFound = true;
          console.log('');
          formatter.info('Extended Info (from manifest)');
          if (manifest.fitness) {
            console.log('  Fitness Levels:');
            Object.entries(manifest.fitness).forEach(([key, val]) => {
              console.log(`    ${key}: ${val}`);
            });
          }
          if (manifest.requirements) {
            console.log('  Requirements:');
            (Array.isArray(manifest.requirements) ? manifest.requirements : [manifest.requirements]).forEach(r => {
              console.log(`    - ${typeof r === 'string' ? r : JSON.stringify(r)}`);
            });
          }
          if (manifest.version) console.log(`  Version:  ${manifest.version}`);
          if (manifest.author) console.log(`  Author:   ${manifest.author}`);
          if (manifest.metrics) {
            console.log('  Metrics:');
            Object.entries(manifest.metrics).forEach(([key, val]) => {
              console.log(`    ${key}: ${val}`);
            });
          }
        }
        break;
      }
    }

    if (!manifestFound && !block) {
      formatter.error(`Block not found: ${blockId}`, 'NOT_FOUND');
    }
  } catch (error) {
    formatter.error(`Failed to get block info: ${error.message}`, 'BLOCK_ERROR');
  }
}

/**
 * Executes a command based on parsed arguments.
 * This function is called by both main() and the interactive shell.
 */
// P3-36: Track if we've checked backend connectivity
let _backendChecked = false;

async function checkBackendOnce() {
  if (_backendChecked) return;
  _backendChecked = true;
  try {
    await client._fetch('GET', '/api/health');
  } catch (e) {
    if (e.code === 'ECONNREFUSED' || e.message?.includes('ECONNREFUSED')) {
      console.error(c.warn(`Backend not reachable at ${client.baseUrl}`));
      console.error(c.gray('   Start services: powershell -File dev-scripts/dev-start.ps1'));
      console.error('');
    }
  }
}

// ============= Models Commands (Phase 19: LLM Integration) =============

async function listModelsCmd(options = {}) {
  formatter.setCommand('models');
  try {
    const data = await client.listLLMModels(options.category || null);
    if (!data || !data.models || data.models.length === 0) {
      formatter.info('No compatible models found. Is the LLM Provider running?');
      return;
    }

    const hw = data.hardware;
    if (hw) {
      console.log('\n' + c.bold('Hardware:') + ' ' +
        (hw.gpuName ? `${c.cyan(hw.gpuName)} — ${hw.vramFreeGb?.toFixed(1)}/${hw.vramTotalGb?.toFixed(1)} GB VRAM` : c.yellow('CPU only')));
    }

    if (data.summary) {
      console.log(c.gray(`  ${data.summary.totalCompatible} compatible models (${data.summary.fullPrecisionCount} full precision, ${data.summary.int8RequiredCount} int8, ${data.summary.int4RequiredCount} int4)\n`));
    }

    const rows = data.models.slice(0, options.limit || 25).map(m => ({
      'Model': m.modelId?.length > 45 ? m.modelId.substring(0, 42) + '...' : m.modelId,
      'Size': m.parametersB ? `${m.parametersB}B` : '?',
      'VRAM': m.vramRequired ? `${m.vramRequired.toFixed(1)}GB` : '?',
      'Precision': m.recommendedPrecision || '-',
      'Local': m.isLocal ? c.green('Yes') : c.gray('No'),
      'Category': m.category || '-'
    }));

    formatter.table(rows, `Compatible Models (${data.count})`);
  } catch (error) {
    handleApiError(error, 'listing models');
    process.exit(EXIT.SERVER_ERROR);
  }
}

async function listLocalModelsCmd() {
  formatter.setCommand('models.local');
  try {
    const data = await client.getLocalModels();
    if (!data || !data.models || data.models.length === 0) {
      formatter.info('No locally cached models found.');
      return;
    }

    const rows = data.models.map(m => ({
      'Model': m.displayName || m.modelId,
      'Size': m.sizeGb ? `${m.sizeGb.toFixed(1)} GB` : '?',
      'Category': m.category || '-',
      'Complete': m.isComplete ? c.green('Yes') : c.yellow('Partial')
    }));

    formatter.table(rows, `Local Models (${data.count})`);
  } catch (error) {
    handleApiError(error, 'listing local models');
    process.exit(EXIT.SERVER_ERROR);
  }
}

async function listRegistryModelsCmd(options = {}) {
  formatter.setCommand('models.registry');
  try {
    const data = await client.getRegistryModels(options.category || null);
    if (!data || !data.models || data.models.length === 0) {
      formatter.info('No registry models found.');
      return;
    }

    console.log(c.gray(`\nCategories: ${(data.categories || []).join(', ')}\n`));

    const rows = data.models.map(m => ({
      'Model': m.modelId?.length > 45 ? m.modelId.substring(0, 42) + '...' : m.modelId,
      'Size': m.parametersB ? `${m.parametersB}B` : '?',
      'VRAM FP16': m.vramFp16Gb ? `${m.vramFp16Gb.toFixed(1)}GB` : '?',
      'Category': m.category || '-',
      'Local': m.isLocal ? c.green('Yes') : c.gray('No'),
      'License': m.license || '-'
    }));

    formatter.table(rows, `Registry Models (${data.count})`);
  } catch (error) {
    handleApiError(error, 'listing registry models');
    process.exit(EXIT.SERVER_ERROR);
  }
}

async function loadModelCmd(modelId, options = {}) {
  formatter.setCommand('models.load');
  if (!modelId) {
    formatter.error('Model ID is required. Usage: maestro models load <model-id>', 'MISSING_ARG');
    process.exit(EXIT.USER_ERROR);
  }
  try {
    console.log(c.gray(`Loading model: ${modelId}...`));
    const result = await client.loadModel(modelId, !!options['8bit']);
    formatter.success(result,
      `\n${c.ok('Model loaded:')}\n` +
      `  ${c.gray('Model:')}     ${c.cyan(result.modelId || modelId)}\n` +
      `  ${c.gray('Status:')}    ${c.green(result.status)}\n` +
      `  ${c.gray('Device:')}    ${result.device || 'N/A'}\n` +
      `  ${c.gray('Load Time:')} ${result.loadTimeS?.toFixed(1) || '?'}s\n`
    );
  } catch (error) {
    handleApiError(error, 'loading model');
    process.exit(EXIT.SERVER_ERROR);
  }
}

async function switchModelCmd(modelId, options = {}) {
  formatter.setCommand('models.switch');
  if (!modelId) {
    formatter.error('Model ID is required. Usage: maestro models switch <model-id>', 'MISSING_ARG');
    process.exit(EXIT.USER_ERROR);
  }
  try {
    console.log(c.gray(`Switching to model: ${modelId}...`));
    const result = await client.switchModel(modelId, !!options['8bit']);
    formatter.success(result,
      `\n${c.ok('Model switched:')}\n` +
      `  ${c.gray('Active Model:')} ${c.cyan(result.activeModel || modelId)}\n` +
      `  ${c.gray('Status:')}       ${c.green(result.status)}\n` +
      `  ${c.gray('Load Time:')}    ${result.loadTimeS?.toFixed(1) || '?'}s\n`
    );
  } catch (error) {
    handleApiError(error, 'switching model');
    process.exit(EXIT.SERVER_ERROR);
  }
}

async function showSystemInfoCmd() {
  formatter.setCommand('provider.capabilities');
  try {
    const caps = await client.getLLMCapabilities();
    console.log('\n' + c.bold('System Capabilities:') + '\n');

    if (caps.gpu && caps.gpu.available) {
      console.log('  ' + c.bold('GPU:'));
      console.log(`    ${c.gray('Name:')}              ${c.cyan(caps.gpu.name || 'Unknown')}`);
      console.log(`    ${c.gray('VRAM:')}              ${caps.gpu.vramFreeGb?.toFixed(1)} / ${caps.gpu.vramTotalGb?.toFixed(1)} GB free`);
      console.log(`    ${c.gray('CUDA:')}              ${caps.gpu.cudaVersion || 'N/A'}`);
      console.log(`    ${c.gray('Compute:')}           ${caps.gpu.computeCapability || 'N/A'}`);
    } else {
      console.log('  ' + c.yellow('GPU: Not available'));
    }

    if (caps.cpu) {
      console.log('\n  ' + c.bold('CPU:'));
      console.log(`    ${c.gray('Name:')}              ${caps.cpu.name || 'Unknown'}`);
      console.log(`    ${c.gray('Cores:')}             ${caps.cpu.coresPhysical || '?'} physical / ${caps.cpu.coresLogical || '?'} logical`);
    }

    if (caps.ram) {
      console.log('\n  ' + c.bold('RAM:'));
      console.log(`    ${c.gray('Available:')}         ${caps.ram.availableGb?.toFixed(1)} / ${caps.ram.totalGb?.toFixed(1)} GB`);
    }

    if (caps.platform) console.log(`\n  ${c.gray('Platform:')}          ${caps.platform}`);
    if (caps.torchVersion) console.log(`  ${c.gray('PyTorch:')}           ${caps.torchVersion}`);
    console.log('');

    formatter.success(caps);
  } catch (error) {
    handleApiError(error, 'getting system info');
    process.exit(EXIT.SERVER_ERROR);
  }
}

// ============= Chat Command (Phase 19) =============

async function chatCmd(options = {}) {
  formatter.setCommand('chat');
  const readline = require('readline');

  const messages = [];
  if (options.system) {
    messages.push({ role: 'system', content: options.system });
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: c.cyan('You: ')
  });

  console.log('\n' + c.bold('Maestro Chat') + c.gray(' (type /exit to quit, /clear to reset, /model <id> to switch)'));
  if (options.model) console.log(c.gray(`  Model: ${options.model}`));
  console.log('');

  let currentModel = options.model || null;

  rl.prompt();
  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    // In-session commands
    if (input === '/exit' || input === '/quit') {
      console.log(c.gray('\nGoodbye!'));
      rl.close();
      process.exit(0);
    }
    if (input === '/clear') {
      messages.length = 0;
      if (options.system) messages.push({ role: 'system', content: options.system });
      console.log(c.gray('  (conversation cleared)'));
      rl.prompt();
      return;
    }
    if (input.startsWith('/model ')) {
      currentModel = input.slice(7).trim();
      console.log(c.gray(`  Model switched to: ${currentModel}`));
      rl.prompt();
      return;
    }

    messages.push({ role: 'user', content: input });

    try {
      const response = await client.chatCompletion(messages, {
        model: currentModel,
        temperature: options.temperature ? parseFloat(options.temperature) : undefined,
        maxTokens: options.maxTokens ? parseInt(options.maxTokens) : undefined
      });

      const content = response.content || response.choices?.[0]?.message?.content || '(no response)';
      messages.push({ role: 'assistant', content });
      console.log('\n' + c.green('Assistant: ') + content + '\n');
    } catch (error) {
      console.error(c.red(`  Error: ${error.message}`));
    }

    rl.prompt();
  });
}

// ============= Setup Wizard (Phase 19) =============

async function setupWizardCmd() {
  formatter.setCommand('setup');
  const { readConfig, updateConfig, getConfigPath } = require('./config.ts');

  console.log('\n' + c.bold('Maestro Setup Wizard') + '\n');

  // Step 1: Check backend
  console.log(c.gray('Checking backend...'));
  try {
    const health = await client.getHealth();
    console.log(`  Backend:       ${c.green('HEALTHY')} (${API_URL})`);
  } catch (e) {
    console.log(`  Backend:       ${c.red('NOT RUNNING')} (${API_URL})`);
    console.log(c.gray('  Start with: powershell -File dev-scripts/dev-start.ps1'));
  }

  // Step 2: Check Provider
  console.log(c.gray('Checking Provider...'));
  try {
    const providerHealth = await client.getLLMHealth();
    console.log(`  Provider:      ${c.green(providerHealth.status || 'HEALTHY')}`);
    if (providerHealth.activeModel) console.log(`  Active Model:  ${c.cyan(providerHealth.activeModel)}`);
    if (providerHealth.cudaDeviceName) console.log(`  GPU:           ${c.cyan(providerHealth.cudaDeviceName)}`);
  } catch (e) {
    console.log(`  Provider:      ${c.red('NOT RUNNING')}`);
  }

  // Step 3: Show hardware
  console.log(c.gray('\nChecking hardware...'));
  try {
    const caps = await client.getLLMCapabilities();
    if (caps.gpu?.available) {
      console.log(`  GPU:           ${c.cyan(caps.gpu.name)} (${caps.gpu.vramFreeGb?.toFixed(1)}/${caps.gpu.vramTotalGb?.toFixed(1)} GB VRAM)`);
    }
    if (caps.ram) {
      console.log(`  RAM:           ${caps.ram.availableGb?.toFixed(1)}/${caps.ram.totalGb?.toFixed(1)} GB`);
    }
  } catch (e) {
    console.log(c.gray('  (hardware info unavailable — LLM Provider not running)'));
  }

  // Step 4: Show compatible models
  console.log(c.gray('\nCompatible models:'));
  try {
    const models = await client.listLLMModels();
    if (models?.models?.length > 0) {
      const top5 = models.models.filter(m => m.recommended).slice(0, 5);
      if (top5.length === 0) top5.push(...models.models.slice(0, 5));
      top5.forEach(m => {
        const local = m.isLocal ? c.green(' [local]') : '';
        console.log(`  ${c.cyan(m.modelId)} (${m.parametersB}B, ${m.vramRequired?.toFixed(1) || '?'}GB VRAM)${local}`);
      });
    }
  } catch (e) {
    console.log(c.gray('  (model list unavailable)'));
  }

  // Step 5: Save config
  const config = readConfig();
  if (!config.backendUrl) config.backendUrl = API_URL;
  updateConfig(config);
  console.log(`\n${c.ok('Config saved to:')} ${getConfigPath()}`);

  // Step 6: Test chat
  console.log(c.gray('\nTesting chat...'));
  try {
    const response = await client.chatCompletion(
      [{ role: 'user', content: 'Say "Hello from Maestro!" in one sentence.' }],
      { maxTokens: 50 }
    );
    const content = response.content || response.choices?.[0]?.message?.content;
    if (content) {
      console.log(`  ${c.green('Chat works!')} Response: ${content.trim()}`);
    } else {
      console.log(c.yellow('  Chat responded but no content returned.'));
    }
  } catch (e) {
    console.log(c.yellow('  Chat test skipped (LLM Provider not available).'));
  }

  console.log(`\n${c.ok('Setup complete!')} Run ${c.cyan('maestro health')} to verify.\n`);
}

async function executeWithArgv(argv) {
  const cmd = argv._[0];

  // P3-36: Startup health check on first API command (skip for local-only commands)
  const localCommands = ['health', 'schema', 'templates', 'template'];
  if (!localCommands.includes(cmd) && cmd !== 'monitor') {
    await checkBackendOnce();
  }

  // ─── Phase 18: Block type shorthand resolution ───
  // 'tools' → block list --designation tool
  // 'agents' → block list --designation agent
  // 'workflows' → block list --type Workflow
  // 'prompts' → block list --type prompt
  const BLOCK_TYPE_SHORTCUTS = {
    'tools': { designation: 'tool' },
    'tool': { designation: 'tool' },
    'agents': { designation: 'agent' },
    'agent': { designation: 'agent' },
    'workflows': { type: 'Workflow' },
    'workflow': { type: 'Workflow' },
    'prompts': { type: 'prompt' },
    'prompt': { type: 'prompt' },
  };

  try {
    // ─── Phase 32-B: Alias resolution (runs BEFORE normal dispatch) ───
    // Check if cmd matches an alias. Built-in commands are never overridden.
    const BUILTIN_COMMANDS = new Set([
      'blocks', 'block', 'session', 'sessions', 'health', 'llm', 'logs', 'monitor', 'code',
      'templates', 'template', 'run', 'execute', 'validate', 'projects', 'workspace',
      'docs', 'training', 'fitness', 'experiment', 'research', 'foundry', 'test',
      'approval', 'approvals', 'auth', 'init', 'aliases', 'system', 'orchestrator', 'metrics',
      'runs', 'config', 'schema', 'search', 'catalog', 'children', 'info', 'chat',
      'setup', 'tools', 'agents', 'workflows', 'prompts',
    ]);

    if (cmd && !BUILTIN_COMMANDS.has(cmd)) {
      const aliases = loadAliases();
      if (aliases[cmd]) {
        // Collect the task argument: everything after the alias name
        const taskArg = argv._.slice(1).join(' ') || argv.task || '';
        return await executeAlias(cmd, aliases[cmd], taskArg);
      }
    }

    // Phase 18: 'blocks' now supports --designation, --type, --category, --limit, --sort filters
    if (cmd === 'blocks') {
      // Interactive mode with -i flag (requires TTY)
      if (argv.i || argv.interactive) {
        return await launchInteractiveBlocksTable({
          designation: argv.designation,
          type: argv.type,
          category: argv.category,
        });
      }
      return await listBlocks({
        designation: argv.designation,
        type: argv.type,
        category: argv.category,
        limit: argv.limit ? parseInt(argv.limit) : undefined,
        sort: argv.sort,
      });
    }

    // Block command — unified block management (Phase 18)
    if (cmd === 'block') {
      const subCmd = argv._[1];

      // block list [--designation tool|agent] [--type Workflow] [--category general] [--limit N] [--sort col]
      if (subCmd === 'list' || (!subCmd && !argv['pending-approval'])) {
        return await listBlocks({
          designation: argv.designation,
          type: argv.type,
          category: argv.category,
          limit: argv.limit ? parseInt(argv.limit) : undefined,
          sort: argv.sort,
        });
      }

      // block --pending-approval (list pending approvals)
      if (argv['pending-approval']) {
        return await listApprovals();
      }

      // block info <id>
      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('Block/Approval ID required'); process.exit(1); }
        try {
          return await getApprovalInfo(id);
        } catch (e) {
          if (e.status === 404) {
            return await getBlockInfo(id);
          }
          throw e;
        }
      }

      // block metrics <id>
      if (subCmd === 'metrics') {
        const id = argv._[2];
        if (!id) { console.error('Block ID required'); process.exit(1); }
        return await getBlockMetricsCmd(id);
      }

      // block top [--designation tool|agent] [--type Workflow] [--limit 10]
      if (subCmd === 'top') {
        return await getTopBlocksCmd({
          designation: argv.designation,
          type: argv.type,
          limit: argv.limit ? parseInt(argv.limit) : 10
        });
      }

      // block designate <id> <designation>
      if (subCmd === 'designate') {
        const id = argv._[2];
        const designation = argv._[3] || argv.designation;
        if (!id) { console.error('Block ID required'); process.exit(1); }
        if (!designation) { console.error('Designation required (tool, agent, or none)'); process.exit(1); }
        return await designateBlockCmd(id, designation);
      }

      // block publish <block-id> --from-session <session-id>
      if (subCmd === 'publish') {
        const blockId = argv._[2];
        if (!blockId) { console.error('Block ID required'); process.exit(1); }
        return await submitBlockForApproval(blockId, {
          session: argv['from-session'] || argv.session,
          submittedBy: argv['submitted-by'] || argv.by,
          metadata: argv.metadata
        });
      }

      // block approve <approval-id>
      if (subCmd === 'approve') {
        const id = argv._[2];
        if (!id) { console.error('Approval ID required'); process.exit(1); }
        return await approveBlock(id, {
          reviewedBy: argv['reviewed-by'] || argv.by
        });
      }

      // block reject <approval-id> --reason "..."
      if (subCmd === 'reject') {
        const id = argv._[2];
        const reason = argv.reason || argv._[3];
        if (!id) { console.error('Approval ID required'); process.exit(1); }
        if (!reason) { console.error('Rejection reason required (--reason "...")'); process.exit(1); }
        return await rejectBlock(id, reason, {
          reviewedBy: argv['reviewed-by'] || argv.by
        });
      }

      // Phase 26: block create --name <name> --type <type> [--description] [--tags] [--designation] [--category] [--config '{}']
      if (subCmd === 'create') {
        const name = argv.name || argv._[2];
        const type = argv.type || argv._[3];
        if (!name) { console.error('Block name required (--name <name>)'); process.exit(1); }
        if (!type) { console.error('Block type required (--type <type>)'); process.exit(1); }
        return await createBlockCmd({
          name,
          type,
          description: argv.description || argv.desc,
          tags: argv.tags,
          designation: argv.designation,
          category: argv.category,
          config: argv.config
        });
      }

      // Phase 26: block update <id> [--name] [--description] [--tags] [--config '{}']
      if (subCmd === 'update') {
        const id = argv._[2];
        if (!id) { console.error('Block ID required'); process.exit(1); }
        return await updateBlockCmd(id, {
          name: argv.name,
          description: argv.description || argv.desc,
          tags: argv.tags,
          config: argv.config
        });
      }

      // Phase 26: block delete <id> [--force]
      if (subCmd === 'delete') {
        const id = argv._[2];
        if (!id) { console.error('Block ID required'); process.exit(1); }
        return await deleteBlockCmd(id, argv.force);
      }

      // Phase 26: block content <id> <path> [--set <content>] [--set-file <filepath>]
      if (subCmd === 'content') {
        const id = argv._[2];
        const filePath = argv._[3];
        if (!id) { console.error('Block ID required'); process.exit(1); }
        if (!filePath) { console.error('File path required (e.g. block.json, scripts/run.ps1)'); process.exit(1); }
        const setContent = argv.set;
        const setFile = argv['set-file'];
        if (setFile) {
          const fs = require('fs');
          const fileContent = fs.readFileSync(setFile, 'utf-8');
          return await setBlockContentCmd(id, filePath, fileContent);
        }
        if (setContent !== undefined) {
          return await setBlockContentCmd(id, filePath, setContent);
        }
        return await getBlockContentCmd(id, filePath);
      }

      // Phase 26: block children <id> [--recursive]
      if (subCmd === 'children') {
        const id = argv._[2];
        if (!id) { console.error('Block ID required'); process.exit(1); }
        return await getBlockChildren(id, argv.recursive !== false);
      }

      // Phase 26: block search <query>
      if (subCmd === 'search') {
        const query = argv._[2];
        if (!query) { console.error('Search query required'); process.exit(1); }
        return await searchBlocks(query);
      }

      console.error(`Unknown block subcommand: ${subCmd}`);
      console.error('   Available: list, info, metrics, top, designate, publish, approve, reject, create, update, delete, content, children, search');
      process.exit(1);
    }
    // Phase 18: Standalone block shortcuts (compatibility aliases)
    if (cmd === 'info') {
      console.error(c.gray('  Hint: Use "block info <id>" instead of "info <id>"'));
      const blockId = argv._[1];
      if (!blockId) { console.error('Block ID required'); process.exit(1); }
      return await getBlockInfo(blockId);
    }
    if (cmd === 'children') {
      console.error(c.gray('  Hint: Use "block children <id>" instead of "children <id>"'));
      const blockId = argv._[1];
      if (!blockId) { console.error('Block ID required'); process.exit(1); }
      const recursive = argv.recursive !== false; // default true
      return await getBlockChildren(blockId, recursive);
    }
    if (cmd === 'search') {
      console.error(c.gray('  Hint: Use "block search <query>" instead of "search <query>"'));
      const query = argv._[1];
      if (!query) { console.error('Search query required'); process.exit(1); }
      return await searchBlocks(query);
    }
    if (cmd === 'health') return await checkHealth({ verbose: argv.verbose || argv.full });

    // Phase 22: Logs command
    if (cmd === 'logs') {
      return await showLogs({ type: argv._[1] || 'audit', limit: argv.limit || argv.lines });
    }

    // Phase 33-B: Interactive mode (`maestro code`) — replaces Phase 28-B code mode
    if (cmd === 'code') {
      if (argv.help || argv.h) {
        console.log(`
${c.boldColor('cyan', 'Interactive Mode')}

${c.bold('Usage:')} maestro code [options]

${c.bold('Description:')}
  Interactive REPL for Maestro. Type a task, press Enter, and Maestro
  creates a session, runs the autonomous workflow, and shows progress.

${c.bold('Options:')}
  --template <name>     Session template (default: project-autonomous)
  --entry <name>        Entry point to invoke (default: dev)
  --repo <path>         Repository path (default: current directory)
  --headless            Run without TUI (structured text output, no TTY needed)
  --task <text>         Task to execute (headless mode, avoids stdin prompt)

${c.bold('Examples:')}
  maestro code                                   Interactive TUI mode
  maestro code --headless --task "Add login"      Headless mode with task
  echo "Fix bug" | maestro code --headless        Headless mode with piped input
`);
        return;
      }

      // Headless mode: no Ink, structured text output, works without TTY
      if (argv.headless) {
        const { runHeadless } = require('@maestro/code/headless.ts');
        return runHeadless({
          apiClient: client,
          repoPath: argv.repo || process.cwd(),
          template: argv.template || 'project-autonomous',
          entryPoint: argv.entry || 'dev',
          task: argv.task || argv._.slice(1).join(' ') || undefined,
          importSessionTemplate,
        });
      }

      // Interactive TUI mode (requires TTY)
      const { startInteractiveMode } = require('@maestro/code/launcher.ts');

      return startInteractiveMode({
        apiClient: client,
        repoPath: argv.repo || process.cwd(),
        template: argv.template || 'project-autonomous',
        entryPoint: argv.entry || 'dev',
        importSessionTemplate,
      });
    }

    // Phase 28-B: Check command — static model compatibility check
    if (cmd === 'check') {
      const blockId = argv._[1];
      if (!blockId) {
        console.log('Usage: maestro check <block-id>');
        console.log('Checks if the required models for a block are available.');
        return;
      }
      try {
        const block = await client.getBlock?.(blockId);
        if (!block) { console.log(`Block not found: ${blockId}`); return; }
        const models = await client.getModels?.();
        const availableIds = new Set((models?.models || []).map((m: any) => m.id));

        console.log(`\nBlock: ${block.name || block.id} (${block.blockType})`);

        // Check manifest-based model requirements (Phase 28-C)
        const manifest = block.metadata?.manifest;
        if (manifest && manifest.requirements && manifest.requirements.models) {
          console.log(`  Tier: ${block.metadata?.tier || 'N/A'}`);
          console.log(`  Quality target: ${block.metadata?.qualityTarget ? Math.round(block.metadata.qualityTarget * 100) + '%' : 'N/A'}`);
          console.log('');
          for (const req of manifest.requirements.models) {
            const ok = availableIds.has(req.id);
            const icon = ok ? '✅' : '❌';
            console.log(`  ${icon} ${req.id}`);
            console.log(`     Used by: ${req.usedBy.join(', ')}`);
            console.log(`     Substitutable: ${req.substitutable ? 'yes' : 'no'}`);
            if (!ok && req.testedSubstitutes?.length) {
              const viableSubs = req.testedSubstitutes.filter((s: any) => s.viable && availableIds.has(s.model));
              if (viableSubs.length > 0) {
                console.log(`     Available substitutes: ${viableSubs.map((s: any) => s.model).join(', ')}`);
              }
            }
          }
        }
        else {
          console.log('  No manifest found. Publish the block with a manifest to enable model compatibility checks.');
        }
      } catch (err: any) {
        console.error(`Check failed: ${err.message || err}`);
      }
      return;
    }

    // Phase 28-C: Tiers command — show tier comparison and recommend best tier
    if (cmd === 'tiers') {
      const { selectBestTier, formatTierReport, TIERS, getMissingModels } = require('./utils/tier-selector.ts');
      const tierOverride = argv.tier ? parseInt(argv.tier) : null;

      try {
        const models = await client.getModels?.();
        const availableIds = (models?.models || []).map((m: any) => m.id);

        if (tierOverride) {
          // Show details for a specific tier
          const tier = TIERS.find((t: any) => t.tier === tierOverride);
          if (!tier) {
            console.log(`Unknown tier: ${tierOverride}. Available: 1-5`);
            return;
          }
          const missing = getMissingModels(tier, availableIds);
          console.log(`\n  ${tier.name}`);
          console.log(`  ${tier.description}`);
          console.log(`  Block: ${tier.blockId}`);
          console.log(`  Quality target: ${Math.round(tier.qualityTarget * 100)}%`);
          console.log(`  Required models: ${tier.requiredModels.join(', ')}`);
          if (missing.length > 0) {
            console.log(`  Missing: ${missing.join(', ')}`);
          } else {
            console.log(`  Status: All models available`);
            console.log(`\n  Use: maestro code --agent ${tier.blockId}`);
          }
          console.log('');
        } else {
          // Show full comparison report
          console.log(formatTierReport(availableIds));
        }
      } catch (err: any) {
        console.error(`Tiers check failed: ${err.message || err}`);
      }
      return;
    }

    // Monitor command - launches session monitor (TUI)
    if (cmd === 'monitor') {
      const targetId = argv._[1];
      const isWorkspace = argv.workspace || argv.w;
      const isLLM = argv.llm || argv._[1] === 'llm';
      const listMode = argv.list || (!targetId && !isLLM);

      const { startMonitor } = require('@maestro/monitor/tui-monitor.ts');

      const options = {
        refreshInterval: argv.refresh ? parseInt(argv.refresh) * 1000 : (listMode ? 3000 : 2000),
        layout: argv.layout || 'auto',
        view: argv.view || null,
        debug: argv.debug || false,
        returnToList: !argv['no-back'],
        mock: argv.mock || false,
        llmMode: isLLM || false
      };

      if (isLLM) {
        // Phase 24: LLM Monitor mode
        return startMonitor(null, client, { ...options, detailType: 'llm' });
      } else if (listMode) {
        // Global monitor - show session list
        return startMonitor(null, client, options);
      } else if (isWorkspace) {
        // Workspace monitor — resolve short ID and pass as workspace
        const resolvedId = await resolveId(targetId, 'workspace');
        return startMonitor(resolvedId, client, { ...options, detailType: 'workspace' });
      } else {
        // Session-specific monitor — resolve short ID to full UUID
        const resolvedId = await resolveId(targetId, 'session');
        return startMonitor(resolvedId, client, options);
      }
    }

    // Project commands
    if (cmd === 'projects') {
      const subCmd = argv._[1];

      // Progressive help for projects
      if (argv.help || argv.h) {
        console.log(`
${c.boldColor('cyan', 'Project Commands')}

${c.bold('Usage:')} maestro projects <command> [options]

${c.bold('Commands:')}
  ${c.gray('(none)')}             List all projects
  info <id>           Show project details
  create              Create project (--name, --path)
  bind --path <p>     Bind existing directory
  open <path>         Open existing project
  delete <id>         Delete project (--force required)
  blocks <id>         List project blocks
  discover            Discover projects in directory
  status/start/stop/restart/logs <id>  Container management
`);
        return;
      }

      if (!subCmd) return await listProjectsWithStatus();

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { formatter.error('Project ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await getProjectInfo(await resolveId(id, 'project'));
      }

      if (subCmd === 'create') {
        const name = argv.name;
        const projectPath = argv.path;
        if (!name) { console.error('--name is required'); process.exit(1); }
        if (!projectPath) { console.error('--path is required'); process.exit(1); }
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
        if (!projectPath) { console.error('--path is required'); process.exit(1); }
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
        if (!projectPath) { console.error('Project path required'); process.exit(1); }
        return await openProject(projectPath);
      }

      if (subCmd === 'delete') {
        const id = argv._[2];
        if (!id) { console.error('Project ID required'); process.exit(1); }
        return await deleteProject(id, { force: argv.force });
      }

      if (subCmd === 'blocks') {
        const id = argv._[2];
        if (!id) { console.error('Project ID required'); process.exit(1); }
        return await listProjectBlocks(id);
      }

      if (subCmd === 'discover') {
        const searchPath = argv._[2] || '.';
        return await discoverProjects(searchPath);
      }

      // Container commands
      if (subCmd === 'status') {
        const id = argv._[2];
        if (!id) { console.error('Project ID required'); process.exit(1); }
        return await getContainerStatus(id);
      }

      if (subCmd === 'start') {
        const id = argv._[2];
        if (!id) { console.error('Project ID required'); process.exit(1); }
        return await startContainer(id);
      }

      if (subCmd === 'stop') {
        const id = argv._[2];
        if (!id) { console.error('Project ID required'); process.exit(1); }
        return await stopContainer(id);
      }

      if (subCmd === 'restart') {
        const id = argv._[2];
        if (!id) { console.error('Project ID required'); process.exit(1); }
        return await restartContainer(id);
      }

      if (subCmd === 'logs') {
        const id = argv._[2];
        if (!id) { console.error('Project ID required'); process.exit(1); }
        return await getContainerLogs(id, {
          lines: argv.lines ? parseInt(argv.lines) : undefined,
          since: argv.since
        });
      }

      console.error(`Unknown projects subcommand: ${subCmd}`);
      console.error('   Run "maestro --help" for usage information');
      process.exit(1);
    }
    
    // Unified run command (works for any block type: workflow, agent, tool...)
    // 'execute' is a silent alias for backward compatibility
    if (cmd === 'run' || cmd === 'execute') {
      const blockId = argv._[1];
      if (!blockId) { formatter.error('Block ID required. Usage: maestro run <block-id> [--input key=value] [--input-json \'{"key":"value"}\']', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
      const inputs = {};
      if (argv.input) {
        const raw = Array.isArray(argv.input) ? argv.input : [argv.input];
        for (const kv of raw) {
          const [k,v] = kv.split('=');
          inputs[k] = v;
        }
      }
      if (argv['input-json']) {
        try {
          const jsonInputs = JSON.parse(argv['input-json']);
          if (typeof jsonInputs === 'object' && jsonInputs !== null) {
            Object.assign(inputs, jsonInputs);
          }
        } catch (e) {
          formatter.error(`Invalid JSON in --input-json: ${e.message}`, 'PARSE_ERROR');
          process.exit(EXIT.USER_ERROR);
        }
      }
      return await runBlockUnified(blockId, inputs, { mock: argv.mock, workingDir: argv['working-dir'] || argv.workdir });
    }

    // Session commands (both 'session' and 'sessions' for convenience)
    if (cmd === 'session' || cmd === 'sessions') {
      const subCmd = argv._[1];

      // P1-10: Progressive help for session commands
      if (argv.help || argv.h) {
        console.log(`
${c.boldColor('cyan', 'Session Commands')}

${c.bold('Usage:')} maestro session <command> [options]

${c.bold('Commands:')}
  list                         List sessions (--status, --recent, --limit)
  info <id>                    Show session details
  create                       Create session (--project, --template, --start)
  start <id>                   Start session (--monitor to launch TUI)
  pause <id>                   Pause a running session
  resume <id>                  Resume a paused session
  stop <id>                    Stop a session
  delete <id>                  Delete session (--force to skip prompt)
  delete-all                   Delete sessions (--status, --force required)
  import <id> --template <t>   Import a session template
  vars <id> [list|get|set|remove]  Manage variables
  entry-points <id>            Manage entry points
  invoke <id> [entry-point]    Invoke entry point (--input key=val or key=val)
  widgets <id>                 Manage monitor widgets
  exec <id> "<cmd>"            Execute command in session
  events <id>                  Show event history
  bind-repo <id> --path <p>    Bind to repository
  take-control <id>            Transfer authority
  last                         Show most recent session

${c.bold('ID Shortcuts:')}
  Use ID prefixes instead of full UUIDs: ${c.cyan('maestro session info f2e844')}

${c.bold('Quick Start:')}
  maestro session create --project <id> --template foundry-default --start
`);
        return;
      }

      if (!subCmd) return await listSessions();

      if (subCmd === 'list') {
        // Interactive mode with -i flag
        if (argv.i || argv.interactive) {
          return await launchInteractiveSessionsTable();
        }
        const recent = argv.recent ? parseInt(argv.recent) : null;
        return await listSessions({
          status: argv.status,
          projectId: argv.project ? await resolveId(argv.project, 'project') : undefined,
          limit: recent || (argv.limit ? parseInt(argv.limit) : undefined)
        });
      }

      // P3-31: Session last command
      if (subCmd === 'last') {
        const sessions = await client.listSessions({ limit: 1 });
        if (!sessions || sessions.length === 0) {
          formatter.info('No sessions found.');
          return;
        }
        return await getSessionInfo(sessions[0].id);
      }

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await getSessionInfo(await resolveId(id, 'session'));
      }

      if (subCmd === 'create') {
        const projectId = argv.project ? await resolveId(argv.project, 'project') : undefined;
        const result = await createSession({
          projectId,
          repo: argv.repo,
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
          source: argv.source,
          repositoryPath: argv['repository-path'],
          accessLevel: argv['access-level'],
          branch: argv.branch,
          excludePatterns: argv['exclude-patterns'],
          // P1-8: Streamlined creation with --template and --start
          template: argv.template,
          autoStart: argv.start
        });
        return result;
      }

      if (subCmd === 'start') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await startSession(await resolveId(id, 'session'), { monitor: argv.monitor });
      }

      if (subCmd === 'pause') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await pauseSession(await resolveId(id, 'session'));
      }

      if (subCmd === 'resume') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await resumeSession(await resolveId(id, 'session'));
      }

      if (subCmd === 'stop') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await stopSession(await resolveId(id, 'session'));
      }

      if (subCmd === 'take-control') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        const authority = argv.authority || argv._[3] || 'human';
        return await takeControlSession(await resolveId(id, 'session'), authority);
      }

      if (subCmd === 'bind-repo') {
        const id = argv._[2];
        const repoPath = argv.path || argv._[3];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        if (!repoPath) { formatter.error('--path <repo-path> required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await bindSessionToRepository(await resolveId(id, 'session'), repoPath);
      }

      if (subCmd === 'exec') {
        const id = argv._[2];
        const command = argv._[3] || argv.command;
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        if (!command) { formatter.error('Command required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await executeSessionCommand(await resolveId(id, 'session'), command);
      }

      if (subCmd === 'events') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await getSessionEvents(await resolveId(id, 'session'), {
          limit: argv.limit,
          offset: argv.offset,
          filter: argv.filter
        });
      }

      if (subCmd === 'delete') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await deleteSession(await resolveId(id, 'session'), { force: argv.force });
      }

      if (subCmd === 'delete-all') {
        const statusFilter = argv.status;
        if (!argv.force) {
          formatter.error('--force is required for delete-all', 'MISSING_PARAM');
          process.exit(EXIT.USER_ERROR);
        }
        const sessions = await client.listSessions(statusFilter ? { status: statusFilter } : {});
        if (!sessions || sessions.length === 0) {
          formatter.info('No sessions to delete.');
          return;
        }
        let deleted = 0;
        for (const s of sessions) {
          try {
            await client.deleteSession(s.id);
            deleted++;
          } catch (e) { /* skip errors */ }
        }
        formatter.success({ deleted, total: sessions.length }, `\n${c.ok(`Deleted ${deleted}/${sessions.length} sessions`)}\n`);
        return;
      }

      // Legacy commands for backward compatibility
      if (subCmd === 'diff') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await getSessionDiff(await resolveId(id, 'session'));
      }

      if (subCmd === 'test') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await runSessionTests(await resolveId(id, 'session'), argv['test-command']);
      }

      if (subCmd === 'commit') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await commitSession(await resolveId(id, 'session'), {
          message: argv.message,
          branch: argv.branch,
          push: argv.push,
          type: argv.type,
          scope: argv.scope
        });
      }

      if (subCmd === 'cancel') {
        const id = argv._[2];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        return await cancelSession(await resolveId(id, 'session'));
      }

      // Session import command (imports templates with workflows, blocks, widgets)
      if (subCmd === 'import') {
        const id = argv._[2];
        const template = argv.template || argv._[3];
        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        if (!template) {
          const available = listAvailableTemplates();
          formatter.error(`Template name required (--template). Available: ${available.join(', ')}`, 'MISSING_PARAM');
          process.exit(EXIT.USER_ERROR);
        }
        return await importSessionTemplate(await resolveId(id, 'session'), template);
      }

      // Session variables commands
      if (subCmd === 'vars' || subCmd === 'variables') {
        const id = argv._[2];
        const varsCmd = argv._[3];

        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        const resolvedId = await resolveId(id, 'session');

        if (!varsCmd || varsCmd === 'list') {
          return await listSessionVariables(resolvedId);
        }

        if (varsCmd === 'get') {
          const key = argv._[4];
          if (!key) { formatter.error('Variable key required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
          return await getSessionVariable(resolvedId, key);
        }

        if (varsCmd === 'set') {
          const key = argv._[4];
          let value = argv._[5];
          if (!key) { formatter.error('Variable key required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
          // --json-value <string> for passing JSON values (resolves --json flag conflict)
          const jsonVal = argv['json-value'] || (typeof argv.json === 'string' && argv.json);
          if (jsonVal) {
            try {
              value = JSON.parse(jsonVal);
            } catch (e) {
              formatter.error('Invalid JSON value', 'PARSE_ERROR');
              process.exit(EXIT.USER_ERROR);
            }
          }
          if (value === undefined) { formatter.error('Variable value required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
          return await setSessionVariable(resolvedId, key, value);
        }

        if (varsCmd === 'remove' || varsCmd === 'delete') {
          const key = argv._[4];
          if (!key) { formatter.error('Variable key required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
          return await removeSessionVariable(resolvedId, key);
        }

        formatter.error(`Unknown vars command: ${varsCmd}. Available: list, get <key>, set <key> <value>, remove <key>`, 'UNKNOWN_COMMAND');
        process.exit(EXIT.USER_ERROR);
      }

      // Session entry points commands
      if (subCmd === 'entry-points' || subCmd === 'endpoints') {
        const id = argv._[2];
        const epCmd = argv._[3];

        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        const resolvedId = await resolveId(id, 'session');

        if (!epCmd || epCmd === 'list') {
          return await listSessionEntryPoints(resolvedId);
        }

        if (epCmd === 'register' || epCmd === 'add') {
          const name = argv._[4];
          const workflowId = argv._[5] || argv.workflow;
          if (!name) { formatter.error('Entry point name required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
          if (!workflowId) { formatter.error('Workflow ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
          return await registerSessionEntryPoint(resolvedId, name, workflowId);
        }

        if (epCmd === 'remove' || epCmd === 'delete') {
          const name = argv._[4];
          if (!name) { formatter.error('Entry point name required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
          return await removeSessionEntryPoint(resolvedId, name);
        }

        formatter.error(`Unknown entry-points command: ${epCmd}. Available: list, register <name> <workflow-id>, remove <name>`, 'UNKNOWN_COMMAND');
        process.exit(EXIT.USER_ERROR);
      }

      // Session invoke command
      if (subCmd === 'invoke') {
        const id = argv._[2];
        const entryPoint = argv._[3] || 'start';

        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }

        // Parse --input key=value flags into an inputs object
        const inputs: Record<string, string> = {};
        if (argv.input) {
          const inputArgs = Array.isArray(argv.input) ? argv.input : [argv.input];
          for (const arg of inputArgs) {
            const eqIdx = String(arg).indexOf('=');
            if (eqIdx > 0) {
              inputs[String(arg).slice(0, eqIdx)] = String(arg).slice(eqIdx + 1);
            }
          }
        }

        // Phase 32-C: Also parse positional key=value args after entry point
        // e.g. maestro session invoke <id> dev task="Add login" repoPath="."
        for (let i = 4; i < argv._.length; i++) {
          const arg = String(argv._[i]);
          const eqIdx = arg.indexOf('=');
          if (eqIdx > 0) {
            inputs[arg.slice(0, eqIdx)] = arg.slice(eqIdx + 1);
          }
        }

        return await invokeSessionEntryPoint(await resolveId(id, 'session'), entryPoint, Object.keys(inputs).length > 0 ? inputs : undefined);
      }

      // Session widgets commands
      if (subCmd === 'widgets') {
        const id = argv._[2];
        const widgetCmd = argv._[3];

        if (!id) { formatter.error('Session ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        const resolvedId = await resolveId(id, 'session');

        if (!widgetCmd || widgetCmd === 'list') {
          return await listSessionWidgets(resolvedId);
        }

        if (widgetCmd === 'add' || widgetCmd === 'register') {
          const widgetType = argv.type;
          const widgetId = argv.id || argv._[4];
          if (!widgetType) { formatter.error('--type required (progress-bar, score-chart, counter, status-list)', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
          if (!widgetId) { formatter.error('--id or widget ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
          let config = {};
          if (argv.config) {
            try {
              config = JSON.parse(argv.config);
            } catch (e) {
              formatter.error('Invalid JSON in --config', 'PARSE_ERROR');
              process.exit(EXIT.USER_ERROR);
            }
          }
          return await registerSessionWidget(resolvedId, widgetId, widgetType, config);
        }

        if (widgetCmd === 'remove' || widgetCmd === 'delete') {
          const widgetId = argv._[4];
          if (!widgetId) { formatter.error('Widget ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
          return await removeSessionWidget(resolvedId, widgetId);
        }

        formatter.error(`Unknown widgets command: ${widgetCmd}. Available: list, add --type <type> --id <id> [--config {...}], remove <id>`, 'UNKNOWN_COMMAND');
        process.exit(EXIT.USER_ERROR);
      }

      formatter.error(`Unknown session command: ${subCmd}. Run 'maestro session --help' for available commands.`, 'UNKNOWN_COMMAND');
      process.exit(EXIT.USER_ERROR);
    }

    // P1-11: Templates list/show commands
    if (cmd === 'templates' || cmd === 'template') {
      const subCmd = argv._[1];

      if (!subCmd || subCmd === 'list') {
        formatter.setCommand('templates.list');
        const templates = listAvailableTemplates();
        if (templates.length === 0) {
          formatter.info('No templates found.');
          return;
        }
        const rows = templates.map(name => {
          const templatePath = path.join(__dirname, '../../content/system/templates/sessions', `${name}.session.json`);
          try {
            const content = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
            const epCount = content.entryPoints ? Object.keys(content.entryPoints).length : 0;
            const varCount = content.variables ? Object.keys(content.variables).length : 0;
            return {
              'Name': name,
              'Entry Points': epCount,
              'Variables': varCount,
              'Description': content.description || '-'
            };
          } catch (e) {
            return { 'Name': name, 'Entry Points': '?', 'Variables': '?', 'Description': 'Error reading' };
          }
        });
        formatter.table(rows, `\n${c.bold('Available Templates:')}\n`);
        return;
      }

      if (subCmd === 'show' || subCmd === 'info') {
        formatter.setCommand('templates.show');
        const name = argv._[2];
        if (!name) { formatter.error('Template name required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        const templatePath = path.join(__dirname, '../../content/system/templates/sessions', `${name}.session.json`);
        if (!fs.existsSync(templatePath)) {
          const available = listAvailableTemplates();
          formatter.error(`Template not found: ${name}. Available: ${available.join(', ')}`, 'NOT_FOUND');
          process.exit(EXIT.NOT_FOUND);
        }
        const content = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        if (formatter.jsonMode) {
          formatter.success(content);
        } else {
          console.log(`\n${c.bold('Template:')} ${c.cyan(name)}\n`);
          if (content.description) console.log(`  ${c.gray('Description:')} ${content.description}`);
          if (content.entryPoints) {
            console.log(`\n  ${c.bold('Entry Points:')}`);
            for (const [ep, wf] of Object.entries(content.entryPoints)) {
              console.log(`    ${c.cyan(ep)} ${c.gray('->')} ${wf}`);
            }
          }
          if (content.variables) {
            const varKeys = Object.keys(content.variables);
            console.log(`\n  ${c.bold('Variables:')} ${c.gray(`(${varKeys.length})`)}`);
            for (const key of varKeys) {
              const val = content.variables[key];
              const display = typeof val === 'object' ? `${JSON.stringify(val).substring(0, 60)}...` : String(val);
              console.log(`    ${key}: ${c.gray(display)}`);
            }
          }
          if (content.monitorWidgets) {
            console.log(`\n  ${c.bold('Widgets:')} ${content.monitorWidgets.length}`);
            for (const w of content.monitorWidgets) {
              console.log(`    ${w.id} (${w.type})`);
            }
          }
          console.log('');
        }
        return;
      }

      formatter.error(`Unknown templates command: ${subCmd}. Available: list, show <name>`, 'UNKNOWN_COMMAND');
      process.exit(EXIT.USER_ERROR);
    }

    // Training commands
    if (cmd === 'training') {
      const subCmd = argv._[1];

      if (!subCmd) return await listTrainingConfigs();

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('Configuration ID required'); process.exit(1); }
        return await getTrainingConfigInfo(id);
      }

      if (subCmd === 'create') {
        if (!argv.name) { console.error('--name is required'); process.exit(1); }
        if (!argv.workflow) { console.error('--workflow is required'); process.exit(1); }
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
        if (!id) { console.error('Training run ID required'); process.exit(1); }
        return await getTrainingRunInfo(id);
      }

      if (subCmd === 'start') {
        const configId = argv._[2];
        if (!configId) { console.error('Configuration ID required'); process.exit(1); }
        return await startTrainingRun(configId, {
          name: argv.name,
          inputs: argv.inputs
        });
      }

      if (subCmd === 'pause') {
        const id = argv._[2];
        if (!id) { console.error('Training run ID required'); process.exit(1); }
        return await controlTrainingRun(id, 'pause');
      }

      if (subCmd === 'resume') {
        const id = argv._[2];
        if (!id) { console.error('Training run ID required'); process.exit(1); }
        return await controlTrainingRun(id, 'resume');
      }

      if (subCmd === 'cancel') {
        const id = argv._[2];
        if (!id) { console.error('Training run ID required'); process.exit(1); }
        return await controlTrainingRun(id, 'cancel');
      }

      console.error(`Unknown training subcommand: ${subCmd}`);
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
        if (!modelId) { console.error('Model ID required'); process.exit(1); }
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
        if (!argv.model) { console.error('--model is required'); process.exit(1); }
        if (!argv['task-type']) { console.error('--task-type is required'); process.exit(1); }
        return await calculateFitness({
          modelId: argv.model,
          taskType: argv['task-type'],
          executionId: argv.execution
        });
      }

      console.error(`Unknown fitness subcommand: ${subCmd}`);
      console.error('   Available commands: config, leaderboard, profiles, profile, entropy, calculate');
      process.exit(1);
    }

    // System block commands
    if (cmd === 'system') {
      const subCmd = argv._[1];

      if (!subCmd) return await listSystemBlocks();

      if (subCmd === 'info') {
        const blockId = argv._[2];
        if (!blockId) { console.error('Block ID required'); process.exit(1); }
        return await getSystemBlockInfo(blockId);
      }

      if (subCmd === 'overrides') {
        return await listUserOverrides();
      }

      if (subCmd === 'override') {
        const blockId = argv._[2];
        if (!blockId) { console.error('Block ID required'); process.exit(1); }
        return await createSystemBlockOverride(blockId, argv.config);
      }

      if (subCmd === 'restore') {
        const blockId = argv._[2];
        if (!blockId) { console.error('Block ID required'); process.exit(1); }
        return await restoreSystemBlock(blockId);
      }

      if (subCmd === 'effective') {
        const blockId = argv._[2];
        if (!blockId) { console.error('Block ID required'); process.exit(1); }
        return await getEffectiveBlock(blockId);
      }

      console.error(`Unknown system subcommand: ${subCmd}`);
      console.error('   Available commands: info, overrides, override, restore, effective');
      process.exit(1);
    }

    // Workspace commands
    if (cmd === 'workspace') {
      const subCmd = argv._[1];

      if (!subCmd) return await listWorkspaces();

      if (subCmd === 'info') {
        const workspaceId = argv._[2];
        if (!workspaceId) { console.error('Workspace ID required'); process.exit(1); }
        return await getWorkspaceInfo(workspaceId);
      }

      if (subCmd === 'create') {
        const name = argv._[2] || argv.name;
        if (!name) { formatter.error('Workspace name required', 'MISSING_PARAM'); process.exit(1); }
        return await createWorkspace({
          name,
          type: argv.type,
          description: argv.description,
          repoPath: argv['repo-path'],
          isolated: argv.isolated
        });
      }

      if (subCmd === 'delete') {
        const workspaceId = argv._[2];
        if (!workspaceId) { console.error('Workspace ID required'); process.exit(1); }
        return await deleteWorkspace(workspaceId, { force: argv.force });
      }

      if (subCmd === 'add-session') {
        const workspaceId = argv._[2];
        const sessionId = argv._[3] || argv.session;
        if (!workspaceId) { console.error('Workspace ID required'); process.exit(1); }
        if (!sessionId) { console.error('Session ID required (--session or as argument)'); process.exit(1); }
        return await addSessionToWorkspace(workspaceId, sessionId);
      }

      if (subCmd === 'add-project') {
        const workspaceId = argv._[2];
        const projectId = argv._[3] || argv.project;
        if (!workspaceId) { console.error('Workspace ID required'); process.exit(1); }
        if (!projectId) { console.error('Project ID required (--project or as argument)'); process.exit(1); }
        return await addProjectToWorkspace(workspaceId, projectId);
      }

      if (subCmd === 'permissions') {
        const workspaceId = argv._[2];
        if (!workspaceId) { console.error('Workspace ID required'); process.exit(1); }
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
        if (!sourceId) { formatter.error('Source workspace ID required (--source)', 'MISSING_PARAM'); process.exit(1); }
        if (!targetId) { formatter.error('Target workspace ID required (--target)', 'MISSING_PARAM'); process.exit(1); }
        if (!agentId) { formatter.error('Agent block ID required (--agent)', 'MISSING_PARAM'); process.exit(1); }
        return await promoteAgent(sourceId, { target: targetId, agent: agentId, version: argv.version });
      }

      console.error(`Unknown workspace subcommand: ${subCmd}`);
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
          console.error('Specify --enable or --disable');
          process.exit(1);
        }
        return await setOrchestratorAutoPromote(!disabled);
      }

      if (subCmd === 'monitor' || subCmd === 'run') {
        return await runOrchestratorMonitor();
      }

      if (subCmd === 'metrics') {
        const agentId = argv.agent || argv._[2];
        if (!agentId) { console.error('Agent ID required'); process.exit(1); }
        // TODO: Implement agent-specific metrics
        console.log(`\nMetrics for agent: ${agentId}\n`);
        console.log('  (Not yet implemented)');
        return;
      }

      console.error(`Unknown orchestrator subcommand: ${subCmd}`);
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
        if (!cycleId) { console.error('Cycle ID required'); process.exit(1); }
        return await getResearchCycleStatus(cycleId);
      }

      if (subCmd === 'stop') {
        const cycleId = argv._[2] || argv.cycle;
        if (!cycleId) { console.error('Cycle ID required'); process.exit(1); }
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
        if (!proposalId) { console.error('Proposal ID required'); process.exit(1); }
        return await approveResearchProposal(proposalId, argv.by);
      }

      if (subCmd === 'reject') {
        const proposalId = argv._[2] || argv.proposal;
        const reason = argv.reason;
        if (!proposalId) { console.error('Proposal ID required'); process.exit(1); }
        if (!reason) { console.error('--reason is required'); process.exit(1); }
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

      console.error(`Unknown research subcommand: ${subCmd}`);
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

      console.error(`Unknown metrics subcommand: ${subCmd}`);
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
        if (!id) { console.error('Run ID required'); process.exit(1); }
        return await getRunInfo(id);
      }

      console.error(`Unknown runs subcommand: ${subCmd}`);
      process.exit(1);
    }

    // Provider commands (Phase 19 — LLM Provider service management)
    if (cmd === 'provider') {
      const subCmd = argv._[1];
      if (!subCmd || subCmd === 'health' || subCmd === 'status') return await checkLLMStatus();
      if (subCmd === 'capabilities') return await showSystemInfoCmd();
      formatter.error(`Unknown provider subcommand: ${subCmd}. Available: health, status, capabilities`, 'UNKNOWN_COMMAND');
      process.exit(EXIT.USER_ERROR);
    }

    // LLM command — deprecated alias for provider
    if (cmd === 'llm') {
      console.log(c.yellow('Note: "maestro llm" is deprecated. Use "maestro provider" instead.'));
      return await checkLLMStatus();
    }

    // Models commands (Phase 19 — model catalog management)
    if (cmd === 'models') {
      const subCmd = argv._[1];
      if (!subCmd || subCmd === 'list') return await listModelsCmd({ category: argv.category || argv.cat, limit: argv.limit });
      if (subCmd === 'local') return await listLocalModelsCmd();
      if (subCmd === 'registry') return await listRegistryModelsCmd({ category: argv.category || argv.cat });
      if (subCmd === 'load') return await loadModelCmd(argv._[2], argv);
      if (subCmd === 'switch') return await switchModelCmd(argv._[2], argv);

      if (subCmd === 'custom') {
        const customAction = argv._[2]; // 'list', 'add', 'remove', or undefined
        const { getConfigDir } = require('./config.ts');
        const fs = require('fs');
        const path = require('path');
        const modelsPath = path.join(getConfigDir(), 'models.json');

        const loadCustomModels = () => {
          try {
            if (fs.existsSync(modelsPath)) {
              return JSON.parse(fs.readFileSync(modelsPath, 'utf-8'));
            }
          } catch (e) {}
          return [];
        };
        const saveCustomModels = (models) => {
          fs.mkdirSync(path.dirname(modelsPath), { recursive: true });
          fs.writeFileSync(modelsPath, JSON.stringify(models, null, 2), 'utf-8');
        };

        if (!customAction || customAction === 'list') {
          const models = loadCustomModels();
          if (models.length === 0) {
            console.log(c.info('No custom models configured.'));
            console.log(c.dim(`  Add one with: maestro models custom add --id <id> --name <name> --provider <local|azure>`));
          } else {
            console.log(`\n${c.boldColor('cyan', 'Custom Models')} (${models.length})`);
            console.log(`  ${c.dim('File: ' + modelsPath)}\n`);
            for (const m of models) {
              console.log(`  ${c.cyan(m.id.padEnd(30))} ${c.gray(m.provider || 'local')}  ${m.name || ''}`);
            }
          }
          return;
        }

        if (customAction === 'add') {
          const id = argv.id || argv._[3];
          const name = argv.name || id;
          const provider = argv.provider || 'local';
          const contextLength = parseInt(argv.context || argv['context-length'] || '4096');

          if (!id) {
            console.error('Usage: maestro models custom add --id <model-id> --name <display-name> --provider <local|azure>');
            process.exit(1);
          }

          const models = loadCustomModels();
          const existing = models.findIndex((m) => m.id === id);
          const entry = { id, name, provider, contextLength, addedAt: new Date().toISOString() };
          if (existing >= 0) {
            models[existing] = entry;
            console.log(c.ok(`Updated custom model: ${c.cyan(id)}`));
          } else {
            models.push(entry);
            console.log(c.ok(`Added custom model: ${c.cyan(id)}`));
          }
          saveCustomModels(models);
          return;
        }

        if (customAction === 'remove') {
          const id = argv.id || argv._[3];
          if (!id) {
            console.error('Usage: maestro models custom remove --id <model-id>');
            process.exit(1);
          }
          const models = loadCustomModels();
          const idx = models.findIndex((m) => m.id === id);
          if (idx < 0) {
            console.error(c.error(`Model not found: ${id}`));
            process.exit(1);
          }
          models.splice(idx, 1);
          saveCustomModels(models);
          console.log(c.ok(`Removed custom model: ${c.cyan(id)}`));
          return;
        }

        formatter.error(`Unknown custom subcommand: ${customAction}. Available: list, add, remove`, 'UNKNOWN_COMMAND');
        process.exit(EXIT.USER_ERROR);
      }

      if (subCmd === 'add') {
        // Shortcut: maestro models add → maestro models custom add
        console.log(c.dim('Tip: Using "maestro models custom add"'));
        const { getConfigDir } = require('./config.ts');
        const fs = require('fs');
        const path = require('path');
        const modelsPath = path.join(getConfigDir(), 'models.json');
        const id = argv.id || argv._[2];
        const name = argv.name || id;
        const provider = argv.provider || 'local';
        const contextLength = parseInt(argv.context || argv['context-length'] || '4096');

        if (!id) {
          console.error('Usage: maestro models add --id <model-id> --name <name> --provider <local|azure>');
          process.exit(1);
        }

        let models = [];
        try { if (fs.existsSync(modelsPath)) models = JSON.parse(fs.readFileSync(modelsPath, 'utf-8')); } catch (e) {}
        const existing = models.findIndex((m) => m.id === id);
        const entry = { id, name, provider, contextLength, addedAt: new Date().toISOString() };
        if (existing >= 0) models[existing] = entry; else models.push(entry);
        fs.mkdirSync(path.dirname(modelsPath), { recursive: true });
        fs.writeFileSync(modelsPath, JSON.stringify(models, null, 2), 'utf-8');
        console.log(c.ok(`Added custom model: ${c.cyan(id)}`));
        return;
      }

      if (subCmd === 'remove') {
        // Shortcut: maestro models remove → maestro models custom remove
        const { getConfigDir } = require('./config.ts');
        const fs = require('fs');
        const path = require('path');
        const modelsPath = path.join(getConfigDir(), 'models.json');
        const id = argv.id || argv._[2];
        if (!id) { console.error('Usage: maestro models remove --id <model-id>'); process.exit(1); }
        let models = [];
        try { if (fs.existsSync(modelsPath)) models = JSON.parse(fs.readFileSync(modelsPath, 'utf-8')); } catch (e) {}
        const idx = models.findIndex((m) => m.id === id);
        if (idx < 0) { console.error(c.error(`Model not found: ${id}`)); process.exit(1); }
        models.splice(idx, 1);
        fs.writeFileSync(modelsPath, JSON.stringify(models, null, 2), 'utf-8');
        console.log(c.ok(`Removed custom model: ${c.cyan(id)}`));
        return;
      }

      formatter.error(`Unknown models subcommand: ${subCmd}. Available: list, local, registry, load, switch, custom, add, remove`, 'UNKNOWN_COMMAND');
      process.exit(EXIT.USER_ERROR);
    }

    // Chat command (Phase 19)
    if (cmd === 'chat') {
      return await chatCmd({
        model: argv.model,
        system: argv.system,
        temperature: argv.temperature || argv.temp,
        maxTokens: argv['max-tokens'] || argv.maxTokens
      });
    }

    // Setup wizard (Phase 19)
    if (cmd === 'setup') {
      return await setupWizardCmd();
    }

    // Agent Foundry commands
    if (cmd === 'foundry') {
      const subCmd = argv._[1];

      if (!subCmd) return await getFoundryOverview();

      if (subCmd === 'leaderboard') {
        return await getFoundryLeaderboard(argv.limit ? parseInt(argv.limit) : 10);
      }

      // Phase 18: 'foundry promote' now uses 'block designate'
      if (subCmd === 'promote') {
        if (!argv.block) { console.error('--block is required'); process.exit(1); }
        if (!argv.type || (argv.type !== 'tool' && argv.type !== 'agent')) {
          console.error('--type must be "tool" or "agent"');
          process.exit(1);
        }
        console.error(c.gray('  Hint: Use "block designate <id> <designation>" instead'));
        return await designateBlockCmd(argv.block, argv.type);
      }

      console.error(`Unknown foundry subcommand: ${subCmd}`);
      process.exit(1);
    }

    // Phase 18: Agent commands — shorthand for block --designation agent
    if (cmd === 'agents') {
      const subCmd = argv._[1];

      if (!subCmd || subCmd === 'list') {
        return await listBlocks({ designation: 'agent', category: argv.category });
      }
      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('Block ID required'); process.exit(1); }
        return await getBlockInfo(id);
      }
      if (subCmd === 'metrics') {
        const id = argv._[2];
        if (!id) { console.error('Block ID required'); process.exit(1); }
        return await getBlockMetricsCmd(id);
      }
      if (subCmd === 'top') {
        return await getTopBlocksCmd({ designation: 'agent', limit: argv.limit ? parseInt(argv.limit) : 10 });
      }
      if (subCmd === 'create') {
        console.error('Removed. Use "block designate <block-id> agent" to designate a block as agent.');
        process.exit(1);
      }
      if (subCmd === 'delete') {
        console.error('Removed. Agents are blocks — use standard block management.');
        process.exit(1);
      }

      console.error(`Unknown agents subcommand: ${subCmd}`);
      process.exit(1);
    }

    // Phase 18: Tool commands — shorthand for block --designation tool
    if (cmd === 'tools') {
      const subCmd = argv._[1];

      if (!subCmd || subCmd === 'list') {
        return await listBlocks({ designation: 'tool', category: argv.category });
      }
      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('Block ID required'); process.exit(1); }
        return await getBlockInfo(id);
      }
      if (subCmd === 'metrics') {
        const id = argv._[2];
        if (!id) { console.error('Block ID required'); process.exit(1); }
        return await getBlockMetricsCmd(id);
      }
      if (subCmd === 'top') {
        return await getTopBlocksCmd({ designation: 'tool', limit: argv.limit ? parseInt(argv.limit) : 10 });
      }
      if (subCmd === 'create') {
        console.error('Removed. Use "block designate <block-id> tool" to designate a block as tool.');
        process.exit(1);
      }
      if (subCmd === 'delete') {
        console.error('Removed. Tools are blocks — use standard block management.');
        process.exit(1);
      }

      // Tool testing commands (generic, work for all blocks)
      if (subCmd === 'test') {
        const blockId = argv._[2];
        if (!blockId) { console.error('Block ID required'); process.exit(1); }
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
        if (id) { return await getToolTestRunInfo(id); }
        return await listToolTestRuns({ blockId: argv.block, status: argv.status });
      }
      if (subCmd === 'evaluate') {
        const runId = argv._[2];
        if (!runId) { console.error('Test run ID required'); process.exit(1); }
        return await evaluateToolTestRun(runId, argv);
      }
      if (subCmd === 'pending') {
        const runId = argv._[2];
        if (!runId) { console.error('Test run ID required'); process.exit(1); }
        return await showPendingEvaluations(runId);
      }

      console.error(`Unknown tools subcommand: ${subCmd}`);
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
        if (!blockId) { console.error('Block ID required'); process.exit(1); }
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
        if (!runId) { console.error('Test run ID required'); process.exit(1); }
        return await showBlockTestPendingEvaluations(runId);
      }

      if (subCmd === 'evaluate') {
        const runId = argv._[2];
        if (!runId) { console.error('Test run ID required'); process.exit(1); }
        return await evaluateBlockTestRun(runId, argv);
      }

      if (subCmd === 'compare') {
        const runIds = argv._[2];
        if (!runIds) { console.error('Run IDs required (comma-separated)'); process.exit(1); }
        return await compareBlockTestRuns(runIds.split(','));
      }

      if (subCmd === 'improve') {
        const runId = argv._[2];
        if (!runId) { console.error('Test run ID required'); process.exit(1); }
        const suggestions = argv.suggestions ? argv.suggestions.split(',') : [];
        if (suggestions.length === 0) {
          console.error('--suggestions required (comma-separated)');
          process.exit(1);
        }
        try {
          const run = await client.submitBlockImprovement(runId, suggestions);
          console.log(`\nImprovement suggestions added to run ${runId}`);
          console.log(`   Total suggestions: ${run.improvementSuggestions?.length || 0}`);
        } catch (error) {
          handleApiError(error, 'submitting improvements');
          process.exit(1);
        }
        return;
      }

      console.error(`Unknown test subcommand: ${subCmd}`);
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
        if (!id) { console.error('Experiment ID required'); process.exit(1); }
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
        if (!id) { console.error('Experiment ID required'); process.exit(1); }
        return await startExperiment(id);
      }

      if (subCmd === 'start-all') {
        const workspaceId = argv.workspace || argv.w || argv._[2];
        if (!workspaceId) { console.error('Workspace ID required (--workspace)'); process.exit(1); }
        return await startAllExperiments(workspaceId, !argv.sequential);
      }

      if (subCmd === 'pause') {
        const id = argv._[2];
        if (!id) { console.error('Experiment ID required'); process.exit(1); }
        return await pauseExperiment(id);
      }

      if (subCmd === 'stop') {
        const id = argv._[2];
        if (!id) { console.error('Experiment ID required'); process.exit(1); }
        return await stopExperiment(id);
      }

      if (subCmd === 'delete') {
        const id = argv._[2];
        if (!id) { console.error('Experiment ID required'); process.exit(1); }
        return await deleteExperiment(id, argv.force);
      }

      if (subCmd === 'progress') {
        const id = argv._[2];
        if (!id) { console.error('Experiment ID required'); process.exit(1); }
        return await getExperimentProgress(id);
      }

      if (subCmd === 'compare') {
        const ids = argv._.slice(2);
        if (ids.length < 2) { console.error('At least 2 experiment IDs required'); process.exit(1); }
        return await compareExperiments(ids);
      }

      if (subCmd === 'strategies') {
        return await listStrategies({
          category: argv.category || argv.c
        });
      }

      if (subCmd === 'strategy') {
        const id = argv._[2];
        if (!id) { console.error('Strategy ID required'); process.exit(1); }
        return await getStrategyInfo(id);
      }

      if (subCmd === 'recommend') {
        return await recommendStrategy({
          agent: argv.agent || argv.a,
          task: argv.task || argv.t
        });
      }

      console.error(`Unknown experiment subcommand: ${subCmd}`);
      console.error('   Available: list, info, create, start, start-all, pause, stop, delete, progress, compare, strategies, strategy, recommend');
      process.exit(1);
    }

    // Block Approval commands
    if (cmd === 'approval' || cmd === 'approvals') {
      const subCmd = argv._[1];

      if (!subCmd || subCmd === 'list') {
        return await listApprovals();
      }

      if (subCmd === 'info') {
        const id = argv._[2];
        if (!id) { console.error('Approval ID required'); process.exit(1); }
        return await getApprovalInfo(id);
      }

      if (subCmd === 'submit') {
        const blockId = argv._[2] || argv.block;
        if (!blockId) { console.error('Block ID required'); process.exit(1); }
        return await submitBlockForApproval(blockId, {
          session: argv.session,
          submittedBy: argv['submitted-by'] || argv.by,
          metadata: argv.metadata
        });
      }

      if (subCmd === 'approve') {
        const id = argv._[2];
        if (!id) { console.error('Approval ID required'); process.exit(1); }
        return await approveBlock(id, {
          reviewedBy: argv['reviewed-by'] || argv.by
        });
      }

      if (subCmd === 'reject') {
        const id = argv._[2];
        const reason = argv.reason || argv._[3];
        if (!id) { console.error('Approval ID required'); process.exit(1); }
        if (!reason) { console.error('Rejection reason required (--reason "...")'); process.exit(1); }
        return await rejectBlock(id, reason, {
          reviewedBy: argv['reviewed-by'] || argv.by
        });
      }

      console.error(`Unknown approval subcommand: ${subCmd}`);
      console.error('   Available: list, info, submit, approve, reject');
      process.exit(1);
    }

    // Documentation commands
    if (cmd === 'docs') {
      const subCmd = argv._[1];

      if (!subCmd || subCmd === 'list') {
        return await listDocs({
          knowledge: argv.knowledge,
          category: argv.category
        });
      }

      if (subCmd === 'show') {
        const topic = argv._[2];
        if (!topic) { console.error('Error: Topic required'); process.exit(1); }
        return await showDoc(topic, {
          json: argv.json,
          full: argv.full
        });
      }

      if (subCmd === 'generate') {
        return await generateDocs({
          metrics: argv.metrics,
          knowledge: argv.knowledge,
          scope: argv.scope || 'user'
        });
      }

      if (subCmd === 'search') {
        const query = argv._[2];
        if (!query) { console.error('Error: Search query required'); process.exit(1); }
        return await searchDocs(query);
      }

      console.error('Unknown docs subcommand: ' + subCmd);
      console.error('Available: list, show, generate, search');
      process.exit(1);
    }

    // Catalog commands
    if (cmd === 'catalog') {
      const subCmd = argv._[1];

      if (!subCmd || subCmd === 'list') {
        return await listCatalog({ category: argv.category });
      }

      if (subCmd === 'show') {
        const blockId = argv._[2];
        if (!blockId) { console.error('Error: Block ID required'); process.exit(1); }
        return await showCatalogEntry(blockId);
      }

      if (subCmd === 'search') {
        const query = argv._[2];
        if (!query) { console.error('Error: Search query required'); process.exit(1); }
        return await searchCatalog(query);
      }

      console.error('Unknown catalog subcommand: ' + subCmd);
      console.error('Available: list, show, search');
      process.exit(1);
    }

    // Block info extended (with fitness data)
    if (cmd === 'block-info') {
      const blockId = argv._[1];
      if (!blockId) { console.error('Error: Block ID required'); process.exit(1); }
      return await getBlockInfoExtended(blockId);
    }

    // Config command — manage CLI configuration (keybindings, etc.)
    if (cmd === 'config') {
      const subCmd = argv._[1];

      if (subCmd === 'keybindings' || subCmd === 'keys') {
        const { loadKeybindings, saveKeybindings, DEFAULT_KEYBINDINGS, flattenBindings, getKeybindingsPath } = require('./keybindings/keybindings.ts');
        const { bindingLabel } = require('./keybindings/keybinding-resolver.ts');
        const action = argv._[2]; // 'set', 'reset', 'edit', or undefined (show)

        if (action === 'set') {
          const actionName = argv._[3];
          const binding = argv._[4];
          if (!actionName || !binding) {
            console.error('Usage: maestro config keybindings set <action> <binding>');
            console.error('Example: maestro config keybindings set panel.next "Ctrl+Right"');
            process.exit(1);
          }

          const current = loadKeybindings();
          // Find which category the action belongs to
          let found = false;
          for (const cat of ['navigation', 'content', 'actions']) {
            if (current[cat] && actionName in current[cat]) {
              current[cat][actionName] = binding;
              found = true;
              break;
            }
          }
          if (!found) {
            // Try to add to the most likely category
            if (actionName.startsWith('page.') || actionName.startsWith('panel.')) {
              current.navigation[actionName] = binding;
            } else if (actionName.startsWith('cursor.') || actionName.startsWith('tree.') || actionName.startsWith('scroll.')) {
              current.content[actionName] = binding;
            } else {
              current.actions[actionName] = binding;
            }
          }
          saveKeybindings(current);
          console.log(c.ok(`Set ${c.cyan(actionName)} = ${c.yellow(binding)}`));
          return;
        }

        if (action === 'reset') {
          saveKeybindings(DEFAULT_KEYBINDINGS);
          console.log(c.ok('Keybindings reset to defaults.'));
          return;
        }

        if (action === 'edit') {
          const filePath = getKeybindingsPath();
          const fs = require('fs');
          const path = require('path');
          // Ensure file exists with current config
          if (!fs.existsSync(filePath)) {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(loadKeybindings(), null, 2) + '\n');
          }
          const editor = process.env.EDITOR || process.env.VISUAL || (process.platform === 'win32' ? 'notepad' : 'vi');
          const { execSync } = require('child_process');
          try {
            execSync(`${editor} "${filePath}"`, { stdio: 'inherit' });
          } catch (e) {
            console.log(`\n  Keybindings file: ${c.cyan(filePath)}`);
            console.log(`  ${c.dim('Open manually with your editor.')}`);
          }
          return;
        }

        // Default: show current keybindings
        const bindings = loadKeybindings();
        console.log(`\n${c.boldColor('cyan', 'Keybindings')}`);
        console.log(`  ${c.dim('File: ' + getKeybindingsPath())}\n`);

        for (const [category, actions] of Object.entries(bindings)) {
          console.log(`  ${c.bold(category.charAt(0).toUpperCase() + category.slice(1))}`);
          for (const [actionName, binding] of Object.entries(actions)) {
            const label = bindingLabel(binding);
            console.log(`    ${c.gray(actionName.padEnd(20))} ${c.cyan(label)}`);
          }
          console.log('');
        }

        console.log(`  ${c.dim('Commands:')}`);
        console.log(`    ${c.green('config keybindings')}              Show all bindings`);
        console.log(`    ${c.green('config keybindings set <a> <k>')}  Set action binding`);
        console.log(`    ${c.green('config keybindings reset')}        Reset to defaults`);
        console.log(`    ${c.green('config keybindings edit')}         Open config in editor`);
        return;
      }

      // Config azure — manage Azure OpenAI configuration
      if (subCmd === 'azure') {
        const { readConfig, updateConfig } = require('./config.ts');
        const action = argv._[2]; // 'set', 'show', 'test', 'clear', or undefined

        if (action === 'set' || (!action && (argv.endpoint || argv['api-key'] || argv.deployment))) {
          const endpoint = argv.endpoint || argv.e;
          const apiKey = argv['api-key'] || argv.k;
          const deployment = argv.deployment || argv.d;

          if (!endpoint && !apiKey && !deployment) {
            console.error('Usage: maestro config azure set --endpoint <url> --api-key <key> --deployment <name>');
            process.exit(1);
          }

          const config = readConfig();
          const azureCfg = config.azure || {};
          if (endpoint) azureCfg.endpoint = endpoint;
          if (apiKey) azureCfg.apiKey = apiKey;
          if (deployment) azureCfg.deployment = deployment;
          updateConfig({ azure: azureCfg });

          console.log(c.ok('Azure OpenAI configuration saved to ~/.maestro/config.json'));
          if (endpoint) console.log(`  Endpoint:   ${c.cyan(endpoint)}`);
          if (apiKey) console.log(`  API Key:    ${c.cyan('****' + apiKey.slice(-4))}`);
          if (deployment) console.log(`  Deployment: ${c.cyan(deployment)}`);

          // Also push to backend
          if (endpoint && apiKey && deployment) {
            try {
              await client.put('/api/provider/azure', {
                endpoint: azureCfg.endpoint,
                apiKey: azureCfg.apiKey,
                deploymentName: azureCfg.deployment
              });
              console.log(c.ok('Configuration also saved to backend. Restart backend to apply.'));
            } catch (e) {
              console.log(c.warn('Could not push config to backend (is it running?). Config saved locally only.'));
            }
          }
          return;
        }

        if (action === 'test') {
          const config = readConfig();
          const azureCfg = config.azure || {};
          console.log(c.info('Testing Azure OpenAI connection...'));
          try {
            const result = await client.post('/api/provider/azure/test', {
              endpoint: azureCfg.endpoint,
              apiKey: azureCfg.apiKey,
              deploymentName: azureCfg.deployment
            });
            console.log(c.ok(`Azure OpenAI: ${result.message || 'Connected'}`));
          } catch (e) {
            console.error(c.error(`Azure OpenAI test failed: ${e.message || e}`));
          }
          return;
        }

        if (action === 'clear') {
          updateConfig({ azure: {} });
          console.log(c.ok('Azure OpenAI configuration cleared.'));
          return;
        }

        // Default: show current config
        const config = readConfig();
        const azureCfg = config.azure || {};
        console.log(`\n${c.boldColor('cyan', 'Azure OpenAI Configuration')}`);
        console.log(`  ${c.dim('File: ~/.maestro/config.json')}\n`);
        if (azureCfg.endpoint) {
          console.log(`  Endpoint:   ${c.cyan(azureCfg.endpoint)}`);
          console.log(`  API Key:    ${azureCfg.apiKey ? c.cyan('****' + azureCfg.apiKey.slice(-4)) : c.gray('not set')}`);
          console.log(`  Deployment: ${azureCfg.deployment ? c.cyan(azureCfg.deployment) : c.gray('not set')}`);
        } else {
          console.log(`  ${c.gray('Not configured. Use: maestro config azure set --endpoint <url> --api-key <key> --deployment <name>')}`);
        }

        // Check backend active provider
        try {
          const active = await client.get('/api/provider/active');
          console.log(`\n  Active provider: ${c.bold(active.provider === 'azure' ? c.cyan('Azure OpenAI') : c.green('Local'))}`);
        } catch (e) {
          // Backend not running — skip
        }
        return;
      }

      // Config help
      console.log(`\n${c.boldColor('cyan', 'Config Commands')}`);
      console.log(`\n  ${c.green('config keybindings')}     View/manage TUI keybindings`);
      console.log(`  ${c.green('config keybindings set <action> <key>')}  Set a binding`);
      console.log(`  ${c.green('config keybindings reset')}              Reset to defaults`);
      console.log(`  ${c.green('config keybindings edit')}               Open in editor`);
      console.log(`\n  ${c.green('config azure')}           View Azure OpenAI configuration`);
      console.log(`  ${c.green('config azure set --endpoint <url> --api-key <key> --deployment <name>')}`);
      console.log(`  ${c.green('config azure test')}       Test Azure connection`);
      console.log(`  ${c.green('config azure clear')}      Remove Azure configuration`);
      return;
    }

    // Schema command — outputs available commands and their parameters
    if (cmd === 'schema') {
      formatter.setCommand('schema');
      const schema = {
        version: '2.0.0',
        inputFormat: '{"command": "session.create", "params": {"type": "foundry", "name": "Test"}}',
        commands: {
          'health': { params: {} },
          'blocks': { params: {} },
          'workflows': { params: {} },
          'info': { params: { id: { type: 'string', required: true, positional: 1 } } },
          'search': { params: { query: { type: 'string', required: true, positional: 1 } } },
          'children': { params: { id: { type: 'string', required: true, positional: 1 }, recursive: { type: 'boolean', default: true } } },
          'session': { params: {} },
          'session.list': { params: { status: { type: 'string' }, project: { type: 'string' }, limit: { type: 'number' } } },
          'session.info': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'session.create': { params: { project: { type: 'string', required: true }, name: { type: 'string' }, authority: { type: 'string', default: 'human' }, type: { type: 'string' }, source: { type: 'string', default: 'sandbox' }, repositoryPath: { type: 'string' } } },
          'session.start': { params: { id: { type: 'string', required: true, positional: 2 }, monitor: { type: 'boolean', default: false } } },
          'session.stop': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'session.pause': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'session.resume': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'session.delete': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'session.exec': { params: { id: { type: 'string', required: true, positional: 2 }, command: { type: 'string', required: true, positional: 3 } } },
          'session.invoke': { params: { id: { type: 'string', required: true, positional: 2 }, entryPoint: { type: 'string', default: 'start', positional: 3 } } },
          'session.events': { params: { id: { type: 'string', required: true, positional: 2 }, limit: { type: 'number' }, offset: { type: 'number' }, filter: { type: 'string' } } },
          'session.vars': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'session.vars.list': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'session.vars.get': { params: { id: { type: 'string', required: true, positional: 2 }, key: { type: 'string', required: true, positional: 4 } } },
          'session.vars.set': { params: { id: { type: 'string', required: true, positional: 2 }, key: { type: 'string', required: true, positional: 4 }, value: { type: 'any', required: true, positional: 5 } } },
          'session.vars.remove': { params: { id: { type: 'string', required: true, positional: 2 }, key: { type: 'string', required: true, positional: 4 } } },
          'session.entry-points': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'session.import': { params: { id: { type: 'string', required: true, positional: 2 }, template: { type: 'string', required: true } } },
          'session.take-control': { params: { id: { type: 'string', required: true, positional: 2 }, authority: { type: 'string', default: 'human' } } },
          'session.bind-repo': { params: { id: { type: 'string', required: true, positional: 2 }, path: { type: 'string', required: true } } },
          'session.widgets': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'run': { params: { blockId: { type: 'string', required: true, positional: 1 }, input: { type: 'string', repeated: true }, mock: { type: 'boolean' }, workingDir: { type: 'string' } }, aliases: ['execute'] },
          'validate': { params: { workflow: { type: 'string', required: true, positional: 1 } } },
          'monitor': { params: { id: { type: 'string', positional: 1 } } },
          'projects': { params: {} },
          'projects.info': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'projects.create': { params: { name: { type: 'string', required: true }, path: { type: 'string', required: true } } },
          'projects.delete': { params: { id: { type: 'string', required: true, positional: 2 }, force: { type: 'boolean' } } },
          'workspace': { params: {} },
          'workspace.info': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'workspace.create': { params: { name: { type: 'string', required: true, positional: 2 } } },
          'workspace.delete': { params: { id: { type: 'string', required: true, positional: 2 }, force: { type: 'boolean' } } },
          'block.publish': { params: { id: { type: 'string', required: true, positional: 2 }, fromSession: { type: 'string' } } },
          'block.approve': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'block.reject': { params: { id: { type: 'string', required: true, positional: 2 }, reason: { type: 'string', required: true } } },
          'docs': { params: {} },
          'docs.list': { params: { knowledge: { type: 'boolean' }, category: { type: 'string' } } },
          'docs.show': { params: { topic: { type: 'string', required: true, positional: 2 }, json: { type: 'boolean' }, full: { type: 'boolean' } } },
          'docs.generate': { params: { metrics: { type: 'boolean' }, knowledge: { type: 'boolean' }, scope: { type: 'string', default: 'user' } } },
          'docs.search': { params: { query: { type: 'string', required: true, positional: 2 } } },
          'catalog': { params: {} },
          'catalog.list': { params: { category: { type: 'string' } } },
          'catalog.show': { params: { id: { type: 'string', required: true, positional: 2 } } },
          'catalog.search': { params: { query: { type: 'string', required: true, positional: 2 } } },
          'block-info': { params: { id: { type: 'string', required: true, positional: 1 } } },
          'provider': { params: {} },
          'provider.health': { params: {} },
          'provider.capabilities': { params: {} },
          'models': { params: { category: { type: 'string' } } },
          'models.local': { params: {} },
          'models.registry': { params: { category: { type: 'string' } } },
          'models.load': { params: { modelId: { type: 'string', required: true, positional: 2 }, '8bit': { type: 'boolean' } } },
          'models.switch': { params: { modelId: { type: 'string', required: true, positional: 2 }, '8bit': { type: 'boolean' } } },
          'chat': { params: { model: { type: 'string' }, system: { type: 'string' }, temperature: { type: 'number' }, 'max-tokens': { type: 'number' } } },
          'setup': { params: {} },
        }
      };
      formatter.success(schema, JSON.stringify(schema, null, 2));
      return;
    }

    // Phase 21: Init command
    if (cmd === 'init') {
      const targetPath = argv._[1] || argv.path;
      return await initRepo(targetPath, { force: argv.force });
    }

    // Phase 32-B: List available aliases
    if (cmd === 'aliases') {
      const aliases = loadAliases();
      const names = Object.keys(aliases);
      if (names.length === 0) {
        console.log(c.gray('\nNo aliases configured.'));
        console.log(c.gray('  Run `maestro init` to create .maestro/aliases.json with defaults.'));
        console.log(c.gray('  Or create ~/.maestro/aliases.json for global aliases.\n'));
        return;
      }
      console.log(`\n${c.bold('Available aliases:')}\n`);
      for (const name of names) {
        const def = aliases[name];
        console.log(`  ${c.cyan(name)}${def.description ? c.gray(` — ${def.description}`) : ''}`);
        console.log(`    ${c.gray('template:')} ${def.template || 'project-autonomous'}  ${c.gray('entry:')} ${def.entryPoint || 'dev'}`);
      }
      console.log(`\n${c.gray('Usage:')} maestro <alias> "task description"\n`);
      return;
    }

    // Phase 20: Auth commands
    if (cmd === 'auth') {
      const subCmd = argv._[1];

      if (!subCmd || subCmd === 'status') {
        try {
          const status = await client.getAuthStatus();
          if (status.enabled) {
            formatter.info(`Security: ${c.green('enabled')}`);
            if (status.needsSetup) {
              console.log(`  ${c.yellow('No API keys configured.')} Run: maestro auth setup`);
            } else {
              console.log(`  API keys configured: ${c.green('yes')}`);
            }
          } else {
            formatter.info(`Security: ${c.gray('disabled')} (development mode)`);
          }
        } catch (error) {
          handleApiError(error, 'checking auth status');
        }
        return;
      }

      if (subCmd === 'setup') {
        try {
          const name = argv.name || 'admin';
          const result = await client.authSetup(name);
          formatter.info('Initial admin API key created');
          console.log('');
          console.log(`  ${c.bold('Key:')} ${c.green(result.key)}`);
          console.log('');
          console.log(`  ${c.yellow('Store this key securely — it cannot be retrieved later.')}`);
          console.log(`  Set it in your config: maestro config set apiKey <key>`);
          console.log(`  Or use env: MAESTRO_API_KEY=<key>`);
        } catch (error) {
          if (error.status === 409) {
            formatter.error('Setup already completed. Use your admin key to create more keys.', 'ALREADY_SETUP');
          } else {
            handleApiError(error, 'auth setup');
          }
        }
        return;
      }

      if (subCmd === 'create-key') {
        const name = argv.name || argv._[2];
        if (!name) { formatter.error('--name required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        try {
          const result = await client.createApiKey({
            name,
            scope: argv.scope || 'Human',
            sessionId: argv['session-id'],
            expiresInDays: argv.expires ? parseInt(argv.expires) : undefined
          });
          formatter.info(`API key created: ${result.name}`);
          console.log(`  ${c.bold('Key:')}   ${c.green(result.key)}`);
          console.log(`  ${c.bold('Scope:')} ${result.scope}`);
          if (result.expiresAt) console.log(`  ${c.bold('Expires:')} ${result.expiresAt}`);
        } catch (error) {
          handleApiError(error, 'creating API key');
        }
        return;
      }

      if (subCmd === 'list-keys') {
        try {
          const keys = await client.listApiKeys();
          if (keys.length === 0) {
            console.log('  No API keys configured.');
            return;
          }
          const rows = keys.map(k => ({
            'ID': k.id,
            'Name': k.name,
            'Prefix': k.keyPrefix + '...',
            'Scope': k.scope,
            'Created': new Date(k.createdAt).toLocaleDateString(),
            'Last Used': k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'never'
          }));
          formatter.table(rows);
        } catch (error) {
          handleApiError(error, 'listing API keys');
        }
        return;
      }

      if (subCmd === 'revoke') {
        const id = argv._[2];
        if (!id) { formatter.error('Key ID required', 'MISSING_PARAM'); process.exit(EXIT.USER_ERROR); }
        try {
          await client.revokeApiKey(id);
          formatter.info(`API key revoked: ${id}`);
        } catch (error) {
          handleApiError(error, 'revoking API key');
        }
        return;
      }

      formatter.error(`Unknown auth subcommand: ${subCmd}. Available: status, setup, create-key, list-keys, revoke`, 'UNKNOWN_COMMAND');
      process.exit(EXIT.USER_ERROR);
    }

    // "Did you mean...?" suggestion
    const suggestion = suggestCommand(cmd, [...BUILTIN_COMMANDS]);
    const hint = suggestion ? ` Did you mean: ${c.cyan(suggestion)}?` : '';
    formatter.error(`Unknown command: ${cmd}.${hint} Run ${c.cyan('maestro --help')} for available commands.`, 'UNKNOWN_COMMAND');
    process.exit(1);
  } catch (error) {
    formatter.error(`Fatal error: ${error.message}`, 'FATAL');
    process.exit(1);
  }
}

// require.main is index.js (the shim), not this module.
// Check if we're the entry point by checking if require.main loaded us.
if (require.main === module || require.main?.filename?.endsWith('index.js')) main();
