/**
 * Inference Unit Editor
 *
 * Editor for configuring LLM inference blocks with dynamic inputs/outputs.
 * Always provides raw_response and metadata outputs, plus optional structured extractions.
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { BaseBlockEditor } from './BaseBlockEditor';
import { useBlockStore } from '../../store/blockStore';
import type { Block, InferenceBlockConfig, InferenceParameter, InferenceOutput } from '../../types/block.types';
import './InferenceEditor.scss';

interface InferenceEditorProps {
  block: Block<InferenceBlockConfig>;
}

export function InferenceEditor({ block }: InferenceEditorProps) {
  const { updateBlock } = useBlockStore();
  const [config, setConfig] = useState<InferenceBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(block.config));
  }, [config, block.config]);

  const handleSave = useCallback(() => {
    updateBlock(block.id, { config });
    setHasUnsavedChanges(false);
  }, [block.id, config, updateBlock]);

  const handleCancel = useCallback(() => {
    setConfig(block.config);
    setHasUnsavedChanges(false);
  }, [block.config]);

  // Input parameter management
  const handleAddInput = () => {
    setConfig({
      ...config,
      inputs: [
        ...config.inputs,
        { name: `param${config.inputs.length + 1}`, type: 'string', required: false },
      ],
    });
  };

  const handleUpdateInput = (index: number, field: keyof InferenceParameter, value: any) => {
    const newInputs = [...config.inputs];
    newInputs[index] = { ...newInputs[index], [field]: value };
    setConfig({ ...config, inputs: newInputs });
  };

  const handleRemoveInput = (index: number) => {
    setConfig({
      ...config,
      inputs: config.inputs.filter((_, i) => i !== index),
    });
  };

  // Structured output management
  const handleAddOutput = () => {
    setConfig({
      ...config,
      structuredOutputs: [
        ...(config.structuredOutputs || []),
        { name: `output${(config.structuredOutputs?.length || 0) + 1}`, type: 'string' },
      ],
    });
  };

  const handleUpdateOutput = (index: number, field: keyof InferenceOutput, value: any) => {
    const newOutputs = [...(config.structuredOutputs || [])];
    newOutputs[index] = { ...newOutputs[index], [field]: value };
    setConfig({ ...config, structuredOutputs: newOutputs });
  };

  const handleRemoveOutput = (index: number) => {
    setConfig({
      ...config,
      structuredOutputs: config.structuredOutputs?.filter((_, i) => i !== index),
    });
  };

  return (
    <BaseBlockEditor
      block={block}
      onSave={handleSave}
      onCancel={handleCancel}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <div className="inference-editor">
        {/* Prompts Section */}
        <section className="inference-editor__section">
          <h3 className="inference-editor__section-title">Prompts</h3>

          <div className="inference-editor__field">
            <label className="inference-editor__label">
              System Prompt
              <span className="inference-editor__label-hint">(Optional)</span>
            </label>
            <textarea
              className="inference-editor__textarea"
              value={config.systemPrompt || ''}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              placeholder="You are a helpful assistant..."
              rows={3}
            />
          </div>

          <div className="inference-editor__field">
            <label className="inference-editor__label">
              User Prompt
              <span className="inference-editor__label-required">*</span>
            </label>
            <textarea
              className="inference-editor__textarea"
              value={config.userPrompt}
              onChange={(e) => setConfig({ ...config, userPrompt: e.target.value })}
              placeholder="Use {{parameterName}} to reference dynamic inputs"
              rows={6}
            />
            <p className="inference-editor__hint">
              <Info size={14} />
              Use {'{{'} and {'}}'}  to reference input parameters
            </p>
          </div>
        </section>

        {/* Dynamic Inputs Section */}
        <section className="inference-editor__section">
          <div className="inference-editor__section-header">
            <h3 className="inference-editor__section-title">Input Parameters</h3>
            <button
              type="button"
              className="inference-editor__add-btn"
              onClick={handleAddInput}
            >
              <Plus size={16} />
              Add Parameter
            </button>
          </div>

          {config.inputs.length === 0 ? (
            <p className="inference-editor__empty">No input parameters defined</p>
          ) : (
            <div className="inference-editor__list">
              {config.inputs.map((input, index) => (
                <div key={index} className="inference-editor__item">
                  <div className="inference-editor__item-row">
                    <input
                      type="text"
                      className="inference-editor__input"
                      value={input.name}
                      onChange={(e) => handleUpdateInput(index, 'name', e.target.value)}
                      placeholder="Parameter name"
                    />
                    <select
                      className="inference-editor__select"
                      value={input.type}
                      onChange={(e) => handleUpdateInput(index, 'type', e.target.value)}
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="object">Object</option>
                      <option value="array">Array</option>
                    </select>
                    <label className="inference-editor__checkbox">
                      <input
                        type="checkbox"
                        checked={input.required}
                        onChange={(e) => handleUpdateInput(index, 'required', e.target.checked)}
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      className="inference-editor__remove-btn"
                      onClick={() => handleRemoveInput(index)}
                      aria-label="Remove parameter"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <input
                    type="text"
                    className="inference-editor__input inference-editor__input--full"
                    value={input.description || ''}
                    onChange={(e) => handleUpdateInput(index, 'description', e.target.value)}
                    placeholder="Description (optional)"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Automatic Outputs Info */}
        <section className="inference-editor__section">
          <h3 className="inference-editor__section-title">Automatic Outputs</h3>
          <div className="inference-editor__info-box">
            <Info size={16} />
            <div>
              <p><strong>raw_response</strong> (string) - Complete LLM response</p>
              <p><strong>metadata</strong> (object) - Execution metadata (tokens, latency, model)</p>
            </div>
          </div>
        </section>

        {/* Structured Outputs Section (Optional) */}
        <section className="inference-editor__section">
          <div className="inference-editor__section-header">
            <h3 className="inference-editor__section-title">
              Structured Outputs
              <span className="inference-editor__label-hint">(Optional Extractions)</span>
            </h3>
            <button
              type="button"
              className="inference-editor__add-btn"
              onClick={handleAddOutput}
            >
              <Plus size={16} />
              Add Output
            </button>
          </div>

          {!config.structuredOutputs || config.structuredOutputs.length === 0 ? (
            <p className="inference-editor__empty">No structured outputs defined</p>
          ) : (
            <div className="inference-editor__list">
              {config.structuredOutputs.map((output, index) => (
                <div key={index} className="inference-editor__item">
                  <div className="inference-editor__item-row">
                    <input
                      type="text"
                      className="inference-editor__input"
                      value={output.name}
                      onChange={(e) => handleUpdateOutput(index, 'name', e.target.value)}
                      placeholder="Output name"
                    />
                    <select
                      className="inference-editor__select"
                      value={output.type}
                      onChange={(e) => handleUpdateOutput(index, 'type', e.target.value)}
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="object">Object</option>
                      <option value="array">Array</option>
                    </select>
                    <button
                      type="button"
                      className="inference-editor__remove-btn"
                      onClick={() => handleRemoveOutput(index)}
                      aria-label="Remove output"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <input
                    type="text"
                    className="inference-editor__input inference-editor__input--full"
                    value={output.jsonPath || ''}
                    onChange={(e) => handleUpdateOutput(index, 'jsonPath', e.target.value)}
                    placeholder="JSONPath (e.g., $.result.title)"
                  />
                  <input
                    type="text"
                    className="inference-editor__input inference-editor__input--full"
                    value={output.description || ''}
                    onChange={(e) => handleUpdateOutput(index, 'description', e.target.value)}
                    placeholder="Description (optional)"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* LLM Configuration */}
        <section className="inference-editor__section">
          <h3 className="inference-editor__section-title">LLM Configuration</h3>

          <div className="inference-editor__field-row">
            <div className="inference-editor__field">
              <label className="inference-editor__label">Temperature</label>
              <input
                type="number"
                className="inference-editor__input"
                value={config.temperature ?? 0.7}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                min="0"
                max="2"
                step="0.1"
              />
            </div>

            <div className="inference-editor__field">
              <label className="inference-editor__label">Max Tokens</label>
              <input
                type="number"
                className="inference-editor__input"
                value={config.maxTokens ?? 1000}
                onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                min="1"
              />
            </div>

            <div className="inference-editor__field">
              <label className="inference-editor__label">Response Format</label>
              <select
                className="inference-editor__select"
                value={config.responseFormat || 'text'}
                onChange={(e) =>
                  setConfig({ ...config, responseFormat: e.target.value as any })
                }
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
              </select>
            </div>
          </div>
        </section>
      </div>
    </BaseBlockEditor>
  );
}
