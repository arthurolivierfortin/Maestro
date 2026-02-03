/**
 * ModelCapabilityTests
 *
 * Main component for displaying comprehensive model capability test results.
 * Shows two main sections:
 * - Provider: Real-time LLM Provider metrics and capabilities
 * - Test Runs: Historical test runs with averages and details
 */

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Play,
  AlertCircle,
  FileText,
  CheckCircle,
  XCircle,
  Server,
  History,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { TestSummaryCard } from './TestSummaryCard';
import { CategoryBreakdown } from './CategoryBreakdown';
import { CapabilitiesCard } from './CapabilitiesCard';
import { RecommendationsPanel } from './RecommendationsPanel';
import { TestResultsTable } from './TestResultsTable';
import type { ModelTestResult } from '../../types/modelTest.types';
import './ModelCapabilityTests.scss';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const LLM_PROVIDER_URL = 'http://localhost:8000';

interface ModelCapabilityTestsProps {
  modelId: string;
  modelDisplayName?: string;
}

interface ProviderMetrics {
  status: 'online' | 'offline' | 'loading';
  currentModel?: string;
  tokensPerSecond?: number;
  gpuInfo?: {
    name: string;
    memory: string;
    utilization?: number;
  };
  capabilities?: {
    streaming: boolean;
    toolCalling: boolean;
    vision: boolean;
  };
}

interface TestRunSummary {
  runId: string;
  timestamp: string;
  preview: {
    'summary.totalScore'?: number;
    'summary.maxScore'?: number;
    'summary.percentage'?: number;
    'summary.classification'?: string;
    'summary.passedTests'?: number;
    'summary.failedTests'?: number;
  };
}

interface TestRunsData {
  modelId: string;
  totalRuns: number;
  averages?: {
    avgScore: number;
    totalRuns: number;
    classificationDistribution: Record<string, number>;
  };
  runs: TestRunSummary[];
}

