import { useBlocks } from '../hooks/useBlocks';
import { BlockCard } from '../components/BlockCard';
import { colors, spacing, fontFamily } from '../theme/tokens';

interface FilterDef {
  label: string;
  type: string | undefined;
}

const filters: FilterDef[] = [
  { label: 'All', type: undefined },
  { label: 'Agents', type: 'agent' },
  { label: 'Tools', type: 'tool' },
  { label: 'Workflows', type: 'workflow' },
  { label: 'Prompts', type: 'prompt' },
];

export function CatalogPage() {
  const { blocks, isLoading, error, typeFilter, setTypeFilter, setSearchQuery } = useBlocks();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily }}>
      {/* Filters row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        padding: `${spacing.sm} ${spacing.md}`,
        borderBottom: `1px solid ${colors.border}`,
        flexWrap: 'wrap',
      }}>
        {filters.map((f) => {
          const isActive = f.type === typeFilter;
          return (
            <button
              key={f.label}
              onClick={() => setTypeFilter(f.type)}
              style={{
                background: 'none',
                border: 'none',
                color: isActive ? colors.accent : colors.muted,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 400,
                fontFamily,
                padding: `${spacing.xs} ${spacing.sm}`,
                borderBottom: isActive ? `2px solid ${colors.accent}` : '2px solid transparent',
              }}
            >
              {f.label}
            </button>
          );
        })}
        <input
          type="text"
          placeholder="Search blocks..."
          onChange={(e) => setSearchQuery(e.target.value || undefined)}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: `1px solid ${colors.border}`,
            color: colors.fg,
            fontFamily,
            fontSize: '12px',
            padding: `${spacing.xs} ${spacing.sm}`,
            outline: 'none',
            minWidth: '150px',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ padding: spacing.md, color: colors.muted, fontSize: '13px' }}>
            Loading blocks...
          </div>
        )}

        {error && (
          <div style={{ padding: spacing.md, color: colors.error, fontSize: '13px' }}>
            Error: {error}
          </div>
        )}

        {!isLoading && !error && (
          blocks.length === 0 ? (
            <div style={{ padding: spacing.md, color: colors.muted, fontSize: '13px' }}>
              No blocks found.
            </div>
          ) : (
            blocks.map((block) => (
              <BlockCard key={block.id} block={block} />
            ))
          )
        )}
      </div>
    </div>
  );
}
