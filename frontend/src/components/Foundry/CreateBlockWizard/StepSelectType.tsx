/**
 * Step 1: Select Block Type
 *
 * Visual type cards for selecting the block type to create.
 */

import React from 'react';
import type { BlockType } from '../../../types/block.types';
import { BlockIcon, blockColorMap } from '../../icons/BlockIcons';
import { WizardStep } from './WizardStep';

export interface StepSelectTypeProps {
  selectedType: BlockType | null;
  onSelectType: (type: BlockType) => void;
}

const BLOCK_TYPES: Array<{
  type: BlockType;
  label: string;
  description: string;
}> = [
  {
    type: 'workflow',
    label: 'Workflow',
    description: 'Top-level orchestration container',
  },
  {
    type: 'agent',
    label: 'Agent',
    description: 'AI agent with model and tools',
  },
  {
    type: 'task',
    label: 'Task',
    description: 'Task with validation rules',
  },
  {
    type: 'prompt',
    label: 'Prompt',
    description: 'Reusable prompt template',
  },
  {
    type: 'instruction',
    label: 'Instruction',
    description: 'Instruction file reference',
  },
  {
    type: 'tool',
    label: 'Tool',
    description: 'Executable script or command',
  },
  {
    type: 'decision',
    label: 'Decision',
    description: 'Conditional branching logic',
  },
  {
    type: 'validator',
    label: 'Validator',
    description: 'Output validation with schema',
  },
  {
    type: 'trigger',
    label: 'Trigger',
    description: 'Workflow execution trigger',
  },
];

export function StepSelectType({ selectedType, onSelectType }: StepSelectTypeProps) {
  return (
    <WizardStep title="Select Block Type" description="Choose the type of block you want to create">
      <div className="type-cards">
        {BLOCK_TYPES.map((blockType) => (
          <button
            key={blockType.type}
            className={`type-card ${selectedType === blockType.type ? 'type-card--selected' : ''}`}
            onClick={() => onSelectType(blockType.type)}
            type="button"
          >
            <div className="type-card__icon">
              <BlockIcon type={blockType.type} size={32} color={blockColorMap[blockType.type]} />
            </div>
            <div className="type-card__content">
              <h4 className="type-card__label">{blockType.label}</h4>
              <p className="type-card__description">{blockType.description}</p>
            </div>
          </button>
        ))}
      </div>
    </WizardStep>
  );
}
