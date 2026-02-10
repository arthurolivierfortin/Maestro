/**
 * useMouse — Terminal mouse event support.
 *
 * Enables xterm mouse tracking (SGR mode) and parses events.
 * Provides click and scroll callbacks.
 *
 * Usage:
 *   useMouse({
 *     onClick: (x, y, button) => { ... },
 *     onScroll: (x, y, direction) => { ... },  // direction: 'up' | 'down'
 *   });
 *
 * Mouse tracking is enabled on mount and disabled on unmount.
 */

import { useEffect } from 'react';

// SGR mouse encoding escape sequences
const ENABLE_MOUSE = '\x1b[?1000h\x1b[?1006h';   // enable tracking + SGR mode
const DISABLE_MOUSE = '\x1b[?1000l\x1b[?1006l';   // disable

// SGR mouse event pattern: \x1b[<button;x;y[Mm]
// button: 0=left, 1=middle, 2=right, 64=scrollUp, 65=scrollDown
// M=press, m=release
const SGR_MOUSE_RE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/;

const useMouse = ({ onClick, onScroll } = {}) => {
  useEffect(() => {
    const stdin = process.stdin;

    // Enable mouse tracking
    process.stdout.write(ENABLE_MOUSE);

    const onData = (data) => {
      const str = data.toString();

      // Try to parse SGR mouse events
      let remaining = str;
      let match;
      while ((match = SGR_MOUSE_RE.exec(remaining)) !== null) {
        const button = parseInt(match[1], 10);
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        const isPress = match[4] === 'M';

        if (isPress) {
          if (button === 64 && onScroll) {
            // Scroll up
            onScroll(x, y, 'up');
          } else if (button === 65 && onScroll) {
            // Scroll down
            onScroll(x, y, 'down');
          } else if (button <= 2 && onClick) {
            // Left/middle/right click
            onClick(x, y, button);
          }
        }

        remaining = remaining.substring(match.index + match[0].length);
      }
    };

    stdin.on('data', onData);

    return () => {
      stdin.off('data', onData);
      // Disable mouse tracking
      process.stdout.write(DISABLE_MOUSE);
    };
  }, [onClick, onScroll]);
};

export { useMouse };
