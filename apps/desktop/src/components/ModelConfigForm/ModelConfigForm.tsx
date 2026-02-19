/**
 * ModelConfigForm Component
 *
 * Form for creating or editing model configurations.
 * Used in the Models Panel for adding custom models.
 */

import { useState, useCallback, useMemo } from 'react';
import { X, Plus, Trash2, TestTube } from 'lucide-react';
import type { Model, ModelProvider, ModelCapability, TaskType } from '../../types/model.types';
import type { CreateModelDto } from '../../services/interfaces/IModelService';
import './ModelConfigForm.scss';

/**
 * Provider options for dropdown
 */
const PROVIDER_OPTIONS: { value: ModelProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'groq', label: 'Groq' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'local', label: 'Local Model' },
  { value: 'custom', label: 'Custom Provider' },
];

/**
 * Capability options for multi-select
 */
const CAPABILITY_OPTIONS: { value: ModelCapability; label: string }[] = [
  { value: 'code-generation', label: 'Code Generation' },
  { value: 'code-review', label: 'Code Review' },
  { value: 'code-debugging', label: 'Debugging' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'planning', label: 'Planning' },
  { value: 'summarization', label: 'Summarization' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'vision', label: 'Vision' },
  { value: 'tool-use', label: 'Tool Use' },
  { value: 'function-calling', label: 'Function Calling' },
  { value: 'structured-output', label: 'Structured Output' },
  { value: 'long-context', label: 'Long Context' },
  { value: 'fast-inference', label: 'Fast Inference' },
];

/**
 * Task types for quality ratings
 */
const TASK_TYPES: TaskType[] = [
  'code-generation',
  'code-review',
  'planning',
  'analysis',
  'debugging',
  'documentation',
  'test-generation',
  'refactoring',
  'summarization',
];

interface ModelConfigFormProps {
  /** Existing model to edit (undefined for new model) */
  model?: Model;
  /** Callback when form is submitted */
  onSubmit: (dto: CreateModelDto) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Optional callback to test connection */
  onTestConnection?: (dto: CreateModelDto) => Promise<boolean>;
}

interface FormState {
  id: string;
  name: string;
  displayName: string;
  provider: ModelProvider;
  capabilities: ModelCapability[];
  contextWindow: number;
  maxOutputTokens: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  speedRating: number;
  qualityRatings: Partial<Record<TaskType, number>>;
  strengths: string[];
  weaknesses: string[];
  supportsStreaming: boolean;
  supportsToolCalls: boolean;
  supportsVision: boolean;
  isLocal: boolean;
  apiEndpoint: string;
}

interface ValidationErrors {
  [key: string]: string | undefined;
}

/**
 * Initialize form state from existing model or defaults
 */
function getInitialState(model?: Model): FormState {
  if (model) {
    return {
      id: model.id,
      name: model.description || model.displayName,
      displayName: model.displayName,
      provider: model.provider,
      capabilities: model.capabilities,
      contextWindow: model.contextWindow,
      maxOutputTokens: model.maxOutputTokens,
      costPerInputToken: model.costPerInputToken * 1000, // Convert to per 1k tokens
      costPerOutputToken: model.costPerOutputToken * 1000,
      speedRating: model.speedRating,
      qualityRatings: model.qualityRatings,
      strengths: model.strengths || [],
      weaknesses: model.weaknesses || [],
      supportsStreaming: model.supportsStreaming,
      supportsToolCalls: model.supportsToolCalls,
      supportsVision: model.supportsVision,
      isLocal: model.isLocal,
      apiEndpoint: model.apiEndpoint || '',
    };
  }

  return {
    id: '',
    name: '',
    displayName: '',
    provider: 'openai',
    capabilities: [],
    contextWindow: 4096,
    maxOutputTokens: 4096,
    costPerInputToken: 0,
    costPerOutputToken: 0,
    speedRating: 5,
    qualityRatings: {},
    strengths: [],
    weaknesses: [],
    supportsStreaming: true,
    supportsToolCalls: false,
    supportsVision: false,
    isLocal: false,
    apiEndpoint: '',
  };
}

