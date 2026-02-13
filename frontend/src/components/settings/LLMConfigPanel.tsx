import React, { useState } from 'react';

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

  const testConnection = async () => {
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

  return (
    <div className="settings-panel">
      <h3 className="settings-panel__title">LLM Provider</h3>

      <div className="settings-panel__section">
        <h4>Local LLM Provider</h4>
        <p className="settings-panel__desc">
          Connected to local LLM Provider at {API_URL}
        </p>
        <button
          className="settings-panel__btn"
          onClick={testConnection}
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
          Configure Azure OpenAI for cloud-based inference.
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
          <label>Deployment</label>
          <input
            type="text"
            placeholder="gpt-4o-mini"
            value={azure.deployment}
            onChange={(e) => setAzure({ ...azure, deployment: e.target.value })}
          />
        </div>
        <button className="settings-panel__btn" disabled={!azure.endpoint || !azure.apiKey}>
          Save Azure Config
        </button>
      </div>
    </div>
  );
};
