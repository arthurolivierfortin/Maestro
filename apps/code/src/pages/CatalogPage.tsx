import { useBlocks } from '../hooks/useBlocks';
import { BlockCard } from '../components/BlockCard';

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
    <div className="col" style={{ height: '100%' }}>
      {/* Filters row */}
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {filters.map((f) => {
          const isActive = f.type === typeFilter;
          return (
            <span
              key={f.label}
              className={`tab${isActive ? ' active' : ''}`}
              onClick={() => setTypeFilter(f.type)}
            >
              {f.label}
            </span>
          );
        })}
        <input
          type="text"
          placeholder="Search blocks..."
          onChange={(e) => setSearchQuery(e.target.value || undefined)}
          className="c0"
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid var(--line)',
            padding: '2px 8px',
            outline: 'none',
            minWidth: 150,
            fontSize: 12,
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {isLoading && <div className="c2" style={{ fontSize: 13 }}>Loading blocks...</div>}

        {error && <div className="cerr" style={{ fontSize: 13 }}>Error: {error}</div>}

        {!isLoading && !error && (
          <div className="box">
            <div className="box-title">Catalog</div>
            <div className="box-meta">{blocks.length}</div>
            <div className="box-body" style={{ paddingLeft: 0, paddingRight: 0 }}>
              {blocks.length === 0 ? (
                <div className="c2" style={{ fontSize: 13, padding: '4px 14px' }}>No blocks found.</div>
              ) : (
                blocks.map((block) => <BlockCard key={block.id} block={block} />)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
