import minimist from 'minimist';
import path from 'path';
import { ApiClient } from './api-client.js';
import { ProcessManager } from './process-manager.js';
import { OutputFormatter } from './output-formatter.js';
import { palette } from './theme/palette.js';
import { setTerminalBg, resetTerminalBg } from './theme/terminal.js';

const DEFAULT_URL = 'http://localhost:5010';

export async function main() {
  const args = minimist(process.argv.slice(2), {
    boolean: ['headless', 'json', 'help', 'mock'],
    string: ['url', 'model', 'project'],
    default: {
      url: DEFAULT_URL,
      headless: false,
      json: false,
    },
    alias: { h: 'help', u: 'url', m: 'model', j: 'json' },
  });

  const command = args._[0] ?? 'start';
  const formatter = new OutputFormatter(args.json);
  const client = new ApiClient(args.url);

  if (args.help) {
    printHelp();
    return;
  }

  switch (command) {
    case 'start':
      await handleStart(args, formatter);
      break;
    case 'stop':
      await handleStop(formatter);
      break;
    case 'status':
      await handleStatus(client, formatter);
      break;
    case 'stats':
      await handleStats(client, formatter, args.model);
      break;
    case 'models':
      await handleModels(client, formatter);
      break;
    case 'switch':
      await handleSwitch(client, formatter, args._[1] ?? args.model);
      break;
    default:
      formatter.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

async function handleStart(args: minimist.ParsedArgs, formatter: OutputFormatter) {
  if (args.headless) {
    formatter.info('Starting backend in headless mode...');
    const pm = new ProcessManager(args.project);
    pm.onLog(line => console.log(line));
    pm.start();
    formatter.success(null, 'Backend started');

    process.on('SIGINT', async () => {
      formatter.info('Shutting down...');
      await pm.stop();
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});
  } else {
    // Interactive TUI mode
    const { render } = await import('ink');
    const React = await import('react');
    const { App } = await import('./app.js');

    const logDir = path.resolve(
      args.project ?? path.resolve(import.meta.dirname ?? process.cwd(), '..', 'dotnet', 'src', 'LLMProvider.Web'),
      'logs'
    );

    // Set terminal background color (Maestro-style)
    setTerminalBg(palette.bg);

    // Ensure background is always reset on exit
    process.on('exit', () => resetTerminalBg());

    const { unmount, waitUntilExit } = render(
      React.createElement(App, {
        baseUrl: args.url,
        logDir,
        mock: args.mock,
        onExit: () => unmount(),
      })
    );

    try {
      await waitUntilExit();
    } finally {
      resetTerminalBg();
    }
  }
}

async function handleStop(formatter: OutputFormatter) {
  formatter.info('Sending stop signal...');
  const pm = new ProcessManager();
  await pm.stop();
  formatter.success(null, 'Backend stopped');
}

async function handleStatus(client: ApiClient, formatter: OutputFormatter) {
  const connected = await client.isConnected();
  if (connected) {
    const health = await client.getHealth();
    formatter.success(health, 'Backend is running');
  } else {
    formatter.error('Backend is not reachable');
    process.exit(1);
  }
}

async function handleStats(client: ApiClient, formatter: OutputFormatter, modelId?: string) {
  if (modelId) {
    const stats = await client.getStats();
    const model = stats?.modelStats.find(m => m.modelId === modelId);
    if (model) {
      formatter.success(model, `Statistics for ${modelId}`);
    } else {
      formatter.error(`No statistics found for model: ${modelId}`);
    }
    return;
  }

  const stats = await client.getStats();
  if (stats) {
    if (formatter['jsonMode']) {
      formatter.success(stats);
    } else {
      formatter.success(null, `Total requests: ${stats.totalRequests}`);
      formatter.info(`Tokens: ${stats.totalTokens?.totalTokens ?? 0} (prompt: ${stats.totalTokens?.promptTokens ?? 0}, completion: ${stats.totalTokens?.completionTokens ?? 0})`);
      formatter.info(`Latency P50: ${stats.latency.p50.toFixed(0)}ms  P95: ${stats.latency.p95.toFixed(0)}ms  P99: ${stats.latency.p99.toFixed(0)}ms`);
      formatter.info(`Queue depth: ${stats.queue.currentDepth}, total processed: ${stats.queue.totalProcessed}`);

      if (stats.modelStats.length > 0) {
        formatter.table(
          ['Model', 'Requests', 'Avg Latency', 'Tokens', 'RPM'],
          stats.modelStats.map(m => [
            m.modelId,
            String(m.requestCount),
            `${m.latency.average.toFixed(0)}ms`,
            String(m.totalTokens.totalTokens),
            m.requestsPerMinute.toFixed(1),
          ])
        );
      }
    }
  } else {
    formatter.error('Could not fetch statistics. Is the backend running?');
  }
}

async function handleModels(client: ApiClient, formatter: OutputFormatter) {
  const models = await client.getModels();
  if (models && models.length > 0) {
    formatter.table(
      ['Model', 'Provider', 'Available', 'Context', 'Capabilities'],
      models.map(m => [
        m.id ?? m.name,
        m.provider,
        m.isAvailable ? 'Yes' : 'No',
        m.contextLength ? `${(m.contextLength / 1024).toFixed(0)}K` : 'N/A',
        (m.capabilities ?? []).join(', '),
      ])
    );
  } else {
    formatter.error('No models found. Is the backend running?');
  }
}

async function handleSwitch(client: ApiClient, formatter: OutputFormatter, modelId?: string) {
  if (!modelId) {
    formatter.error('Usage: monitor switch <modelId>');
    process.exit(1);
  }
  try {
    await client.switchModel(modelId);
    formatter.success(null, `Switch request sent for model: ${modelId}`);
  } catch (e) {
    formatter.error(`Failed to switch model: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function printHelp() {
  console.log(`
LLM-Provider Monitor

Usage: npx tsx src/index.ts [command] [options]

Commands:
  start           Start backend + open interactive TUI (default)
  start --headless  Start backend only, no TUI
  stop            Stop the backend process
  status          Check backend connection status
  stats           Show statistics snapshot
  stats --model <id>  Show model-specific statistics
  models          List all available models
  switch <modelId>  Force a model switch

Options:
  -u, --url <url>   Backend URL (default: http://localhost:5010)
  -j, --json        Output in JSON format
  -h, --help        Show this help
  `);
}
