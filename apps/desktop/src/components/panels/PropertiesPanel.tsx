/**
 * PropertiesPanel Component
 *
 * Displays and edits properties of the selected block.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronRight, Copy, Check, Eye, Pencil } from 'lucide-react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { useNavigationStore } from '../../store/navigationStore';
import { useBlockStore } from '../../store/blockStore';
import { BlockTypeRegistry } from '../../registry';
import type { Block, BlockConfig } from '../../types/block.types';
import './PropertiesPanel.scss';

interface PropertiesPanelProps {
  panelRef: React.RefObject<ImperativePanelHandle>;
}

export function PropertiesPanel({ panelRef }: PropertiesPanelProps) {
  const selectedBlockId = useNavigationStore((state) => state.selectedBlockId);
  const propertiesPanelMode = useNavigationStore((state) => state.propertiesPanelMode);
  const setPropertiesPanelMode = useNavigationStore((state) => state.setPropertiesPanelMode);
  const getBlock = useBlockStore((state) => state.getBlock);
  const updateBlock = useBlockStore((state) => state.updateBlock);

  const [block, setBlock] = useState<Block | null>(null);
  const [editedConfig, setEditedConfig] = useState<BlockConfig | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Track original config to detect user changes vs store updates
  const originalConfigRef = useRef<BlockConfig | null>(null);
  // Track if we're currently updating the store to prevent feedback loop
  const isUpdatingStoreRef = useRef(false);

  const isViewMode = propertiesPanelMode === 'view';

  // Sync isCollapsed with panel collapse state
  useEffect(() => {
    const handlePanelCollapse = () => {
      const panel = panelRef.current;
      if (panel) {
        const collapsed = panel.isCollapsed();
        setIsCollapsed(collapsed);
      }
    };

    // Check initial state and set up listener
    handlePanelCollapse();
    const interval = setInterval(handlePanelCollapse, 100);

    return () => clearInterval(interval);
  }, [panelRef]);

  const handleToggle = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [panelRef]);

  // Load block when selection changes
  useEffect(() => {
    // Skip if we're in the middle of updating the store
    if (isUpdatingStoreRef.current) return;

    if (selectedBlockId) {
      const foundBlock = getBlock(selectedBlockId);
      if (foundBlock) {
        setBlock(foundBlock);
        setEditedConfig(foundBlock.config);
        originalConfigRef.current = foundBlock.config;
      }
    } else {
      setBlock(null);
      setEditedConfig(null);
      originalConfigRef.current = null;
    }
  }, [selectedBlockId, getBlock]);

  // Debounced update to store - only when config actually changed by user
  useEffect(() => {
    if (!block || !editedConfig) return;

    // Don't update if config is the same as original (no user changes)
    if (editedConfig === originalConfigRef.current) return;

    // Check if config actually changed (deep comparison)
    const configChanged = JSON.stringify(editedConfig) !== JSON.stringify(originalConfigRef.current);
    if (!configChanged) return;

    const timeoutId = setTimeout(() => {
      isUpdatingStoreRef.current = true;
      updateBlock(block.id, { config: editedConfig });
      originalConfigRef.current = editedConfig;
      // Reset flag after a tick to allow store to settle
      setTimeout(() => {
        isUpdatingStoreRef.current = false;
      }, 0);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [editedConfig, block?.id, updateBlock]);

  const handleCopyId = useCallback(() => {
    if (block) {
      navigator.clipboard.writeText(block.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }, [block]);

  const handleConfigChange = useCallback(
    (field: string, value: unknown) => {
      if (!editedConfig) return;
      setEditedConfig({ ...editedConfig, [field]: value } as BlockConfig);
    },
    [editedConfig]
  );

  const handleNameChange = useCallback(
    (value: string) => {
      if (!block) return;
      updateBlock(block.id, { name: value });
    },
    [block, updateBlock]
  );

  const typeInfo = block ? BlockTypeRegistry.get(block.blockType) : undefined;

  const handleToggleMode = useCallback(() => {
    setPropertiesPanelMode(isViewMode ? 'edit' : 'view');
  }, [isViewMode, setPropertiesPanelMode]);

  return (
    <div className="properties-panel" data-state={isCollapsed ? 'collapsed' : 'expanded'}>
      <div className="properties-panel__header">
        <button
          className="properties-panel__toggle-btn"
          onClick={handleToggle}
          aria-label={isCollapsed ? 'Expand properties panel' : 'Collapse properties panel'}
          aria-expanded={!isCollapsed}
        >
          <ChevronRight size={16} />
        </button>

        <h3 className="properties-panel__title">Properties</h3>

        {block && !isCollapsed && (
          <button
            className={`properties-panel__mode-btn ${isViewMode ? 'properties-panel__mode-btn--view' : 'properties-panel__mode-btn--edit'}`}
            onClick={handleToggleMode}
            title={isViewMode ? 'Switch to edit mode' : 'Switch to view mode'}
          >
            {isViewMode ? (
              <>
                <Eye size={14} /> View
              </>
            ) : (
              <>
                <Pencil size={14} /> Edit
              </>
            )}
          </button>
        )}
      </div>

      {/* Content area: hidden via CSS when collapsed */}
      {!block ? (
        <div className="properties-panel__empty">
          <p>No block selected</p>
          <p className="properties-panel__empty-hint">
            Select a block to view and edit its properties
          </p>
        </div>
      ) : (
        <div className="properties-panel__content">
          {/* Block Type */}
          <div className="properties-panel__section">
            <div className="properties-panel__block-type">
              {typeInfo?.icon && <span className="properties-panel__icon">{typeInfo.icon}</span>}
              <span className="properties-panel__type-label">
                {typeInfo?.label || block.blockType}
              </span>
            </div>
          </div>

          {/* Block ID */}
          <div className="properties-panel__section">
            <label className="properties-panel__label">Block ID</label>
            <div className="properties-panel__id-field">
              <input
                type="text"
                value={block.id}
                readOnly
                className="properties-panel__input properties-panel__input--readonly"
              />
              <button
                className="properties-panel__copy-btn"
                onClick={handleCopyId}
                aria-label="Copy block ID"
              >
                {copiedId ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="properties-panel__section">
            <label className="properties-panel__label">Name</label>
            <input
              type="text"
              value={block.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={`properties-panel__input ${isViewMode ? 'properties-panel__input--readonly' : ''}`}
              placeholder="Enter block name"
              readOnly={isViewMode}
              disabled={isViewMode}
            />
          </div>

          {/* Metadata */}
          <div className="properties-panel__section">
            <label className="properties-panel__label">Metadata</label>
            <div className="properties-panel__metadata">
              <div className="properties-panel__metadata-row">
                <span className="properties-panel__metadata-label">Created:</span>
                <span className="properties-panel__metadata-value">
                  {block.metadata?.createdAt ? new Date(block.metadata.createdAt).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="properties-panel__metadata-row">
                <span className="properties-panel__metadata-label">Updated:</span>
                <span className="properties-panel__metadata-value">
                  {block.metadata?.updatedAt ? new Date(block.metadata.updatedAt).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Configuration Fields */}
          {editedConfig && (
            <div className="properties-panel__section">
              <label className="properties-panel__label">Configuration</label>
              <div className="properties-panel__config">
                {renderConfigFields(block.blockType, editedConfig, handleConfigChange)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Render configuration fields based on block type
 */
function renderConfigFields(
  blockType: string,
  config: BlockConfig,
  onChange: (field: string, value: unknown) => void
) {
  const fields: JSX.Element[] = [];

  // Common fields based on block type
  switch (blockType) {
    case 'task':
      if ('description' in config) {
        fields.push(
          <div key="description" className="properties-panel__field">
            <label className="properties-panel__field-label">Description</label>
            <textarea
              value={config.description}
              onChange={(e) => onChange('description', e.target.value)}
              className="properties-panel__textarea"
              placeholder="Task description"
              rows={3}
            />
          </div>
        );
      }
      break;

    case 'command':
      if ('commandType' in config) {
        fields.push(
          <div key="commandType" className="properties-panel__field">
            <label className="properties-panel__field-label">Command Type</label>
            <select
              value={config.commandType}
              onChange={(e) => onChange('commandType', e.target.value)}
              className="properties-panel__select"
            >
              <option value="Bash">Bash</option>
              <option value="Git">Git</option>
              <option value="FileSystem">File System</option>
              <option value="HTTP">HTTP</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
        );
      }
      if ('command' in config) {
        fields.push(
          <div key="command" className="properties-panel__field">
            <label className="properties-panel__field-label">Command</label>
            <input
              type="text"
              value={config.command || ''}
              onChange={(e) => onChange('command', e.target.value)}
              className="properties-panel__input"
              placeholder="Command to execute"
            />
          </div>
        );
      }
      break;

    case 'prompt':
      if ('template' in config) {
        fields.push(
          <div key="template" className="properties-panel__field">
            <label className="properties-panel__field-label">Template</label>
            <textarea
              value={config.template}
              onChange={(e) => onChange('template', e.target.value)}
              className="properties-panel__textarea"
              placeholder="Prompt template with {{variables}}"
              rows={5}
            />
          </div>
        );
      }
      break;

    case 'instruction':
      if ('filePath' in config) {
        fields.push(
          <div key="filePath" className="properties-panel__field">
            <label className="properties-panel__field-label">File Path</label>
            <input
              type="text"
              value={config.filePath}
              onChange={(e) => onChange('filePath', e.target.value)}
              className="properties-panel__input"
              placeholder="Path to instruction file"
            />
          </div>
        );
      }
      break;

    case 'decision':
      if ('condition' in config) {
        fields.push(
          <div key="condition" className="properties-panel__field">
            <label className="properties-panel__field-label">Condition</label>
            <textarea
              value={config.condition}
              onChange={(e) => onChange('condition', e.target.value)}
              className="properties-panel__textarea"
              placeholder="JavaScript expression"
              rows={3}
            />
          </div>
        );
      }
      break;
  }

  return fields.length > 0 ? (
    fields
  ) : (
    <p className="properties-panel__no-config">No configuration fields available</p>
  );
}
