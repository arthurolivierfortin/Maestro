import type { BlockDto } from '../services/blockService';

const typeBadgeKind = (blockType: string): string => {
  switch (blockType.toLowerCase()) {
    case 'agent':
      return 'ac';
    case 'tool':
      return 'ok';
    case 'workflow':
      return 'agent';
    case 'prompt':
      return '';
    default:
      return '';
  }
};

interface BlockCardProps {
  block: BlockDto;
}

export function BlockCard({ block }: BlockCardProps) {
  return (
    <div
      className="row gap-12"
      style={{ padding: '6px 14px', borderBottom: '1px dotted var(--line-soft)' }}
    >
      <span className={`b ${typeBadgeKind(block.blockType)}`} style={{ minWidth: 64, justifyContent: 'center' }}>
        {block.blockType}
      </span>
      <div className="flex-1">
        <div className="c0 bd" style={{ fontSize: 13 }}>{block.name}</div>
        {block.description && (
          <div
            className="c3"
            style={{ fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {block.description}
          </div>
        )}
      </div>
    </div>
  );
}
