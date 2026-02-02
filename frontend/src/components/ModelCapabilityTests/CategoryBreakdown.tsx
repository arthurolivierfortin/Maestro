/**
 * CategoryBreakdown
 *
 * Displays test results breakdown by category with expandable details.
 */

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileJson,
  ListChecks,
  Brain,
  History,
  Wrench,
  Code,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { TestCategory, TestCategoryResult } from '../../types/modelTest.types';

interface CategoryBreakdownProps {
  categoryScores: Record<TestCategory, { score: number; maxScore: number; percentage: number }>;
  categories: Partial<Record<TestCategory, TestCategoryResult>>;
}

const categoryIcons: Record<TestCategory, React.ReactNode> = {
  outputFormat: <FileJson size={18} />,
  instructionFollowing: <ListChecks size={18} />,
  contextMemory: <History size={18} />,
  reasoning: <Brain size={18} />,
  toolCalling: <Wrench size={18} />,
  codeGeneration: <Code size={18} />,
  creativity: <Brain size={18} />,
  safety: <CheckCircle size={18} />,
};

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

function getScoreColor(percentage: number): string {
  if (percentage >= 80) return '#22c55e';
  if (percentage >= 60) return '#84cc16';
  if (percentage >= 40) return '#eab308';
  if (percentage >= 20) return '#f97316';
  return '#ef4444';
}

export function CategoryBreakdown({ categoryScores, categories }: CategoryBreakdownProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const sortedCategories = Object.entries(categoryScores)
    .sort(([, a], [, b]) => b.percentage - a.percentage);

  return (
    <div className="category-breakdown">
      <h4 className="category-breakdown__title">Results by Category</h4>

      <div className="category-breakdown__list">
        {sortedCategories.map(([category, scores]) => {
          const categoryData = categories[category as TestCategory];
          const isExpanded = expandedCategories.has(category);
          const color = getScoreColor(scores.percentage);

          return (
            <div
              key={category}
              className={`category-breakdown__item ${isExpanded ? 'expanded' : ''}`}
            >
              {/* Category header */}
              <button
                className="category-breakdown__header"
                onClick={() => toggleCategory(category)}
              >
                <div className="category-breakdown__header-left">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="category-breakdown__icon">
                    {categoryIcons[category as TestCategory]}
                  </span>
                  <span className="category-breakdown__label">
                    {categoryLabels[category as TestCategory] || category}
                  </span>
                </div>
                <div className="category-breakdown__header-right">
                  <div className="category-breakdown__bar">
                    <div
                      className="category-breakdown__bar-fill"
                      style={{ width: `${scores.percentage}%`, backgroundColor: color }}
                    />
                  </div>
                  <span
                    className="category-breakdown__percentage"
                    style={{ color }}
                  >
                    {scores.percentage}%
                  </span>
                  <span className="category-breakdown__score">
                    {scores.score}/{scores.maxScore}
                  </span>
                </div>
              </button>

              {/* Expanded tests */}
              {isExpanded && categoryData?.tests && (
                <div className="category-breakdown__tests">
                  {categoryData.tests.map((test) => (
                    <div
                      key={test.testId}
                      className={`category-breakdown__test ${test.passed ? 'passed' : 'failed'}`}
                    >
                      <div className="category-breakdown__test-status">
                        {test.passed ? (
                          <CheckCircle size={14} className="icon-success" />
                        ) : (
                          <XCircle size={14} className="icon-error" />
                        )}
                      </div>
                      <div className="category-breakdown__test-info">
                        <span className="category-breakdown__test-id">{test.testId}</span>
                        <span className="category-breakdown__test-name">{test.name}</span>
                      </div>
                      <div className="category-breakdown__test-score">
                        {test.score}/{test.maxScore}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
