/**
 * Wizard State Types
 *
 * Type definitions for the Create Block Wizard state management.
 */

import type { Block, BlockType, BlockStatus } from '../../../types/block.types';

/**
 * Wizard step identifiers
 */
export type WizardStep = 'type' | 'basic' | 'config' | 'preview';

/**
 * Wizard state
 */
export interface WizardState {
  currentStep: WizardStep;
  selectedType: BlockType | null;
  basicInfo: BasicInfo;
  config: Record<string, any>;
  validationErrors: Record<string, string>;
}

/**
 * Basic information for new block
 */
export interface BasicInfo {
  name: string;
  description: string;
  tags: string[];
  status: BlockStatus;
}

/**
 * Wizard actions
 */
export type WizardAction =
  | { type: 'SET_STEP'; payload: WizardStep }
  | { type: 'SELECT_TYPE'; payload: BlockType }
  | { type: 'UPDATE_BASIC_INFO'; payload: Partial<BasicInfo> }
  | { type: 'UPDATE_CONFIG'; payload: Record<string, any> }
  | { type: 'SET_VALIDATION_ERROR'; payload: { field: string; error: string } }
  | { type: 'CLEAR_VALIDATION_ERRORS' }
  | { type: 'RESET' };

/**
 * Block type template preset
 */
export interface BlockTypeTemplate {
  type: BlockType;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  defaultConfig: Record<string, any>;
}

/**
 * Initial wizard state
 */
export const initialWizardState: WizardState = {
  currentStep: 'type',
  selectedType: null,
  basicInfo: {
    name: '',
    description: '',
    tags: [],
    status: 'draft',
  },
  config: {},
  validationErrors: {},
};

/**
 * Wizard reducer
 */
export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'SELECT_TYPE':
      return {
        ...state,
        selectedType: action.payload,
        config: {}, // Reset config when type changes
      };

    case 'UPDATE_BASIC_INFO':
      return {
        ...state,
        basicInfo: { ...state.basicInfo, ...action.payload },
      };

    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.payload },
      };

    case 'SET_VALIDATION_ERROR':
      return {
        ...state,
        validationErrors: {
          ...state.validationErrors,
          [action.payload.field]: action.payload.error,
        },
      };

    case 'CLEAR_VALIDATION_ERRORS':
      return {
        ...state,
        validationErrors: {},
      };

    case 'RESET':
      return initialWizardState;

    default:
      return state;
  }
}
