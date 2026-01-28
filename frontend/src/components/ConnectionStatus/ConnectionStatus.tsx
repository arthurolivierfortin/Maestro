/**
 * Connection Status Component
 *
 * Displays the current backend connection status with visual indicator.
 */

import React from 'react';
import { useBackendConnection } from '../../hooks/useBackendConnection';
import './ConnectionStatus.css';

export interface ConnectionStatusProps {
  /**
   * Show detailed connection information (default: false)
   */
  showDetails?: boolean;

  /**
   * Custom className for styling
   */
  className?: string;
}

/**
 * Connection Status Component
 *
 * Shows a visual indicator of backend connection state:
 * - Green: Connected
 * - Yellow: Connecting
 * - Red: Disconnected
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showDetails = false,
  className = '',
}) => {
  const {
    isConnected,
    isConnecting,
    error,
    lastChecked,
    backendVersion,
    blockCount,
    retry,
  } = useBackendConnection();

  const getStatusClass = () => {
    if (isConnecting) return 'connecting';
    if (isConnected) return 'connected';
    return 'disconnected';
  };

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    return 'Disconnected';
  };

  const getStatusIcon = () => {
    if (isConnecting) return '🔄';
    if (isConnected) return '✓';
    return '✗';
  };

  return (
    <div className={`connection-status ${getStatusClass()} ${className}`}>
      <div className="connection-status__indicator">
        <span className="connection-status__icon">{getStatusIcon()}</span>
        <span className="connection-status__text">{getStatusText()}</span>
      </div>

      {showDetails && (
        <div className="connection-status__details">
          {isConnected && (
            <>
              {backendVersion && (
                <div className="connection-status__detail">
                  <span className="label">Version:</span>
                  <span className="value">{backendVersion}</span>
                </div>
              )}
              <div className="connection-status__detail">
                <span className="label">Blocks:</span>
                <span className="value">{blockCount}</span>
              </div>
            </>
          )}

          {error && (
            <div className="connection-status__error">
              <span className="label">Error:</span>
              <span className="value">{error}</span>
            </div>
          )}

          {lastChecked && (
            <div className="connection-status__detail">
              <span className="label">Last checked:</span>
              <span className="value">{lastChecked.toLocaleTimeString()}</span>
            </div>
          )}

          {!isConnected && (
            <button
              className="connection-status__retry-button"
              onClick={retry}
              disabled={isConnecting}
            >
              Retry Connection
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
