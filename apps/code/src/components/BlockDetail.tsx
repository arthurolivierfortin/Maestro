import type { BlockDto } from '../services/blockService';

const typeBadgeKind = (blockType: string): string => {
  switch (blockType.toLowerCase()) {
    case 'agent':
      return 'ac';
    case 'tool':
      return 'ok';
    case 'workflow':
      return 'agent';
    default:
      return '';
  }
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="row gap-12" style={{ padding: '3px 0' }}>
      <span
        className="c2"
        style={{ fontSize: 11, width: 110, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}
      >
        {label}
      </span>
      <span className="c1" style={{ fontSize: 12 }}>{value}</span>
    </div>
  );
}

function ContentSection({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        className="c2"
        style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
      >
        {title}
      </div>
      <pre
        className="c1"
        style={{
          fontFamily: 'monospace',
          fontSize: 11,
          margin: 0,
          padding: 10,
          background: 'var(--bg-soft, rgba(255,255,255,0.03))',
          border: '1px solid var(--line)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 320,
          overflowY: 'auto',
        }}
      >
        {body}
      </pre>
    </div>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function BlockDetail({
  block,
  configContent,
  promptContent,
  onClose,
}: {
  block: BlockDto;
  configContent: string | null;
  promptContent: string | null;
  onClose: () => void;
}) {
  return (
    <div className="box" style={{ marginTop: 16 }}>
      <div className="box-title">{block.id}</div>
      <div className="box-meta">
        <span className={`b ${typeBadgeKind(block.blockType)}`}>{block.blockType}</span>
      </div>
      <div className="box-body">
        <Field label="Name" value={block.name} />
        {block.description && <Field label="Description" value={block.description} />}
        {block.designation && <Field label="Designation" value={block.designation} />}
        {block.category && <Field label="Category" value={block.category} />}
        {block.contract && <Field label="Contract" value={block.contract} />}
        {block.author && <Field label="Author" value={block.author} />}
        {block.version && <Field label="Version" value={block.version} />}
        <Field label="Atomic" value={block.isAtomic ? 'yes' : 'no'} />
        {block.tags.length > 0 && <Field label="Tags" value={block.tags.join(', ')} />}

        {configContent !== null && <ContentSection title="block.json" body={prettyJson(configContent)} />}
        {promptContent !== null && <ContentSection title="system-prompt.md" body={promptContent} />}

        <div className="row gap-8" style={{ marginTop: 12 }}>
          <button onClick={onClose} className="b" style={{ cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
