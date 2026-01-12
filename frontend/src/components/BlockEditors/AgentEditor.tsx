/**
 * Agent Editor
 *
 * Type-specific editor for agent blocks.
 * Includes model selector, system prompt, tools, temperature, and max tokens.
 */

import { useState, useEffect, useCallback } from 'react';
import { BaseBlockEditor } from './BaseBlockEditor';
import { ModelSelector } from '../ModelSelector';
import type { Block, AgentBlockConfig } from '../../types/block.types';
import { useBlockStore } from '../../store';

export interface AgentEditorProps {
  block: Block<AgentBlockConfig>;
}

export function AgentEditor({ block }: AgentEditorProps) {
  const { updateBlock } = useBlockStore();
  const [config, setConfig] = useState<AgentBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(config) !== JSON.stringify(block.config);
    setHasUnsavedChanges(changed);
  }, [config, block.config]);

  const handleSave = useCallback(
    (updatedConfig: AgentBlockConfig) => {
      updateBlock(block.id, { config: updatedConfig });
    },
    [block.id, updateBlock]
  );

  const handleFieldChange = useCallback(
    (field: keyof AgentBlockConfig, value: unknown) => {
      setConfig((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  return (
    <BaseBlockEditor
      block={block}
      onSave={() => handleSave(config)}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      {/* Agent Type */}
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Agent Configuration</h2>
        <p className="base-block-editor__section-description">
          Configure the agent's type, model, and behavior settings.
        </p>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="agentType">
            Agent Type
          </label>
          <select
            id="agentType"
            className="base-block-editor__select"
            value={config.agentType}
            onChange={(e) => handleFieldChange('agentType', e.target.value)}
          >
            <option value="Planner">Planner</option>
            <option value="Coder">Coder</option>
            <option value="Tester">Tester</option>
            <option value="Reviewer">Reviewer</option>
            <option value="Debugger">Debugger</option>
            <option value="Custom">Custom</option>
          </select>
          <p className="base-block-editor__help-text">
            The type of agent determines its primary function and capabilities.
          </p>
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="modelId">
            Model
          </label>
          <ModelSelector
            value={config.modelId || ''}
            onChange={(modelId) => handleFieldChange('modelId', modelId)}
            onlyAvailable={true}
            placeholder="Select a model..."
          />
          <p className="base-block-editor__help-text">
            The AI model this agent will use for inference.
          </p>
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="fallbackModelId">
            Fallback Model (Optional)
          </label>
          <ModelSelector
            value={config.fallbackModelId || ''}
            onChange={(modelId) => handleFieldChange('fallbackModelId', modelId || undefined)}
            onlyAvailable={true}
            placeholder="Select a fallback model..."
          />
          <p className="base-block-editor__help-text">
            Fallback model to use if the primary model is unavailable.
          </p>
        </div>
      </div>

      {/* System Prompt */}
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">System Prompt</h2>
        <p className="base-block-editor__section-description">
          Define the agent's behavior, role, and instructions.
        </p>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="systemPrompt">
            System Prompt
          </label>
          <textarea
            id="systemPrompt"
            className="base-block-editor__textarea"
            value={config.systemPrompt || ''}
            onChange={(e) => handleFieldChange('systemPrompt', e.target.value)}
            placeholder="Enter system prompt instructions..."
            rows={10}
          />
          <p className="base-block-editor__help-text">
            The system prompt defines the agent's personality, expertise, and behavioral guidelines.
          </p>
        </div>
      </div>

      {/* Model Parameters */}
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Model Parameters</h2>
        <p className="base-block-editor__section-description">
          Fine-tune the model's output behavior with temperature and token limits.
        </p>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="temperature">
            Temperature: {config.temperature ?? 0.7}
          </label>
          <input
            id="temperature"
            type="range"
            className="base-block-editor__input"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature ?? 0.7}
            onChange={(e) => handleFieldChange('temperature', parseFloat(e.target.value))}
          />
          <p className="base-block-editor__help-text">
            Controls randomness: 0 = deterministic, 2 = very creative. Default: 0.7
          </p>
        </div>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="maxTokens">
            Max Tokens
          </label>
          <input
            id="maxTokens"
            type="number"
            className="base-block-editor__input"
            min="1"
            max="100000"
            value={config.maxTokens || ''}
            onChange={(e) => handleFieldChange('maxTokens', parseInt(e.target.value) || undefined)}
            placeholder="e.g., 4096"
          />
          <p className="base-block-editor__help-text">
            Maximum number of tokens in the response. Leave empty for model default.
          </p>
        </div>
      </div>

      {/* Tools */}
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Tools</h2>
        <p className="base-block-editor__section-description">
          Select which tools this agent can use during execution.
        </p>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label">Available Tools</label>
          <p className="base-block-editor__help-text">
            Tool selection interface will be implemented in a future update.
            For now, tools can be configured via the Properties panel.
          </p>
        </div>
      </div>
    </BaseBlockEditor>
  );
}
