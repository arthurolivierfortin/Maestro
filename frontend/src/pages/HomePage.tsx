/**
 * Dashboard — Live overview of Maestro services, sessions, and quick actions.
 * Uses shared hooks (useHealthMonitor, useSessionList) and transforms (statusToSemantic).
 */

import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, StatusIndicator } from '@components/ui';
import { useHealthMonitor } from '@shared/app/hooks/useHealthMonitor';
import { useSessionList } from '@shared/app/hooks/useSessionList';
import { usePolling } from '@shared/app/hooks/usePolling';
import { statusToSemantic } from '@shared/app/transforms/session';
import type { ServiceHealth } from '@shared/app/transforms/health';
import './HomePage.scss';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Simple fetch wrappers for the shared hooks
const fetchFns = {
  getHealth: () => fetch(`${API_URL}/api/health`).then(r => r.ok ? r.json() : null),
  getLLMHealth: () => fetch(`${API_URL}/api/provider/health`).then(r => r.ok ? r.json() : null),
};

const fetchSessions = () =>
  fetch(`${API_URL}/api/sessions`).then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : []);

const fetchBlocks = () =>
  fetch(`${API_URL}/api/blocks`).then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d.length : 0);

// Map semantic category to Badge variant
const semanticToVariant = (sem: string) => {
  const map: Record<string, 'info' | 'success' | 'error' | 'warning' | 'muted'> = {
    info: 'info', success: 'success', error: 'error', warning: 'warning', muted: 'muted',
  };
  return map[sem] || 'muted';
};

// Map semantic category to StatusIndicator status
const semanticToStatus = (sem: string) => {
  const map: Record<string, 'running' | 'success' | 'error' | 'warning' | 'pending'> = {
    info: 'running', success: 'success', error: 'error', warning: 'warning', muted: 'pending',
  };
  return map[sem] || 'pending';
};

