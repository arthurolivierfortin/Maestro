/**
 * Monitoring Page
 *
 * Page for per-project monitoring and agent activity tracking.
 */

import React, { useEffect, useState, useCallback } from 'react';
import './MonitoringPage.scss';

// Types for monitoring data
interface AgentActivity {
  id: string;
  agentId: string;
  agentName?: string;
  projectId?: string;
  actionType: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  executionId?: string;
  relatedBlockId?: string;
  duration?: number;
  success?: boolean;
}

interface AssignedAgent {
  assignmentId: string;
  agentId: string;
  agentName: string;
  role: string;
  assignedAt: string;
  recentActivityCount: number;
}

interface ProjectStats {
  totalAgents: number;
  activeAgentsLast24h: number;
  totalActivitiesToday: number;
  successRate: number;
}

interface ProjectMonitoringData {
  projectId: string;
  assignedAgents: AssignedAgent[];
  recentActivity: AgentActivity[];
  stats: ProjectStats;
}

interface Project {
  id: string;
  name: string;
  path: string;
}

// API functions
const API_BASE = 'http://localhost:5000/api';

async function fetchProjects(): Promise<Project[]> {
  try {
    const response = await fetch(`${API_BASE}/projects`);
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  } catch {
    return [];
  }
}

async function fetchProjectMonitoring(projectId: string): Promise<ProjectMonitoringData | null> {
  try {
    const response = await fetch(`${API_BASE}/monitoring/projects/${encodeURIComponent(projectId)}`);
    if (!response.ok) throw new Error('Failed to fetch monitoring data');
    return response.json();
  } catch {
    return null;
  }
}

async function attachAgent(projectId: string, agentId: string, role: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE}/monitoring/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}/attach`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function detachAgent(projectId: string, agentId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_BASE}/monitoring/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}`,
      { method: 'DELETE' }
    );
    return response.ok;
  } catch {
    return false;
  }
}

// Sub-components
interface ActivityBadgeProps {
  actionType: string;
}

const ActivityBadge: React.FC<ActivityBadgeProps> = ({ actionType }) => {
  const typeClass = actionType.replace(/_/g, '-');
  return <span className={`activity-badge activity-badge--${typeClass}`}>{actionType}</span>;
};

interface SuccessBadgeProps {
  success?: boolean;
}

const SuccessBadge: React.FC<SuccessBadgeProps> = ({ success }) => {
  if (success === undefined) return null;
  return (
    <span className={`success-badge success-badge--${success ? 'success' : 'failure'}`}>
      {success ? 'Success' : 'Failed'}
    </span>
  );
};

interface StatsCardProps {
  label: string;
  value: number | string;
  variant?: 'default' | 'success' | 'warning' | 'info';
}

const StatsCard: React.FC<StatsCardProps> = ({ label, value, variant = 'default' }) => (
  <div className={`stats-card stats-card--${variant}`}>
    <span className="stats-card__value">{value}</span>
    <span className="stats-card__label">{label}</span>
  </div>
);

interface AgentCardProps {
  agent: AssignedAgent;
  onDetach: (agentId: string) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onDetach }) => (
  <div className="agent-card">
    <div className="agent-card__header">
      <span className="agent-card__name">{agent.agentName}</span>
      <span className={`agent-card__role agent-card__role--${agent.role}`}>{agent.role}</span>
    </div>
    <div className="agent-card__details">
      <span className="agent-card__id">{agent.agentId}</span>
      <span className="agent-card__activity">
        {agent.recentActivityCount} activities (24h)
      </span>
    </div>
    <div className="agent-card__footer">
      <span className="agent-card__assigned">
        Assigned: {new Date(agent.assignedAt).toLocaleDateString()}
      </span>
      <button className="btn-secondary btn-sm" onClick={() => onDetach(agent.agentId)}>
        Detach
      </button>
    </div>
  </div>
);

interface ActivityRowProps {
  activity: AgentActivity;
}

const ActivityRow: React.FC<ActivityRowProps> = ({ activity }) => (
  <div className="activity-row">
    <div className="activity-row__time">
      {new Date(activity.timestamp).toLocaleTimeString()}
    </div>
    <div className="activity-row__agent">
      {activity.agentName || activity.agentId}
    </div>
    <div className="activity-row__type">
      <ActivityBadge actionType={activity.actionType} />
    </div>
    <div className="activity-row__description">
      {activity.description}
    </div>
    <div className="activity-row__result">
      <SuccessBadge success={activity.success} />
      {activity.duration !== undefined && (
        <span className="activity-row__duration">{activity.duration.toFixed(1)}s</span>
      )}
    </div>
  </div>
);

interface AttachAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (agentId: string, role: string) => Promise<void>;
}