export function ModelConfigForm({
  model,
  onSubmit,
  onCancel,
  onTestConnection,
}: ModelConfigFormProps) {
  const [formState, setFormState] = useState<FormState>(() => getInitialState(model));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const isEditMode = !!model;

  /**
   * Update a single field
   */
  const updateField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
      // Clear error when field is modified
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  /**
   * Toggle a capability
   */
  const toggleCapability = useCallback((capability: ModelCapability) => {
    setFormState((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter((c) => c !== capability)
        : [...prev.capabilities, capability],
    }));
  }, []);

  /**
   * Update a quality rating
   */
  const updateQualityRating = useCallback((taskType: TaskType, value: number) => {
    setFormState((prev) => ({
      ...prev,
      qualityRatings: { ...prev.qualityRatings, [taskType]: value },
    }));
  }, []);

  /**
   * Add a strength or weakness
   */
  const addListItem = useCallback((field: 'strengths' | 'weaknesses', value: string) => {
    if (!value.trim()) return;
    setFormState((prev) => ({
      ...prev,
      [field]: [...prev[field], value.trim()],
    }));
  }, []);

  /**
   * Remove a strength or weakness
   */
  const removeListItem = useCallback((field: 'strengths' | 'weaknesses', index: number) => {
    setFormState((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  }, []);

  /**
   * Validate form
   */
  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!formState.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    if (!formState.name.trim()) {
      newErrors.name = 'Model name is required';
    }

    if (!isEditMode && !formState.id.trim()) {
      // Auto-generate ID from name if not provided
      // This is handled in submit, so no error needed
    }

    if (formState.contextWindow < 1) {
      newErrors.contextWindow = 'Context window must be at least 1';
    }

    if (formState.maxOutputTokens < 1) {
      newErrors.maxOutputTokens = 'Max output tokens must be at least 1';
    }

    if (formState.speedRating < 1 || formState.speedRating > 10) {
      newErrors.speedRating = 'Speed rating must be between 1 and 10';
    }

    if (formState.isLocal || formState.provider === 'ollama' || formState.provider === 'custom') {
      if (!formState.apiEndpoint.trim()) {
        newErrors.apiEndpoint = 'API endpoint is required for local/custom models';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formState, isEditMode]);

  /**
   * Build DTO from form state
   */
  const buildDto = useMemo((): CreateModelDto => {
    const id =
      formState.id.trim() ||
      formState.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    return {
      id,
      name: formState.name,
      displayName: formState.displayName,
      provider: formState.provider,
      capabilities: formState.capabilities,
      contextWindow: formState.contextWindow,
      maxOutputTokens: formState.maxOutputTokens,
      costPerInputToken: formState.costPerInputToken / 1000, // Convert back to per token
      costPerOutputToken: formState.costPerOutputToken / 1000,
      speedRating: formState.speedRating,
      qualityRatings: formState.qualityRatings,
      strengths: formState.strengths,
      weaknesses: formState.weaknesses,
      supportsStreaming: formState.supportsStreaming,
      supportsToolCalls: formState.supportsToolCalls,
      supportsVision: formState.supportsVision,
      isLocal: formState.isLocal,
      apiEndpoint: formState.apiEndpoint || undefined,
    };
  }, [formState]);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(buildDto);
    } catch (error) {
      console.error('Failed to save model:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save model' });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle test connection
   */
  const handleTestConnection = async () => {
    if (!onTestConnection) return;

    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTestConnection(buildDto);
      setTestResult(result);
    } catch {
      setTestResult(false);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="model-config-form">
      <div className="model-config-form__header">
        <h3>{isEditMode ? 'Edit Model' : 'Add Custom Model'}</h3>
        <button
          type="button"
          className="model-config-form__close"
          onClick={onCancel}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="model-config-form__body">
        {/* Basic Info Section */}
        <section className="model-config-form__section">
          <h4>Basic Information</h4>

          <div className="model-config-form__row">
            <label className="model-config-form__field">
              <span>Display Name *</span>
              <input
                type="text"
                value={formState.displayName}
                onChange={(e) => updateField('displayName', e.target.value)}
                placeholder="e.g., GPT-4 Turbo"
                className={errors.displayName ? 'error' : ''}
              />
              {errors.displayName && <span className="error-text">{errors.displayName}</span>}
            </label>

            <label className="model-config-form__field">
              <span>Model Name/ID *</span>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., gpt-4-turbo"
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </label>
          </div>

          <div className="model-config-form__row">
            <label className="model-config-form__field">
              <span>Provider *</span>
              <select
                value={formState.provider}
                onChange={(e) => updateField('provider', e.target.value as ModelProvider)}
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="model-config-form__field">
              <span>
                API Endpoint {(formState.isLocal || formState.provider === 'ollama') && '*'}
              </span>
              <input
                type="text"
                value={formState.apiEndpoint}
                onChange={(e) => updateField('apiEndpoint', e.target.value)}
                placeholder="e.g., http://localhost:11434"
                className={errors.apiEndpoint ? 'error' : ''}
              />
              {errors.apiEndpoint && <span className="error-text">{errors.apiEndpoint}</span>}
            </label>
          </div>
        </section>

        {/* Capabilities Section */}
        <section className="model-config-form__section">
          <h4>Capabilities</h4>
          <div className="model-config-form__capabilities">
            {CAPABILITY_OPTIONS.map((opt) => (
              <label key={opt.value} className="model-config-form__checkbox">
                <input
                  type="checkbox"
                  checked={formState.capabilities.includes(opt.value)}
                  onChange={() => toggleCapability(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Token Limits Section */}
        <section className="model-config-form__section">
          <h4>Token Limits</h4>
          <div className="model-config-form__row">
            <label className="model-config-form__field">
              <span>Context Window</span>
              <input
                type="number"
                value={formState.contextWindow}
                onChange={(e) => updateField('contextWindow', parseInt(e.target.value) || 0)}
                min={1}
                className={errors.contextWindow ? 'error' : ''}
              />
              {errors.contextWindow && <span className="error-text">{errors.contextWindow}</span>}
            </label>

            <label className="model-config-form__field">
              <span>Max Output Tokens</span>
              <input
                type="number"
                value={formState.maxOutputTokens}
                onChange={(e) => updateField('maxOutputTokens', parseInt(e.target.value) || 0)}
                min={1}
                className={errors.maxOutputTokens ? 'error' : ''}
              />
              {errors.maxOutputTokens && (
                <span className="error-text">{errors.maxOutputTokens}</span>
              )}
            </label>
          </div>
        </section>

        {/* Cost Section */}
        <section className="model-config-form__section">
          <h4>Cost (per 1K tokens)</h4>
          <div className="model-config-form__row">
            <label className="model-config-form__field">
              <span>Input Cost ($)</span>
              <input
                type="number"
                value={formState.costPerInputToken}
                onChange={(e) => updateField('costPerInputToken', parseFloat(e.target.value) || 0)}
                min={0}
                step={0.0001}
              />
            </label>

            <label className="model-config-form__field">
              <span>Output Cost ($)</span>
              <input
                type="number"
                value={formState.costPerOutputToken}
                onChange={(e) => updateField('costPerOutputToken', parseFloat(e.target.value) || 0)}
                min={0}
                step={0.0001}
              />
            </label>
          </div>
        </section>

        {/* Performance Section */}
        <section className="model-config-form__section">
          <h4>Performance</h4>
          <div className="model-config-form__row">
            <label className="model-config-form__field">
              <span>Speed Rating (1-10)</span>
              <input
                type="range"
                value={formState.speedRating}
                onChange={(e) => updateField('speedRating', parseInt(e.target.value))}
                min={1}
                max={10}
              />
              <span className="range-value">{formState.speedRating}</span>
            </label>
          </div>

          <div className="model-config-form__checkboxes">
            <label className="model-config-form__checkbox">
              <input
                type="checkbox"
                checked={formState.supportsStreaming}
                onChange={(e) => updateField('supportsStreaming', e.target.checked)}
              />
              <span>Supports Streaming</span>
            </label>
            <label className="model-config-form__checkbox">
              <input
                type="checkbox"
                checked={formState.supportsToolCalls}
                onChange={(e) => updateField('supportsToolCalls', e.target.checked)}
              />
              <span>Supports Tool Calls</span>
            </label>
            <label className="model-config-form__checkbox">
              <input
                type="checkbox"
                checked={formState.supportsVision}
                onChange={(e) => updateField('supportsVision', e.target.checked)}
              />
              <span>Supports Vision</span>
            </label>
            <label className="model-config-form__checkbox">
              <input
                type="checkbox"
                checked={formState.isLocal}
                onChange={(e) => updateField('isLocal', e.target.checked)}
              />
              <span>Local Model</span>
            </label>
          </div>
        </section>

        {/* Quality Ratings Section */}
        <section className="model-config-form__section">
          <h4>Quality Ratings (1-10)</h4>
          <div className="model-config-form__ratings">
            {TASK_TYPES.map((taskType) => (
              <label key={taskType} className="model-config-form__rating">
                <span>{taskType.replace(/-/g, ' ')}</span>
                <input
                  type="range"
                  value={formState.qualityRatings[taskType] || 5}
                  onChange={(e) => updateQualityRating(taskType, parseInt(e.target.value))}
                  min={1}
                  max={10}
                />
                <span className="range-value">{formState.qualityRatings[taskType] || 5}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Strengths & Weaknesses */}
        <section className="model-config-form__section">
          <h4>Strengths & Weaknesses</h4>
          <div className="model-config-form__row">
            <div className="model-config-form__list">
              <span>Strengths</span>
              <div className="list-items">
                {formState.strengths.map((item, i) => (
                  <div key={i} className="list-item">
                    <span>{item}</span>
                    <button type="button" onClick={() => removeListItem('strengths', i)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="list-add">
                <input
                  type="text"
                  placeholder="Add strength..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addListItem('strengths', e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    addListItem('strengths', input.value);
                    input.value = '';
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="model-config-form__list">
              <span>Weaknesses</span>
              <div className="list-items">
                {formState.weaknesses.map((item, i) => (
                  <div key={i} className="list-item">
                    <span>{item}</span>
                    <button type="button" onClick={() => removeListItem('weaknesses', i)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="list-add">
                <input
                  type="text"
                  placeholder="Add weakness..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addListItem('weaknesses', e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    addListItem('weaknesses', input.value);
                    input.value = '';
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Error Message */}
        {errors.submit && <div className="model-config-form__error">{errors.submit}</div>}

        {/* Actions */}
        <div className="model-config-form__actions">
          {onTestConnection && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              <TestTube size={16} />
              {isTesting ? 'Testing...' : 'Test Connection'}
              {testResult !== null && (
                <span className={testResult ? 'test-success' : 'test-failure'}>
                  {testResult ? '✓' : '✗'}
                </span>
              )}
            </button>
          )}

          <div className="model-config-form__actions-right">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Model'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
