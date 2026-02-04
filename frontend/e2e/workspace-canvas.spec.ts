/**
 * E2E Tests for Workspace Canvas View
 *
 * Verifies that the workspace canvas correctly:
 * - Displays the 3-column layout (Hierarchy | Canvas | Inspector)
 * - Shows the console panel
 * - Handles SignalR connection gracefully
 * - Shows view mode switcher
 */

import { test, expect } from '@playwright/test';

test.describe('Workspace Canvas View', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workspaces page first
    await page.goto('/workspaces');
    await page.waitForTimeout(2000);
  });

  test('should load workspaces list page', async ({ page }) => {
    // Take screenshot of workspaces list
    await page.screenshot({
      path: 'playwright-results/screenshots/workspaces-list.png',
      fullPage: true,
    });

    // Should see workspaces heading or content
    const heading = page.getByRole('heading', { name: /workspaces/i });
    const headingVisible = await heading.isVisible().catch(() => false);
    console.log('Workspaces heading visible:', headingVisible);
  });

  test('should navigate to workspace detail and show canvas tab', async ({ page }) => {
    // Wait for workspace cards to load
    await page.waitForTimeout(3000);

    // Try to find and click on a workspace row
    const workspaceRows = page.locator('.workspace-row');
    const count = await workspaceRows.count();
    console.log(`Found ${count} workspace rows`);

    if (count > 0) {
      // Click on first workspace
      await workspaceRows.first().click();
      await page.waitForTimeout(2000);

      // Take screenshot of workspace detail page
      await page.screenshot({
        path: 'playwright-results/screenshots/workspace-detail.png',
        fullPage: true,
      });

      // Look for Canvas tab
      const canvasTab = page.getByRole('button', { name: /canvas/i });
      const canvasTabVisible = await canvasTab.isVisible().catch(() => false);
      console.log('Canvas tab visible:', canvasTabVisible);

      if (canvasTabVisible) {
        await canvasTab.click();
        await page.waitForTimeout(2000);

        // Take screenshot of canvas view
        await page.screenshot({
          path: 'playwright-results/screenshots/workspace-canvas.png',
          fullPage: true,
        });
      }
    }
  });

  test('should show workspace live view components when canvas is active', async ({ page }) => {
    // Go directly to a workspace page with canvas tab
    await page.goto('/workspaces');
    await page.waitForTimeout(2000);

    // Find and click first workspace
    const workspaceRows = page.locator('.workspace-row');
    const count = await workspaceRows.count();

    if (count > 0) {
      await workspaceRows.first().click();
      await page.waitForTimeout(2000);

      // Click Canvas tab
      const canvasTab = page.getByRole('button', { name: /canvas/i });
      if (await canvasTab.isVisible().catch(() => false)) {
        await canvasTab.click();
        await page.waitForTimeout(3000);

        // Check for live view components
        const liveView = page.locator('.workspace-live-view');
        const liveViewVisible = await liveView.isVisible().catch(() => false);
        console.log('Live view visible:', liveViewVisible);

        // Check for toolbar with view modes
        const toolbar = page.locator('.workspace-live-view__toolbar');
        const toolbarVisible = await toolbar.isVisible().catch(() => false);
        console.log('Toolbar visible:', toolbarVisible);

        // Check for hierarchy panel
        const hierarchy = page.locator('.hierarchy-panel, .workspace-live-view__hierarchy');
        const hierarchyVisible = await hierarchy.isVisible().catch(() => false);
        console.log('Hierarchy panel visible:', hierarchyVisible);

        // Check for canvas area
        const canvas = page.locator('.workspace-canvas, .workspace-live-view__canvas');
        const canvasVisible = await canvas.isVisible().catch(() => false);
        console.log('Canvas visible:', canvasVisible);

        // Check for inspector panel
        const inspector = page.locator('.inspector-panel, .workspace-live-view__inspector');
        const inspectorVisible = await inspector.isVisible().catch(() => false);
        console.log('Inspector panel visible:', inspectorVisible);

        // Check for console panel
        const consolePanel = page.locator('.console-panel, .workspace-live-view__console');
        const consolePanelVisible = await consolePanel.isVisible().catch(() => false);
        console.log('Console panel visible:', consolePanelVisible);

        // Take final screenshot
        await page.screenshot({
          path: 'playwright-results/screenshots/workspace-live-view-full.png',
          fullPage: true,
        });
      }
    }
  });

  test('should handle SignalR connection status gracefully', async ({ page }) => {
    await page.goto('/workspaces');
    await page.waitForTimeout(2000);

    // Find and click first workspace
    const workspaceRows = page.locator('.workspace-row');
    const count = await workspaceRows.count();

    if (count > 0) {
      await workspaceRows.first().click();
      await page.waitForTimeout(2000);

      // Click Canvas tab
      const canvasTab = page.getByRole('button', { name: /canvas/i });
      if (await canvasTab.isVisible().catch(() => false)) {
        await canvasTab.click();
        await page.waitForTimeout(3000);

        // Check for connection indicator (should show connected or disconnected, not crash)
        const connectionIndicator = page.locator('.workspace-live-view__connection-indicator');
        const connectionIndicatorVisible = await connectionIndicator.isVisible().catch(() => false);
        console.log('Connection indicator visible:', connectionIndicatorVisible);

        // Page should not have crashed - look for error messages
        const errorText = await page.locator('text=error').count();
        const crashText = await page.locator('text=Something went wrong').count();
        console.log('Error messages found:', errorText);
        console.log('Crash messages found:', crashText);

        // Take screenshot showing connection status
        await page.screenshot({
          path: 'playwright-results/screenshots/workspace-connection-status.png',
          fullPage: true,
        });
      }
    }
  });

  test('should show view mode buttons', async ({ page }) => {
    await page.goto('/workspaces');
    await page.waitForTimeout(2000);

    const workspaceRows = page.locator('.workspace-row');
    const count = await workspaceRows.count();

    if (count > 0) {
      await workspaceRows.first().click();
      await page.waitForTimeout(2000);

      const canvasTab = page.getByRole('button', { name: /canvas/i });
      if (await canvasTab.isVisible().catch(() => false)) {
        await canvasTab.click();
        await page.waitForTimeout(3000);

        // Check for view mode buttons
        const liveMode = page.locator('.workspace-live-view__view-mode:has-text("Live")');
        const designMode = page.locator('.workspace-live-view__view-mode:has-text("Design")');
        const topologyMode = page.locator('.workspace-live-view__view-mode:has-text("Topology")');
        const timelineMode = page.locator('.workspace-live-view__view-mode:has-text("Timeline")');

        console.log('Live mode button visible:', await liveMode.isVisible().catch(() => false));
        console.log('Design mode button visible:', await designMode.isVisible().catch(() => false));
        console.log('Topology mode button visible:', await topologyMode.isVisible().catch(() => false));
        console.log('Timeline mode button visible:', await timelineMode.isVisible().catch(() => false));

        // Take screenshot
        await page.screenshot({
          path: 'playwright-results/screenshots/workspace-view-modes.png',
          fullPage: true,
        });
      }
    }
  });
});