const AttachAgentModal: React.FC<AttachAgentModalProps> = ({ isOpen, onClose, onAttach }) => {
  const [agentId, setAgentId] = useState('');
  const [role, setRole] = useState('primary');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onAttach(agentId, role);
    setIsLoading(false);
    setAgentId('');
    setRole('primary');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Attach Agent to Project</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="agentId">Agent ID *</label>
            <input
              id="agentId"
              type="text"
              required
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="agent-uuid or agent name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="primary">Primary</option>
              <option value="reviewer">Reviewer</option>
              <option value="tester">Tester</option>
              <option value="support">Support</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Attaching...' : 'Attach Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Page Component
const MonitoringPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [monitoringData, setMonitoringData] = useState<ProjectMonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      setIsLoading(true);
      const projectList = await fetchProjects();
      setProjects(projectList);
      if (projectList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectList[0].id);
      }
      setIsLoading(false);
    };
    loadProjects();
  }, []);

  // Load monitoring data for selected project
  const loadMonitoringData = useCallback(async () => {
    if (!selectedProjectId) return;
    const data = await fetchProjectMonitoring(selectedProjectId);
    if (data) {
      setMonitoringData(data);
      setError(null);
    } else {
      setError('Failed to load monitoring data');
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadMonitoringData();
  }, [loadMonitoringData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !selectedProjectId) return;
    const interval = setInterval(loadMonitoringData, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, selectedProjectId, loadMonitoringData]);

  const handleAttachAgent = async (agentId: string, role: string) => {
    if (!selectedProjectId) return;
    const success = await attachAgent(selectedProjectId, agentId, role);
    if (success) {
      loadMonitoringData();
    } else {
      setError('Failed to attach agent');
    }
  };

  const handleDetachAgent = async (agentId: string) => {
    if (!selectedProjectId) return;
    const success = await detachAgent(selectedProjectId, agentId);
    if (success) {
      loadMonitoringData();
    } else {
      setError('Failed to detach agent');
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="monitoring-page">
      {/* Header */}
      <header className="monitoring-page__header">
        <div className="monitoring-page__title">
          <h1>Project Monitoring</h1>
          <span className="monitoring-page__count">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="monitoring-page__actions">
          <label className="monitoring-page__auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button className="btn-secondary" onClick={loadMonitoringData}>
            Refresh
          </button>
        </div>
      </header>

      {/* Project Selector */}
      <div className="monitoring-page__project-selector">
        <label htmlFor="project-select">Project:</label>
        <select
          id="project-select"
          value={selectedProjectId || ''}
          onChange={(e) => setSelectedProjectId(e.target.value)}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        {selectedProject && (
          <span className="monitoring-page__project-path">{selectedProject.path}</span>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Content */}
      <div className="monitoring-page__content">
        {isLoading && !monitoringData ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading monitoring data...</p>
          </div>
        ) : !selectedProjectId ? (
          <div className="empty-state">
            <h2>No Projects Found</h2>
            <p>Add a project to start monitoring agent activity.</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            {monitoringData && (
              <section className="monitoring-page__stats">
                <StatsCard
                  label="Total Agents"
                  value={monitoringData.stats.totalAgents}
                  variant="info"
                />
                <StatsCard
                  label="Active (24h)"
                  value={monitoringData.stats.activeAgentsLast24h}
                  variant="success"
                />
                <StatsCard
                  label="Activities Today"
                  value={monitoringData.stats.totalActivitiesToday}
                  variant="default"
                />
                <StatsCard
                  label="Success Rate"
                  value={`${monitoringData.stats.successRate.toFixed(0)}%`}
                  variant={monitoringData.stats.successRate >= 80 ? 'success' : 'warning'}
                />
              </section>
            )}

            {/* Assigned Agents */}
            <section className="monitoring-page__section">
              <div className="monitoring-page__section-header">
                <h2>Assigned Agents</h2>
                <button className="btn-primary" onClick={() => setShowAttachModal(true)}>
                  + Attach Agent
                </button>
              </div>
              {monitoringData?.assignedAgents.length === 0 ? (
                <div className="empty-state empty-state--small">
                  <p>No agents attached to this project.</p>
                </div>
              ) : (
                <div className="agents-grid">
                  {monitoringData?.assignedAgents.map((agent) => (
                    <AgentCard
                      key={agent.assignmentId}
                      agent={agent}
                      onDetach={handleDetachAgent}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Recent Activity */}
            <section className="monitoring-page__section">
              <div className="monitoring-page__section-header">
                <h2>Recent Activity</h2>
                <span className="monitoring-page__section-count">
                  {monitoringData?.recentActivity.length || 0} events
                </span>
              </div>
              {monitoringData?.recentActivity.length === 0 ? (
                <div className="empty-state empty-state--small">
                  <p>No recent activity for this project.</p>
                </div>
              ) : (
                <div className="activity-list">
                  <div className="activity-list__header">
                    <span>Time</span>
                    <span>Agent</span>
                    <span>Action</span>
                    <span>Description</span>
                    <span>Result</span>
                  </div>
                  {monitoringData?.recentActivity.map((activity) => (
                    <ActivityRow key={activity.id} activity={activity} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Attach Agent Modal */}
      <AttachAgentModal
        isOpen={showAttachModal}
        onClose={() => setShowAttachModal(false)}
        onAttach={handleAttachAgent}
      />
    </div>
  );
};

export default MonitoringPage;
