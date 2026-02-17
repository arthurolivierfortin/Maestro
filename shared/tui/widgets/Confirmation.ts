import { createElement as h, useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface ConfirmationProps {
  question: string;
  defaultYes?: boolean;
  onConfirm: (confirmed: boolean) => void;
}

export const Confirmation = ({ question, defaultYes = true, onConfirm }: ConfirmationProps) => {
  const [selected, setSelected] = useState(defaultYes ? 0 : 1);

  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow) setSelected(s => s === 0 ? 1 : 0);
    if (input === 'y' || input === 'Y') { onConfirm(true); return; }
    if (input === 'n' || input === 'N') { onConfirm(false); return; }
    if (key.return) onConfirm(selected === 0);
  });

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'yellow', paddingX: 1 },
    h(Text, { bold: true, color: 'yellow' }, question),
    h(Box, { marginTop: 1, gap: 2 },
      h(Text, { color: selected === 0 ? 'green' : 'gray', bold: selected === 0, inverse: selected === 0 },
        ' Yes '
      ),
      h(Text, { color: selected === 1 ? 'red' : 'gray', bold: selected === 1, inverse: selected === 1 },
        ' No '
      )
    ),
    h(Text, { color: 'gray', dimColor: true, marginTop: 1 }, '←/→ or y/n  Enter confirm')
  );
};
