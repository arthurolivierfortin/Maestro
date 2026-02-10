/**
 * Panel — Reusable panel wrapper with focus, scroll, anchor, and title.
 *
 * Every panel in the monitor should use this instead of raw Box+borderStyle.
 * Provides consistent styling from theme.js and interactive features.
 *
 * Props:
 *   title        string — Panel title (shown in top-left of border)
 *   focused      boolean — Whether this panel has focus (bright border + title)
 *   anchor       'top' | 'bottom' — Content anchor direction (default: 'top')
 *                  'top': content starts at top, overflow clips bottom (default)
 *                  'bottom': content anchored to bottom, overflow clips top (for logs)
 *   scrollOffset number — Lines to shift content (for manual scrolling)
 *   cursorInfo   string — Optional cursor position info (e.g. "3/12") shown after title
 *   showScroll   boolean — Show scroll indicators (▲/▼) in top-right
 *   canScrollUp  boolean — Whether there's content above
 *   canScrollDown boolean — Whether there's content below
 *   children     ReactNode — Panel content
 *   ...boxProps  — Passed through to outer Box (width, height, flexGrow, etc.)
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { theme, icons } from '../theme.js';

const Panel = ({
  title,
  focused = false,
  cursorInfo = null,
  anchor = 'top',
  scrollOffset = 0,
  showScroll = false,
  canScrollUp = false,
  canScrollDown = false,
  children,
  ...boxProps
}) => {
  const borderColor = focused ? theme.panel.borderFocused : theme.panel.border;
  const titleColor = focused ? theme.panel.titleFocused : theme.panel.title;
  const titleBold = focused && theme.panel.titleBold;

  // Build the title line: " TITLE " or " ◆ TITLE " when focused
  const titleElements = [];
  if (title) {
    if (focused) {
      titleElements.push(
        h(Text, { key: 'focus-icon', color: titleColor }, icons.focus + ' ')
      );
    }
    titleElements.push(
      h(Text, { key: 'title', color: titleColor, bold: titleBold }, title)
    );
    if (cursorInfo) {
      titleElements.push(
        h(Text, { key: 'cursor-info', color: 'gray' }, ' ' + cursorInfo)
      );
    }
  }

  // Scroll indicators in top-right
  const scrollIndicators = showScroll
    ? h(Box, { key: 'scroll', flexDirection: 'row' },
        canScrollUp
          ? h(Text, { color: theme.panel.scrollIndicator }, icons.scrollUp)
          : h(Text, { color: 'gray', dimColor: true }, ' '),
        canScrollDown
          ? h(Text, { color: theme.panel.scrollIndicator }, icons.scrollDown)
          : h(Text, { color: 'gray', dimColor: true }, ' ')
      )
    : null;

  // Content wrapper: clips overflow and positions content based on anchor
  //
  // anchor='top' (default):
  //   Content starts at top. scrollOffset shifts content UP (negative marginTop).
  //   Overflow clips at bottom. User scrolls down to see more.
  //
  // anchor='bottom':
  //   Content anchored to bottom via justifyContent='flex-end'.
  //   When scrollOffset=0: latest content visible at bottom (auto-scroll).
  //   When scrollOffset>0: content shifts DOWN via marginBottom, revealing
  //   older content above. User scrolls up (Ctrl+Up) to see history.
  //
  const isBottom = anchor === 'bottom';
  const isManualScroll = scrollOffset > 0;

  let contentWrapper;
  if (isBottom && !isManualScroll) {
    // Auto-scroll mode: anchor content to bottom
    contentWrapper = h(Box, {
      key: 'content',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    }, children);
  } else if (isBottom && isManualScroll) {
    // Manual scroll from bottom: shift content down to reveal older entries
    contentWrapper = h(Box, {
      key: 'content',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
      h(Box, {
        flexDirection: 'column',
        marginBottom: scrollOffset,
      }, children)
    );
  } else {
    // Top anchor (default): shift content up by scrollOffset
    contentWrapper = h(Box, {
      key: 'content',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'hidden',
    },
      h(Box, {
        flexDirection: 'column',
        marginTop: scrollOffset > 0 ? -scrollOffset : 0,
      }, children)
    );
  }

  return h(Box, {
    borderStyle: theme.panel.borderStyle,
    borderColor,
    flexDirection: 'column',
    overflow: 'hidden',
    ...boxProps,
  },
    // Title bar (only if title or scroll indicators)
    (title || scrollIndicators)
      ? h(Box, {
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '100%',
          paddingLeft: 1,
          paddingRight: 1,
        },
          h(Box, { flexDirection: 'row' }, ...titleElements),
          scrollIndicators
        )
      : null,
    // Content area
    contentWrapper
  );
};

export { Panel };
