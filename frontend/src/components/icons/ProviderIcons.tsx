/**
 * Provider Icons Component
 *
 * Displays provider logos/icons for AI models.
 */

import {
  Bot,
  Zap,
  Cloud,
  Server,
  Puzzle,
  Sparkles,
  Brain,
  Cpu,
  Code2,
} from 'lucide-react';
import type { ModelProvider } from '../../types/model.types';

export interface ProviderIconProps {
  provider: ModelProvider;
  size?: number;
  className?: string;
}

/**
 * Provider icon component
 */
export function ProviderIcon({ provider, size = 20, className = '' }: ProviderIconProps) {
  const iconProps = { size, className };

  switch (provider) {
    case 'openai':
      return <Sparkles {...iconProps} style={{ color: '#10a37f' }} />;
    case 'anthropic':
      return <Brain {...iconProps} style={{ color: '#d97706' }} />;
    case 'google':
      return <Cloud {...iconProps} style={{ color: '#4285f4' }} />;
    case 'ollama':
      return <Cpu {...iconProps} style={{ color: '#000000' }} />;
    case 'groq':
      return <Zap {...iconProps} style={{ color: '#f97316' }} />;
    case 'mistral':
      return <Code2 {...iconProps} style={{ color: '#ff7000' }} />;
    case 'azure-openai':
      return <Cloud {...iconProps} style={{ color: '#0078d4' }} />;
    case 'local':
      return <Server {...iconProps} style={{ color: '#6b7280' }} />;
    case 'custom':
      return <Puzzle {...iconProps} style={{ color: '#8b5cf6' }} />;
    default:
      return <Bot {...iconProps} />;
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
    case 'custom':
      return '#8b5cf6';
    default:
      return '#888888';
  }
}
