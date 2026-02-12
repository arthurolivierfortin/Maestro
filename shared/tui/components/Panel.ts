// @ts-nocheck
/**
 * Panel — Reusable panel wrapper with focus, scroll, anchor, and title.
 *
 * Props:
 *   title        string
 *   focused      boolean
 *   anchor       'top' | 'bottom'
 *   scrollOffset number
 *   cursorInfo   string
 *   showScroll   boolean
 *   canScrollUp  boolean
 *   canScrollDown boolean
 *   children     ReactNode
 *   ...boxProps
 */

import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { semantic } from '../../theme/colors.ts';
import { icons } from '../../theme/tokens.ts';

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
  const borderColor = focused ? semantic.panel.borderFocused : semantic.panel.border;
  const titleColor = focused ? semantic.panel.titleFocused : semantic.panel.title;
  const titleBold = focused;

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

  const scrollIndicators = showScroll
    ? h(Box, { key: 'scroll', flexDirection: 'row' },
        canScrollUp
          ? h(Text, { color: 'gray' }, icons.scrollUp)
          : h(Text, { color: 'gray', dimColor: true }, ' '),
        canScrollDown
          ? h(Text, { color: 'gray' }, icons.scrollDown)
          : h(Text, { color: 'gray', dimColor: true }, ' ')
      )
    : null;

  const isBottom = anchor === 'bottom';
  const isManualScroll = scrollOffset > 0;

  let contentWrapper;
  if (isBottom && !isManualScroll) {
    contentWrapper = h(Box, {
      key: 'content',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    }, children);
  } else if (isBottom && isManualScroll) {
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
    borderStyle: 'single',
    borderColor,
    flexDirection: 'column',
    overflow: 'hidden',
    ...boxProps,
  },
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
    contentWrapper
  );
};

export { Panel };
