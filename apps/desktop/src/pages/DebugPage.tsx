/**
 * Debug Page
 *
 * Development page for verifying frontend state and API synchronization.
 * Provides visibility into what the frontend receives from the backend.
 *
 * Access: /debug
 *
 * This page allows Claude (or developers) to verify that:
 * 1. Agents are loaded correctly from the API
 * 2. Tools are loaded correctly from the API
 * 3. The frontend state matches what the backend returns
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Download, Copy } from 'lucide-react';
import './DebugPage.scss';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface HealthStatus {
  status: string;
  version: string;
  blockCount: number;
  services: Record<string, string>;
}

interface AgentData {
  id: string;
  name: string;
  version: string;
  category: string;
  totalRuns: number;
  overallScore: number;
}

interface ToolData {
  id: string;
  name: string;
  version: string;
  category: string;
  totalRuns: number;
  overallScore: number;
}

interface FoundryOverview {
  agentCount: number;
  toolCount: number;
  totalAgentRuns: number;
  totalToolRuns: number;
  avgAgentScore: number;
  avgToolScore: number;
}

interface ApiCheckResult {
  endpoint: string;
  status: 'success' | 'error' | 'loading' | 'pending';
  statusCode?: number;
  data?: unknown;
  error?: string;
  duration?: number;
}

interface DebugState {
  health: ApiCheckResult;
  agents: ApiCheckResult;
  tools: ApiCheckResult;
  foundryOverview: ApiCheckResult;
  blocks: ApiCheckResult;
}

export function DebugPage() {
  const [debugState, setDebugState] = useState<DebugState>({
    health: { endpoint: '/api/health', status: 'pending' },
    agents: { endpoint: '/api/agents', status: 'pending' },
    tools: { endpoint: '/api/tools', status: 'pending' },
    foundryOverview: { endpoint: '/api/foundry/overview', status: 'pending' },
    blocks: { endpoint: '/api/blocks', status: 'pending' },
  });

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [jsonExport, setJsonExport] = useState<string>('');

  const checkEndpoint = async (
    endpoint: string,
    key: keyof DebugState
  ): Promise<void> => {
    setDebugState((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: 'loading' },
    }));

    const startTime = performance.now();
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      const duration = Math.round(performance.now() - startTime);

      if (response.ok) {
        const data = await response.json();
        setDebugState((prev) => ({
          ...prev,
          [key]: {
            endpoint,
            status: 'success',
            statusCode: response.status,
            data,
            duration,
          },
        }));
      } else {
        setDebugState((prev) => ({
          ...prev,
          [key]: {
            endpoint,
            status: 'error',
            statusCode: response.status,
            error: `HTTP ${response.status}: ${response.statusText}`,
            duration,
          },
        }));
      }
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      setDebugState((prev) => ({
        ...prev,
        [key]: {
          endpoint,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          duration,
        },
      }));
    }
  };

  const runAllChecks = useCallback(async () => {
    await Promise.all([
      checkEndpoint('/api/health', 'health'),
      checkEndpoint('/api/agents', 'agents'),
      checkEndpoint('/api/tools', 'tools'),
      checkEndpoint('/api/foundry/overview', 'foundryOverview'),
      checkEndpoint('/api/blocks', 'blocks'),
    ]);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    runAllChecks();
  }, [runAllChecks]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(runAllChecks, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, runAllChecks]);

  useEffect(() => {
    // Generate JSON export whenever state changes
    const exportData = {
      timestamp: new Date().toISOString(),
      apiBase: API_BASE,
      checks: debugState,
      summary: {
        healthOk: debugState.health.status === 'success',
        agentCount: Array.isArray(debugState.agents.data) ? debugState.agents.data.length : 0,
        toolCount: Array.isArray(debugState.tools.data) ? debugState.tools.data.length : 0,
        blockCount: Array.isArray(debugState.blocks.data) ? debugState.blocks.data.length : 0,
      },
    };
    setJsonExport(JSON.stringify(exportData, null, 2));
  }, [debugState]);

  const getStatusIcon = (status: ApiCheckResult['status']): React.ReactNode => {
    switch (status) {
      case 'success':
        return <CheckCircle className="status-icon status-icon--success" size={20} />;
      case 'error':
        return <XCircle className="status-icon status-icon--error" size={20} />;
      case 'loading':
        return <RefreshCw className="status-icon status-icon--loading" size={20} />;
      default:
        return <AlertCircle className="status-icon status-icon--pending" size={20} />;
    }
  };

  const debugStateKeys: (keyof DebugState)[] = ['health', 'agents', 'tools', 'foundryOverview', 'blocks'];

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonExport);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([jsonExport], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maestro-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderAgentsList = () => {
    if (debugState.agents.status !== 'success' || !debugState.agents.data) {
      return null;
    }
    const agents = debugState.agents.data as AgentData[];
    return (
      <div className="debug-section">
        <h3>Agents ({agents.length})</h3>
        <table className="debug-table" data-testid="agents-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Version</th>
              <th>Category</th>
              <th>Runs</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id} data-testid={`agent-row-${agent.id}`}>
                <td>{agent.id}</td>
                <td>{agent.name}</td>
                <td>{agent.version}</td>
                <td>{agent.category}</td>
                <td>{agent.totalRuns}</td>
                <td>{agent.overallScore?.toFixed(0) || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderToolsList = () => {
    if (debugState.tools.status !== 'success' || !debugState.tools.data) {
      return null;
    }
    const tools = debugState.tools.data as ToolData[];
    return (
      <div className="debug-section">
        <h3>Tools ({tools.length})</h3>
        <table className="debug-table" data-testid="tools-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Version</th>
              <th>Category</th>
              <th>Runs</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <tr key={tool.id} data-testid={`tool-row-${tool.id}`}>
                <td>{tool.id}</td>
                <td>{tool.name}</td>
                <td>{tool.version}</td>
                <td>{tool.category}</td>
                <td>{tool.totalRuns}</td>
                <td>{tool.overallScore?.toFixed(0) || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFoundryOverview = () => {
    if (debugState.foundryOverview.status !== 'success' || !debugState.foundryOverview.data) {
      return null;
    }
    const overview = debugState.foundryOverview.data as FoundryOverview;
    return (
      <div className="debug-section">
        <h3>Foundry Overview</h3>
        <div className="debug-stats" data-testid="foundry-overview">
          <div className="debug-stat">
            <span className="debug-stat__label">Agent Count:</span>
            <span className="debug-stat__value" data-testid="agent-count">{overview.agentCount}</span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat__label">Tool Count:</span>
            <span className="debug-stat__value" data-testid="tool-count">{overview.toolCount}</span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat__label">Total Agent Runs:</span>
            <span className="debug-stat__value">{overview.totalAgentRuns}</span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat__label">Total Tool Runs:</span>
            <span className="debug-stat__value">{overview.totalToolRuns}</span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat__label">Avg Agent Score:</span>
            <span className="debug-stat__value">{overview.avgAgentScore?.toFixed(1) || '-'}</span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat__label">Avg Tool Score:</span>
            <span className="debug-stat__value">{overview.avgToolScore?.toFixed(1) || '-'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="debug-page" data-testid="debug-page">
      <div className="debug-page__header">
        <h1>Debug Dashboard</h1>
        <div className="debug-page__actions">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (5s)
          </label>
          <button className="btn btn--secondary" onClick={copyToClipboard} title="Copy JSON">
            <Copy size={16} />
          </button>
          <button className="btn btn--secondary" onClick={downloadJson} title="Download JSON">
            <Download size={16} />
          </button>
          <button className="btn btn--primary" onClick={runAllChecks}>
            <RefreshCw size={16} />
            Refresh All
          </button>
        </div>
      </div>

      {lastRefresh && (
        <p className="debug-page__timestamp">
          Last refresh: {lastRefresh.toLocaleString()}
        </p>
      )}

      <div className="debug-page__content">
        {/* API Status Checks */}
        <div className="debug-section">
          <h2>API Status</h2>
          <div className="api-checks" data-testid="api-checks">
            {debugStateKeys.map((key): React.ReactElement => {
              const check: ApiCheckResult = debugState[key];
              return (
                <div key={key} className={`api-check api-check--${check.status}`} data-testid={`api-check-${key}`}>
                  {getStatusIcon(check.status)}
                  <div className="api-check__info">
                    <span className="api-check__endpoint">{check.endpoint}</span>
                    {check.statusCode !== undefined && check.statusCode > 0 ? (
                      <span className="api-check__status-code">HTTP {check.statusCode}</span>
                    ) : null}
                    {check.duration !== undefined ? (
                      <span className="api-check__duration">{check.duration}ms</span>
                    ) : null}
                    {check.error !== undefined ? (
                      <span className="api-check__error">{check.error}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Health Details */}
        {debugState.health.status === 'success' && debugState.health.data !== undefined ? (
          <div className="debug-section">
            <h3>Health Details</h3>
            <div className="debug-stats" data-testid="health-details">
              <div className="debug-stat">
                <span className="debug-stat__label">Status:</span>
                <span className="debug-stat__value">{(debugState.health.data as HealthStatus).status}</span>
              </div>
              <div className="debug-stat">
                <span className="debug-stat__label">Version:</span>
                <span className="debug-stat__value">{(debugState.health.data as HealthStatus).version}</span>
              </div>
              <div className="debug-stat">
                <span className="debug-stat__label">Block Count:</span>
                <span className="debug-stat__value">{(debugState.health.data as HealthStatus).blockCount}</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Foundry Overview */}
        {renderFoundryOverview()}

        {/* Agents List */}
        {renderAgentsList()}

        {/* Tools List */}
        {renderToolsList()}

        {/* Raw JSON Export */}
        <div className="debug-section">
          <h3>Raw JSON Export</h3>
          <pre className="debug-json" data-testid="debug-json">{jsonExport}</pre>
        </div>
      </div>
    </div>
  );
}

export default DebugPage;
