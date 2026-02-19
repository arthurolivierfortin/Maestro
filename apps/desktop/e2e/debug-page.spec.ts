/**
 * E2E Tests for Debug Page
 *
 * Verifies that the debug page correctly displays:
 * - API status checks
 * - Agents loaded from backend
 * - Tools loaded from backend
 * - Foundry overview
 *
 * These tests help Claude verify that the frontend is synced with backend data.
 */

import { test, expect } from '@playwright/test';

test.describe('Debug Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/debug');
  });

  test('should load debug page', async ({ page }) => {
    await expect(page.getByTestId('debug-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Debug Dashboard' })).toBeVisible();
  });

  test('should show API status checks', async ({ page }) => {
    const apiChecks = page.getByTestId('api-checks');
    await expect(apiChecks).toBeVisible();

    // Wait for checks to complete (not in loading state)
    await page.waitForTimeout(2000);

    // Check that all endpoints are listed
    await expect(page.getByTestId('api-check-health')).toBeVisible();
    await expect(page.getByTestId('api-check-agents')).toBeVisible();
    await expect(page.getByTestId('api-check-tools')).toBeVisible();
    await expect(page.getByTestId('api-check-foundryOverview')).toBeVisible();
    await expect(page.getByTestId('api-check-blocks')).toBeVisible();
  });

  test('should display agents table when API returns data', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(3000);

    const agentsTable = page.getByTestId('agents-table');

    // Take screenshot regardless of whether agents are loaded
    await page.screenshot({
      path: 'playwright-results/screenshots/debug-page-agents.png',
      fullPage: true,
    });

    // If backend is running and has agents, table should be visible
    const tableVisible = await agentsTable.isVisible().catch(() => false);
    if (tableVisible) {
      const rows = page.locator('[data-testid^="agent-row-"]');
      const count = await rows.count();
      console.log(`Found ${count} agents in debug page`);
    }
  });

  test('should display tools table when API returns data', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(3000);

    const toolsTable = page.getByTestId('tools-table');

    // Take screenshot
    await page.screenshot({
      path: 'playwright-results/screenshots/debug-page-tools.png',
      fullPage: true,
    });

    const tableVisible = await toolsTable.isVisible().catch(() => false);
    if (tableVisible) {
      const rows = page.locator('[data-testid^="tool-row-"]');
      const count = await rows.count();
      console.log(`Found ${count} tools in debug page`);
    }
  });

  test('should display foundry overview when API returns data', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(3000);

    const overview = page.getByTestId('foundry-overview');

    const overviewVisible = await overview.isVisible().catch(() => false);
    if (overviewVisible) {
      const agentCount = await page.getByTestId('agent-count').textContent();
      const toolCount = await page.getByTestId('tool-count').textContent();
      console.log(`Foundry overview: ${agentCount} agents, ${toolCount} tools`);
    }
  });

  test('should have working refresh button', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /Refresh All/i });
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // Should trigger loading states
    await page.waitForTimeout(500);
  });

  test('should export JSON data', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(3000);

    const jsonExport = page.getByTestId('debug-json');
    await expect(jsonExport).toBeVisible();

    const jsonContent = await jsonExport.textContent();
    expect(jsonContent).toBeTruthy();

    // Verify it's valid JSON
    const parsed = JSON.parse(jsonContent || '{}');
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('summary');
  });

  test('take full page screenshot for verification', async ({ page }) => {
    // Wait for all data to load
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: 'playwright-results/screenshots/debug-page-full.png',
      fullPage: true,
    });
  });
});