export function HomePage() {
  // Shared hooks — same logic as TUI HomeScreen
  const health = useHealthMonitor(fetchFns, 5000, 10000);
  const sessionState = useSessionList(useCallback(fetchSessions, []), 5000);
  const { data: blockCount } = usePolling(useCallback(fetchBlocks, []), 15000);

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (health.connectionStatus !== 'connecting') setLoading(false);
  }, [health.connectionStatus]);

  const services: ServiceHealth[] = [health.backend, health.llm];
  const allHealthy = services.every(s => s.status === 'healthy');
  const recentSessions = sessionState.sessions.slice(0, 5);

  return (
    <div className="dashboard page-enter">
      {/* Header */}
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__title">Dashboard</h1>
          <p className="dashboard__subtitle">
            {allHealthy ? 'All systems operational' : 'Some services need attention'}
          </p>
        </div>
        <div className="dashboard__header-actions">
          <Link to="/chat" className="dashboard__btn dashboard__btn--primary">New Chat</Link>
          <Link to="/sessions" className="dashboard__btn dashboard__btn--secondary">View Sessions</Link>
        </div>
      </div>

      {/* Service Health */}
      <section className="dashboard__section stagger-children">
        <h2 className="dashboard__section-title">Services</h2>
        <div className="dashboard__grid dashboard__grid--services">
          {loading ? (
            <>
              <div className="ui-skeleton ui-skeleton--card" />
              <div className="ui-skeleton ui-skeleton--card" />
            </>
          ) : services.map((svc) => (
            <Card key={svc.name} variant="default" padding="md">
              <div className="dashboard__service">
                <div className="dashboard__service-info">
                  <StatusIndicator status={svc.status} size="md" pulse={svc.status === 'healthy'} />
                  <div>
                    <span className="dashboard__service-name">{svc.name}</span>
                    <span className="dashboard__service-detail">{svc.detail}</span>
                  </div>
                </div>
                {svc.latencyMs != null && (
                  <Badge variant="muted" size="sm">{svc.latencyMs}ms</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Stats Row */}
      <section className="dashboard__section">
        <div className="dashboard__grid dashboard__grid--stats stagger-children">
          <Card variant="default" padding="md">
            <div className="dashboard__stat">
              <span className="dashboard__stat-value">{sessionState.counts.running}</span>
              <span className="dashboard__stat-label">Active Sessions</span>
            </div>
          </Card>
          <Card variant="default" padding="md">
            <div className="dashboard__stat">
              <span className="dashboard__stat-value">{blockCount ?? 0}</span>
              <span className="dashboard__stat-label">Blocks Available</span>
            </div>
          </Card>
          <Card variant="default" padding="md">
            <div className="dashboard__stat">
              <span className="dashboard__stat-value">{health.activeModel || '—'}</span>
              <span className="dashboard__stat-label">Active Model</span>
            </div>
          </Card>
          <Card variant="default" padding="md">
            <div className="dashboard__stat">
              {health.vramTotal ? (
                <>
                  <span className="dashboard__stat-value">
                    {Math.round((health.vramUsed || 0) / 1024)}
                    <span className="dashboard__stat-unit"> / {Math.round(health.vramTotal / 1024)} GB</span>
                  </span>
                  <span className="dashboard__stat-label">VRAM Usage</span>
                </>
              ) : (
                <>
                  <span className="dashboard__stat-value">—</span>
                  <span className="dashboard__stat-label">VRAM Usage</span>
                </>
              )}
            </div>
          </Card>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="dashboard__section">
        <h2 className="dashboard__section-title">Quick Actions</h2>
        <div className="dashboard__grid dashboard__grid--actions stagger-children">
          <Link to="/chat" className="dashboard__action-card">
            <span className="dashboard__action-icon">💬</span>
            <span className="dashboard__action-label">Chat with Model</span>
          </Link>
          <Link to="/foundry" className="dashboard__action-card">
            <span className="dashboard__action-icon">🧱</span>
            <span className="dashboard__action-label">Browse Blocks</span>
          </Link>
          <Link to="/sessions" className="dashboard__action-card">
            <span className="dashboard__action-icon">⚡</span>
            <span className="dashboard__action-label">Manage Sessions</span>
          </Link>
          <Link to="/models" className="dashboard__action-card">
            <span className="dashboard__action-icon">🤖</span>
            <span className="dashboard__action-label">Models & Hardware</span>
          </Link>
          <Link to="/workspaces" className="dashboard__action-card">
            <span className="dashboard__action-icon">📁</span>
            <span className="dashboard__action-label">Workspaces</span>
          </Link>
          <Link to="/settings" className="dashboard__action-card">
            <span className="dashboard__action-icon">⚙️</span>
            <span className="dashboard__action-label">Settings</span>
          </Link>
        </div>
      </section>

      {/* Recent Sessions */}
      <section className="dashboard__section">
        <div className="dashboard__section-header">
          <h2 className="dashboard__section-title">Recent Sessions</h2>
          <Link to="/sessions" className="dashboard__link">View all</Link>
        </div>
        {loading ? (
          <div className="ui-skeleton ui-skeleton--card" style={{ height: 200 }} />
        ) : recentSessions.length === 0 ? (
          <div className="ui-empty">
            <div className="ui-empty__icon">📋</div>
            <h3 className="ui-empty__title">No sessions yet</h3>
            <p className="ui-empty__message">Create your first session to get started with Maestro workflows.</p>
            <div className="ui-empty__action">
              <Link to="/sessions" className="dashboard__btn dashboard__btn--primary">Create Session</Link>
            </div>
          </div>
        ) : (
          <Card variant="default" padding="none">
            <div className="dashboard__session-list">
              {recentSessions.map((s) => {
                const sem = statusToSemantic(s.status);
                return (
                  <div key={s.id} className="dashboard__session-row">
                    <div className="dashboard__session-info">
                      <StatusIndicator
                        status={semanticToStatus(sem)}
                        size="sm"
                        pulse={sem === 'info'}
                      />
                      <span className="dashboard__session-name">{s.name || s.id}</span>
                    </div>
                    <Badge variant={semanticToVariant(sem)} size="sm">
                      {s.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

export default HomePage;
