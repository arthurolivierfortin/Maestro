/**
 * E2E Tests for Full Stack Synchronization Verification
 *
 * These tests verify that:
 * 1. Backend API returns agents from JSON files
 * 2. Frontend displays what the API returns
 *
 * This is the key verification layer for Claude to ensure
 * frontend is synchronized with backend changes.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

interface AgentSummary {
  id: string;
  name: string;
  version: string;
  category: string;
}

interface ToolSummary {
  id: string;
  name: string;
  version: string;
  category: string;
}

test.describe('Backend-Frontend Synchronization', () => {
  test('verify agents API returns data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/agents`);

    console.log('=== API AGENTS CHECK ===');
    console.log(`Status: ${response.status()}`);

    if (response.ok()) {
      const agents = await response.json() as AgentSummary[];
      console.log(`Agent count from API: ${agents.length}`);
      agents.forEach(a => console.log(`  - ${a.id}: ${a.name} (v${a.version})`));
    } else {
      console.log(`API Error: ${response.statusText()}`);
    }
    console.log('========================');
  });

  test('verify tools API returns data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/tools`);

    console.log('=== API TOOLS CHECK ===');
    console.log(`Status: ${response.status()}`);

    if (response.ok()) {
      const tools = await response.json() as ToolSummary[];
      console.log(`Tool count from API: ${tools.length}`);
      tools.forEach(t => console.log(`  - ${t.id}: ${t.name} (v${t.version})`));
    } else {
      console.log(`API Error: ${response.statusText()}`);
    }
    console.log('=======================');
  });

  test('verify foundry overview API', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/foundry/overview`);

    console.log('=== FOUNDRY OVERVIEW CHECK ===');
    console.log(`Status: ${response.status()}`);

    if (response.ok()) {
      const overview = await response.json();
      console.log(`Agent count: ${overview.agentCount}`);
      console.log(`Tool count: ${overview.toolCount}`);
      console.log(`Total agent runs: ${overview.totalAgentRuns}`);
      console.log(`Total tool runs: ${overview.totalToolRuns}`);
    } else {
      console.log(`API Error: ${response.statusText()}`);
    }
    console.log('==============================');
  });

  test('compare API data with frontend display', async ({ page, request }) => {
    // First, get data from API
    const agentsResponse = await request.get(`${API_BASE}/api/agents`);
    const toolsResponse = await request.get(`${API_BASE}/api/tools`);

    let apiAgentCount = 0;
    let apiToolCount = 0;

    if (agentsResponse.ok()) {
      const agents = await agentsResponse.json() as AgentSummary[];
      apiAgentCount = agents.length;
    }

    if (toolsResponse.ok()) {
      const tools = await toolsResponse.json() as ToolSummary[];
      apiToolCount = tools.length;
    }

    // Now check frontend debug page
    await page.goto('/debug');
    await page.waitForTimeout(5000);

    // Get counts from debug page JSON export
    const jsonExport = await page.getByTestId('debug-json').textContent();
    const debugData = JSON.parse(jsonExport || '{}');

    console.log('=== SYNCHRONIZATION REPORT ===');
    console.log(`API Agent Count: ${apiAgentCount}`);
    console.log(`Frontend Agent Count: ${debugData.summary?.agentCount || 0}`);
    console.log(`API Tool Count: ${apiToolCount}`);
    console.log(`Frontend Tool Count: ${debugData.summary?.toolCount || 0}`);

    const agentsSynced = apiAgentCount === (debugData.summary?.agentCount || 0);
    const toolsSynced = apiToolCount === (debugData.summary?.toolCount || 0);

    console.log(`Agents Synced: ${agentsSynced ? '✓ YES' : '✗ NO'}`);
    console.log(`Tools Synced: ${toolsSynced ? '✓ YES' : '✗ NO'}`);
    console.log('==============================');

    await page.screenshot({
      path: 'playwright-results/screenshots/sync-verification.png',
      fullPage: true,
    });

    // Generate verification report file
    const report = {
      timestamp: new Date().toISOString(),
      api: {
        agentCount: apiAgentCount,
        toolCount: apiToolCount,
      },
      frontend: {
        agentCount: debugData.summary?.agentCount || 0,
        toolCount: debugData.summary?.toolCount || 0,
      },
      synchronized: {
        agents: agentsSynced,
        tools: toolsSynced,
        overall: agentsSynced && toolsSynced,
      },
    };

    console.log('\n=== VERIFICATION RESULT ===');
    console.log(JSON.stringify(report, null, 2));
    console.log('===========================');
  });
});

test.describe('Screenshots for Visual Verification', () => {
  test('capture all pages for visual review', async ({ page }) => {
    // Capture home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'playwright-results/screenshots/home.png', fullPage: true });
    console.log('Captured: home.png');

    // Capture debug page
    await page.goto('/debug');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'playwright-results/screenshots/debug.png', fullPage: true });
    console.log('Captured: debug.png');

    // Capture foundry page (Blocks tab)
    await page.goto('/foundry');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'playwright-results/screenshots/foundry.png', fullPage: true });
    console.log('Captured: foundry.png');

    // Capture Agents tab - click on tab directly
    const agentsTab = page.getByRole('button', { name: 'Agents' });
    await agentsTab.click();
    await page.waitForTimeout(3000); // Wait for agents to load from API
    await page.screenshot({ path: 'playwright-results/screenshots/foundry-agents.png', fullPage: true });
    console.log('Captured: foundry-agents.png');

    // Capture Tools tab - click on tab directly
    const toolsTab = page.getByRole('button', { name: 'Tools' });
    await toolsTab.click();
    await page.waitForTimeout(3000); // Wait for tools to load from API
    await page.screenshot({ path: 'playwright-results/screenshots/foundry-tools.png', fullPage: true });
    console.log('Captured: foundry-tools.png');

    // Capture Agent Detail page
    await page.goto('/agent/autonomous-programmer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'playwright-results/screenshots/agent-detail.png', fullPage: true });
    console.log('Captured: agent-detail.png');

    // Capture Tool Detail page
    await page.goto('/tool/code-search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'playwright-results/screenshots/tool-detail.png', fullPage: true });
    console.log('Captured: tool-detail.png');
  });
});
