/**
 * RecommendationsPanel
 *
 * Displays recommendations, strengths, weaknesses, and quirks.
 */

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Settings,
  ThumbsUp,
  ThumbsDown,
  Info,
  Zap,
} from 'lucide-react';
import type {
  TestRecommendations,
  QualitativeAnalysis,
  MaestroCompatibility,
} from '../../types/modelTest.types';

interface RecommendationsPanelProps {
  recommendations?: TestRecommendations;
  qualitativeAnalysis?: QualitativeAnalysis;
}

const compatibilityColors: Record<MaestroCompatibility, string> = {
  Excellent: '#22c55e',
  Good: '#84cc16',
  Limited: '#eab308',
  NotRecommended: '#ef4444',
};

export function RecommendationsPanel({
  recommendations,
  qualitativeAnalysis,
}: RecommendationsPanelProps) {
  if (!recommendations && !qualitativeAnalysis) {
    return (
      <div className="recommendations-panel recommendations-panel--empty">
        <Info size={48} />
        <h3>No Analysis Available</h3>
        <p>Run tests with the analysis option enabled to see recommendations.</p>
      </div>
    );
  }

  return (
    <div className="recommendations-panel">
      {/* Overall Assessment */}
      {qualitativeAnalysis?.overallAssessment && (
        <div className="recommendations-panel__section recommendations-panel__assessment">
          <div className="recommendations-panel__section-header">
            <Zap size={20} />
            <h4>Overall Assessment</h4>
          </div>
          <p>{qualitativeAnalysis.overallAssessment}</p>
        </div>
      )}

      {/* Maestro Compatibility */}
      {recommendations?.maestroCompatibility && (
        <div className="recommendations-panel__section">
          <div className="recommendations-panel__section-header">
            <Settings size={20} />
            <h4>Maestro Compatibility</h4>
          </div>
          <div className="recommendations-panel__compatibility">
            {Object.entries(recommendations.maestroCompatibility).map(([usage, rating]) => (
              <div key={usage} className="recommendations-panel__compat-item">
                <span className="compat-label">
                  {usage === 'forAgents'
                    ? 'For Agents'
                    : usage === 'forInference'
                    ? 'For Inference'
                    : 'For Evaluation'}
                </span>
                <span
                  className="compat-rating"
                  style={{ backgroundColor: compatibilityColors[rating as MaestroCompatibility] }}
                >
                  {rating}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="recommendations-panel__two-col">
        {/* Strengths */}
        {qualitativeAnalysis?.strengths && qualitativeAnalysis.strengths.length > 0 && (
          <div className="recommendations-panel__section recommendations-panel__strengths">
            <div className="recommendations-panel__section-header">
              <ThumbsUp size={20} className="icon-success" />
              <h4>Strengths</h4>
            </div>
            <ul>
              {qualitativeAnalysis.strengths.map((strength, i) => (
                <li key={i}>
                  <strong>{strength.area}</strong>
                  <p>{strength.description}</p>
                  {strength.evidence && (
                    <span className="evidence">Evidence: {strength.evidence}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {qualitativeAnalysis?.weaknesses && qualitativeAnalysis.weaknesses.length > 0 && (
          <div className="recommendations-panel__section recommendations-panel__weaknesses">
            <div className="recommendations-panel__section-header">
              <ThumbsDown size={20} className="icon-error" />
              <h4>Weaknesses</h4>
            </div>
            <ul>
              {qualitativeAnalysis.weaknesses.map((weakness, i) => (
                <li key={i} className={`severity-${weakness.severity}`}>
                  <div className="weakness-header">
                    <strong>{weakness.area}</strong>
                    <span className={`severity severity--${weakness.severity}`}>
                      {weakness.severity}
                    </span>
                  </div>
                  <p>{weakness.description}</p>
                  {weakness.evidence && (
                    <span className="evidence">Evidence: {weakness.evidence}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Quirks & Workarounds */}
      {qualitativeAnalysis?.quirks && qualitativeAnalysis.quirks.length > 0 && (
        <div className="recommendations-panel__section">
          <div className="recommendations-panel__section-header">
            <AlertTriangle size={20} className="icon-warning" />
            <h4>Quirks & Workarounds</h4>
          </div>
          <div className="recommendations-panel__quirks">
            {qualitativeAnalysis.quirks.map((quirk, i) => (
              <div key={i} className="recommendations-panel__quirk">
                <div className="quirk-behavior">
                  <Info size={14} />
                  <span>{quirk.behavior}</span>
                </div>
                {quirk.workaround && (
                  <div className="quirk-workaround">
                    <Lightbulb size={14} />
                    <span>{quirk.workaround}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Use Cases */}
      <div className="recommendations-panel__two-col">
        {/* Best Use Cases */}
        {recommendations?.bestUseCases && recommendations.bestUseCases.length > 0 && (
          <div className="recommendations-panel__section">
            <div className="recommendations-panel__section-header">
              <CheckCircle size={20} className="icon-success" />
              <h4>Best For</h4>
            </div>
            <ul className="recommendations-panel__list recommendations-panel__list--success">
              {recommendations.bestUseCases.map((useCase, i) => (
                <li key={i}>{useCase}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Avoid For */}
        {recommendations?.avoidFor && recommendations.avoidFor.length > 0 && (
          <div className="recommendations-panel__section">
            <div className="recommendations-panel__section-header">
              <XCircle size={20} className="icon-error" />
              <h4>Avoid For</h4>
            </div>
            <ul className="recommendations-panel__list recommendations-panel__list--error">
              {recommendations.avoidFor.map((avoid, i) => (
                <li key={i}>{avoid}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Suggested Configuration */}
      {recommendations?.suggestedConfig && (
        <div className="recommendations-panel__section">
          <div className="recommendations-panel__section-header">
            <Settings size={20} />
            <h4>Suggested Configuration</h4>
          </div>
          <div className="recommendations-panel__config">
            <div className="config-grid">
              {recommendations.suggestedConfig.temperature !== undefined && (
                <div className="config-item">
                  <span className="config-label">Temperature</span>
                  <code>{recommendations.suggestedConfig.temperature}</code>
                </div>
              )}
              {recommendations.suggestedConfig.maxTokens !== undefined && (
                <div className="config-item">
                  <span className="config-label">Max Tokens</span>
                  <code>{recommendations.suggestedConfig.maxTokens}</code>
                </div>
              )}
              {recommendations.suggestedConfig.topP !== undefined && (
                <div className="config-item">
                  <span className="config-label">Top P</span>
                  <code>{recommendations.suggestedConfig.topP}</code>
                </div>
              )}
            </div>
            {recommendations.suggestedConfig.systemPromptTips &&
              recommendations.suggestedConfig.systemPromptTips.length > 0 && (
                <div className="config-tips">
                  <h5>
                    <Lightbulb size={14} /> System Prompt Tips
                  </h5>
                  <ul>
                    {recommendations.suggestedConfig.systemPromptTips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
