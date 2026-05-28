import type { CompatibleModel } from '../services/providerService';

interface ModelRowProps {
  model: CompatibleModel;
}

export function ModelRow({ model }: ModelRowProps) {
  return (
    <div
      className="row gap-12"
      style={{ padding: '6px 14px', borderBottom: '1px dotted var(--line-soft)' }}
    >
      <span className="c0 bd flex-1" style={{ fontSize: 13 }}>{model.name}</span>
      {model.category && (
        <span className="c2" style={{ fontSize: 11, minWidth: 60 }}>{model.category}</span>
      )}
      {model.recommended && <span className="b ac">RECOMMENDED</span>}
    </div>
  );
}
