/**
 * TabBar — Data-driven tab navigation bar.
 *
 * Renders: [H]ome  [S]paces  [F]oundry    or    [1]Metrics  [2]Logs  [3]Queue
 * Active tab is highlighted, inactive tabs use shortcut colors.
 * Tabs are passed as data — zero hardcoded page/tab names.
 *
 * Replaces: Maestro NavBar (hardcoded 5 pages), LLM-Provider TabBar (hardcoded 4 tabs).
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { semantic } from '../../theme/colors.ts';

export interface TabDef {
  /** Hotkey character displayed in brackets: "1", "H", "s" */
  key: string;
  /** Unique tab identifier: "home", "metrics" */
  id: string;
  /** Display label after the key: "ome", "Metrics" */
  label: string;
}

export interface TabBarProps {
  /** Tab definitions — order determines display order */
  tabs: TabDef[];
  /** ID of the currently active tab */
  activeTab: string;
  /** Optional badge shown on the right side */
  badge?: { text: string; color?: string };
  /** Color for active tab text. Default: semantic.panel.borderFocused */
  activeColor?: string;
  /** Gap between tabs in spaces. Default 2. */
  gap?: number;
}

const Tab = ({ tab, isActive, activeColor }: { tab: TabDef; isActive: boolean; activeColor: string }) => {
  if (isActive) {
    return h(Text, { bold: true },
      h(Text, { color: activeColor, bold: true }, '['),
      h(Text, { color: activeColor, bold: true }, tab.key),
      h(Text, { color: activeColor, bold: true }, ']'),
      h(Text, { color: activeColor, bold: true }, tab.label),
    );
  }
  return h(Text, null,
    h(Text, { color: semantic.shortcut.bracket, dimColor: true }, '['),
    h(Text, { color: semantic.shortcut.key }, tab.key),
    h(Text, { color: semantic.shortcut.bracket, dimColor: true }, ']'),
    h(Text, { color: semantic.text.muted }, tab.label),
  );
};

const TabBar = ({
  tabs,
  activeTab,
  badge,
  activeColor = semantic.panel.borderFocused,
  gap = 2,
}: TabBarProps) => {
  const tabElements: any[] = [];
  const spacer = ' '.repeat(gap);

  for (let i = 0; i < tabs.length; i++) {
    tabElements.push(
      h(Tab, {
        key: tabs[i]!.id,
        tab: tabs[i]!,
        isActive: activeTab === tabs[i]!.id,
        activeColor,
      })
    );
    if (i < tabs.length - 1) {
      tabElements.push(h(Text, { key: `sp-${i}` }, spacer));
    }
  }

  return h(Box, { flexDirection: 'row' },
    ...tabElements,
    badge
      ? h(Text, { key: 'badge', color: badge.color ?? semantic.text.muted }, `  ${badge.text}`)
      : null,
  );
};

export { TabBar };
