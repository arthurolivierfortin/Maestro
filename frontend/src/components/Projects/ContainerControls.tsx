/**
 * Container Controls
 *
 * Start/stop/restart buttons for project containers.
 * Phase 8 implementation.
 */

import React from 'react';
import './ContainerControls.scss';

export type ContainerStatusType = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

interface ContainerControlsProps {
  status: ContainerStatusType;
  hasRuntime: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart?: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export const ContainerControls: React.FC<ContainerControlsProps> = ({
  status,
  hasRuntime,
  onStart,
  onStop,
  onRestart,
  disabled = false,
  compact = false,
}) => {
  if (!hasRuntime) {
    return (
      <div className="container-controls container-controls--no-runtime">
        <span className="container-controls__no-runtime-label">Local</span>
      </div>
    );
  }

  const isTransitioning = status === 'starting' || status === 'stopping';
  const isRunning = status === 'running';
  const canStart = status === 'stopped' || status === 'error';
  const canStop = status === 'running' || status === 'error';

  return (
    <div className={`container-controls ${compact ? 'container-controls--compact' : ''}`}>
      {/* Start button */}
      <button
        className="container-controls__btn container-controls__btn--start"
        onClick={(e) => {
          e.stopPropagation();
          onStart();
        }}
        disabled={disabled || isTransitioning || !canStart}
        title={canStart ? 'Start container' : 'Container is running'}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M4 2.5a.5.5 0 0 1 .804-.39l9 6a.5.5 0 0 1 0 .78l-9 6A.5.5 0 0 1 4 14.5v-12z" />
        </svg>
        {!compact && <span>Start</span>}
      </button>

      {/* Stop button */}
      <button
        className="container-controls__btn container-controls__btn--stop"
        onClick={(e) => {
          e.stopPropagation();
          onStop();
        }}
        disabled={disabled || isTransitioning || !canStop}
        title={canStop ? 'Stop container' : 'Container is stopped'}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <rect x="3" y="3" width="10" height="10" rx="1" />
        </svg>
        {!compact && <span>Stop</span>}
      </button>

      {/* Restart button (optional) */}
      {onRestart && isRunning && (
        <button
          className="container-controls__btn container-controls__btn--restart"
          onClick={(e) => {
            e.stopPropagation();
            onRestart();
          }}
          disabled={disabled || isTransitioning}
          title="Restart container"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
          </svg>
          {!compact && <span>Restart</span>}
        </button>
      )}
    </div>
  );
};

export default ContainerControls;
