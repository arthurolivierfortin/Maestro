import { createElement as h } from 'react';
import { Box, Text } from 'ink';

interface FileTreeWidgetProps {
  rootPath?: string;
  files?: string[];
  highlighted?: string[];
}

export const FileTreeWidget = ({ rootPath, files = [], highlighted = [] }: FileTreeWidgetProps) => {
  const highlightSet = new Set(highlighted);

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'green', paddingX: 1 },
    h(Text, { bold: true, color: 'green' }, rootPath || 'Files'),
    h(Box, { flexDirection: 'column', marginTop: 1 },
      ...files.slice(0, 25).map((file, i) => {
        const isHighlighted = highlightSet.has(file);
        return h(Box, { key: i },
          h(Text, { color: isHighlighted ? 'cyan' : 'gray' },
            isHighlighted ? '● ' : '  '
          ),
          h(Text, { color: isHighlighted ? 'white' : 'gray', bold: isHighlighted }, file)
        );
      }),
      files.length > 25 ? h(Text, { color: 'gray', dimColor: true }, `... ${files.length - 25} more files`) : null,
      files.length === 0 ? h(Text, { color: 'gray', dimColor: true }, 'No files') : null
    )
  );
};
