import type { SessionDto } from '../services/sessionService';
import {
  canStart as statusCanStart,
  canStop as statusCanStop,
  canPause as statusCanPause,
  canResume as statusCanResume,
  statusColorClass,
} from '../services/sessionStatus';

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
  const showStart = statusCanStart(session.status);
  const showPause = statusCanPause(session.status);
  const showResume = statusCanResume(session.status);
  const showStop = statusCanStop(session.status);

  return (
    <div className="box" style={{ marginTop: 16 }}>
      <div className="box-title">{session.name}</div>
      <div className="box-meta">
        <span className={`b ${statusColorClass(session.status)}`}>{session.status}</span>
      </div>
      <div className="box-body">
        <Field label="Type" value={session.type} />
        <Field label="Authority" value={session.authority} />
        <Field label="Repository" value={session.repositoryPath ?? '-'} />
        <Field label="Commands" value={session.commandCount} />
        <Field label="Created" value={session.createdAt} />

        <div className="row gap-8" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {showStart && (
            <button onClick={() => onStart(session.id)} className="b ok" style={{ cursor: 'pointer' }}>Start</button>
          )}
          {showPause && (
            <button onClick={() => onPause(session.id)} className="b ac" style={{ cursor: 'pointer' }}>Pause</button>
          )}
          {showResume && (
            <button onClick={() => onResume(session.id)} className="b ok" style={{ cursor: 'pointer' }}>Resume</button>
          )}
          {showStop && (
            <button onClick={() => onStop(session.id)} className="b err" style={{ cursor: 'pointer' }}>Stop</button>
          )}
          <button onClick={() => onDelete(session.id)} className="b err" style={{ cursor: 'pointer' }}>Delete</button>
          <button onClick={onClose} className="b" style={{ cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
