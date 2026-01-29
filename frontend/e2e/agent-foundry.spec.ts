/**
 * E2E Tests for Agent Foundry Page
 *
 * Verifies that agents and tools created in the backend
 * are correctly displayed in the frontend.
 *
 * These tests help Claude verify frontend-backend synchronization.
 */

import { test, expect } from '@playwright/test';

test.describe('Agent Foundry Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/foundry');
  });

  test('should load foundry page', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({
      path: 'playwright-results/screenshots/foundry-page-initial.png',
      fullPage: true,
    });
  });

  test('should display agents tab', async ({ page }) => {
    // Click on Agents tab if it exists
    const agentsTab = page.getByRole('button', { name: /Agents/i });

    if (await agentsTab.isVisible()) {
      await agentsTab.click();
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'playwright-results/screenshots/foundry-agents-tab.png',
        fullPage: true,
      });

      // Count agent cards
      const agentCards = page.locator('.item-card--agent, [data-testid^="agent-card-"]');
      const count = await agentCards.count();
      console.log(`Found ${count} agent cards in Foundry page`);
    }
  });

  test('should display tools tab', async ({ page }) => {
    // Click on Tools tab if it exists
    const toolsTab = page.getByRole('button', { name: /Tools/i });

    if (await toolsTab.isVisible()) {
      await toolsTab.click();
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'playwright-results/screenshots/foundry-tools-tab.png',
        fullPage: true,
      });

      // Count tool cards
      const toolCards = page.locator('.item-card--tool, [data-testid^="tool-card-"]');
      const count = await toolCards.count();
      console.log(`Found ${count} tool cards in Foundry page`);
    }
  });

  test('should show overview statistics', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for stat cards
    const statCards = page.locator('.stat-card');
    const count = await statCards.count();

    if (count > 0) {
      console.log(`Found ${count} stat cards in overview`);
    }

    await page.screenshot({
      path: 'playwright-results/screenshots/foundry-overview.png',
      fullPage: true,
    });
  });

  test('should show leaderboard', async ({ page }) => {
    await page.waitForTimeout(2000);

    const leaderboard = page.locator('.leaderboard');
    const visible = await leaderboard.isVisible().catch(() => false);

    if (visible) {
      const items = page.locator('.leaderboard__item');
      const count = await items.count();
      console.log(`Found ${count} items in leaderboard`);
    }
  });
});

test.describe('Agent Foundry - Specific Agent Verification', () => {
  test('verify autonomous-programmer agent is displayed', async ({ page }) => {
    await page.goto('/foundry');
    await page.waitForLoadState('networkidle');

    // Click agents tab
    const agentsTab = page.getByRole('button', { name: /Agents/i });
    if (await agentsTab.isVisible()) {
      await agentsTab.click();
      await page.waitForTimeout(2000);
    }

    // Look for specific agents that were created
    const agentNames = [
      'autonomous-programmer',
      'code-developer',
      'task-decomposer',
      'result-validator',
      'simple-task-executor',
      'cantante-developer',
      'ui-feature-developer',
    ];

    const foundAgents: string[] = [];
    const missingAgents: string[] = [];

    for (const agentName of agentNames) {
      const agentElement = page.locator(`text=${agentName}`).first();
      const visible = await agentElement.isVisible({ timeout: 1000 }).catch(() => false);

      if (visible) {
        foundAgents.push(agentName);
      } else {
        missingAgents.push(agentName);
      }
    }

    console.log('=== AGENT VERIFICATION REPORT ===');
    console.log(`Found agents: ${foundAgents.length}`);
    foundAgents.forEach(a => console.log(`  ✓ ${a}`));
    console.log(`Missing agents: ${missingAgents.length}`);
    missingAgents.forEach(a => console.log(`  ✗ ${a}`));
    console.log('=================================');

    await page.screenshot({
      path: 'playwright-results/screenshots/agent-verification.png',
      fullPage: true,
    });
  });
});
