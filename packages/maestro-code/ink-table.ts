/**
 * Interactive Table — Ink component for browsing tabular data.
 *
 * Features:
 *   - j/k navigation with scroll windowing (via useSelectableList)
 *   - / to filter, Esc to clear filter
 *   - Enter to select a row (calls onSelect callback)
 *   - q to quit
 *
 * Reuses DataTable from shared/tui/ for column rendering.
 * Falls back to text output if not TTY (no Ink).
 */

import { createElement as h, useState, useCallback, useMemo } from 'react';
import { render, useApp, Box, Text, useInput } from 'ink';
import { useSelectableList } from '@maestro/tui/hooks';

// ── Types ──────────────────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
}

interface InkTableProps {
  title: string;
  columns: ColumnDef[];
  rows: Record<string, string | number>[];
  onSelect?: (row: Record<string, string | number>) => void;
  pageSize?: number;
}

// ── Helpers ────────────────────────────────────────────────────

function padCell(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const truncated = text.length > width ? text.slice(0, width - 1) + '\u2026' : text;
  return align === 'right' ? truncated.padStart(width) : truncated.padEnd(width);
}

// ── Component ──────────────────────────────────────────────────

const InkTable = ({ title, columns, rows, onSelect, pageSize = 20 }: InkTableProps) => {
  const { exit } = useApp();
  const [filterText, setFilterText] = useState('');
  const [filterMode, setFilterMode] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<Record<string, string | number> | null>(null);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!filterText) return rows;
    const lower = filterText.toLowerCase();
    return rows.filter(row =>
      columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(lower))
    );
  }, [rows, filterText, columns]);

  const {
    selectedIndex, moveUp, moveDown, pageUp, pageDown, reset,
    scrollStart, visibleCount, canScrollUp, canScrollDown, positionLabel,
  } = useSelectableList({
    itemCount: filteredRows.length,
    pageSize,
    wrap: true,
  });

  useInput((input, key) => {
    if (selectedDetail) {
      // In detail view: any key goes back
      setSelectedDetail(null);
      return;
    }

    if (filterMode) {
      if (key.escape) {
        setFilterMode(false);
        setFilterText('');
        reset();
      } else if (key.return) {
        setFilterMode(false);
      } else if (key.backspace || key.delete) {
        setFilterText(f => f.slice(0, -1));
        reset();
      } else if (input && !key.ctrl && !key.meta) {
        setFilterText(f => f + input);
        reset();
      }
      return;
    }

    if (input === 'q' || key.escape) {
      exit();
      return;
    }
    if (input === 'j' || key.downArrow) moveDown();
    if (input === 'k' || key.upArrow) moveUp();
    if (input === 'g') pageUp();
    if (input === 'G') pageDown();
    if (input === '/') {
      setFilterMode(true);
      setFilterText('');
      reset();
    }
    if (key.return && filteredRows.length > 0) {
      const row = filteredRows[selectedIndex];
      if (onSelect) {
        onSelect(row);
      } else {
        setSelectedDetail(row);
      }
    }
  });

  // Detail view
  if (selectedDetail) {
    return h(Box, { flexDirection: 'column', paddingLeft: 1 },
      h(Text, { bold: true }, '\nDetail (press any key to go back)\n'),
      ...columns.map(col =>
        h(Box, { key: col.key, flexDirection: 'row' },
          h(Text, { color: 'gray' }, `  ${col.label}: `.padEnd(16)),
          h(Text, {}, String(selectedDetail[col.key] ?? '—')),
        )
      ),
      h(Text, { color: 'gray', dimColor: true }, '\n'),
    );
  }

  // Visible slice
  const visibleRows = filteredRows.slice(scrollStart, scrollStart + visibleCount);

  // Header
  const headerText = columns.map(col => padCell(col.label, col.width, col.align)).join('  ');
  const sepText = columns.map(col => '\u2500'.repeat(col.width)).join('  ');

  return h(Box, { flexDirection: 'column', paddingLeft: 1 },
    // Title + count
    h(Box, { flexDirection: 'row', marginBottom: 0 },
      h(Text, { bold: true }, `\n${title}`),
      h(Text, { color: 'gray' }, ` (${filteredRows.length}${filteredRows.length !== rows.length ? '/' + rows.length : ''})`),
      h(Text, { color: 'gray', dimColor: true }, `  ${positionLabel}`),
    ),

    // Filter bar
    filterMode
      ? h(Box, { flexDirection: 'row' },
          h(Text, { color: 'yellow' }, '  / '),
          h(Text, {}, filterText),
          h(Text, { color: 'gray', dimColor: true }, '\u2588'),
        )
      : filterText
        ? h(Text, { color: 'gray' }, `  filter: "${filterText}"`)
        : null,

    // Header
    h(Text, { color: 'gray', dimColor: true }, `  ${headerText}`),
    h(Text, { color: 'gray', dimColor: true }, `  ${sepText}`),

    // Scroll up indicator
    canScrollUp
      ? h(Text, { color: 'gray', dimColor: true }, '  \u25B2 more above')
      : null,

    // Rows
    ...visibleRows.map((row, i) => {
      const globalIdx = scrollStart + i;
      const isSelected = globalIdx === selectedIndex;
      const cells = columns.map(col =>
        padCell(String(row[col.key] ?? ''), col.width, col.align)
      ).join('  ');

      return h(Box, { key: `row-${globalIdx}`, flexDirection: 'row' },
        h(Text, { color: isSelected ? 'cyan' : undefined, bold: isSelected },
          isSelected ? '\u25B6 ' : '  '
        ),
        h(Text, { color: isSelected ? 'white' : undefined, bold: isSelected }, cells),
      );
    }),

    // Scroll down indicator
    canScrollDown
      ? h(Text, { color: 'gray', dimColor: true }, '  \u25BC more below')
      : null,

    // Help bar
    h(Text, { color: 'gray', dimColor: true },
      '\n  j/k: navigate  /: filter  Enter: detail  q: quit'
    ),
  );
};

// ── Render function (called from launcher) ─────────────────────

async function renderInkTable(props: InkTableProps): Promise<void> {
  const app = render(h(InkTable, props));
  await app.waitUntilExit();
}

export { InkTable, renderInkTable };
export type { InkTableProps, ColumnDef };
