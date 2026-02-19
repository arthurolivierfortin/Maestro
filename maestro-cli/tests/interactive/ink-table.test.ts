// @ts-nocheck
/**
 * Tests for InkTable interactive component.
 */
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';

describe('InkTable', () => {
  it('renders table with columns and rows', async () => {
    const { render } = await import('ink-testing-library');
    const { InkTable } = await import('../../interactive/ink-table.ts');

    const columns = [
      { key: 'id', label: 'ID', width: 10 },
      { key: 'name', label: 'Name', width: 20 },
      { key: 'type', label: 'Type', width: 10 },
    ];
    const rows = [
      { id: 'block-1', name: 'Test Block', type: 'tool' },
      { id: 'block-2', name: 'Other Block', type: 'agent' },
    ];

    const { lastFrame, unmount } = render(h(InkTable, {
      title: 'Test Blocks',
      columns,
      rows,
    }));

    const output = lastFrame();
    expect(output).toContain('Test Blocks');
    expect(output).toContain('(2)');
    expect(output).toContain('ID');
    expect(output).toContain('Name');
    expect(output).toContain('Test Block');
    expect(output).toContain('Other Block');
    expect(output).toContain('j/k: navigate');

    unmount();
  });

  it('shows selected row indicator', async () => {
    const { render } = await import('ink-testing-library');
    const { InkTable } = await import('../../interactive/ink-table.ts');

    const columns = [
      { key: 'id', label: 'ID', width: 10 },
      { key: 'name', label: 'Name', width: 20 },
    ];
    const rows = [
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' },
    ];

    const { lastFrame, unmount } = render(h(InkTable, {
      title: 'Selection Test',
      columns,
      rows,
    }));

    // First row should have the selection indicator
    const output = lastFrame();
    expect(output).toContain('\u25B6');

    unmount();
  });

  it('handles empty rows gracefully', async () => {
    const { render } = await import('ink-testing-library');
    const { InkTable } = await import('../../interactive/ink-table.ts');

    const columns = [
      { key: 'id', label: 'ID', width: 10 },
    ];

    const { lastFrame, unmount } = render(h(InkTable, {
      title: 'Empty Table',
      columns,
      rows: [],
    }));

    const output = lastFrame();
    expect(output).toContain('Empty Table');
    expect(output).toContain('(0)');

    unmount();
  });
});
