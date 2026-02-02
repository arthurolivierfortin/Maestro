/**
 * CapabilitiesCard
 *
 * Displays model capabilities assessment with visual indicators.
 */

import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Wrench,
  FileJson,
  MessageSquare,
  Brain,
  Code,
  ListChecks,
} from 'lucide-react';
import type { ModelCapabilities, CapabilityQuality } from '../../types/modelTest.types';

interface CapabilitiesCardProps {
  capabilities: ModelCapabilities;
}

const capabilityLabels: Record<keyof ModelCapabilities, { label: string; icon: React.ReactNode }> = {
  toolCalling: { label: 'Tool Calling', icon: <Wrench size={16} /> },
  jsonOutput: { label: 'JSON Output', icon: <FileJson size={16} /> },
  codeGeneration: { label: 'Code Generation', icon: <Code size={16} /> },
  reasoning: { label: 'Reasoning', icon: <Brain size={16} /> },
  multiTurn: { label: 'Multi-turn', icon: <MessageSquare size={16} /> },
  systemPromptAdherence: { label: 'System Prompt', icon: <ListChecks size={16} /> },
};

const qualityColors: Record<CapabilityQuality, string> = {
  excellent: '#22c55e',
  good: '#84cc16',
  partial: '#eab308',
  poor: '#f97316',
  none: '#ef4444',
};

const qualityIcons: Record<CapabilityQuality, React.ReactNode> = {
  excellent: <CheckCircle size={14} />,
  good: <CheckCircle size={14} />,
  partial: <AlertCircle size={14} />,
  poor: <XCircle size={14} />,
  none: <XCircle size={14} />,
};

export function CapabilitiesCard({ capabilities }: CapabilitiesCardProps) {
  const capabilityEntries = Object.entries(capabilities) as [
    keyof ModelCapabilities,
    ModelCapabilities[keyof ModelCapabilities]
  ][];

  return (
    <div className="capabilities-card">
      <div className="capabilities-card__header">
        <Brain size={20} />
        <h4>Capabilities</h4>
      </div>

      <div className="capabilities-card__list">
        {capabilityEntries.map(([key, assessment]) => {
          const { label, icon } = capabilityLabels[key] || { label: key, icon: null };
          const quality = assessment.quality;
          const color = qualityColors[quality];

          return (
            <div key={key} className="capabilities-card__item">
              <div className="capabilities-card__item-icon">{icon}</div>
              <div className="capabilities-card__item-info">
                <span className="capabilities-card__item-label">{label}</span>
                <div className="capabilities-card__item-bar">
                  <div
                    className="capabilities-card__item-fill"
                    style={{
                      width: `${assessment.confidence * 100}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
              <div
                className="capabilities-card__item-quality"
                style={{ color }}
                title={assessment.notes}
              >
                {qualityIcons[quality]}
                <span>{quality}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
