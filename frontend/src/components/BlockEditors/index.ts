/**
 * Block Editors Index
 *
 * Barrel export for all block editor components.
 * Note: AgentEditor removed (use AgentFoundry Agents instead)
 * Note: ToolEditor renamed to CommandEditor
 */

export { BaseBlockEditor } from './BaseBlockEditor';
export { CommandEditor, ToolEditor } from './CommandEditor'; // ToolEditor is deprecated alias
export { PromptEditor } from './PromptEditor';
export { InstructionEditor } from './InstructionEditor';
export { TaskEditor } from './TaskEditor';
export { TriggerEditor } from './TriggerEditor';
export { ValidatorEditor } from './ValidatorEditor';
export { DecisionEditor } from './DecisionEditor';
export { InferenceEditor } from './InferenceEditor';
export { ScriptEditor } from './ScriptEditor';
export { EditorRegistry, getEditorForBlockType, hasEditor } from './EditorRegistry';

export type { BaseBlockEditorProps } from './BaseBlockEditor';
export type { BlockEditorProps } from './EditorRegistry';
