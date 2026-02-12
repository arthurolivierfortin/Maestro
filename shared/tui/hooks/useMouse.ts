import { useEffect } from 'react';

const ENABLE_MOUSE = '\x1b[?1000h\x1b[?1006h';
const DISABLE_MOUSE = '\x1b[?1000l\x1b[?1006l';
const SGR_MOUSE_RE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/;

type ScrollDirection = 'up' | 'down';

interface UseMouseOptions {
  onClick?: (x: number, y: number, button: number) => void;
  onScroll?: (x: number, y: number, direction: ScrollDirection) => void;
}

const useMouse = ({ onClick, onScroll }: UseMouseOptions = {}): void => {
  useEffect(() => {
    const stdin = process.stdin;
    process.stdout.write(ENABLE_MOUSE);
    const onData = (data: Buffer): void => {
      const str = data.toString();
      let remaining = str;
      let match: RegExpExecArray | null;
      while ((match = SGR_MOUSE_RE.exec(remaining)) !== null) {
        const button = parseInt(match[1], 10);
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        const isPress = match[4] === 'M';
        if (isPress) {
          if (button === 64 && onScroll) {
            onScroll(x, y, 'up');
          } else if (button === 65 && onScroll) {
            onScroll(x, y, 'down');
          } else if (button <= 2 && onClick) {
            onClick(x, y, button);
          }
        }
        remaining = remaining.substring(match.index + match[0].length);
      }
    };
    stdin.on('data', onData);
    return () => {
      stdin.off('data', onData);
      process.stdout.write(DISABLE_MOUSE);
    };
  }, [onClick, onScroll]);
};

export { useMouse };
export type { UseMouseOptions, ScrollDirection };
