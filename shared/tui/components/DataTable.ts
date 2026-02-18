/**
 * DataTable — Tabular data display with header row and aligned columns.
 *
 * Renders:
 *   Model               Reqs  Avg(ms) Tokens  RPM
 *   gpt-4o              124   820     32.1K   2.1
 *   claude-sonnet        56   1240    18.5K   0.9
 *
 * Header row is muted, data rows use secondary color.
 * Replaces: LLM-Provider Row components in MetricsTab, QueueTab, ModelsTab.
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { semantic } from '../../theme/colors.ts';

export interface Column {
  /** Key to look up in row data */
  key: string;
  /** Header label */
  label: string;
  /** Character width for padding */
  width: number;
  /** Text alignment. Default 'left'. */
  align?: 'left' | 'right';
  /** Override color for this column's data cells */
  color?: string;
}

export interface DataTableProps {
  /** Column definitions */
  columns: Column[];
  /** Row data — each row is a record keyed by column.key */
  rows: Record<string, string | number>[];
  /** Color for header labels. Default: semantic.text.muted */
  headerColor?: string;
  /** Default color for data cells. Default: semantic.text.secondary */
  rowColor?: string;
}

const padCell = (text: string, width: number, align: 'left' | 'right' = 'left'): string => {
  if (align === 'right') {
    return text.padStart(width);
  }
  return text.padEnd(width);
};

const DataTable = ({
  columns,
  rows,
  headerColor = semantic.text.muted,
  rowColor = semantic.text.secondary,
}: DataTableProps) => {
  // Header row
  const headerCells = columns.map((col, i) =>
    h(Text, { key: `h-${i}`, color: headerColor },
      padCell(col.label, col.width, col.align)
    )
  );

  // Data rows
  const dataRows = rows.map((row, rowIdx) => {
    const cells = columns.map((col, colIdx) => {
      const value = String(row[col.key] ?? '');
      const cellColor = col.color ?? rowColor;
      return h(Text, { key: `c-${colIdx}`, color: cellColor },
        padCell(value, col.width, col.align)
      );
    });
    return h(Box, { key: `r-${rowIdx}`, flexDirection: 'row' }, ...cells);
  });

  return h(Box, { flexDirection: 'column' },
    h(Box, { flexDirection: 'row' }, ...headerCells),
    ...dataRows,
  );
};

export { DataTable };
