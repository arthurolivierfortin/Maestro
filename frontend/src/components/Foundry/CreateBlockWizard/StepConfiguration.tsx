/**
 * Step 3: Configuration
 *
 * Type-specific configuration form.
 */

import React from 'react';
import type { BlockType } from '../../../types/block.types';
import { WizardStep } from './WizardStep';

export interface StepConfigurationProps {
  blockType: BlockType;
  config: Record<string, any>;
  onUpdateConfig: (updates: Record<string, any>) => void;
}

export function StepConfiguration({ blockType, config, onUpdateConfig }: StepConfigurationProps) {
  // Render type-specific configuration fields
  const renderConfigFields = () => {
    switch (blockType) {
      case 'agent':
        return (
          <div className="config-fields">
            <div className="form-group">
              <label htmlFor="systemPrompt" className="form-label">
                System Prompt
              </label>
              <textarea
                id="systemPrompt"
                className="form-textarea"
                placeholder="Enter system prompt for the agent"
                value={config.systemPrompt || ''}
                onChange={(e) => onUpdateConfig({ systemPrompt: e.target.value })}
                rows={5}
              />
            </div>
            <div className="form-group">
              <label htmlFor="temperature" className="form-label">
                Temperature
              </label>
              <input
                id="temperature"
                type="number"
                className="form-input"
                placeholder="0.7"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature || 0.7}
                onChange={(e) => onUpdateConfig({ temperature: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        );

      case 'tool':
        return (
          <div className="config-fields">
            <div className="form-group">
              <label htmlFor="command" className="form-label">
                Command
              </label>
              <input
                id="command"
                type="text"
                className="form-input"
                placeholder="Enter command to execute"
                value={config.command || ''}
                onChange={(e) => onUpdateConfig({ command: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="script" className="form-label">
                Script
              </label>
              <textarea
                id="script"
                className="form-textarea"
                placeholder="Enter script content"
                value={config.script || ''}
                onChange={(e) => onUpdateConfig({ script: e.target.value })}
                rows={8}
              />
            </div>
          </div>
        );

      case 'prompt':
        return (
          <div className="config-fields">
            <div className="form-group">
              <label htmlFor="template" className="form-label">
                Template
              </label>
              <textarea
                id="template"
                className="form-textarea"
                placeholder="Enter prompt template (use {{variableName}} for variables)"
                value={config.template || ''}
                onChange={(e) => onUpdateConfig({ template: e.target.value })}
                rows={8}
              />
              <small className="form-helper">
                Use double curly braces for variables, e.g., {`{{variableName}}`}
              </small>
            </div>
          </div>
        );

      case 'instruction':
        return (
          <div className="config-fields">
            <div className="form-group">
              <label htmlFor="filePath" className="form-label">
                File Path
              </label>
              <input
                id="filePath"
                type="text"
                className="form-input"
                placeholder="path/to/instruction.md"
                value={config.filePath || ''}
                onChange={(e) => onUpdateConfig({ filePath: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="scope" className="form-label">
                Scope
              </label>
              <select
                id="scope"
                className="form-select"
                value={config.scope || 'global'}
                onChange={(e) => onUpdateConfig({ scope: e.target.value })}
              >
                <option value="global">Global</option>
                <option value="workflow">Workflow</option>
                <option value="agent">Agent</option>
              </select>
            </div>
          </div>
        );

      case 'task':
        return (
          <div className="config-fields">
            <div className="form-group">
              <label htmlFor="timeout" className="form-label">
                Timeout (seconds)
              </label>
              <input
                id="timeout"
                type="number"
                className="form-input"
                placeholder="30"
                min="1"
                value={config.timeout || 30}
                onChange={(e) => onUpdateConfig({ timeout: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="maxRetries" className="form-label">
                Max Retries
              </label>
              <input
                id="maxRetries"
                type="number"
                className="form-input"
                placeholder="3"
                min="0"
                value={config.maxRetries || 3}
                onChange={(e) => onUpdateConfig({ maxRetries: parseInt(e.target.value) })}
              />
            </div>
          </div>
        );

      case 'trigger':
        return (
          <div className="config-fields">
            <div className="form-group">
              <label htmlFor="triggerType" className="form-label">
                Trigger Type
              </label>
              <select
                id="triggerType"
                className="form-select"
                value={config.triggerType || 'manual'}
                onChange={(e) => onUpdateConfig({ triggerType: e.target.value })}
              >
                <option value="manual">Manual</option>
                <option value="schedule">Schedule (Cron)</option>
                <option value="webhook">Webhook</option>
                <option value="file-watch">File Watch</option>
                <option value="event">Event</option>
              </select>
            </div>
            {config.triggerType === 'schedule' && (
              <div className="form-group">
                <label htmlFor="cronExpression" className="form-label">
                  Cron Expression
                </label>
                <input
                  id="cronExpression"
                  type="text"
                  className="form-input"
                  placeholder="0 * * * *"
                  value={config.cronExpression || ''}
                  onChange={(e) => onUpdateConfig({ cronExpression: e.target.value })}
                />
              </div>
            )}
          </div>
        );

      case 'validator':
        return (
          <div className="config-fields">
            <div className="form-group">
              <label htmlFor="schema" className="form-label">
                JSON Schema
              </label>
              <textarea
                id="schema"
                className="form-textarea"
                placeholder='{"type": "object", "properties": {...}}'
                value={config.schema || ''}
                onChange={(e) => onUpdateConfig({ schema: e.target.value })}
                rows={10}
              />
            </div>
          </div>
        );

      case 'decision':
        return (
          <div className="config-fields">
            <div className="form-group">
              <label htmlFor="condition" className="form-label">
                Condition Expression
              </label>
              <textarea
                id="condition"
                className="form-textarea"
                placeholder="Enter condition expression"
                value={config.condition || ''}
                onChange={(e) => onUpdateConfig({ condition: e.target.value })}
                rows={4}
              />
            </div>
          </div>
        );

      case 'workflow':
        return (
          <div className="config-fields">
            <p className="config-note">
              Workflow blocks are composite blocks. Configuration will be done in the Canvas editor
              after creation.
            </p>
          </div>
        );

      default:
        return (
          <div className="config-fields">
            <p className="config-note">No additional configuration required for this block type.</p>
          </div>
        );
    }
  };

  return (
    <WizardStep title="Configuration" description="Configure type-specific settings for your block">
      {renderConfigFields()}
    </WizardStep>
  );
}
