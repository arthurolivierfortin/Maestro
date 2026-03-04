#!/usr/bin/env npx tsx
/**
 * TUI MCP Server — Model Context Protocol server exposing TUI interaction tools.
 *
 * This server gives a Claude Code subagent direct tools to interact with
 * the maestro-code TUI via PTY. The subagent sees the screen, presses keys,
 * types text — exactly like a real user. No file system access, no scripts,
 * no circumvention possible.
 *
 * Protocol: JSON-RPC 2.0 over stdio (MCP standard)
 *
 * Tools:
 *   tui_spawn   — Start the TUI in demo or real mode
 *   tui_frame   — Capture the current screen
 *   tui_press   — Send a keypress (enter, escape, tab, up, down, /, h, a, s, f, c, m, j, k, q)
 *   tui_type    — Type text into the focused input
 *   tui_wait    — Wait for text to appear on screen
 *   tui_stable  — Wait for screen to stop changing
 *   tui_check   — Check if text exists on screen
 *   tui_kill    — Stop the TUI
 */

import { TuiDriver, type Frame } from './tui-driver.ts';
import * as readline from 'readline';

// ── State ────────────────────────────────────────────────────

let driver: TuiDriver | null = null;

// ── Frame formatting ─────────────────────────────────────────

function formatFrame(frame: Frame): string {
  const nonEmpty = frame.lines.filter(l => l.trim());
  return [
    `--- Frame (${frame.timestamp}ms, ${nonEmpty.length} visible lines) ---`,
    ...nonEmpty.map(l => l.substring(0, 140)),
    '--- End Frame ---',
  ].join('\n');
}

// ── Tool definitions ─────────────────────────────────────────

