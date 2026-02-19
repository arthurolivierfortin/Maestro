/**
 * Provider Icons Component
 *
 * Displays provider logos/icons for AI models.
 * Supports status-based styling:
 * - ready: Full color (configured and working)
 * - available: Grayscale (can be auto-setup)
 * - not_configured: Transparent/faded (requires manual setup)
 */

import { Bot, Zap, Cloud, Server, Puzzle, Sparkles, Brain, Cpu, Code2 } from 'lucide-react';
import type { ModelProvider } from '../../types/model.types';

export type ProviderIconStatus = 'ready' | 'available' | 'not_configured' | 'downloading' | 'error';

export interface ProviderIconProps {
  provider: ModelProvider;
  size?: number;
  className?: string;
  /** Status affects color: ready=color, available=grayscale, not_configured=faded */
  status?: ProviderIconStatus;
}

/**
 * Get the style for an icon based on status
 */
function getStatusStyle(status: ProviderIconStatus | undefined, color: string): React.CSSProperties {
  switch (status) {
    case 'ready':
      // Full color - configured and working
      return { color };
    case 'available':
      // Grayscale - can be setup but not yet
      return {
        color: 'currentColor',
        filter: 'grayscale(100%)',
        opacity: 0.8,
      };
    case 'not_configured':
      // Faded/transparent - requires manual setup
      return {
        color: 'currentColor',
        opacity: 0.35,
      };
    case 'downloading':
      // Blue tint while downloading
      return { color: '#3b82f6' };
    case 'error':
      // Red for error
      return { color: '#ef4444' };
    default:
      // Default to full color if no status provided
      return { color };
  }
}

/**
 * Provider icon component
 */
export function ProviderIcon({ provider, size = 20, className = '', status }: ProviderIconProps) {
  const iconProps = { size, className };
  const color = getProviderColor(provider);
  const style = getStatusStyle(status, color);

  switch (provider) {
    case 'openai':
      return <Sparkles {...iconProps} style={style} />;
    case 'anthropic':
      return <Brain {...iconProps} style={style} />;
    case 'google':
      return <Cloud {...iconProps} style={style} />;
    case 'ollama':
      return <Cpu {...iconProps} style={style} />;
    case 'groq':
      return <Zap {...iconProps} style={style} />;
    case 'mistral':
      return <Code2 {...iconProps} style={style} />;
    case 'azure-openai':
      return <Cloud {...iconProps} style={style} />;
    case 'local':
    case 'llm-provider':
      return <Server {...iconProps} style={style} />;
    case 'custom':
      return <Puzzle {...iconProps} style={style} />;
    default:
      return <Bot {...iconProps} style={style} />;
  }
}

/**
 * Get provider display name
 */
export function getProviderName(provider: ModelProvider): string {
  switch (provider) {
    case 'openai':
      return 'OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'google':
      return 'Google AI';
    case 'ollama':
      return 'Ollama';
    case 'groq':
      return 'Groq';
    case 'mistral':
      return 'Mistral';
    case 'azure-openai':
      return 'Azure OpenAI';
    case 'local':
      return 'Local';
    case 'llm-provider':
      return 'LLM Provider';
    case 'custom':
      return 'Custom';
    default:
      return 'Unknown';
  }
}

/**
 * Get provider color
 */
export function getProviderColor(provider: ModelProvider): string {
  switch (provider) {
    case 'openai':
      return '#10a37f';
    case 'anthropic':
      return '#d97706';
    case 'google':
      return '#4285f4';
    case 'ollama':
      return '#000000';
    case 'groq':
      return '#f97316';
    case 'mistral':
      return '#ff7000';
    case 'azure-openai':
      return '#0078d4';
    case 'local':
      return '#6b7280';
    case 'llm-provider':
      return '#22c55e';
    case 'custom':
      return '#8b5cf6';
    default:
      return '#888888';
  }
}
