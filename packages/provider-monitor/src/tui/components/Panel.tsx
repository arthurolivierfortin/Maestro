import React from 'react';
import { Box, Text } from 'ink';
import { semantic, icons } from '../../theme/index.js';

interface PanelProps {
  title: string;
  focused?: boolean;
  children: React.ReactNode;
  height?: number | string;
  width?: string;
  anchor?: 'top' | 'bottom';
  scrollOffset?: number;
  canScrollUp?: boolean;
  canScrollDown?: boolean;
}

export function Panel({
  title,
  focused = false,
  children,
  height,
  width,
  anchor = 'top',
  scrollOffset = 0,
  canScrollUp = false,
  canScrollDown = false,
}: PanelProps) {
  const borderColor = focused ? semantic.panel.borderFocused : semantic.panel.border;
  const titleColor = focused ? semantic.panel.titleFocused : semantic.panel.title;
  const showScroll = canScrollUp || canScrollDown;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      width={width as string | undefined}
      height={height as number | undefined}
      flexGrow={height ? undefined : 1}
      overflow="hidden"
    >
      {/* Title bar with optional scroll indicators */}
      <Box flexDirection="row" justifyContent="space-between" paddingX={1}>
        <Box gap={1}>
          {focused && <Text color={semantic.panel.titleFocused}>{icons.focus}</Text>}
          <Text color={titleColor} bold>{title}</Text>
        </Box>
        {showScroll && (
          <Box gap={0}>
            <Text color={canScrollUp ? semantic.text.secondary : semantic.text.muted} dimColor={!canScrollUp}>
              {icons.scrollUp}
            </Text>
            <Text color={canScrollDown ? semantic.text.secondary : semantic.text.muted} dimColor={!canScrollDown}>
              {icons.scrollDown}
            </Text>
          </Box>
        )}
      </Box>

      {/* Content area with anchor support */}
      {anchor === 'bottom' ? (
        <Box
          flexDirection="column"
          flexGrow={1}
          paddingX={1}
          justifyContent={scrollOffset === 0 ? 'flex-end' : undefined}
          overflow="hidden"
        >
          <Box flexDirection="column" marginBottom={scrollOffset}>
            {children}
          </Box>
        </Box>
      ) : (
        <Box
          flexDirection="column"
          flexGrow={1}
          paddingX={1}
          overflow="hidden"
        >
          <Box flexDirection="column" marginTop={-scrollOffset}>
            {children}
          </Box>
        </Box>
      )}
    </Box>
  );
}
