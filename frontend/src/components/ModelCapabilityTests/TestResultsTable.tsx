/**
 * TestResultsTable
 *
 * Detailed table view of all test results with expandable rows.
 */

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Hash,
  MessageSquare,
  Code,
} from 'lucide-react';
import type { TestCategory, TestCategoryResult, TestResult } from '../../types/modelTest.types';

interface TestResultsTableProps {
  categories: Partial<Record<TestCategory, TestCategoryResult>>;
}

const categoryLabels: Record<TestCategory, string> = {
  outputFormat: 'Output Format',
  instructionFollowing: 'Instruction Following',
  contextMemory: 'Context & Memory',
  reasoning: 'Reasoning',
  toolCalling: 'Tool Calling',
  codeGeneration: 'Code Generation',
  creativity: 'Creativity',
  safety: 'Safety',
};

export function TestResultsTable({ categories }: TestResultsTableProps) {
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');

  // Flatten all tests with category info
  const allTests = Object.entries(categories).flatMap(([category, data]) =>
    (data?.tests || []).map((test) => ({
      ...test,
      category: category as TestCategory,
    }))
  );

  // Apply filter
  const filteredTests = allTests.filter((test) => {
    if (filter === 'all') return true;
    if (filter === 'passed') return test.passed;
    return !test.passed;
  });

  const toggleExpand = (testId: string) => {
    setExpandedTest(expandedTest === testId ? null : testId);
  };

  return (
    <div className="test-results-table">
      {/* Filter buttons */}
      <div className="test-results-table__filters">
        <button
          className={`test-results-table__filter ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({allTests.length})
        </button>
        <button
          className={`test-results-table__filter ${filter === 'passed' ? 'active' : ''}`}
          onClick={() => setFilter('passed')}
        >
          <CheckCircle size={14} />
          Passed ({allTests.filter((t) => t.passed).length})
        </button>
        <button
          className={`test-results-table__filter ${filter === 'failed' ? 'active' : ''}`}
          onClick={() => setFilter('failed')}
        >
          <XCircle size={14} />
          Failed ({allTests.filter((t) => !t.passed).length})
        </button>
      </div>

      {/* Table */}
      <div className="test-results-table__container">
        <table className="test-results-table__table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th style={{ width: '60px' }}>ID</th>
              <th>Test Name</th>
              <th style={{ width: '120px' }}>Category</th>
              <th style={{ width: '80px' }}>Score</th>
              <th style={{ width: '80px' }}>Duration</th>
              <th style={{ width: '60px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTests.map((test) => (
              <>
                <tr
                  key={test.testId}
                  className={`test-results-table__row ${test.passed ? 'passed' : 'failed'} ${
                    expandedTest === test.testId ? 'expanded' : ''
                  }`}
                  onClick={() => toggleExpand(test.testId)}
                >
                  <td className="test-results-table__expand">
                    {expandedTest === test.testId ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </td>
                  <td className="test-results-table__id">
                    <code>{test.testId}</code>
                  </td>
                  <td className="test-results-table__name">{test.name}</td>
                  <td className="test-results-table__category">
                    {categoryLabels[test.category] || test.category}
                  </td>
                  <td className="test-results-table__score">
                    {test.score}/{test.maxScore}
                  </td>
                  <td className="test-results-table__duration">
                    <Clock size={12} />
                    {test.response?.durationMs || 0}ms
                  </td>
                  <td className="test-results-table__status">
                    {test.passed ? (
                      <CheckCircle size={16} className="icon-success" />
                    ) : (
                      <XCircle size={16} className="icon-error" />
                    )}
                  </td>
                </tr>
                {expandedTest === test.testId && (
                  <tr className="test-results-table__details-row">
                    <td colSpan={7}>
                      <TestDetailsPanel test={test} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TestDetailsPanelProps {
  test: TestResult & { category: TestCategory };
}

function TestDetailsPanel({ test }: TestDetailsPanelProps) {
  return (
    <div className="test-details-panel">
      {/* Description */}
      {test.description && (
        <div className="test-details-panel__section">
          <h5>Description</h5>
          <p>{test.description}</p>
        </div>
      )}

      {/* Prompts */}
      <div className="test-details-panel__prompts">
        {test.prompt?.system && (
          <div className="test-details-panel__prompt">
            <h5>
              <MessageSquare size={14} /> System Prompt
            </h5>
            <pre>{test.prompt.system}</pre>
          </div>
        )}
        <div className="test-details-panel__prompt">
          <h5>
            <MessageSquare size={14} /> User Prompt
          </h5>
          <pre>{test.prompt?.user}</pre>
        </div>
      </div>

      {/* Response */}
      {test.response && (
        <div className="test-details-panel__section">
          <h5>
            <Code size={14} /> Model Response
            {test.response.truncated && <span className="truncated">(truncated)</span>}
          </h5>
          <pre className="test-details-panel__response">{test.response.raw}</pre>
          <div className="test-details-panel__response-meta">
            <span>
              <Hash size={12} /> {test.response.tokensGenerated} tokens
            </span>
            <span>
              <Clock size={12} /> {test.response.durationMs}ms
            </span>
          </div>
        </div>
      )}

      {/* Evaluation */}
      <div className="test-details-panel__section">
        <h5>Evaluation</h5>
        <div className="test-details-panel__evaluation">
          <span className="eval-method">Method: {test.evaluation?.method}</span>
          <span className={`eval-result ${test.evaluation?.matched ? 'matched' : 'not-matched'}`}>
            {test.evaluation?.matched ? 'Matched' : 'Not Matched'}
          </span>
          {test.evaluation?.partialCredit !== undefined && (
            <span className="eval-credit">
              Partial Credit: {(test.evaluation.partialCredit * 100).toFixed(0)}%
            </span>
          )}
        </div>
        {test.evaluation?.explanation && (
          <p className="test-details-panel__explanation">{test.evaluation.explanation}</p>
        )}
      </div>
    </div>
  );
}
