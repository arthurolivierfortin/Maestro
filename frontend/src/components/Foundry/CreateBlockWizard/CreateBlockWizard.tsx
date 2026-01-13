/**
 * Create Block Wizard Modal
 *
 * Multi-step wizard for creating new blocks.
 */

import { useReducer, useEffect } from 'react';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { useBlockStore } from '../../../store';
import { useNavigate } from 'react-router-dom';
import {
  wizardReducer,
  initialWizardState,
  type WizardStep,
} from './wizardTypes';
import { StepSelectType } from './StepSelectType';
import { StepBasicInfo } from './StepBasicInfo';
import { StepConfiguration } from './StepConfiguration';
import { StepPreview } from './StepPreview';
import type { BlockType, Block, BlockConfig } from '../../../types/block.types';
import './CreateBlockWizard.scss';

export interface CreateBlockWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Step order for navigation
 */
const STEP_ORDER: WizardStep[] = ['type', 'basic', 'config', 'preview'];

/**
 * Create Block Wizard Component
 */
export function CreateBlockWizard({ isOpen, onClose }: CreateBlockWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const { addBlock } = useBlockStore();
  const navigate = useNavigate();

  // Reset wizard when modal opens
  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'RESET' });
    }
  }, [isOpen]);

  /**
   * Get current step index
   */
  const currentStepIndex = STEP_ORDER.indexOf(state.currentStep);

  /**
   * Check if can proceed to next step
   */
  const canProceed = (): boolean => {
    dispatch({ type: 'CLEAR_VALIDATION_ERRORS' });

    switch (state.currentStep) {
      case 'type':
        if (!state.selectedType) {
          return false;
        }
        return true;

      case 'basic':
        if (!state.basicInfo.name.trim()) {
          dispatch({
            type: 'SET_VALIDATION_ERROR',
            payload: { field: 'name', error: 'Name is required' },
          });
          return false;
        }
        return true;

      case 'config':
        // Type-specific validation
        return true;

      case 'preview':
        return true;

      default:
        return false;
    }
  };

  /**
   * Navigate to next step
   */
  const handleNext = () => {
    if (!canProceed()) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      dispatch({ type: 'SET_STEP', payload: STEP_ORDER[nextIndex] });
    }
  };

  /**
   * Navigate to previous step
   */
  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      dispatch({ type: 'SET_STEP', payload: STEP_ORDER[prevIndex] });
    }
  };

  /**
   * Handle keyboard navigation
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && state.currentStep !== 'preview') {
        e.preventDefault();
        handleNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, state.currentStep]);

  /**
   * Create the block
   */
  const handleCreate = () => {
    if (!state.selectedType || !state.basicInfo.name) return;

    // Generate unique ID
    const blockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create new block
    const newBlock: Block = {
      id: blockId,
      name: state.basicInfo.name,
      blockType: state.selectedType,
      isAtomic:
        state.selectedType !== 'workflow' &&
        state.selectedType !== 'agent' &&
        state.selectedType !== 'task',
      config: state.config as BlockConfig,
      inputs: [],
      outputs: [],
      position: { x: 100, y: 100 },
      metadata: {
        description: state.basicInfo.description,
        tags: state.basicInfo.tags,
        status: state.basicInfo.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'current-user', // TODO: Get from auth
      },
    };

    // Add block to store
    addBlock(null, newBlock);

    // Close wizard
    onClose();

    // Navigate to appropriate editor
    if (newBlock.isAtomic) {
      navigate(`/foundry/${blockId}/edit`);
    } else {
      navigate(`/canvas/${blockId}`);
    }
  };

  /**
   * Render current step
   */
  const renderStep = () => {
    switch (state.currentStep) {
      case 'type':
        return (
          <StepSelectType
            selectedType={state.selectedType}
            onSelectType={(type: BlockType) => dispatch({ type: 'SELECT_TYPE', payload: type })}
          />
        );

      case 'basic':
        return (
          <StepBasicInfo
            basicInfo={state.basicInfo}
            onUpdateBasicInfo={(updates) =>
              dispatch({ type: 'UPDATE_BASIC_INFO', payload: updates })
            }
            validationErrors={state.validationErrors}
          />
        );

      case 'config':
        return state.selectedType ? (
          <StepConfiguration
            blockType={state.selectedType}
            config={state.config}
            onUpdateConfig={(updates) => dispatch({ type: 'UPDATE_CONFIG', payload: updates })}
          />
        ) : null;

      case 'preview':
        return state.selectedType ? (
          <StepPreview
            blockType={state.selectedType}
            basicInfo={state.basicInfo}
            config={state.config}
          />
        ) : null;

      default:
        return null;
    }
  };

  /**
   * Render footer with navigation buttons
   */
  const renderFooter = () => {
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === STEP_ORDER.length - 1;

    return (
      <>
        {!isFirstStep && (
          <Button variant="secondary" onClick={handleBack}>
            Back
          </Button>
        )}
        {!isLastStep && (
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={state.currentStep === 'type' && !state.selectedType}
          >
            Next
          </Button>
        )}
        {isLastStep && (
          <Button variant="primary" onClick={handleCreate}>
            Create Block
          </Button>
        )}
      </>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Block"
      footer={renderFooter()}
      size="lg"
      closeOnBackdrop={false}
    >
      <div className="create-block-wizard">
        {/* Step progress indicator */}
        <div className="wizard-progress">
          {STEP_ORDER.map((step, index) => (
            <div
              key={step}
              className={`wizard-progress__step ${
                index === currentStepIndex
                  ? 'wizard-progress__step--active'
                  : index < currentStepIndex
                    ? 'wizard-progress__step--completed'
                    : ''
              }`}
            >
              <div className="wizard-progress__number">{index + 1}</div>
              <div className="wizard-progress__label">
                {step === 'type' && 'Type'}
                {step === 'basic' && 'Basic Info'}
                {step === 'config' && 'Configuration'}
                {step === 'preview' && 'Preview'}
              </div>
            </div>
          ))}
        </div>

        {/* Current step content */}
        <div className="wizard-content">{renderStep()}</div>
      </div>
    </Modal>
  );
}
