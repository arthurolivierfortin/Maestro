/**
 * Trigger Editor
 *
 * Type-specific editor for trigger blocks.
 * Includes trigger type and type-specific configuration.
 */

import { useState, useEffect, useCallback } from 'react';
import { BaseBlockEditor } from './BaseBlockEditor';
import type { Block, TriggerBlockConfig } from '../../types/block.types';
import { useBlockStore } from '../../store';

export interface TriggerEditorProps {
  block: Block<TriggerBlockConfig>;
}

export function TriggerEditor({ block }: TriggerEditorProps) {
  const updateBlock = useBlockStore((s) => s.updateBlock);
  const [config, setConfig] = useState<TriggerBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(block.config));
  }, [config, block.config]);

  const handleSave = useCallback(
    (updatedConfig: TriggerBlockConfig) => {
      updateBlock(block.id, { config: updatedConfig });
    },
    [block.id, updateBlock]
  );

  const handleFieldChange = useCallback((field: keyof TriggerBlockConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  return (
    <BaseBlockEditor
      block={block}
      onSave={() => handleSave(config)}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <div className="base-block-editor__section">
        <h2 className="base-block-editor__section-title">Trigger Configuration</h2>
        <p className="base-block-editor__section-description">
          Configure when and how this workflow should be triggered.
        </p>

        <div className="base-block-editor__field">
          <label className="base-block-editor__label" htmlFor="triggerType">
            Trigger Type
          </label>
          <select
            id="triggerType"
            className="base-block-editor__select"
            value={config.triggerType}
            onChange={(e) => handleFieldChange('triggerType', e.target.value)}
          >
            <option value="Manual">Manual</option>
            <option value="Schedule">Cron Schedule</option>
            <option value="Webhook">Webhook</option>
            <option value="FileWatch">File Watch</option>
            <option value="Event">Event</option>
          </select>
        </div>

        {config.triggerType === 'Schedule' && (
          <div className="base-block-editor__field">
            <label className="base-block-editor__label" htmlFor="cronExpression">
              Cron Expression
            </label>
            <input
              id="cronExpression"
              type="text"
              className="base-block-editor__input"
              value={config.cronExpression || ''}
              onChange={(e) => handleFieldChange('cronExpression', e.target.value)}
              placeholder="0 0 * * *"
            />
            <p className="base-block-editor__help-text">
              Standard cron expression (e.g., "0 0 * * *" for daily at midnight).
            </p>
          </div>
        )}

        {config.triggerType === 'Webhook' && (
          <div className="base-block-editor__field">
            <label className="base-block-editor__label" htmlFor="webhookUrl">
              Webhook URL Path
            </label>
            <input
              id="webhookUrl"
              type="text"
              className="base-block-editor__input"
              value={config.webhookPath || ''}
              onChange={(e) => handleFieldChange('webhookPath', e.target.value)}
              placeholder="/webhooks/my-trigger"
            />
          </div>
        )}

        {config.triggerType === 'FileWatch' && (
          <div className="base-block-editor__field">
            <label className="base-block-editor__label" htmlFor="watchPath">
              Watch Path
            </label>
            <input
              id="watchPath"
              type="text"
              className="base-block-editor__input"
              value={config.watchPath || ''}
              onChange={(e) => handleFieldChange('watchPath', e.target.value)}
              placeholder="/path/to/watch/**/*"
            />
          </div>
        )}

        {config.triggerType === 'Event' && (
          <div className="base-block-editor__field">
            <label className="base-block-editor__label" htmlFor="eventName">
              Event Name
            </label>
            <input
              id="eventName"
              type="text"
              className="base-block-editor__input"
              value={config.eventName || ''}
              onChange={(e) => handleFieldChange('eventName', e.target.value)}
              placeholder="my.custom.event"
            />
          </div>
        )}
      </div>
    </BaseBlockEditor>
  );
}
