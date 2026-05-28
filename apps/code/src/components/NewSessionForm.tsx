import { useState } from 'react';
import type { CreateSessionRequest } from '../services/sessionService';

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-0)',
  border: '1px solid var(--line)',
  padding: '6px 8px',
  marginTop: 4,
  outline: 'none',
};

export function NewSessionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (request: CreateSessionRequest) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [task, setTask] = useState('');

  const canSubmit = repoPath.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim() || undefined,
      repositoryPath: repoPath.trim(),
      task: task.trim() || undefined,
    });
  };

  return (
    <div className="box" style={{ margin: '8px 0 16px' }}>
      <div className="box-title">New Session</div>
      <div className="box-body col gap-8">
        <label className="col">
          <span className="c2" style={{ fontSize: 11 }}>Name (optional)</span>
          <input
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label className="col">
          <span className="c2" style={{ fontSize: 11 }}>Repository path</span>
          <input
            placeholder="Repository path (e.g. C:/MyProject)"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label className="col">
          <span className="c2" style={{ fontSize: 11 }}>Task (optional)</span>
          <input
            placeholder="Task (optional)"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            style={inputStyle}
          />
        </label>
        <div className="row gap-8" style={{ marginTop: 4 }}>
          <button onClick={handleSubmit} disabled={!canSubmit} className="b ok" style={{ cursor: canSubmit ? 'pointer' : 'default' }}>
            Create
          </button>
          <button onClick={onCancel} className="b" style={{ cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
