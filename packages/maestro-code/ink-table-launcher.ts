/**
 * CJS-safe launcher for Ink interactive table.
 * Same dynamic import pattern as launcher.ts.
 */

interface LaunchTableOptions {
  title: string;
  columns: { key: string; label: string; width: number; align?: 'left' | 'right' }[];
  rows: Record<string, string | number>[];
  onSelect?: (row: Record<string, string | number>) => void;
  pageSize?: number;
}

export async function launchInkTable(options: LaunchTableOptions) {
  const { renderInkTable } = await import('./ink-table.ts');
  await renderInkTable(options);
}
