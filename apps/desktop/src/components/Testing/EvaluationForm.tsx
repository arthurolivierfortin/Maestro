/**
 * EvaluationForm Component
 * Form for manually evaluating a test iteration
 */

import React, { useState } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import type { BlockTestIteration, EvaluationCriterion, SubmitEvaluationRequest } from '../../types/test.types';
import './EvaluationForm.scss';

interface EvaluationFormProps {
  iteration: BlockTestIteration;
  criteria: EvaluationCriterion[];
  onSubmit: (evaluation: SubmitEvaluationRequest) => Promise<void>;
  isSubmitting?: boolean;
}

export const EvaluationForm: React.FC<EvaluationFormProps> = ({
  iteration,
  criteria,
  onSubmit,
  isSubmitting = false,
}) => {
  const [overallScore, setOverallScore] = useState<number>(70);
  const [explanation, setExplanation] = useState('');
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    criteria.forEach((c) => {
      initial[c.name] = 70;
    });
    return initial;
  });

  const handleCriterionChange = (name: string, score: number) => {
    setCriteriaScores((prev) => ({ ...prev, [name]: score }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const evaluation: SubmitEvaluationRequest = {
      iterationId: iteration.id,
      overallScore,
      explanation: explanation || undefined,
      criteriaScores: criteria.map((c) => ({
        name: c.name,
        score: criteriaScores[c.name] || 70,
      })),
      evaluatorType: 'manual',
      confidence: 1.0,
    };

    await onSubmit(evaluation);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  };

  return (
    <form className="evaluation-form" onSubmit={handleSubmit}>
      <div className="evaluation-form__header">
        <h4>Evaluate Iteration #{iteration.iterationNumber}</h4>
        <span className={`evaluation-form__status ${iteration.success ? 'success' : 'failure'}`}>
          {iteration.success ? 'Executed Successfully' : 'Execution Failed'}
        </span>
      </div>

      {iteration.outputContent && (
        <div className="evaluation-form__output">
          <label>Output:</label>
          <pre>{iteration.outputContent}</pre>
        </div>
      )}

      {iteration.errorMessage && (
        <div className="evaluation-form__error">
          <AlertCircle size={14} />
          <span>{iteration.errorMessage}</span>
        </div>
      )}

      <div className="evaluation-form__overall">
        <label>
          Overall Score
          <span className={`evaluation-form__score-badge evaluation-form__score-badge--${getScoreColor(overallScore)}`}>
            {overallScore}
          </span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={overallScore}
          onChange={(e) => setOverallScore(Number(e.target.value))}
          className="evaluation-form__slider"
        />
        <div className="evaluation-form__slider-labels">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {criteria.length > 0 && (
        <div className="evaluation-form__criteria">
          <label>Criteria Scores</label>
          {criteria.map((criterion) => (
            <div key={criterion.id} className="evaluation-form__criterion">
              <div className="evaluation-form__criterion-header">
                <span className="evaluation-form__criterion-name">
                  {criterion.name}
                  <small>({(criterion.weight * 100).toFixed(0)}%)</small>
                </span>
                <span className={`evaluation-form__score-badge evaluation-form__score-badge--${getScoreColor(criteriaScores[criterion.name] || 70)}`}>
                  {criteriaScores[criterion.name] || 70}
                </span>
              </div>
              {criterion.description && (
                <p className="evaluation-form__criterion-desc">{criterion.description}</p>
              )}
              <input
                type="range"
                min="0"
                max="100"
                value={criteriaScores[criterion.name] || 70}
                onChange={(e) => handleCriterionChange(criterion.name, Number(e.target.value))}
                className="evaluation-form__slider evaluation-form__slider--small"
              />
            </div>
          ))}
        </div>
      )}

      <div className="evaluation-form__explanation">
        <label>Explanation (optional)</label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Add notes about this evaluation..."
          rows={3}
        />
      </div>

      <button
        type="submit"
        className="evaluation-form__submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          'Submitting...'
        ) : (
          <>
            <Send size={14} />
            Submit Evaluation
          </>
        )}
      </button>
    </form>
  );
};

export default EvaluationForm;
