/**
 * BottomPanel Component
 *
 * Tabbed panel for Terminal, Output, and Problems.
 */

import { useState, useEffect } from 'react';
import { Terminal as TerminalIcon, FileText, AlertCircle, X } from 'lucide-react';
import { useBlockStore } from '../../store/blockStore';
import { BlockTypeRegistry } from '../../registry';
import { useNavigationStore } from '../../store/navigationStore';
import './BottomPanel.scss';

type TabId = 'terminal' | 'output' | 'problems';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'terminal', label: 'Terminal', icon: <TerminalIcon size={14} /> },
  { id: 'output', label: 'Output', icon: <FileText size={14} /> },
  { id: 'problems', label: 'Problems', icon: <AlertCircle size={14} /> },
];

interface BottomPanelProps {
  onClose?: () => void;
}

export function BottomPanel({ onClose }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = localStorage.getItem('maestro.ui.bottomPanel.activeTab');
    return (saved as TabId) || 'terminal';
  });

  const blocks = useBlockStore((state) => state.blocks);
  const selectBlock = useNavigationStore((state) => state.selectBlock);

  // Persist active tab
  useEffect(() => {
    localStorage.setItem('maestro.ui.bottomPanel.activeTab', activeTab);
  }, [activeTab]);

  // Get validation errors
  const validationErrors = Array.from(blocks.values())
    .map((block) => {
      const validation = BlockTypeRegistry.validateConfig(block.blockType, block.config);
      if (!validation.isValid) {
        return {
          blockId: block.id,
          blockName: block.name,
          blockType: block.blockType,
          errors: validation.errors,
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{
    blockId: string;
    blockName: string;
    blockType: string;
    errors: Array<{ field: string; message: string }>;
  }>;

  const handleErrorClick = (blockId: string) => {
    selectBlock(blockId);
    // TODO: Scroll to block in canvas when canvas is implemented
  };

  return (
    <div className="bottom-panel">
      <div className="bottom-panel__header">
        <div className="bottom-panel__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`bottom-panel__tab ${activeTab === tab.id ? 'bottom-panel__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === 'problems' && validationErrors.length > 0 && (
                <span className="bottom-panel__badge">{validationErrors.length}</span>
              )}
            </button>
          ))}
        </div>
        {onClose && (
          <button
            className="bottom-panel__close-btn"
            onClick={onClose}
            aria-label="Close bottom panel"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="bottom-panel__content">
        {activeTab === 'terminal' && (
          <div className="bottom-panel__placeholder">
            <TerminalIcon size={48} />
            <h3>Terminal</h3>
            <p>Terminal integration coming in Phase 9</p>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="bottom-panel__placeholder">
            <FileText size={48} />
            <h3>Output</h3>
            <p>Execution output will be displayed here</p>
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="bottom-panel__problems">
            {validationErrors.length === 0 ? (
              <div className="bottom-panel__placeholder">
                <AlertCircle size={48} />
                <h3>No Problems</h3>
                <p>All blocks are valid</p>
              </div>
            ) : (
              <div className="bottom-panel__problems-list">
                {validationErrors.map((error) => (
                  <div key={error.blockId} className="bottom-panel__problem">
                    <div className="bottom-panel__problem-header">
                      <button
                        className="bottom-panel__problem-block"
                        onClick={() => handleErrorClick(error.blockId)}
                      >
                        <AlertCircle size={14} className="bottom-panel__problem-icon" />
                        <span className="bottom-panel__problem-block-name">{error.blockName}</span>
                        <span className="bottom-panel__problem-block-type">
                          ({error.blockType})
                        </span>
                      </button>
                    </div>
                    <ul className="bottom-panel__problem-errors">
                      {error.errors.map((err, idx) => (
                        <li key={idx} className="bottom-panel__problem-error">
                          <strong>{err.field}:</strong> {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
