import { useProviderData } from '../hooks/useProviderData';
import { ProviderHealthBadge } from '../components/ProviderHealthBadge';
import { ModelRow } from '../components/ModelRow';

export function ModelsPage() {
  const { health, models, stats, isLoading, error } = useProviderData();

  return (
    <div className="col" style={{ height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* Provider status panel */}
        {(health || stats) && (
          <div className="box" style={{ marginBottom: 16 }}>
            <div className="box-title">Provider</div>
            <div className="box-body row gap-12" style={{ flexWrap: 'wrap' }}>
              {health && (
                <>
                  <ProviderHealthBadge status={health.status} />
                  {health.activeModel && (
                    <span className="c1" style={{ fontSize: 12 }}>
                      Active: <span className="ca bd">{health.activeModel}</span>
                    </span>
                  )}
                  <span className="c2" style={{ fontSize: 11 }}>
                    {health.modelsLoaded} loaded | {health.device}
                  </span>
                </>
              )}
              {stats && (
                <span className="c2 row gap-8" style={{ marginLeft: 'auto', fontSize: 11 }}>
                  <span>Requests: <span className="c1">{stats.totalRequests}</span></span>
                  <span>Tokens: <span className="c1">{stats.totalTokens}</span></span>
                  {stats.avgLatencyMs > 0 && (
                    <span>Avg: <span className="c1">{Math.round(stats.avgLatencyMs)}ms</span></span>
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {isLoading && <div className="c2" style={{ fontSize: 13 }}>Loading provider data...</div>}

        {error && <div className="cerr" style={{ fontSize: 13 }}>Error: {error}</div>}

        {!isLoading && !error && models && (
          <div className="box">
            <div className="box-title">Models</div>
            <div className="box-meta">{models.models.length}</div>
            <div className="box-body" style={{ paddingLeft: 0, paddingRight: 0 }}>
              {models.models.length === 0 ? (
                <div className="c2" style={{ fontSize: 13, padding: '4px 14px' }}>No models available.</div>
              ) : (
                models.models.map((model) => <ModelRow key={model.modelId} model={model} />)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