const TOOLS = [
  {
    name: 'tui_spawn',
    description: 'Start the maestro-code TUI. Must be called first before any other tool. Returns the initial screen frame.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['demo', 'real'],
          description: 'demo = mock data (no backend needed), real = live backend on port 5000',
        },
        repo: {
          type: 'string',
          description: 'Repository path for real mode (e.g., /c/Cantante)',
        },
      },
      required: [],
    },
  },
  {
    name: 'tui_frame',
    description: 'Capture and return the current TUI screen. This is your EYES — call this after every action to see what the user would see. Read every line carefully.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'tui_press',
    description: 'Send a single keypress to the TUI. Returns the screen after the keypress. Use this to navigate pages, press Enter to submit, Escape to go back, / to focus input, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          enum: ['enter', 'escape', 'tab', 'up', 'down', 'left', 'right', '/', 'h', 'a', 's', 'f', 'c', 'm', 'j', 'k', 'q'],
          description: 'Key to press. Letters navigate pages: h=Home, a=Agent, s=Spaces, f=Foundry, c=Catalog, m=Models. j/k=scroll. /=focus input. q=quit.',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'tui_type',
    description: 'Type text into the currently focused input field. The input must be focused first (press / on Agent page). Returns the screen after typing.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to type',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'tui_wait',
    description: 'Wait for specific text to appear on the TUI screen. Useful after actions that take time (e.g., waiting for agent response). Returns the frame when found or timeout.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to wait for',
        },
        timeout_ms: {
          type: 'number',
          description: 'Max time to wait in milliseconds (default: 30000)',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'tui_stable',
    description: 'Wait for the screen to stop changing (stabilize). Useful after navigation or when waiting for rendering to complete.',
    inputSchema: {
      type: 'object',
      properties: {
        timeout_ms: {
          type: 'number',
          description: 'Max time to wait in milliseconds (default: 15000)',
        },
      },
      required: [],
    },
  },
  {
    name: 'tui_check',
    description: 'Check if specific text exists on the current screen. Returns PASS or FAIL with the frame if not found.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to check for',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'tui_kill',
    description: 'Stop the TUI and clean up. Call this when you are done testing.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ── Tool execution ───────────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'tui_spawn': {
      if (driver) {
        try { driver.kill(); } catch {}
      }
      const mode = (args.mode as string) || 'demo';
      const repo = args.repo as string | undefined;

      driver = new TuiDriver(120, 40);
      await driver.spawn(mode as 'demo' | 'real', { repo });

      const frame = await driver.waitForRender(20000);
      const text = formatFrame(frame);

      if (frame.text.includes('Backend Not Available')) {
        return `WARNING: Backend not running!\n\n${text}`;
      }
      return `TUI started in ${mode} mode.\n\n${text}`;
    }

    case 'tui_frame': {
      if (!driver) return 'ERROR: TUI not running. Call tui_spawn first.';
      return formatFrame(driver.captureFrame());
    }

    case 'tui_press': {
      if (!driver) return 'ERROR: TUI not running. Call tui_spawn first.';
      const key = args.key as string;
      driver.press(key as any);
      await new Promise(r => setTimeout(r, 400));
      const frame = driver.captureFrame();
      return `Pressed: ${key}\n\n${formatFrame(frame)}`;
    }

    case 'tui_type': {
      if (!driver) return 'ERROR: TUI not running. Call tui_spawn first.';
      const text = args.text as string;
      await driver.typeText(text, 20);
      await new Promise(r => setTimeout(r, 500));
      const frame = driver.captureFrame();
      return `Typed: "${text}"\n\n${formatFrame(frame)}`;
    }

    case 'tui_wait': {
      if (!driver) return 'ERROR: TUI not running. Call tui_spawn first.';
      const text = args.text as string;
      const timeout = (args.timeout_ms as number) || 30000;
      const frame = await driver.waitForContent(text, timeout);
      const found = frame.text.includes(text);
      return `${found ? 'FOUND' : 'NOT FOUND'}: "${text}"\n\n${formatFrame(frame)}`;
    }

    case 'tui_stable': {
      if (!driver) return 'ERROR: TUI not running. Call tui_spawn first.';
      const timeout = (args.timeout_ms as number) || 15000;
      const frame = await driver.waitForStable(1000, timeout);
      return `Screen stable.\n\n${formatFrame(frame)}`;
    }

    case 'tui_check': {
      if (!driver) return 'ERROR: TUI not running. Call tui_spawn first.';
      const text = args.text as string;
      const frame = driver.captureFrame();
      const found = frame.text.includes(text);
      if (found) {
        return `CHECK "${text}": PASS`;
      }
      return `CHECK "${text}": FAIL\n\n${formatFrame(frame)}`;
    }

    case 'tui_kill': {
      if (!driver) return 'TUI was not running.';
      driver.kill();
      driver = null;
      return 'TUI stopped and cleaned up.';
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ── JSON-RPC handler ─────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: string;
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

function send(obj: object) {
  const json = JSON.stringify(obj);
  // MCP uses Content-Length framed messages over stdio
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
}

async function handleMessage(msg: JsonRpcRequest) {
  const { id, method, params } = msg;

  // Notifications (no id) — just acknowledge
  if (id === undefined) {
    return; // notifications like 'notifications/initialized' don't need a response
  }

  switch (method) {
    case 'initialize':
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'tui-dogfood', version: '1.0.0' },
        },
      });
      break;

    case 'tools/list':
      send({
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      });
      break;

    case 'tools/call': {
      const toolName = (params as any)?.name as string;
      const toolArgs = ((params as any)?.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await executeTool(toolName, toolArgs);
        send({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: result }],
          },
        });
      } catch (err: any) {
        send({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `ERROR: ${err.message}` }],
            isError: true,
          },
        });
      }
      break;
    }

    default:
      send({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
  }
}

// ── Stdio transport (Content-Length framing) ──────────────────

function startStdioTransport() {
  let buffer = '';

  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;

    // Parse Content-Length framed messages
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = buffer.substring(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Try line-delimited JSON as fallback
        const lineEnd = buffer.indexOf('\n');
        if (lineEnd === -1) break;
        const line = buffer.substring(0, lineEnd).trim();
        buffer = buffer.substring(lineEnd + 1);
        if (line) {
          try {
            const msg = JSON.parse(line);
            handleMessage(msg);
          } catch {}
        }
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;

      if (buffer.length < bodyStart + contentLength) break; // not enough data yet

      const body = buffer.substring(bodyStart, bodyStart + contentLength);
      buffer = buffer.substring(bodyStart + contentLength);

      try {
        const msg = JSON.parse(body);
        handleMessage(msg);
      } catch (err) {
        process.stderr.write(`[tui-mcp] Parse error: ${err}\n`);
      }
    }
  });

  process.stdin.on('end', () => {
    if (driver) {
      try { driver.kill(); } catch {}
    }
    process.exit(0);
  });

  process.stderr.write('[tui-mcp] TUI MCP server ready (stdio)\n');
}

// ── Entry point ──────────────────────────────────────────────

startStdioTransport();
