/**
 * Step 2: Basic Information
 *
 * Form for entering name, description, tags, and status.
 */

import React, { useState } from 'react';
import type { BasicInfo } from './wizardTypes';
import { Input } from '../../common/Input';
import { WizardStep } from './WizardStep';
import type { BlockStatus } from '../../../types/block.types';

export interface StepBasicInfoProps {
  basicInfo: BasicInfo;
  onUpdateBasicInfo: (updates: Partial<BasicInfo>) => void;
  validationErrors: Record<string, string>;
}

export function StepBasicInfo({
  basicInfo,
  onUpdateBasicInfo,
  validationErrors,
}: StepBasicInfoProps) {
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!basicInfo.tags.includes(tagInput.trim())) {
        onUpdateBasicInfo({ tags: [...basicInfo.tags, tagInput.trim()] });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    onUpdateBasicInfo({ tags: basicInfo.tags.filter((t) => t !== tag) });
  };

  return (
    <WizardStep
      title="Basic Information"
      description="Provide name, description, and classification for your block"
    >
      <div className="basic-info-form">
        <Input
          label="Name"
          placeholder="Enter block name"
          value={basicInfo.name}
          onChange={(e) => onUpdateBasicInfo({ name: e.target.value })}
          error={validationErrors.name}
          required
          fullWidth
          autoFocus
        />

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            Description
          </label>
          <textarea
            id="description"
            className="form-textarea"
            placeholder="Enter block description"
            value={basicInfo.description}
            onChange={(e) => onUpdateBasicInfo({ description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="tags" className="form-label">
            Tags
          </label>
          <input
            id="tags"
            type="text"
            className="form-input"
            placeholder="Type and press Enter to add tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
          />
          {basicInfo.tags.length > 0 && (
            <div className="tag-list">
              {basicInfo.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                  <button
                    type="button"
                    className="tag__remove"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove ${tag} tag`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <div className="radio-group">
            {(['draft', 'active', 'archived'] as BlockStatus[]).map((status) => (
              <label key={status} className="radio-label">
                <input
                  type="radio"
                  name="status"
                  value={status}
                  checked={basicInfo.status === status}
                  onChange={(e) => onUpdateBasicInfo({ status: e.target.value as BlockStatus })}
                  className="radio-input"
                />
                <span className="radio-text">
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </WizardStep>
  );
}