export function ModelCapabilityTests({ modelId, modelDisplayName }: ModelCapabilityTestsProps) {
  // Main tab state
  const [mainTab, setMainTab] = useState<'provider' | 'runs'>('provider');

  // Provider state
  const [providerMetrics, setProviderMetrics] = useState<ProviderMetrics>({ status: 'loading' });

  // Test runs state
  const [testRunsData, setTestRunsData] = useState<TestRunsData | null>(null);
  const [selectedRun, setSelectedRun] = useState<ModelTestResult | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  // Common state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'recommendations'>('overview');

  // Fetch provider metrics
  useEffect(() => {
    fetchProviderMetrics();
  }, []);

  // Fetch test runs
  useEffect(() => {
    fetchTestRuns();
  }, [modelId]);

  const fetchProviderMetrics = async () => {
    try {
      const response = await fetch(`${LLM_PROVIDER_URL}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        setProviderMetrics({
          status: 'online',
          currentModel: data.current_model,
          tokensPerSecond: data.performance?.tokens_per_second,
          gpuInfo: data.gpu_info ? {
            name: data.gpu_info.name,
            memory: `${Math.round(data.gpu_info.total_memory / 1024 / 1024 / 1024)}GB`,
            utilization: data.gpu_info.utilization,
          } : undefined,
          capabilities: {
            streaming: true,
            toolCalling: data.capabilities?.tool_calling ?? false,
            vision: data.capabilities?.vision ?? false,
          },
        });
      } else {
        setProviderMetrics({ status: 'offline' });
      }
    } catch {
      setProviderMetrics({ status: 'offline' });
    }
  };

  const fetchTestRuns = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const documentId = modelId.replace(/\//g, '-').toLowerCase();
      const response = await fetch(
        `${API_BASE}/api/knowledge-base/models/${documentId}/runs`
      );

      if (response.ok) {
        const data = await response.json();
        setTestRunsData(data as TestRunsData);
      } else if (response.status === 404) {
        setTestRunsData({ modelId, totalRuns: 0, runs: [] });
      } else {
        throw new Error(`Failed to fetch test runs: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error fetching test runs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load test runs');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRunDetails = async (runId: string) => {
    try {
      const documentId = modelId.replace(/\//g, '-').toLowerCase();
      const response = await fetch(
        `${API_BASE}/api/knowledge-base/models/${documentId}/runs/${runId}`
      );
      if (response.ok) {
        const envelope = await response.json();
        setSelectedRun(envelope.document as ModelTestResult);
        setExpandedRunId(runId);
      }
    } catch (err) {
      console.error('Error fetching run details:', err);
    }
  };

  const handleRunClick = (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      setSelectedRun(null);
    } else {
      fetchRunDetails(runId);
    }
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    setError(null);

    try {
      // Execute the model-capability-tester system block via the API
      const response = await fetch(`${API_BASE}/api/blocks/model-capability-tester/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: {
            modelId: modelId,
            categories: 'all',
            includeAnalysis: true
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Test execution result:', result);
        // Refresh test runs after successful execution
        await fetchTestRuns();
      } else if (response.status === 404) {
        // Fallback to CLI instructions if block execution endpoint not available
        alert(
          `Block execution endpoint not available.\n\n` +
          `To run capability tests for ${modelDisplayName || modelId}, use the CLI:\n\n` +
          `powershell -File blocks/scripts/model-testing/test-model-capabilities.ps1 -ModelId "${modelId}"`
        );
      } else {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to execute tests');
      }
    } catch (err) {
      // Check if it's a network error (endpoint doesn't exist)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        alert(
          `Backend not available.\n\n` +
          `To run capability tests for ${modelDisplayName || modelId}, use the CLI:\n\n` +
          `powershell -File blocks/scripts/model-testing/test-model-capabilities.ps1 -ModelId "${modelId}"`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Failed to run tests');
      }
    } finally {
      setIsRunningTests(false);
    }
  };

  // Render Provider Tab content
  const renderProviderTab = () => (
    <div className="model-capability-tests__provider">
      <div className="model-capability-tests__provider-status">
        <div className={`provider-status-badge provider-status-badge--${providerMetrics.status}`}>
          <Server size={16} />
          <span>{providerMetrics.status === 'online' ? 'LLM Provider Online' : providerMetrics.status === 'loading' ? 'Checking...' : 'LLM Provider Offline'}</span>
        </div>
        <button className="model-capability-tests__refresh-btn" onClick={fetchProviderMetrics}>
          <RefreshCw size={14} />
        </button>
      </div>

      {providerMetrics.status === 'online' && (
        <>
          <div className="model-capability-tests__provider-grid">
            {providerMetrics.currentModel && (
              <div className="provider-metric-card">
                <span className="provider-metric-label">Current Model</span>
                <span className="provider-metric-value">{providerMetrics.currentModel}</span>
              </div>
            )}
            {providerMetrics.tokensPerSecond && (
              <div className="provider-metric-card">
                <span className="provider-metric-label">Speed</span>
                <span className="provider-metric-value">{providerMetrics.tokensPerSecond} tok/s</span>
              </div>
            )}
            {providerMetrics.gpuInfo && (
              <div className="provider-metric-card">
                <span className="provider-metric-label">GPU</span>
                <span className="provider-metric-value">{providerMetrics.gpuInfo.name}</span>
                <span className="provider-metric-sub">{providerMetrics.gpuInfo.memory} VRAM</span>
              </div>
            )}
          </div>

          {providerMetrics.capabilities && (
            <div className="model-capability-tests__provider-caps">
              <h4>Provider Capabilities</h4>
              <div className="provider-caps-list">
                <div className={`provider-cap ${providerMetrics.capabilities.streaming ? 'enabled' : 'disabled'}`}>
                  {providerMetrics.capabilities.streaming ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  <span>Streaming</span>
                </div>
                <div className={`provider-cap ${providerMetrics.capabilities.toolCalling ? 'enabled' : 'disabled'}`}>
                  {providerMetrics.capabilities.toolCalling ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  <span>Tool Calling</span>
                </div>
                <div className={`provider-cap ${providerMetrics.capabilities.vision ? 'enabled' : 'disabled'}`}>
                  {providerMetrics.capabilities.vision ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  <span>Vision</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {providerMetrics.status === 'offline' && (
        <div className="model-capability-tests__provider-offline">
          <AlertCircle size={32} />
          <p>LLM Provider is not running</p>
          <span>Start the provider to see real-time metrics</span>
        </div>
      )}
    </div>
  );

  // Render Test Runs Tab content
  const renderTestRunsTab = () => {
    if (isLoading) {
      return (
        <div className="model-capability-tests--loading">
          <RefreshCw className="spinning" size={24} />
          <span>Loading test runs...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="model-capability-tests--error">
          <AlertCircle size={24} />
          <span>{error}</span>
          <button onClick={fetchTestRuns}>Retry</button>
        </div>
      );
    }

    if (!testRunsData || testRunsData.totalRuns === 0) {
      return (
        <div className="model-capability-tests--empty">
          <FileText size={48} />
          <h3>No Test Runs Available</h3>
          <p>This model hasn't been tested yet.</p>
          <button
            className="model-capability-tests__run-btn"
            onClick={handleRunTests}
            disabled={isRunningTests}
          >
            {isRunningTests ? (
              <>
                <RefreshCw className="spinning" size={16} />
                Running Tests...
              </>
            ) : (
              <>
                <Play size={16} />
                Run Capability Tests
              </>
            )}
          </button>
        </div>
      );
    }

    return (
      <div className="model-capability-tests__runs">
        {/* Averages summary */}
        {testRunsData.averages && (
          <div className="model-capability-tests__averages">
            <h4>Average Across {testRunsData.averages.totalRuns} Runs</h4>
            <div className="averages-grid">
              <div className="average-stat">
                <span className="average-value">{Math.round(testRunsData.averages.avgScore)}</span>
                <span className="average-label">Avg Score</span>
              </div>
              {Object.entries(testRunsData.averages.classificationDistribution).map(([classification, count]) => (
                <div key={classification} className="average-stat">
                  <span className="average-value">{count}</span>
                  <span className="average-label">{classification}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Run tests button */}
        <div className="model-capability-tests__runs-actions">
          <button
            className="model-capability-tests__run-btn"
            onClick={handleRunTests}
            disabled={isRunningTests}
          >
            {isRunningTests ? (
              <>
                <RefreshCw className="spinning" size={16} />
                Running...
              </>
            ) : (
              <>
                <Play size={16} />
                Run New Test
              </>
            )}
          </button>
          <button className="model-capability-tests__refresh-btn" onClick={fetchTestRuns}>
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Runs list */}
        <div className="model-capability-tests__runs-list">
          {testRunsData.runs.map((run) => (
            <div key={run.runId} className="run-item">
              <button
                className={`run-item__header ${expandedRunId === run.runId ? 'expanded' : ''}`}
                onClick={() => handleRunClick(run.runId)}
              >
                <div className="run-item__expand">
                  {expandedRunId === run.runId ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                <div className="run-item__info">
                  <span className="run-item__date">
                    <Clock size={14} />
                    {new Date(run.timestamp).toLocaleString()}
                  </span>
                  <span className={`run-item__classification classification--${run.preview['summary.classification']?.toLowerCase()}`}>
                    {run.preview['summary.classification']}
                  </span>
                </div>
                <div className="run-item__score">
                  <span className="run-item__score-value">
                    {run.preview['summary.totalScore']}/{run.preview['summary.maxScore']}
                  </span>
                  <span className="run-item__score-pct">
                    ({run.preview['summary.percentage']}%)
                  </span>
                </div>
                <div className="run-item__stats">
                  <span className="run-item__passed">
                    <CheckCircle size={12} /> {run.preview['summary.passedTests']}
                  </span>
                  <span className="run-item__failed">
                    <XCircle size={12} /> {run.preview['summary.failedTests']}
                  </span>
                </div>
              </button>

              {/* Expanded run details */}
              {expandedRunId === run.runId && selectedRun && (
                <div className="run-item__details">
                  {/* Sub-tabs for the run details */}
                  <div className="model-capability-tests__tabs model-capability-tests__tabs--sub">
                    <button
                      className={`model-capability-tests__tab ${activeTab === 'overview' ? 'active' : ''}`}
                      onClick={() => setActiveTab('overview')}
                    >
                      Overview
                    </button>
                    <button
                      className={`model-capability-tests__tab ${activeTab === 'details' ? 'active' : ''}`}
                      onClick={() => setActiveTab('details')}
                    >
                      Test Details
                    </button>
                    <button
                      className={`model-capability-tests__tab ${activeTab === 'recommendations' ? 'active' : ''}`}
                      onClick={() => setActiveTab('recommendations')}
                    >
                      Recommendations
                    </button>
                  </div>

                  <div className="model-capability-tests__content">
                    {activeTab === 'overview' && (
                      <div className="model-capability-tests__overview">
                        <div className="model-capability-tests__overview-grid">
                          <TestSummaryCard summary={selectedRun.summary} />
                          <CapabilitiesCard capabilities={selectedRun.capabilities} />
                        </div>
                        <CategoryBreakdown
                          categoryScores={selectedRun.summary.categoryScores}
                          categories={selectedRun.categories}
                        />
                      </div>
                    )}

                    {activeTab === 'details' && (
                      <TestResultsTable categories={selectedRun.categories} />
                    )}

                    {activeTab === 'recommendations' && (
                      <RecommendationsPanel
                        recommendations={selectedRun.recommendations}
                        qualitativeAnalysis={selectedRun.qualitativeAnalysis}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="model-capability-tests">
      {/* Main tabs: Provider vs Test Runs */}
      <div className="model-capability-tests__main-tabs">
        <button
          className={`model-capability-tests__main-tab ${mainTab === 'provider' ? 'active' : ''}`}
          onClick={() => setMainTab('provider')}
        >
          <Server size={16} />
          Provider
        </button>
        <button
          className={`model-capability-tests__main-tab ${mainTab === 'runs' ? 'active' : ''}`}
          onClick={() => setMainTab('runs')}
        >
          <History size={16} />
          Test Runs
          {testRunsData && testRunsData.totalRuns > 0 && (
            <span className="tab-badge">{testRunsData.totalRuns}</span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {mainTab === 'provider' ? renderProviderTab() : renderTestRunsTab()}
    </div>
  );
}

export default ModelCapabilityTests;
