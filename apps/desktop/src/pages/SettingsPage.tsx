import React, { useState, useEffect } from 'react';
import { LLMConfigPanel } from '../components/settings/LLMConfigPanel';
import { Tabs } from '@components/ui';
import './SettingsPage.scss';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type SettingsTab = 'llm' | 'general' | 'about';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('llm');
  const [backendVersion, setBackendVersion] = useState<string>('—');
  const [authStatus, setAuthStatus] = useState<string>('—');

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.version) setBackendVersion(data.version);
      })
      .catch(() => {});

    fetch(`${API_URL}/api/auth/status`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setAuthStatus(data.isSetup ? 'Configured' : 'Not configured');
      })
      .catch(() => setAuthStatus('Unavailable'));
  }, []);

  const tabs = [
    { id: 'llm', label: 'LLM Provider' },
    { id: 'general', label: 'General' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div className="settings-page page-enter">
      <h1 className="settings-page__title">Settings</h1>

      <Tabs tabs={tabs} activeId={activeTab} onChange={(id) => setActiveTab(id as SettingsTab)} />

      <div className="settings-page__body">
        {activeTab === 'llm' && <LLMConfigPanel />}

        {activeTab === 'general' && (
          <div className="settings-panel">
            <h3 className="settings-panel__title">General Settings</h3>

            <div className="settings-panel__section">
              <h4>Security</h4>
              <p className="settings-panel__desc">API key authentication status</p>
              <div className="settings-panel__info-row">
                <span className="settings-panel__info-label">Auth Status</span>
                <span className="settings-panel__info-value">{authStatus}</span>
              </div>
            </div>

            <div className="settings-panel__section">
              <h4>Backend</h4>
              <p className="settings-panel__desc">API server configuration</p>
              <div className="settings-panel__info-row">
                <span className="settings-panel__info-label">API URL</span>
                <span className="settings-panel__info-value settings-panel__info-value--mono">{API_URL}</span>
              </div>
              <div className="settings-panel__info-row">
                <span className="settings-panel__info-label">Version</span>
                <span className="settings-panel__info-value">{backendVersion}</span>
              </div>
            </div>

            <div className="settings-panel__section">
              <h4>Data Directory</h4>
              <p className="settings-panel__desc">Local storage paths for Maestro data</p>
              <div className="settings-panel__info-row">
                <span className="settings-panel__info-label">Config</span>
                <span className="settings-panel__info-value settings-panel__info-value--mono">~/.maestro/</span>
              </div>
              <div className="settings-panel__info-row">
                <span className="settings-panel__info-label">Content</span>
                <span className="settings-panel__info-value settings-panel__info-value--mono">content/system/</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="settings-panel">
            <h3 className="settings-panel__title">About B-One Maestro</h3>
            <div className="settings-panel__section">
              <p className="settings-panel__desc">
                Autonomous Multi-Agent Workflow Orchestrator for Software Engineering Tasks.
              </p>
              <div className="settings-panel__info-row">
                <span className="settings-panel__info-label">Version</span>
                <span className="settings-panel__info-value">1.0.0</span>
              </div>
              <div className="settings-panel__info-row">
                <span className="settings-panel__info-label">Architecture</span>
                <span className="settings-panel__info-value">Block-based workflow orchestration</span>
              </div>
              <div className="settings-panel__info-row">
                <span className="settings-panel__info-label">Platform</span>
                <span className="settings-panel__info-value">Windows (Electron + .NET)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
