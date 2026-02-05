/**
 * Editor Registry
 *
 * Maps block types to their corresponding editor components.
 * Used by BlockEditPage to render the appropriate editor.
 * Note: AgentEditor removed (use AgentFoundry Agents instead)
 * Note: ToolEditor renamed to CommandEditor
 */

import { ComponentType } from 'react';
import { CommandEditor } from './CommandEditor';
import { PromptEditor } from './PromptEditor';
import { InstructionEditor } from './InstructionEditor';
import { TaskEditor } from './TaskEditor';
import { TriggerEditor } from './TriggerEditor';
import { ValidatorEditor } from './ValidatorEditor';
import { DecisionEditor } from './DecisionEditor';
import { InferenceEditor } from './InferenceEditor';
import { ScriptEditor } from './ScriptEditor';
import type { Block, BlockType } from '../../types/block.types';

export interface BlockEditorProps {
  block: Block;
}

/**
 * Registry mapping block types to editor components
 */
export const EditorRegistry: Record<BlockType, ComponentType<BlockEditorProps> | null> = {
  command: CommandEditor as ComponentType<BlockEditorProps>,
  prompt: PromptEditor as ComponentType<BlockEditorProps>,
  instruction: InstructionEditor as ComponentType<BlockEditorProps>,
  task: TaskEditor as ComponentType<BlockEditorProps>,
  trigger: TriggerEditor as ComponentType<BlockEditorProps>,
  validator: ValidatorEditor as ComponentType<BlockEditorProps>,
  decision: DecisionEditor as ComponentType<BlockEditorProps>,
  inference: InferenceEditor as ComponentType<BlockEditorProps>,
  script: ScriptEditor as ComponentType<BlockEditorProps>,
  workflow: null, // Workflows use Canvas editor, not a form editor
  agent: null, // Agents use Canvas editor, not a form editor
  tool: null, // Tools use Canvas editor, not a form editor
  context: null, // Context blocks configured via JSON block definition
};

/**
 * Get editor component for a given block type
 */
export function getEditorForBlockType(
  blockType: BlockType
): ComponentType<BlockEditorProps> | null {
  return EditorRegistry[blockType];
}

/**
 * Check if a block type has a dedicated editor
 */
export function hasEditor(blockType: BlockType): boolean {
  return EditorRegistry[blockType] !== null;
}
