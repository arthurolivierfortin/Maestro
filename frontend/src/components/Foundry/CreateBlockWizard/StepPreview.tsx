/**
 * Step 4: Preview & Confirm
 *
 * Shows JSON preview of the block to be created.
 */
import type { BlockType, Block } from '../../../types/block.types';
import { WizardStep } from './WizardStep';
import type { BasicInfo } from './wizardTypes';

export interface StepPreviewProps {
  blockType: BlockType;
  basicInfo: BasicInfo;
  config: Record<string, any>;
}

export function StepPreview({ blockType, basicInfo, config }: StepPreviewProps) {
  // Build preview block object
  // Only workflow and task are composite blocks (can contain children)
  const previewBlock: Partial<Block<Record<string, any>>> = {
    blockType,
    name: basicInfo.name,
    isAtomic: blockType !== 'workflow' && blockType !== 'task',
    config,
    metadata: {
      description: basicInfo.description,
      tags: basicInfo.tags,
      status: basicInfo.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current-user', // TODO: Get from auth
    },
    inputs: [],
    outputs: [],
    position: { x: 0, y: 0 },
  };

  const jsonString = JSON.stringify(previewBlock, null, 2);

  return (
    <WizardStep
      title="Preview & Confirm"
      description="Review the block configuration before creating"
    >
      <div className="preview-container">
        <div className="preview-summary">
          <div className="summary-item">
            <span className="summary-label">Type:</span>
            <span className="summary-value">{blockType}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Name:</span>
            <span className="summary-value">{basicInfo.name}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Status:</span>
            <span className="summary-value">{basicInfo.status}</span>
          </div>
          {basicInfo.tags.length > 0 && (
            <div className="summary-item">
              <span className="summary-label">Tags:</span>
              <span className="summary-value">{basicInfo.tags.join(', ')}</span>
            </div>
          )}
        </div>

        <div className="preview-json">
          <div className="preview-json__header">
            <span className="preview-json__title">JSON Preview</span>
          </div>
          <pre className="preview-json__content">
            <code>{jsonString}</code>
          </pre>
        </div>
      </div>
    </WizardStep>
  );
}
