/**
 * TUI MCP Server — Model Context Protocol server exposing TUI interaction tools.
 *
 * Uses the official @modelcontextprotocol/sdk for proper protocol compliance.
 * Gives a Claude Code subagent direct tools to interact with the maestro-code
 * TUI via PTY — exactly like a real user.
 *
 * Usage in .mcp.json:
 *   { "command": "npx", "args": ["tsx", "packages/maestro-code/tests/tui-mcp-server.ts"] }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { TuiDriver, type Frame } from './tui-driver.ts';
import { MaestroSidecar } from '@maestro/sidecar';

// ── Constants ────────────────────────────────────────────────

const __filename_esm = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const __dirname_esm = path.dirname(__filename_esm);
const DOGFOOD_DIR = path.resolve(__dirname_esm, '..', '..', '..', 'dogfooding');
const REPORTS_DIR = path.join(DOGFOOD_DIR, 'reports');

// ── State ────────────────────────────────────────────────────

let driver: TuiDriver | null = null;
let sidecar: MaestroSidecar | null = null;
let sessionNotes: string[] = [];
let sessionId: string = '';

function formatFrame(frame: Frame): string {
  const nonEmpty = frame.lines.filter(l => l.trim());
  return [
    `--- Frame (${frame.timestamp}ms, ${nonEmpty.length} visible lines) ---`,
    ...nonEmpty.map(l => l.substring(0, 140)),
    '--- End Frame ---',
  ].join('\n');
}

// ── Server ───────────────────────────────────────────────────

const server = new McpServer({
  name: "tui-dogfood",
  version: "1.0.0",
});

// ── Tools ────────────────────────────────────────────────────

server.registerTool(
  "tui_spawn",
  {
    description: "Start the maestro-code TUI. Must be called first. Returns the initial screen frame.",
    inputSchema: {
      mode: z.enum(["demo", "real"]).default("demo")
        .describe("demo = mock data (no backend), real = live backend on port 5000"),
      repo: z.string().optional()
        .describe("Repository path for real mode (e.g. C:\\Cantante)"),
    },
  },
  async ({ mode, repo }) => {
    if (driver) {
      try { driver.kill(); } catch {}
    }
    // Reset session notes
    sessionNotes = [];
    sessionId = '';

    // In real mode, start backend + LLM-Provider via sidecar if not already running
    let sidecarInfo = '';
    if (mode === 'real' && !sidecar) {
      try {
        console.error('[tui-mcp] Starting sidecar (backend + LLM-Provider)...');
        sidecar = new MaestroSidecar({
          backendPort: 5000,
          llmProviderPort: 5010,
          healthTimeout: 45000,
          onLog: (msg: string) => console.error(`[sidecar] ${msg}`),
        });
        await sidecar.start();
        sidecarInfo = `Sidecar started: backend on ${sidecar.backendPort}, LLM-Provider on ${sidecar.llmProviderPort}\n`;
        console.error(`[tui-mcp] Sidecar ready: backend=${sidecar.backendPort}, llm=${sidecar.llmProviderPort}`);
      } catch (err: any) {
        console.error(`[tui-mcp] Sidecar failed: ${err.message}`);
        sidecarInfo = `WARNING: Sidecar failed to start: ${err.message}\n`;
      }
    }

    driver = new TuiDriver(120, 40);
    await driver.spawn(mode, { repo });
    const frame = await driver.waitForRender(20000);
    const text = formatFrame(frame);
    const warning = frame.text.includes('Backend Not Available') ? 'WARNING: Backend not running!\n\n' : '';
    return { content: [{ type: "text" as const, text: `TUI started in ${mode} mode.\n${sidecarInfo}\n${warning}${text}` }] };
  },
);

server.registerTool(
  "tui_frame",
  {
    description: "Capture and return the current TUI screen. This is your EYES — call after every action.",
    inputSchema: {},
  },
  async () => {
    if (!driver) return { content: [{ type: "text" as const, text: "ERROR: TUI not running. Call tui_spawn first." }] };
    return { content: [{ type: "text" as const, text: formatFrame(driver.captureFrame()) }] };
  },
);

server.registerTool(
  "tui_press",
  {
    description: "Send a keypress to the TUI. Returns the screen after the press.",
    inputSchema: {
      key: z.enum(["enter", "escape", "tab", "space", "up", "down", "left", "right", "/", "h", "a", "s", "f", "c", "m", "j", "k", "p", "t", "q", "d", "r", "n", "y", "z", "1", "2", "3", "4", "?"])
        .describe("Key to press. Navigation: j/k=scroll, space=expand/collapse, enter=select/open, escape=close. Filters: 1/2/3/4=type tabs, r=toggle filter. Actions: d=delete, t=test, p=playground, z=zoom, ?=help overlay, y=confirm, n=deny. Pages (classic): h/a/s/f/c/m."),
    },
  },
  async ({ key }) => {
    if (!driver) return { content: [{ type: "text" as const, text: "ERROR: TUI not running. Call tui_spawn first." }] };
    driver.press(key as any);
    await new Promise(r => setTimeout(r, 400));
    return { content: [{ type: "text" as const, text: `Pressed: ${key}\n\n${formatFrame(driver.captureFrame())}` }] };
  },
);

server.registerTool(
  "tui_type",
  {
    description: "Type text into the focused input field. Press / first to focus. Returns screen after typing.",
    inputSchema: {
      text: z.string().describe("The text to type"),
    },
  },
  async ({ text }) => {
    if (!driver) return { content: [{ type: "text" as const, text: "ERROR: TUI not running. Call tui_spawn first." }] };
    await driver.typeText(text, 20);
    await new Promise(r => setTimeout(r, 500));
    return { content: [{ type: "text" as const, text: `Typed: "${text}"\n\n${formatFrame(driver.captureFrame())}` }] };
  },
);

server.registerTool(
  "tui_wait",
  {
    description: "Wait for text to appear on screen. Returns frame when found or timeout.",
    inputSchema: {
      text: z.string().describe("Text to wait for"),
      timeout_ms: z.number().default(30000).describe("Max wait in ms"),
    },
  },
  async ({ text, timeout_ms }) => {
    if (!driver) return { content: [{ type: "text" as const, text: "ERROR: TUI not running. Call tui_spawn first." }] };
    const frame = await driver.waitForContent(text, timeout_ms);
    const found = frame.text.includes(text);
    return { content: [{ type: "text" as const, text: `${found ? 'FOUND' : 'NOT FOUND'}: "${text}"\n\n${formatFrame(frame)}` }] };
  },
);

server.registerTool(
  "tui_stable",
  {
    description: "Wait for the screen to stop changing (stabilize).",
    inputSchema: {
      timeout_ms: z.number().default(15000).describe("Max wait in ms"),
    },
  },
  async ({ timeout_ms }) => {
    if (!driver) return { content: [{ type: "text" as const, text: "ERROR: TUI not running. Call tui_spawn first." }] };
    const frame = await driver.waitForStable(1000, timeout_ms);
    return { content: [{ type: "text" as const, text: `Screen stable.\n\n${formatFrame(frame)}` }] };
  },
);

server.registerTool(
  "tui_check",
  {
    description: "Check if text exists on screen. Returns PASS or FAIL.",
    inputSchema: {
      text: z.string().describe("Text to check for"),
    },
  },
  async ({ text }) => {
    if (!driver) return { content: [{ type: "text" as const, text: "ERROR: TUI not running. Call tui_spawn first." }] };
    const frame = driver.captureFrame();
    const found = frame.text.includes(text);
    return { content: [{ type: "text" as const, text: found ? `CHECK "${text}": PASS` : `CHECK "${text}": FAIL\n\n${formatFrame(frame)}` }] };
  },
);

server.registerTool(
  "tui_note",
  {
    description: "Record an observation during testing. Call this frequently as you explore — every reaction, confusion, problem, or delight. Notes are accumulated and included in the final report. Think out loud.",
    inputSchema: {
      category: z.enum(["first-impression", "confusion", "bug", "friction", "delight", "suggestion", "observation"])
        .describe("What kind of note is this?"),
      page: z.string().optional()
        .describe("Which page/screen you're on (e.g. Agent, Home, Spaces, Foundry, Catalog, Models)"),
      note: z.string()
        .describe("Your honest observation. Be specific — reference what you see on screen."),
      severity: z.enum(["critical", "major", "minor", "info"]).default("info")
        .describe("How important is this finding?"),
    },
  },
  async ({ category, page, note, severity }) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    const entry = `[${timestamp}] [${severity}] [${category}]${page ? ` [${page}]` : ''} ${note}`;
    sessionNotes.push(entry);
    return { content: [{ type: "text" as const, text: `Note #${sessionNotes.length} recorded: ${entry}` }] };
  },
);

server.registerTool(
  "tui_report",
  {
    description: "Write the final dogfooding report. This saves a markdown file to dogfooding/reports/ with all your notes and the full analysis. Call this at the END of the session, after tui_kill.",
    inputSchema: {
      summary: z.string().describe("Executive summary — 2-3 sentences on the overall experience"),
      scores: z.object({
        first_impression: z.number().min(1).max(5),
        navigation: z.number().min(1).max(5),
        core_feature: z.number().min(1).max(5),
        visual_polish: z.number().min(1).max(5),
        error_handling: z.number().min(1).max(5),
        overall: z.number().min(1).max(5),
      }).describe("Scores 1-5 for each category"),
      top_issues: z.array(z.string()).describe("Top 3-5 prioritized issues to fix"),
      what_works: z.array(z.string()).describe("Things that work well"),
      full_analysis: z.string().describe("The complete detailed analysis — discoverability problems, UX friction, broken features, suggestions"),
    },
  },
  async ({ summary, scores, top_issues, what_works, full_analysis }) => {
    // Ensure directories exist
    fs.mkdirSync(REPORTS_DIR, { recursive: true });

    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const timeStr = now.toISOString().substring(11, 19).replace(/:/g, '-');
    sessionId = `${dateStr}-${timeStr}`;
    const filename = `dogfood-${sessionId}.md`;
    const filepath = path.join(REPORTS_DIR, filename);

    const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;

    const report = `# Dogfooding Report — ${dateStr}

## Summary
${summary}

## Scores

| Category | Score |
|----------|-------|
| First Impression | ${scores.first_impression}/5 |
| Navigation | ${scores.navigation}/5 |
| Core Feature (Agent) | ${scores.core_feature}/5 |
| Visual Polish | ${scores.visual_polish}/5 |
| Error Handling | ${scores.error_handling}/5 |
| **Overall** | **${scores.overall}/5** |
| *Average* | *${avgScore.toFixed(1)}/5* |

## Top Issues to Fix
${top_issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

## What Works Well
${what_works.map(w => `- ${w}`).join('\n')}

## Detailed Analysis
${full_analysis}

## Session Notes (raw observations)
${sessionNotes.length > 0 ? sessionNotes.map(n => `- ${n}`).join('\n') : '_No notes recorded during session._'}

---
*Generated by e2e-tester agent on ${now.toISOString()}*
`;

    fs.writeFileSync(filepath, report, 'utf-8');
    console.error(`[tui-mcp] Report written to ${filepath}`);

    return { content: [{ type: "text" as const, text: `Report saved to dogfooding/reports/${filename}\n\nOverall score: ${scores.overall}/5 (avg: ${avgScore.toFixed(1)})\nNotes recorded: ${sessionNotes.length}\nTop issue: ${top_issues[0] || 'none'}` }] };
  },
);

server.registerTool(
  "tui_kill",
  {
    description: "Stop the TUI and clean up. Call when done testing.",
    inputSchema: {},
  },
  async () => {
    if (!driver && !sidecar) return { content: [{ type: "text" as const, text: "TUI was not running." }] };
    if (driver) { driver.kill(); driver = null; }
    if (sidecar) {
      try { await sidecar.stop(); } catch {}
      sidecar = null;
    }
    return { content: [{ type: "text" as const, text: "TUI and services stopped and cleaned up." }] };
  },
);

// ── Start ────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[tui-mcp] TUI MCP server running on stdio");
}

main().catch((error) => {
  console.error("[tui-mcp] Fatal error:", error);
  process.exit(1);
});
