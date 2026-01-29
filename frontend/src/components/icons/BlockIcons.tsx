/**
 * Block Icons Component
 *
 * Renders icons for block types using Lucide React.
 */

import {
  Workflow,
  ListChecks,
  MessageSquare,
  FileText,
  Terminal,
  GitBranch,
  ShieldCheck,
  Zap,
  Brain,
  Code,
  Bot,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { BlockType } from '../../types/block.types';

/**
 * Icon mapping for block types
 */
const iconMap: Record<BlockType, LucideIcon> = {
  workflow: Workflow,
  task: ListChecks,
  agent: Bot,
  tool: Wrench,
  prompt: MessageSquare,
  instruction: FileText,
  command: Terminal,
  decision: GitBranch,
  validator: ShieldCheck,
  trigger: Zap,
  inference: Brain,
  script: Code,
};

/**
 * Color mapping for block types
 */
export const blockColorMap: Record<BlockType, string> = {
  workflow: '#2563eb',
  task: '#10b981',
  agent: '#7c3aed',
  tool: '#0891b2',
  prompt: '#f59e0b',
  instruction: '#f97316',
  command: '#6b7280',
  decision: '#06b6d4',
  validator: '#ec4899',
  trigger: '#ef4444',
  inference: '#8b5cf6',
  script: '#f43f5e',
};

interface BlockIconProps {
  type: BlockType;
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Block Icon Component
 */
export function BlockIcon({ type, size = 16, color, className = '' }: BlockIconProps) {
  const Icon = iconMap[type];
  const iconColor = color || blockColorMap[type];

  if (!Icon) {
    return null;
  }

  return <Icon size={size} color={iconColor} className={className} />;
}

/**
 * Get icon component for a block type
 */
export function getBlockIcon(type: BlockType): LucideIcon {
  return iconMap[type];
}
