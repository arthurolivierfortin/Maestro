import type { SessionDto } from '../services/sessionService';

const statusClass = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
    case 'running':
      return 'ok';
    case 'failed':
    case 'error':
      return 'err';
    case 'created':
    case 'pending':
    case 'paused':
      return 'ac';
    default:
      return '';
  }
};

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="row gap-12" style={{ padding: '3px 0' }}>
      <span className="c2" style={{ fontSize: 11, width: 110, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span className="c1" style={{ fontSize: 12 }}>{value}</span>
    </div>
  );
}

export function SessionDetail({
  session,
  onStart,
  onPause,
  onResume,
  onStop,
  onDelete,
  onClose,
}: {
  session: SessionDto;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const status = session.status.toLowerCase();
  const canStart = ['created', 'stopped'].includes(status);
  const canPause = status === 'active';
  const canResume = status === 'paused';
  const canStop = ['active', 'paused'].includes(status);

  return (
    <div className="box" style={{ marginTop: 16 }}>
      <div className="box-title">{session.name}</div>
      <div className="box-meta">
        <span className={`b ${statusClass(session.status)}`}>{session.status}</span>
      </div>
      <div className="box-body">
        <Field label="Type" value={session.type} />
        <Field label="Authority" value={session.authority} />
        <Field label="Repository" value={session.repositoryPath ?? '-'} />
        <Field label="Commands" value={session.commandCount} />
        <Field label="Created" value={session.createdAt} />

        <div className="row gap-8" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {canStart && (
            <button onClick={() => onStart(session.id)} className="b ok" style={{ cursor: 'pointer' }}>Start</button>
          )}
          {canPause && (
            <button onClick={() => onPause(session.id)} className="b ac" style={{ cursor: 'pointer' }}>Pause</button>
          )}
          {canResume && (
            <button onClick={() => onResume(session.id)} className="b ok" style={{ cursor: 'pointer' }}>Resume</button>
          )}
          {canStop && (
            <button onClick={() => onStop(session.id)} className="b err" style={{ cursor: 'pointer' }}>Stop</button>
          )}
          <button onClick={() => onDelete(session.id)} className="b err" style={{ cursor: 'pointer' }}>Delete</button>
          <button onClick={onClose} className="b" style={{ cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
