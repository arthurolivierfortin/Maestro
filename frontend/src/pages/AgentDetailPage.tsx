/**
 * Agent Detail Page
 *
 * Displays detailed information about a specific agent including:
 * - Visual preview of agent workflow
 * - Configuration
 * - Available tools
 * - Execution history
 * - Metrics and performance
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import {
  Bot, ArrowLeft, Play, Settings, Wrench,
  BarChart3, Clock, AlertCircle, Layers, Maximize2
} from 'lucide-react';
import { AgentToolsPreview } from '../components/AgentToolsPreview';
import './AgentDetailPage.scss';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface ToolDetail {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
}

interface AgentDetail {
  id: string;
  name: string;
  description: string;
  version: string;
  blockId: string;
  category: string;
  tags: string[];
  capabilities: string[];
  availableTools: string[];
  toolDetails?: ToolDetail[];
  config: {
    model?: string;
    maxSteps: number;
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
    requireApproval: boolean;
    systemPrompt?: string;
  };
  metrics: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    cancelledRuns: number;
    completionRate: number;
    avgExecutionTimeMs: number;
    avgTokenCost: number;
    avgStepsPerRun: number;
    avgToolsUsedPerRun: number;
    avgTaskCompletionScore: number;
    avgEfficiencyScore: number;
    avgQualityScore: number;
    overallScore: number;
    lastRunAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;

    setLoading(true);
    fetch(`${API_BASE}/api/agents/${agentId}`)
      .then(res => {
        if (!res.ok) throw new Error(`Agent not found: ${agentId}`);
        return res.json();
      })
      .then(data => {
        setAgent(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [agentId]);

  const handleBack = () => {
    navigate('/foundry/agents');
  };

  const handleExecute = () => {
    // TODO: Open execution modal
    console.log('Execute agent:', agentId);
  };

  const handleConfigure = () => {
    // Navigate to canvas editor using blockId if available, otherwise agentId
    navigate(`/canvas/${agent?.blockId || agentId}`);
  };

  if (loading) {
    return (
      <div className="agent-detail-page">
        <div className="agent-detail-page__loading">Loading agent...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="agent-detail-page">
        <div className="agent-detail-page__error">
          <AlertCircle size={48} />
          <h2>Agent Not Found</h2>
          <p>{error || 'The requested agent could not be found.'}</p>
          <button className="btn-primary" onClick={handleBack}>
            Back to Agents
          </button>
        </div>
      </div>
    );
  }

  const metrics = agent.metrics || {};

  return (
    <div className="agent-detail-page">
      {/* Header */}
      <div className="agent-detail-page__header">
        <button className="btn-back" onClick={handleBack}>
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="agent-detail-page__title">
          <Bot size={32} />
          <div>
            <h1>{agent.name}</h1>
            <span className="agent-detail-page__version">v{agent.version}</span>
            <span className="agent-detail-page__category">{agent.category}</span>
          </div>
        </div>
        <div className="agent-detail-page__actions">
          <button className="btn-secondary" onClick={handleConfigure}>
            <Settings size={18} />
            Configure
          </button>
          <button className="btn-primary" onClick={handleExecute}>
            <Play size={18} />
            Execute
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="agent-detail-page__section">
        <p className="agent-detail-page__description">{agent.description}</p>
      </div>

      {/* Agent Tools Preview */}
      <div className="agent-detail-page__section">
        <div className="section-header">
          <h2><Layers size={20} /> Available Tools</h2>
          <button className="btn-secondary btn-sm" onClick={handleConfigure}>
            <Maximize2 size={16} />
            Open Editor
          </button>
        </div>
        <ReactFlowProvider>
          <AgentToolsPreview
            agentId={agent.id}
            agentName={agent.name}
            tools={
              agent.toolDetails?.map(t => ({
                id: t.id,
                name: t.name,
                description: t.description,
                category: t.category,
              })) ||
              agent.availableTools?.map(id => ({
                id,
                name: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              })) ||
              []
            }
            onToolClick={(toolId) => navigate(`/tool/${toolId}`)}
          />
        </ReactFlowProvider>
      </div>

      {/* Metrics Summary */}
      <div className="agent-detail-page__section">
        <h2><BarChart3 size={20} /> Performance Metrics</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-card__value">{metrics.totalRuns || 0}</span>
            <span className="metric-card__label">Total Runs</span>
          </div>
          <div className="metric-card metric-card--success">
            <span className="metric-card__value">{metrics.completedRuns || 0}</span>
            <span className="metric-card__label">Completed</span>
          </div>
          <div className="metric-card metric-card--error">
            <span className="metric-card__value">{metrics.failedRuns || 0}</span>
            <span className="metric-card__label">Failed</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__value">{(metrics.completionRate || 0).toFixed(0)}%</span>
            <span className="metric-card__label">Success Rate</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__value">{(metrics.overallScore || 0).toFixed(0)}</span>
            <span className="metric-card__label">Overall Score</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__value">
              {metrics.avgExecutionTimeMs
                ? `${(metrics.avgExecutionTimeMs / 1000).toFixed(1)}s`
                : '-'}
            </span>
            <span className="metric-card__label">Avg Time</span>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div className="agent-detail-page__section">
          <h2>Capabilities</h2>
          <div className="tags-list">
            {agent.capabilities.map(cap => (
              <span key={cap} className="tag">{cap}</span>
            ))}
          </div>
        </div>
      )}

      {/* Available Tools */}
      {agent.availableTools && agent.availableTools.length > 0 && (
        <div className="agent-detail-page__section">
          <h2><Wrench size={20} /> Available Tools ({agent.availableTools.length})</h2>
          <div className="tools-list">
            {agent.availableTools.map(toolId => (
              <div key={toolId} className="tool-item">
                <Wrench size={16} />
                <span>{toolId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="agent-detail-page__section">
        <h2><Settings size={20} /> Configuration</h2>
        <div className="config-grid">
          <div className="config-item">
            <span className="config-item__label">Model</span>
            <span className="config-item__value">{agent.config?.model || 'Default'}</span>
          </div>
          <div className="config-item">
            <span className="config-item__label">Max Steps</span>
            <span className="config-item__value">{agent.config?.maxSteps || '-'}</span>
          </div>
          <div className="config-item">
            <span className="config-item__label">Max Tokens</span>
            <span className="config-item__value">{agent.config?.maxTokens || '-'}</span>
          </div>
          <div className="config-item">
            <span className="config-item__label">Temperature</span>
            <span className="config-item__value">{agent.config?.temperature || '-'}</span>
          </div>
          <div className="config-item">
            <span className="config-item__label">Timeout</span>
            <span className="config-item__value">
              {agent.config?.timeoutMs ? `${agent.config.timeoutMs / 1000}s` : '-'}
            </span>
          </div>
          <div className="config-item">
            <span className="config-item__label">Require Approval</span>
            <span className="config-item__value">
              {agent.config?.requireApproval ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="agent-detail-page__section">
        <h2><Clock size={20} /> Recent Runs</h2>
        {metrics.totalRuns === 0 ? (
          <div className="no-runs">
            <p>No execution history yet. Run this agent to see results here.</p>
            <button className="btn-primary" onClick={handleExecute}>
              <Play size={18} />
              Execute Agent
            </button>
          </div>
        ) : (
          <div className="runs-placeholder">
            <p>Last run: {metrics.lastRunAt ? new Date(metrics.lastRunAt).toLocaleString() : 'Never'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentDetailPage;
