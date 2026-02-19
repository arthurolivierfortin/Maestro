/**
 * Keyboard Shortcuts Panel Component
 *
 * Displays all available keyboard shortcuts organized by context.
 */

import React from 'react';
import { X } from 'lucide-react';
import './KeyboardShortcutsPanel.scss';

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  context: string;
}

const SHORTCUTS: Shortcut[] = [
  // Global shortcuts
  { keys: ['Cmd/Ctrl', 'K'], description: 'Open command palette', context: 'Global' },
  { keys: ['Cmd/Ctrl', 'N'], description: 'Create new block', context: 'Global' },
  { keys: ['Cmd/Ctrl', 'S'], description: 'Save current block', context: 'Global' },
  { keys: ['Escape'], description: 'Close modal / cancel', context: 'Global' },
  { keys: ['?'], description: 'Show shortcuts panel', context: 'Global' },
  { keys: ['Enter'], description: 'Open/confirm selection', context: 'Global' },

  // Foundry shortcuts
  { keys: ['F'], description: 'Toggle favorite', context: 'Foundry' },
  { keys: ['E'], description: 'Edit selected block', context: 'Foundry' },
  { keys: ['D'], description: 'Duplicate selected block', context: 'Foundry' },
  { keys: ['Delete'], description: 'Delete selected block', context: 'Foundry' },
  { keys: ['↑', '↓', '←', '→'], description: 'Navigate grid', context: 'Foundry' },

  // Canvas shortcuts
  { keys: ['↑', '↓', '←', '→'], description: 'Navigate tree', context: 'Canvas' },
  { keys: ['Space'], description: 'Pan canvas (hold)', context: 'Canvas' },

  // Editor shortcuts
  { keys: ['Cmd/Ctrl', 'S'], description: 'Save changes', context: 'Editor' },
  { keys: ['Cmd/Ctrl', 'Z'], description: 'Undo', context: 'Editor' },
  { keys: ['Cmd/Ctrl', 'Shift', 'Z'], description: 'Redo', context: 'Editor' },
];

/**
 * Keyboard Shortcuts Panel
 */
export const KeyboardShortcutsPanel: React.FC<KeyboardShortcutsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  // Group shortcuts by context
  const grouped = SHORTCUTS.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.context]) {
        acc[shortcut.context] = [];
      }
      acc[shortcut.context].push(shortcut);
      return acc;
    },
    {} as Record<string, Shortcut[]>
  );

  return (
    <div className="shortcuts-panel-backdrop" onClick={onClose}>
      <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="panel-body">
          {Object.entries(grouped).map(([context, shortcuts]) => (
            <div key={context} className="shortcut-section">
              <h3 className="section-title">{context}</h3>
              <div className="shortcuts-list">
                {shortcuts.map((shortcut, index) => (
                  <div key={index} className="shortcut-item">
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="key-separator">+</span>}
                          <kbd className="key">{key}</kbd>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="shortcut-description">{shortcut.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="panel-footer">
          <p>
            Press <kbd>?</kbd> anytime to show this panel
          </p>
        </div>
      </div>
    </div>
  );
};
