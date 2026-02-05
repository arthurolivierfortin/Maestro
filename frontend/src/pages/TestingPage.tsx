/**
 * TestingPage Component
 * Main page for block testing and evaluation management
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Plus,
  RefreshCw,
  Filter,
  AlertCircle,
  CheckCircle,
  Clock,
  Bot,
  Wrench,
  GitBranch,
  Layers,
} from 'lucide-react';
import { useTestStore } from '../store/testStore';
import { TestRunCard, ScoreTrendChart } from '../components/Testing';
import type { BlockTestRunStatus } from '../types/test.types';
import './TestingPage.scss';

type TabType = 'runs' | 'pending' | 'insights';
type BlockTypeFilter = 'all' | 'tool' | 'agent' | 'workflow' | 'task';
type StatusFilter = 'all' | BlockTestRunStatus;

export const TestingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('runs');
  const [blockTypeFilter, setBlockTypeFilter] = useState<BlockTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  const {
    testRuns,
    isLoading,
    error,
    loadTestRuns,
    deleteTestRun,
    clearError,
  } = useTestStore();

  // Load test runs on mount
  useEffect(() => {
    loadTestRuns();
  }, [loadTestRuns]);

  // Filtered runs
  const filteredRuns = testRuns.filter((run) => {
    if (blockTypeFilter !== 'all' && run.blockType !== blockTypeFilter) return false;
    if (statusFilter !== 'all' && run.status !== statusFilter) return false;
    return true;
  });

  // Pending evaluation runs
  const pendingRuns = testRuns.filter((run) => run.status === 'AwaitingEvaluation');

  // Completed runs for insights
  const completedRuns = testRuns.filter((run) => run.status === 'Completed' && run.metrics);

  // Stats
  const stats = {
    total: testRuns.length,
    pending: pendingRuns.length,
    completed: completedRuns.length,
    avgScore: completedRuns.length > 0
      ? Math.round(completedRuns.reduce((acc, r) => acc + (r.metrics?.overallScore || 0), 0) / completedRuns.length)
      : 0,
  };

  const handleRefresh = useCallback(() => {
    loadTestRuns();
  }, [loadTestRuns]);

  const handleDelete = useCallback(async (id: string) => {
    if (window.confirm('Are you sure you want to delete this test run?')) {
      await deleteTestRun(id);
    }
  }, [deleteTestRun]);

  const handleCreateTest = () => {
    // Navigate to foundry to select a block to test
    navigate('/foundry?action=test');
  };

  const blockTypeIcons: Record<string, React.ReactNode> = {
    all: <Layers size={14} />,
    agent: <Bot size={14} />,
    tool: <Wrench size={14} />,
    workflow: <GitBranch size={14} />,
    task: <Layers size={14} />,
  };

  return (
    <div className="testing-page">
      <header className="testing-page__header">
        <div className="testing-page__title">
          <FlaskConical size={24} />
          <h1>Block Testing</h1>
        </div>
        <div className="testing-page__actions">
          <button
            className="testing-page__btn testing-page__btn--secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
          </button>
          <button
            className="testing-page__btn testing-page__btn--secondary"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            Refresh
          </button>
          <button
            className="testing-page__btn testing-page__btn--primary"
            onClick={handleCreateTest}
          >
            <Plus size={16} />
            New Test
          </button>
        </div>
      </header>

      {error && (
        <div className="testing-page__error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      <div className="testing-page__stats">
        <div className="testing-page__stat">
          <span className="testing-page__stat-value">{stats.total}</span>
          <span className="testing-page__stat-label">Total Runs</span>
        </div>
        <div className="testing-page__stat testing-page__stat--warning">
          <Clock size={18} />
          <span className="testing-page__stat-value">{stats.pending}</span>
          <span className="testing-page__stat-label">Pending Evaluation</span>
        </div>
        <div className="testing-page__stat testing-page__stat--success">
          <CheckCircle size={18} />
          <span className="testing-page__stat-value">{stats.completed}</span>
          <span className="testing-page__stat-label">Completed</span>
        </div>
        <div className="testing-page__stat">
          <span className="testing-page__stat-value">{stats.avgScore}</span>
          <span className="testing-page__stat-label">Avg Score</span>
        </div>
      </div>

      {showFilters && (
        <div className="testing-page__filters">
          <div className="testing-page__filter-group">
            <label>Block Type</label>
            <div className="testing-page__filter-buttons">
              {(['all', 'tool', 'agent', 'workflow', 'task'] as BlockTypeFilter[]).map((type) => (
                <button
                  key={type}
                  className={`testing-page__filter-btn ${blockTypeFilter === type ? 'active' : ''}`}
                  onClick={() => setBlockTypeFilter(type)}
                >
                  {blockTypeIcons[type]}
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="testing-page__filter-group">
            <label>Status</label>
            <div className="testing-page__filter-buttons">
              {(['all', 'Pending', 'Running', 'AwaitingEvaluation', 'Completed', 'Failed'] as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  className={`testing-page__filter-btn ${statusFilter === status ? 'active' : ''}`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all' ? 'All' : status === 'AwaitingEvaluation' ? 'Awaiting' : status}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="testing-page__tabs">
        <button
          className={`testing-page__tab ${activeTab === 'runs' ? 'active' : ''}`}
          onClick={() => setActiveTab('runs')}
        >
          Test Runs
          <span className="testing-page__tab-count">{filteredRuns.length}</span>
        </button>
        <button
          className={`testing-page__tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Evaluation
          {stats.pending > 0 && (
            <span className="testing-page__tab-count testing-page__tab-count--warning">
              {stats.pending}
            </span>
          )}
        </button>
        <button
          className={`testing-page__tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          Insights
        </button>
      </div>

      <div className="testing-page__content">
        {activeTab === 'runs' && (
          <div className="testing-page__runs">
            {isLoading && filteredRuns.length === 0 ? (
              <div className="testing-page__loading">Loading test runs...</div>
            ) : filteredRuns.length === 0 ? (
              <div className="testing-page__empty">
                <FlaskConical size={48} />
                <h3>No test runs found</h3>
                <p>Start testing your blocks to see results here.</p>
                <button
                  className="testing-page__btn testing-page__btn--primary"
                  onClick={handleCreateTest}
                >
                  <Plus size={16} />
                  Create Test Run
                </button>
              </div>
            ) : (
              <div className="testing-page__runs-grid">
                {filteredRuns.map((run) => (
                  <TestRunCard
                    key={run.id}
                    testRun={run}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="testing-page__pending">
            {pendingRuns.length === 0 ? (
              <div className="testing-page__empty">
                <CheckCircle size={48} />
                <h3>All caught up!</h3>
                <p>No test runs awaiting evaluation.</p>
              </div>
            ) : (
              <div className="testing-page__pending-list">
                <p className="testing-page__pending-intro">
                  The following test runs have completed iterations that need evaluation.
                  Click on a run to evaluate its iterations.
                </p>
                <div className="testing-page__runs-grid">
                  {pendingRuns.map((run) => (
                    <TestRunCard
                      key={run.id}
                      testRun={run}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="testing-page__insights">
            {completedRuns.length < 2 ? (
              <div className="testing-page__empty">
                <AlertCircle size={48} />
                <h3>Not enough data</h3>
                <p>Complete at least 2 test runs to see trend insights.</p>
              </div>
            ) : (
              <>
                <ScoreTrendChart runs={completedRuns} height={250} />

                <div className="testing-page__insights-grid">
                  <div className="testing-page__insight-card">
                    <h4>By Block Type</h4>
                    <div className="testing-page__insight-list">
                      {(['tool', 'agent', 'workflow'] as const).map((type) => {
                        const typeRuns = completedRuns.filter((r) => r.blockType === type);
                        if (typeRuns.length === 0) return null;
                        const avg = Math.round(
                          typeRuns.reduce((acc, r) => acc + (r.metrics?.overallScore || 0), 0) / typeRuns.length
                        );
                        return (
                          <div key={type} className="testing-page__insight-row">
                            {blockTypeIcons[type]}
                            <span className="testing-page__insight-label">{type}</span>
                            <span className="testing-page__insight-count">{typeRuns.length} runs</span>
                            <span className={`testing-page__insight-score ${avg >= 80 ? 'high' : avg >= 60 ? 'medium' : 'low'}`}>
                              {avg}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="testing-page__insight-card">
                    <h4>Recent Performance</h4>
                    <div className="testing-page__insight-list">
                      {completedRuns.slice(0, 5).map((run) => (
                        <div key={run.id} className="testing-page__insight-row">
                          {blockTypeIcons[run.blockType]}
                          <span className="testing-page__insight-label">{run.blockId}</span>
                          <span className={`testing-page__insight-score ${(run.metrics?.overallScore || 0) >= 80 ? 'high' : (run.metrics?.overallScore || 0) >= 60 ? 'medium' : 'low'}`}>
                            {run.metrics?.overallScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestingPage;
