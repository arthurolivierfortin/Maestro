/**
 * Agent Foundry Page
 *
 * Centralized hub for managing autonomous agents and tools with metrics and scoring.
 * Displays agents and tools with their performance metrics, allows creating new ones,
 * and provides a dashboard overview.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AgentFoundryPage.scss';

// Types
interface ToolSummary {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  totalRuns: number;
  successRate: number;
  overallScore: number;
  lastRunAt?: string;
  usedByAgentsCount: number;
}

interface AgentSummary {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  capabilities: string[];
  availableToolsCount: number;
  totalRuns: number;
  completionRate: number;
  overallScore: number;
  lastRunAt?: string;
}

interface FoundryOverview {
  agentCount: number;
  toolCount: number;
  totalAgentRuns: number;
  totalToolRuns: number;
  avgAgentScore: number;
  avgToolScore: number;
  topAgents: LeaderboardItem[];
  topTools: LeaderboardItem[];
  recentActivity: ActivityItem[];
}

interface LeaderboardItem {
  id: string;
  name: string;
  type: string;
  score: number;
  runs: number;
  successRate: number;
}

interface ActivityItem {
  id: string;
  name: string;
  type: string;
  action: string;
  timestamp: string;
  score: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export function AgentFoundryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'tools'>('overview');
  const [overview, setOverview] = useState<FoundryOverview | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, agentsRes, toolsRes] = await Promise.all([
        fetch(`${API_BASE}/api/foundry/overview`),
        fetch(`${API_BASE}/api/agents`),
        fetch(`${API_BASE}/api/tools`)
      ]);

      if (overviewRes.ok) {
        setOverview(await overviewRes.json());
      }
      if (agentsRes.ok) {
        setAgents(await agentsRes.json());
      }
      if (toolsRes.ok) {
        setTools(await toolsRes.json());
      }
    } catch (err) {
      setError('Failed to load Agent Foundry data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderScoreBar = (score: number) => {
    const percentage = Math.min(100, Math.max(0, score));
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
    return (
      <div className="score-bar">
        <div className="score-bar__fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
        <span className="score-bar__value">{score.toFixed(0)}</span>
      </div>
    );
  };

  const renderOverview = () => {
    if (!overview) return null;

    return (
      <div className="foundry-overview">
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card__icon">🤖</div>
            <div className="stat-card__content">
              <div className="stat-card__value">{overview.agentCount}</div>
              <div className="stat-card__label">Agents</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon">🔧</div>
            <div className="stat-card__content">
              <div className="stat-card__value">{overview.toolCount}</div>
              <div className="stat-card__label">Tools</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon">▶️</div>
            <div className="stat-card__content">
              <div className="stat-card__value">{overview.totalAgentRuns + overview.totalToolRuns}</div>
              <div className="stat-card__label">Total Runs</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card__icon">⭐</div>
            <div className="stat-card__content">
              <div className="stat-card__value">
                {((overview.avgAgentScore + overview.avgToolScore) / 2).toFixed(0)}
              </div>
              <div className="stat-card__label">Avg Score</div>
            </div>
          </div>
        </div>

        {/* Leaderboards */}
        <div className="leaderboards">
          <div className="leaderboard">
            <h3 className="leaderboard__title">Top Agents</h3>
            <div className="leaderboard__list">
              {overview.topAgents.map((item, idx) => (
                <div key={item.id} className="leaderboard__item" onClick={() => navigate(`/foundry/agents/${item.id}`)}>
                  <span className="leaderboard__rank">#{idx + 1}</span>
                  <span className="leaderboard__name">{item.name}</span>
                  <span className="leaderboard__score">{item.score.toFixed(0)}</span>
                </div>
              ))}
              {overview.topAgents.length === 0 && (
                <div className="leaderboard__empty">No agents yet</div>
              )}
            </div>
          </div>

          <div className="leaderboard">
            <h3 className="leaderboard__title">Top Tools</h3>
            <div className="leaderboard__list">
              {overview.topTools.map((item, idx) => (
                <div key={item.id} className="leaderboard__item" onClick={() => navigate(`/foundry/tools/${item.id}`)}>
                  <span className="leaderboard__rank">#{idx + 1}</span>
                  <span className="leaderboard__name">{item.name}</span>
                  <span className="leaderboard__score">{item.score.toFixed(0)}</span>
                </div>
              ))}
              {overview.topTools.length === 0 && (
                <div className="leaderboard__empty">No tools yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="recent-activity">
          <h3 className="recent-activity__title">Recent Activity</h3>
          <div className="recent-activity__list">
            {overview.recentActivity.map((item) => (
              <div key={`${item.id}-${item.timestamp}`} className="activity-item">
                <span className={`activity-item__icon activity-item__icon--${item.type}`}>
                  {item.type === 'agent' ? '🤖' : '🔧'}
                </span>
                <span className="activity-item__name">{item.name}</span>
                <span className="activity-item__action">{item.action}</span>
                <span className="activity-item__score">Score: {item.score}</span>
                <span className="activity-item__time">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
            {overview.recentActivity.length === 0 && (
              <div className="recent-activity__empty">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAgents = () => (
    <div className="items-grid">
      {agents.map((agent) => (
        <div key={agent.id} className="item-card item-card--agent" onClick={() => navigate(`/foundry/agents/${agent.id}`)}>
          <div className="item-card__header">
            <span className="item-card__icon">🤖</span>
            <div className="item-card__title-group">
              <h3 className="item-card__name">{agent.name}</h3>
              <span className="item-card__version">v{agent.version}</span>
            </div>
          </div>
          <p className="item-card__description">{agent.description}</p>
          <div className="item-card__tags">
            {agent.capabilities.slice(0, 3).map((cap) => (
              <span key={cap} className="tag">{cap}</span>
            ))}
          </div>
          <div className="item-card__metrics">
            <div className="metric">
              <span className="metric__label">Runs</span>
              <span className="metric__value">{agent.totalRuns}</span>
            </div>
            <div className="metric">
              <span className="metric__label">Success</span>
              <span className="metric__value">{agent.completionRate.toFixed(0)}%</span>
            </div>
            <div className="metric">
              <span className="metric__label">Tools</span>
              <span className="metric__value">{agent.availableToolsCount}</span>
            </div>
          </div>
          <div className="item-card__score">
            <span className="item-card__score-label">Score</span>
            {renderScoreBar(agent.overallScore)}
          </div>
        </div>
      ))}
      {agents.length === 0 && (
        <div className="items-grid__empty">
          <p>No agents registered yet.</p>
          <button className="btn btn--primary" onClick={() => navigate('/foundry/agents/new')}>
            Create Agent
          </button>
        </div>
      )}
    </div>
  );

  const renderTools = () => (
    <div className="items-grid">
      {tools.map((tool) => (
        <div key={tool.id} className="item-card item-card--tool" onClick={() => navigate(`/foundry/tools/${tool.id}`)}>
          <div className="item-card__header">
            <span className="item-card__icon">🔧</span>
            <div className="item-card__title-group">
              <h3 className="item-card__name">{tool.name}</h3>
              <span className="item-card__version">v{tool.version}</span>
            </div>
          </div>
          <p className="item-card__description">{tool.description}</p>
          <div className="item-card__tags">
            <span className="tag tag--category">{tool.category}</span>
            {tool.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
          <div className="item-card__metrics">
            <div className="metric">
              <span className="metric__label">Runs</span>
              <span className="metric__value">{tool.totalRuns}</span>
            </div>
            <div className="metric">
              <span className="metric__label">Success</span>
              <span className="metric__value">{tool.successRate.toFixed(0)}%</span>
            </div>
            <div className="metric">
              <span className="metric__label">Used by</span>
              <span className="metric__value">{tool.usedByAgentsCount} agents</span>
            </div>
          </div>
          <div className="item-card__score">
            <span className="item-card__score-label">Score</span>
            {renderScoreBar(tool.overallScore)}
          </div>
        </div>
      ))}
      {tools.length === 0 && (
        <div className="items-grid__empty">
          <p>No tools registered yet.</p>
          <button className="btn btn--primary" onClick={() => navigate('/foundry/tools/new')}>
            Create Tool
          </button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="agent-foundry-page agent-foundry-page--loading">
        <div className="loading-spinner" />
        <p>Loading Agent Foundry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="agent-foundry-page agent-foundry-page--error">
        <p>{error}</p>
        <button className="btn btn--primary" onClick={fetchData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="agent-foundry-page">
      <div className="agent-foundry-page__header">
        <div className="agent-foundry-page__title-row">
          <h1 className="agent-foundry-page__title">Agent Foundry</h1>
          <div className="agent-foundry-page__actions">
            <button className="btn btn--secondary" onClick={() => navigate('/foundry/tools/new')}>
              + New Tool
            </button>
            <button className="btn btn--primary" onClick={() => navigate('/foundry/agents/new')}>
              + New Agent
            </button>
          </div>
        </div>
        <p className="agent-foundry-page__subtitle">
          Create, manage, and monitor autonomous agents and their tools
        </p>
      </div>

      <div className="agent-foundry-page__tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'agents' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          Agents ({agents.length})
        </button>
        <button
          className={`tab ${activeTab === 'tools' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          Tools ({tools.length})
        </button>
      </div>

      <div className="agent-foundry-page__content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'agents' && renderAgents()}
        {activeTab === 'tools' && renderTools()}
      </div>
    </div>
  );
}

export default AgentFoundryPage;
