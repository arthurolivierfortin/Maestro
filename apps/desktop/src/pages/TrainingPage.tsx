/**
 * Training Page (Phase 9)
 *
 * Page for managing training configurations and runs.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTrainingStore } from '../store/trainingStore';
import type {
  TrainingConfiguration,
  TrainingRunSummary,
  CreateTrainingConfigRequest,
  TrainingRunStatus,
} from '../types';
import './TrainingPage.scss';

// ============= Sub-Components =============

interface StatusBadgeProps {
  status: TrainingRunStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusClass = status.toLowerCase();
  return <span className={`status-badge status-badge--${statusClass}`}>{status}</span>;
};

interface CreateConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (config: CreateTrainingConfigRequest) => Promise<void>;
  isLoading: boolean;
}

const CreateConfigModal: React.FC<CreateConfigModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading,
}) => {
  const [formData, setFormData] = useState<CreateTrainingConfigRequest>({
    name: '',
    workflowId: '',
    iterations: 10,
    parallelIterations: 1,
    delayBetweenIterationsMs: 0,
    optimizationGoal: 'Balanced',
    tags: [],
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        workflowId: '',
        iterations: 10,
        parallelIterations: 1,
        delayBetweenIterationsMs: 0,
        optimizationGoal: 'Balanced',
        tags: [],
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreate(formData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Training Configuration</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Configuration Name *</label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="My Training Config"
            />
          </div>

          <div className="form-group">
            <label htmlFor="workflowId">Workflow ID *</label>
            <input
              id="workflowId"
              type="text"
              required
              value={formData.workflowId}
              onChange={(e) => setFormData((prev) => ({ ...prev, workflowId: e.target.value }))}
              placeholder="workflow-uuid"
            />
          </div>

          <div className="form-group">
            <label htmlFor="iterations">Iterations *</label>
            <input
              id="iterations"
              type="number"
              min={1}
              max={1000}
              required
              value={formData.iterations}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, iterations: parseInt(e.target.value) || 1 }))
              }
            />
            <p className="form-group__help">Number of times to run the workflow</p>
          </div>

          <div className="form-group">
            <label htmlFor="parallelIterations">Parallel Iterations</label>
            <input
              id="parallelIterations"
              type="number"
              min={1}
              max={10}
              value={formData.parallelIterations}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  parallelIterations: parseInt(e.target.value) || 1,
                }))
              }
            />
            <p className="form-group__help">Max concurrent workflow executions</p>
          </div>

          <div className="form-group">
            <label htmlFor="optimizationGoal">Optimization Goal</label>
            <select
              id="optimizationGoal"
              value={formData.optimizationGoal}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  optimizationGoal: e.target.value as 'Quality' | 'Speed' | 'Cost' | 'Balanced',
                }))
              }
            >
              <option value="Balanced">Balanced</option>
              <option value="Quality">Quality</option>
              <option value="Speed">Speed</option>
              <option value="Cost">Cost</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ConfigCardProps {
  config: TrainingConfiguration;
  onStartRun: (configId: string) => void;
  onDelete: (configId: string) => void;
}

const ConfigCard: React.FC<ConfigCardProps> = ({ config, onStartRun, onDelete }) => {
  return (
    <div className="config-card">
      <div className="config-card__header">
        <h3 className="config-card__name">{config.name}</h3>
        <span className={`config-card__goal config-card__goal--${config.optimizationGoal.toLowerCase()}`}>
          {config.optimizationGoal}
        </span>
      </div>
      {config.description && (
        <p className="config-card__description">{config.description}</p>
      )}
      <div className="config-card__details">
        <div className="config-card__detail">
          <span className="config-card__label">Iterations</span>
          <span className="config-card__value">{config.iterations}</span>
        </div>
        <div className="config-card__detail">
          <span className="config-card__label">Parallel</span>
          <span className="config-card__value">{config.parallelIterations}</span>
        </div>
        <div className="config-card__detail">
          <span className="config-card__label">Workflow</span>
          <span className="config-card__value config-card__value--mono">
            {config.workflowId.substring(0, 8)}...
          </span>
        </div>
      </div>
      <div className="config-card__actions">
        <button className="btn-primary" onClick={() => onStartRun(config.id)}>
          Start Training
        </button>
        <button
          className="btn-secondary btn-danger"
          onClick={() => onDelete(config.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

interface RunRowProps {
  run: TrainingRunSummary;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

const RunRow: React.FC<RunRowProps> = ({ run, onPause, onResume, onCancel, onDelete }) => {
  const progress = run.totalIterations > 0
    ? Math.round((run.completedIterations / run.totalIterations) * 100)
    : 0;

  return (
    <div className="run-row">
      <div className="run-row__info">
        <span className="run-row__name">{run.name}</span>
        <StatusBadge status={run.status} />
      </div>
      <div className="run-row__progress">
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="run-row__progress-text">
          {run.completedIterations}/{run.totalIterations}
          {run.failedIterations > 0 && (
            <span className="run-row__failed"> ({run.failedIterations} failed)</span>
          )}
        </span>
      </div>
      <div className="run-row__metrics">
        {run.averageQualityScore !== undefined && (
          <span className="run-row__metric">
            Quality: {run.averageQualityScore.toFixed(1)}
          </span>
        )}
        {run.totalCostUsd !== undefined && (
          <span className="run-row__metric">
            Cost: ${run.totalCostUsd.toFixed(4)}
          </span>
        )}
      </div>
      <div className="run-row__actions">
        {run.status === 'Running' && (
          <button className="btn-icon" onClick={() => onPause(run.id)} title="Pause">
            ||
          </button>
        )}
        {run.status === 'Paused' && (
          <button className="btn-icon" onClick={() => onResume(run.id)} title="Resume">
            &gt;
          </button>
        )}
        {(run.status === 'Running' || run.status === 'Paused') && (
          <button className="btn-icon btn-icon--danger" onClick={() => onCancel(run.id)} title="Cancel">
            x
          </button>
        )}
        {(run.status === 'Completed' || run.status === 'Failed' || run.status === 'Cancelled') && (
          <button className="btn-icon btn-icon--danger" onClick={() => onDelete(run.id)} title="Delete">
            x
          </button>
        )}
      </div>
    </div>
  );
};

// ============= Main Page =============

const TrainingPage: React.FC = () => {
  const configurations = useTrainingStore((s) => s.configurations);
  const runs = useTrainingStore((s) => s.runs);
  const isLoading = useTrainingStore((s) => s.isLoading);
  const error = useTrainingStore((s) => s.error);

  const loadConfigurations = useTrainingStore((s) => s.loadConfigurations);
  const loadRuns = useTrainingStore((s) => s.loadRuns);
  const createConfiguration = useTrainingStore((s) => s.createConfiguration);
  const deleteConfiguration = useTrainingStore((s) => s.deleteConfiguration);
  const startRun = useTrainingStore((s) => s.startRun);
  const pauseRun = useTrainingStore((s) => s.pauseRun);
  const resumeRun = useTrainingStore((s) => s.resumeRun);
  const cancelRun = useTrainingStore((s) => s.cancelRun);
  const deleteRun = useTrainingStore((s) => s.deleteRun);
  const clearError = useTrainingStore((s) => s.clearError);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'configurations' | 'runs'>('configurations');

  useEffect(() => {
    loadConfigurations();
    loadRuns();
  }, [loadConfigurations, loadRuns]);

  const handleCreateConfig = async (config: CreateTrainingConfigRequest) => {
    await createConfiguration(config);
  };

  const handleStartRun = async (configId: string) => {
    await startRun({ configurationId: configId });
    setActiveTab('runs');
  };

  // Stats
  const activeRunsCount = useMemo(() =>
    runs.filter((r) => r.status === 'Running' || r.status === 'Paused').length,
    [runs]
  );

  return (
    <div className="training-page">
      {/* Header */}
      <header className="training-page__header">
        <div className="training-page__title">
          <h1>Training</h1>
          <span className="training-page__count">
            {activeRunsCount > 0 && (
              <span className="training-page__count-active">{activeRunsCount} active</span>
            )}
            <span className="training-page__count-total">
              {configurations.length} configs, {runs.length} runs
            </span>
          </span>
        </div>
        <div className="training-page__actions">
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            + New Configuration
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="training-page__tabs">
        <button
          className={`training-page__tab ${activeTab === 'configurations' ? 'active' : ''}`}
          onClick={() => setActiveTab('configurations')}
        >
          Configurations
          <span className="training-page__tab-count">{configurations.length}</span>
        </button>
        <button
          className={`training-page__tab ${activeTab === 'runs' ? 'active' : ''}`}
          onClick={() => setActiveTab('runs')}
        >
          Training Runs
          <span className="training-page__tab-count">{runs.length}</span>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      {/* Content */}
      <div className="training-page__content">
        {isLoading && configurations.length === 0 && runs.length === 0 ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading training data...</p>
          </div>
        ) : activeTab === 'configurations' ? (
          configurations.length === 0 ? (
            <div className="empty-state">
              <h2>No Training Configurations</h2>
              <p>Create your first training configuration to start optimizing workflows.</p>
              <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                Create Configuration
              </button>
            </div>
          ) : (
            <div className="config-grid">
              {configurations.map((config) => (
                <ConfigCard
                  key={config.id}
                  config={config}
                  onStartRun={handleStartRun}
                  onDelete={deleteConfiguration}
                />
              ))}
            </div>
          )
        ) : runs.length === 0 ? (
          <div className="empty-state">
            <h2>No Training Runs</h2>
            <p>Start a training run from one of your configurations.</p>
          </div>
        ) : (
          <div className="runs-list">
            {runs.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                onPause={pauseRun}
                onResume={resumeRun}
                onCancel={cancelRun}
                onDelete={deleteRun}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateConfigModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateConfig}
        isLoading={isLoading}
      />
    </div>
  );
};

export default TrainingPage;
