import { colors, spacing, fontFamily } from '../theme/tokens';
import type { BlockDto } from '../services/blockService';

const typeColor = (blockType: string): string => {
  switch (blockType.toLowerCase()) {
    case 'agent':
      return colors.accent;
    case 'tool':
      return colors.success;
    case 'workflow':
      return '#ab47bc';
    case 'prompt':
      return '#42a5f5';
    default:
      return colors.muted;
  }
};

interface BlockCardProps {
  block: BlockDto;
}

export function BlockCard({ block }: BlockCardProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      padding: `${spacing.sm} ${spacing.md}`,
      borderBottom: `1px solid ${colors.border}`,
      fontFamily,
    }}>
      <span style={{
        color: typeColor(block.blockType),
        fontSize: '11px',
        fontWeight: 700,
        fontFamily,
        minWidth: '70px',
        textTransform: 'uppercase',
      }}>
        {block.blockType}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: colors.fg, fontSize: '13px', fontWeight: 600 }}>
          {block.name}
        </div>
        {block.description && (
          <div style={{
            color: colors.muted,
            fontSize: '11px',
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {block.description}
          </div>
        )}
      </div>
    </div>
  );
}
