import { useProviderData } from '../hooks/useProviderData';
import { ProviderHealthBadge } from '../components/ProviderHealthBadge';
import { ModelRow } from '../components/ModelRow';
import { colors, spacing, fontFamily } from '../theme/tokens';

export function ModelsPage() {
  const { health, models, stats, isLoading, error } = useProviderData();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily }}>
      {/* Status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        padding: `${spacing.sm} ${spacing.md}`,
        borderBottom: `1px solid ${colors.border}`,
        flexWrap: 'wrap',
      }}>
        {health && (
          <>
            <ProviderHealthBadge status={health.status} />
            {health.activeModel && (
              <span style={{ color: colors.fg, fontSize: '12px' }}>
                Active: <span style={{ color: colors.accent, fontWeight: 600 }}>{health.activeModel}</span>
              </span>
            )}
            <span style={{ color: colors.muted, fontSize: '11px' }}>
              {health.modelsLoaded} loaded | {health.device}
            </span>
          </>
        )}

        {stats && (
          <span style={{ marginLeft: 'auto', color: colors.muted, fontSize: '11px', display: 'flex', gap: spacing.sm }}>
            <span>Requests: <span style={{ color: colors.fg }}>{stats.totalRequests}</span></span>
            <span>Tokens: <span style={{ color: colors.fg }}>{stats.totalTokens}</span></span>
            {stats.avgLatencyMs > 0 && (
              <span>Avg: <span style={{ color: colors.fg }}>{Math.round(stats.avgLatencyMs)}ms</span></span>
            )}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ padding: spacing.md, color: colors.muted, fontSize: '13px' }}>
            Loading provider data...
          </div>
        )}

        {error && (
          <div style={{ padding: spacing.md, color: colors.error, fontSize: '13px' }}>
            Error: {error}
          </div>
        )}

        {!isLoading && !error && models && (
          models.models.length === 0 ? (
            <div style={{ padding: spacing.md, color: colors.muted, fontSize: '13px' }}>
              No models available.
            </div>
          ) : (
            models.models.map((model) => (
              <ModelRow key={model.modelId} model={model} />
            ))
          )
        )}
      </div>
    </div>
  );
}
