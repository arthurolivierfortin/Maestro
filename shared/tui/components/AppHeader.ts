/**
 * AppHeader — Generic application header with brand, status, tabs, and info items.
 *
 * Renders:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ LLM-Provider ● [1]Metrics [2]Logs [3]Queue [4]Models   ⬢gpt-4 ☰2 │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * All content is data-driven: brand name, tabs, status items passed as props.
 * Replaces: LLM-Provider Header.tsx (hardcoded brand + tabs).
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { semantic } from '../../theme/colors.ts';
import { TabBar } from './TabBar.ts';
import type { TabBarProps } from './TabBar.ts';

export interface HeaderItem {
  /** Optional icon before value: "⬢", "☰" */
  icon?: string;
  /** Optional label before value: "model", "queue" */
  label?: string;
  /** Display value: "gpt-4", "2", "1.2K tok" */
  value: string;
  /** Color for the value text */
  color?: string;
}

export interface AppHeaderProps {
  /** Application brand */
  brand: { name: string; icon?: string };
  /** Whether the backend/service is connected */
  connected: boolean;
  /** Status items shown on the right side */
  items?: HeaderItem[];
  /** Optional inline tab bar */
  tabs?: TabBarProps;
  /** Height of the header box. Default 3. */
  height?: number;
  /** Border color. Default: semantic.ui.border */
  borderColor?: string;
}

const AppHeader = ({
  brand,
  connected,
  items,
  tabs,
  height = 3,
  borderColor = semantic.ui.border,
}: AppHeaderProps) => {
  const statusColor = connected ? semantic.status.success : semantic.status.error;
  const statusIcon = connected ? '\u25CF' : '\u2717';

  // Left side: brand + status + optional tabs
  const leftParts: any[] = [
    h(Text, { key: 'brand', color: semantic.panel.borderFocused, bold: true },
      brand.icon ? `${brand.icon} ${brand.name}` : brand.name
    ),
    h(Text, { key: 'status-spacer' }, ' '),
    h(Text, { key: 'status', color: statusColor }, statusIcon),
  ];

  if (tabs) {
    leftParts.push(h(Text, { key: 'tab-spacer' }, '  '));
    leftParts.push(h(TabBar, { key: 'tabs', ...tabs }));
  }

  // Right side: info items
  const rightParts: any[] = [];
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const itemColor = item.color ?? semantic.text.secondary;
      if (i > 0) {
        rightParts.push(h(Text, { key: `item-sp-${i}` }, ' '));
      }
      rightParts.push(
        h(Text, { key: `item-${i}`, color: itemColor },
          (item.icon ? item.icon : '') +
          (item.label ? `${item.label}: ` : '') +
          item.value
        )
      );
    }
  }

  return h(Box, {
    borderStyle: 'single',
    borderColor,
    paddingLeft: 1,
    paddingRight: 1,
    height,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
    h(Box, { flexDirection: 'row' }, ...leftParts),
    rightParts.length > 0
      ? h(Box, { flexDirection: 'row' }, ...rightParts)
      : null,
  );
};

export { AppHeader };
