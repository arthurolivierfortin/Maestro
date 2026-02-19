import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

export const LLMConfigPanel: React.FC = () => {
  const [azure, setAzure] = useState<AzureConfig>({ endpoint: '', apiKey: '', deployment: '' });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [azureTestResult, setAzureTestResult] = useState<string | null>(null);
  const [azureTesting, setAzureTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>('unknown');

  useEffect(() => {
    // Load current Azure config and active provider
    Promise.all([
      fetch(`${API_URL}/api/provider/azure`).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/api/provider/active`).then(r => r.ok ? r.json() : null)
    ]).then(([azureConfig, providerInfo]) => {
      if (azureConfig) {
        setAzure({
          endpoint: azureConfig.endpoint || '',
          apiKey: '', // Never returned from server
          deployment: azureConfig.deploymentName || ''
        });
      }
      if (providerInfo) {
        setActiveProvider(providerInfo.provider);
      }
    }).catch(() => {});
  }, []);

  const testLocalConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/provider/health`);
      if (res.ok) {
        const data = await res.json();
        setTestResult(`Connected! Status: ${data.status}, Model: ${data.activeModel || 'none'}`);
      } else {
        setTestResult(`Connection failed: ${res.status}`);
      }
    } catch (e: any) {
      setTestResult(`Connection error: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  const saveAzureConfig = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`${API_URL}/api/provider/azure`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: azure.endpoint,
          apiKey: azure.apiKey,
          deploymentName: azure.deployment
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSaveResult(data.message || 'Configuration saved.');
      } else {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setSaveResult(`Error: ${err.error}`);
      }
    } catch (e: any) {
      setSaveResult(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const testAzureConnection = async () => {
    setAzureTesting(true);
    setAzureTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/provider/azure/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: azure.endpoint || undefined,
          apiKey: azure.apiKey || undefined,
          deploymentName: azure.deployment || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAzureTestResult(`Connected! ${data.message}`);
      } else {
        setAzureTestResult(`Error: ${data.error} — ${data.details || ''}`);
      }
    } catch (e: any) {
      setAzureTestResult(`Connection error: ${e.message}`);
    } finally {
      setAzureTesting(false);
    }
  };

  return (
    <div className="settings-panel">
      <h3 className="settings-panel__title">LLM Provider</h3>

      <div className="settings-panel__section">
        <h4>Active Provider: <span style={{ color: activeProvider === 'azure' ? '#4fc3f7' : '#81c784' }}>{activeProvider}</span></h4>
      </div>

      <div className="settings-panel__section">
        <h4>Local LLM Provider</h4>
        <p className="settings-panel__desc">
          Connected to local LLM Provider via backend at {API_URL}
        </p>
        <button
          className="settings-panel__btn"
          onClick={testLocalConnection}
          disabled={testing}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {testResult && (
          <p className={`settings-panel__result ${testResult.includes('Connected') ? 'settings-panel__result--ok' : 'settings-panel__result--error'}`}>
            {testResult}
          </p>
        )}
      </div>

      <div className="settings-panel__section">
        <h4>Azure OpenAI (Optional)</h4>
        <p className="settings-panel__desc">
          Configure Azure OpenAI for cloud-based inference. Requires backend restart to take effect.
        </p>
        <div className="settings-panel__field">
          <label>Endpoint</label>
          <input
            type="text"
            placeholder="https://your-resource.openai.azure.com"
            value={azure.endpoint}
            onChange={(e) => setAzure({ ...azure, endpoint: e.target.value })}
          />
        </div>
        <div className="settings-panel__field">
          <label>API Key</label>
          <input
            type="password"
            placeholder="Enter your Azure API key"
            value={azure.apiKey}
            onChange={(e) => setAzure({ ...azure, apiKey: e.target.value })}
          />
        </div>
        <div className="settings-panel__field">
          <label>Deployment Name</label>
          <input
            type="text"
            placeholder="gpt-4o-mini"
            value={azure.deployment}
            onChange={(e) => setAzure({ ...azure, deployment: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button
            className="settings-panel__btn"
            onClick={saveAzureConfig}
            disabled={saving || !azure.endpoint || !azure.apiKey || !azure.deployment}
          >
            {saving ? 'Saving...' : 'Save Azure Config'}
          </button>
          <button
            className="settings-panel__btn"
            onClick={testAzureConnection}
            disabled={azureTesting || !azure.endpoint || !azure.apiKey}
          >
            {azureTesting ? 'Testing...' : 'Test Azure Connection'}
          </button>
        </div>
        {saveResult && (
          <p className={`settings-panel__result ${saveResult.includes('Error') ? 'settings-panel__result--error' : 'settings-panel__result--ok'}`}>
            {saveResult}
          </p>
        )}
        {azureTestResult && (
          <p className={`settings-panel__result ${azureTestResult.includes('Connected') ? 'settings-panel__result--ok' : 'settings-panel__result--error'}`}>
            {azureTestResult}
          </p>
        )}
      </div>
    </div>
  );
};
