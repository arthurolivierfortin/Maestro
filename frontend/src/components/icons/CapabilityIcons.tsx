/**
 * Capability Icons Component
 *
 * Displays icons for model capabilities.
 */

import {
  Code,
  Eye,
  Wrench,
  FileText,
  Zap,
  Brain,
  Pencil,
  Search,
  Languages,
  FileCode,
  Bug,
  GitBranch,
  Database,
  FileJson,
  Gauge,
} from 'lucide-react';
import type { ModelCapability } from '../../types/model.types';

export interface CapabilityIconProps {
  capability: ModelCapability;
  size?: number;
  className?: string;
}

/**
 * Capability icon component
 */
export function CapabilityIcon({ capability, size = 16, className = '' }: CapabilityIconProps) {
  const iconProps = { size, className };

  switch (capability) {
    case 'code-generation':
      return <Code {...iconProps} />;
    case 'code-review':
      return <FileCode {...iconProps} />;
    case 'code-debugging':
      return <Bug {...iconProps} />;
    case 'reasoning':
      return <Brain {...iconProps} />;
    case 'planning':
      return <GitBranch {...iconProps} />;
    case 'summarization':
      return <FileText {...iconProps} />;
    case 'analysis':
      return <Search {...iconProps} />;
    case 'creative-writing':
      return <Pencil {...iconProps} />;
    case 'translation':
      return <Languages {...iconProps} />;
    case 'vision':
      return <Eye {...iconProps} />;
    case 'tool-use':
      return <Wrench {...iconProps} />;
    case 'function-calling':
      return <Wrench {...iconProps} />;
    case 'structured-output':
      return <FileJson {...iconProps} />;
    case 'long-context':
      return <Database {...iconProps} />;
    case 'fast-inference':
      return <Gauge {...iconProps} />;
    default:
      return <Zap {...iconProps} />;
  }
}

/**
 * Get capability display name
 */
export function getCapabilityName(capability: ModelCapability): string {
  switch (capability) {
    case 'code-generation':
      return 'Code Generation';
    case 'code-review':
      return 'Code Review';
    case 'code-debugging':
      return 'Debugging';
    case 'reasoning':
      return 'Reasoning';
    case 'planning':
      return 'Planning';
    case 'summarization':
      return 'Summarization';
    case 'analysis':
      return 'Analysis';
    case 'creative-writing':
      return 'Creative Writing';
    case 'translation':
      return 'Translation';
    case 'vision':
      return 'Vision';
    case 'tool-use':
      return 'Tool Use';
    case 'function-calling':
      return 'Function Calling';
    case 'structured-output':
      return 'Structured Output';
    case 'long-context':
      return 'Long Context';
    case 'fast-inference':
      return 'Fast Inference';
    default:
      return capability;
  }
}

/**
 * Get short capability label for badges
 */
export function getCapabilityShortName(capability: ModelCapability): string {
  switch (capability) {
    case 'code-generation':
      return 'Code';
    case 'code-review':
      return 'Review';
    case 'code-debugging':
      return 'Debug';
    case 'reasoning':
      return 'Reason';
    case 'planning':
      return 'Plan';
    case 'summarization':
      return 'Summary';
    case 'analysis':
      return 'Analyze';
    case 'creative-writing':
      return 'Creative';
    case 'translation':
      return 'Translate';
    case 'vision':
      return 'Vision';
    case 'tool-use':
      return 'Tools';
    case 'function-calling':
      return 'Functions';
    case 'structured-output':
      return 'Structured';
    case 'long-context':
      return 'Long';
    case 'fast-inference':
      return 'Fast';
    default:
      return capability;
  }
}
