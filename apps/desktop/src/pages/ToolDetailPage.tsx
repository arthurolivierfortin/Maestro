/**
 * Tool Detail Page
 *
 * Displays detailed information about a specific tool including:
 * - Visual preview of tool workflow
 * - Configuration and parameters
 * - Usage statistics
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import { Wrench, ArrowLeft, Play, Settings, BarChart3, AlertCircle, Bot, Layers, Maximize2 } from 'lucide-react';
import { ToolUsagePreview } from '../components/ToolUsagePreview';
import './ToolDetailPage.scss';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface AgentInfo {
  id: string;
  name: string;
}

interface ToolDetail {
  id: string;
  name: string;
  description: string;
  version: string;
  blockId: string;
  category: string;
  tags: string[];
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  metrics: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: number;
    avgExecutionTimeMs: number;
    overallScore: number;
    lastRunAt?: string;
  };
  usedByAgents: string[];
  agentDetails?: AgentInfo[];
  createdAt: string;
  updatedAt: string;
}

export function ToolDetailPage() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();

  const [tool, setTool] = useState<ToolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toolId) return;

    setLoading(true);
    fetch(`${API_BASE}/api/tools/${toolId}`)
      .then(res => {
        if (!res.ok) throw new Error(`Tool not found: ${toolId}`);
        return res.json();
      })
      .then(data => {
        setTool(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [toolId]);

  const handleBack = () => {
    navigate('/foundry/tools');
  };

  const handleTest = () => {
    console.log('Test tool:', toolId);
  };

  const handleConfigure = () => {
    // Navigate to canvas editor using blockId if available, otherwise toolId
    navigate(`/canvas/${tool?.blockId || toolId}`);
  };

  if (loading) {
    return (
      <div className="tool-detail-page">
        <div className="tool-detail-page__loading">Loading tool...</div>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="tool-detail-page">
        <div className="tool-detail-page__error">
          <AlertCircle size={48} />
          <h2>Tool Not Found</h2>
          <p>{error || 'The requested tool could not be found.'}</p>
          <button className="btn-primary" onClick={handleBack}>
            Back to Tools
          </button>
        </div>
      </div>
    );
  }

  const metrics = tool.metrics || {};

  return (
    <div className="tool-detail-page">
      {/* Header */}
      <div className="tool-detail-page__header">
        <button className="btn-back" onClick={handleBack}>
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="tool-detail-page__title">
          <Wrench size={32} />
          <div>
            <h1>{tool.name}</h1>
            <span className="tool-detail-page__version">v{tool.version}</span>
            <span className="tool-detail-page__category">{tool.category}</span>
          </div>
        </div>
        <div className="tool-detail-page__actions">
          <button className="btn-secondary" onClick={handleConfigure}>
            <Settings size={18} />
            Configure
          </button>
          <button className="btn-primary" onClick={handleTest}>
            <Play size={18} />
            Test
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="tool-detail-page__section">
        <p className="tool-detail-page__description">{tool.description}</p>
      </div>

      {/* Tool Usage Preview */}
      <div className="tool-detail-page__section">
        <div className="section-header">
          <h2><Layers size={20} /> Used By Agents</h2>
          <button className="btn-secondary btn-sm" onClick={handleConfigure}>
            <Maximize2 size={16} />
            Open Editor
          </button>
        </div>
        <ReactFlowProvider>
          <ToolUsagePreview
            toolId={tool.id}
            toolName={tool.name}
            usedByAgents={
              tool.agentDetails?.map(a => ({
                id: a.id,
                name: a.name,
              })) ||
              tool.usedByAgents?.map(id => ({
                id,
                name: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              })) ||
              []
            }
            onAgentClick={(agentId) => navigate(`/agent/${agentId}`)}
          />
        </ReactFlowProvider>
      </div>

      {/* Metrics */}
      <div className="tool-detail-page__section">
        <h2><BarChart3 size={20} /> Performance Metrics</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-card__value">{metrics.totalRuns || 0}</span>
            <span className="metric-card__label">Total Runs</span>
          </div>
          <div className="metric-card metric-card--success">
            <span className="metric-card__value">{metrics.successfulRuns || 0}</span>
            <span className="metric-card__label">Successful</span>
          </div>
          <div className="metric-card metric-card--error">
            <span className="metric-card__value">{metrics.failedRuns || 0}</span>
            <span className="metric-card__label">Failed</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__value">{(metrics.successRate || 0).toFixed(0)}%</span>
            <span className="metric-card__label">Success Rate</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__value">{(metrics.overallScore || 0).toFixed(0)}</span>
            <span className="metric-card__label">Score</span>
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

      {/* Used by Agents */}
      {tool.usedByAgents && tool.usedByAgents.length > 0 && (
        <div className="tool-detail-page__section">
          <h2><Bot size={20} /> Used by Agents ({tool.usedByAgents.length})</h2>
          <div className="agents-list">
            {tool.usedByAgents.map(agentId => (
              <div
                key={agentId}
                className="agent-item"
                onClick={() => navigate(`/agent/${agentId}`)}
              >
                <Bot size={16} />
                <span>{agentId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parameters */}
      {tool.parameters && tool.parameters.length > 0 && (
        <div className="tool-detail-page__section">
          <h2><Settings size={20} /> Parameters</h2>
          <div className="params-list">
            {tool.parameters.map(param => (
              <div key={param.name} className="param-item">
                <div className="param-item__header">
                  <span className="param-item__name">{param.name}</span>
                  <span className="param-item__type">{param.type}</span>
                  {param.required && <span className="param-item__required">Required</span>}
                </div>
                <p className="param-item__description">{param.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {tool.tags && tool.tags.length > 0 && (
        <div className="tool-detail-page__section">
          <h2>Tags</h2>
          <div className="tags-list">
            {tool.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolDetailPage;
