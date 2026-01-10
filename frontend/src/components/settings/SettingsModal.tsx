/**
 * Settings Modal Component
 *
 * Modal for switching style presets and theme mode.
 */

import { Modal } from '../common/Modal';
import { useThemeStore, StylePreset, ThemeMode } from '@store/themeStore';
import './SettingsModal.scss';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const presetDescriptions: Record<StylePreset, { name: string; description: string }> = {
  minimal: {
    name: 'Minimal Editor',
    description:
      'Typography-first, extremely calm, almost invisible UI chrome. Ideal for focused writing and code editing.',
  },
  structured: {
    name: 'Workflow Studio',
    description:
      'Structured panels, visible boundaries, clear zones. More expressive with defined element presence.',
  },
  balanced: {
    name: 'Dense IDE',
    description:
      'Compact, information-dense, professional engineering tool. Maximum efficiency for power users.',
  },
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { preset, mode, setPreset, setMode } = useThemeStore();

  const handlePresetChange = (newPreset: StylePreset) => {
    setPreset(newPreset);
  };

  const handleModeChange = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="md">
      <div className="settings-modal">
        <section className="settings-section">
          <h3 className="settings-section__title">Style Preset</h3>
          <p className="settings-section__description">
            Choose the visual identity for the application. Each preset supports light and dark
            modes.
          </p>

          <div className="preset-options">
            {(Object.keys(presetDescriptions) as StylePreset[]).map((presetKey) => (
              <label key={presetKey} className="preset-option">
                <input
                  type="radio"
                  name="preset"
                  value={presetKey}
                  checked={preset === presetKey}
                  onChange={() => handlePresetChange(presetKey)}
                  className="preset-option__radio"
                />
                <div className="preset-option__content">
                  <div className="preset-option__header">
                    <span className="preset-option__name">
                      {presetDescriptions[presetKey].name}
                    </span>
                    {preset === presetKey && <span className="preset-option__badge">Active</span>}
                  </div>
                  <span className="preset-option__description">
                    {presetDescriptions[presetKey].description}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3 className="settings-section__title">Theme Mode</h3>
          <p className="settings-section__description">
            Switch between light and dark color schemes.
          </p>

          <div className="theme-mode-options">
            <label className="theme-mode-option">
              <input
                type="radio"
                name="mode"
                value="light"
                checked={mode === 'light'}
                onChange={() => handleModeChange('light')}
                className="theme-mode-option__radio"
              />
              <span className="theme-mode-option__label">Light</span>
            </label>

            <label className="theme-mode-option">
              <input
                type="radio"
                name="mode"
                value="dark"
                checked={mode === 'dark'}
                onChange={() => handleModeChange('dark')}
                className="theme-mode-option__radio"
              />
              <span className="theme-mode-option__label">Dark</span>
            </label>
          </div>
        </section>
      </div>
    </Modal>
  );
}
