/** Box drawing characters for panel borders */
export const borders = {
  single: {
    topLeft: '\u250C',     // ┌
    topRight: '\u2510',    // ┐
    bottomLeft: '\u2514',  // └
    bottomRight: '\u2518', // ┘
    horizontal: '\u2500',  // ─
    vertical: '\u2502',    // │
    teeRight: '\u251C',    // ├
    teeLeft: '\u2524',     // ┤
    teeDown: '\u252C',     // ┬
    teeUp: '\u2534',       // ┴
    cross: '\u253C',       // ┼
  },
  double: {
    topLeft: '\u2554',
    topRight: '\u2557',
    bottomLeft: '\u255A',
    bottomRight: '\u255D',
    horizontal: '\u2550',
    vertical: '\u2551',
  },
} as const;
