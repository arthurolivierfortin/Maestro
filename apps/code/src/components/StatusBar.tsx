import { useBackendStatus } from '../hooks/useBackendStatus';

export function StatusBar() {
  const { connected, checking } = useBackendStatus();

  const pipClass = checking ? 'pip idle' : connected ? 'pip' : 'pip off';
  const statusText = checking ? 'checking…' : connected ? 'connected' : 'disconnected';

  return (
    <footer className="status">
      <span className="mode">NORMAL</span>
      <span className="sep">│</span>
      <span><span className="k">1-5</span> tab</span>
      <span className="sep">│</span>
      <span><span className="k">?</span> help</span>
      <span className="sep">│</span>
      <span><span className="k">/</span> cmd</span>
      <span className="gauge">
        <span className={pipClass} />
        <span className="c3">backend</span>
        <span className="c1">{statusText}</span>
      </span>
    </footer>
  );
}
