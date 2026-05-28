import { useCostData } from '../hooks/useCostData';
import { CostCard } from '../components/CostCard';
import { SpendingBar } from '../components/SpendingBar';
import { colors, spacing, fontFamily } from '../theme/tokens';
import type { CostLimitConfig } from '../services/costsService';

interface LimitEntry {
  label: string;
  config: CostLimitConfig;
  current: number;
}

export function MonitorPage() {
  const { summary, limits, isLoading, error } = useCostData();

  const limitEntries: LimitEntry[] = [];
  if (limits && summary) {
    if (limits.maxPerDay?.value != null) {
      limitEntries.push({ label: 'Daily Limit', config: limits.maxPerDay, current: summary.today.totalCost });
    }
    if (limits.maxPerWeek?.value != null) {
      limitEntries.push({ label: 'Weekly Limit', config: limits.maxPerWeek, current: summary.thisWeek.totalCost });
    }
    if (limits.maxPerMonth?.value != null) {
      limitEntries.push({ label: 'Monthly Limit', config: limits.maxPerMonth, current: summary.thisMonth.totalCost });
    }
    if (limits.maxPerSession?.value != null) {
      limitEntries.push({ label: 'Session Limit', config: limits.maxPerSession, current: 0 });
    }
  }

  const hasLimits = limitEntries.length > 0;
  const providerEntries = summary ? Object.entries(summary.byProvider) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily }}>
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: spacing.md }}>
        {isLoading && (
          <div style={{ color: colors.muted, fontSize: '13px' }}>
            Loading cost data...
          </div>
        )}

        {error && (
          <div style={{ color: colors.error, fontSize: '13px' }}>
            Error: {error}
          </div>
        )}

        {!isLoading && !error && summary && (
          <>
            {/* Cost summary cards */}
            <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', marginBottom: spacing.lg }}>
              <CostCard
                label="Today"
                value={`$${summary.today.totalCost.toFixed(2)}`}
                subLabel={`${summary.today.requestCount} requests`}
              />
              <CostCard
                label="This Week"
                value={`$${summary.thisWeek.totalCost.toFixed(2)}`}
                subLabel={`${summary.thisWeek.requestCount} requests`}
              />
              <CostCard
                label="This Month"
                value={`$${summary.thisMonth.totalCost.toFixed(2)}`}
                subLabel={`${summary.thisMonth.requestCount} requests`}
              />
              <CostCard
                label="All Time"
                value={`$${summary.allTime.totalCost.toFixed(2)}`}
                subLabel={`${summary.allTime.requestCount} requests`}
              />
            </div>

            {/* Spending limits */}
            <div style={{ marginBottom: spacing.lg }}>
              <div style={{ color: colors.fg, fontSize: '13px', fontWeight: 600, marginBottom: spacing.sm, borderBottom: `1px solid ${colors.border}`, paddingBottom: spacing.xs }}>
                Spending Limits
              </div>
              {hasLimits ? (
                limitEntries.map((entry) => (
                  <SpendingBar
                    key={entry.label}
                    label={entry.label}
                    current={entry.current}
                    max={entry.config.value ?? 0}
                    enforcement={entry.config.enforcement}
                  />
                ))
              ) : (
                <div style={{ color: colors.muted, fontSize: '12px', padding: `${spacing.xs} ${spacing.md}` }}>
                  No spending limits configured.
                </div>
              )}
            </div>

            {/* Provider breakdown */}
            {providerEntries.length > 0 && (
              <div>
                <div style={{ color: colors.fg, fontSize: '13px', fontWeight: 600, marginBottom: spacing.sm, borderBottom: `1px solid ${colors.border}`, paddingBottom: spacing.xs }}>
                  Cost by Provider
                </div>
                {providerEntries.map(([name, data]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: `${spacing.xs} ${spacing.md}`, fontSize: '12px' }}>
                    <span style={{ color: colors.fg }}>{name}</span>
                    <span style={{ color: colors.accent }}>${data.totalCost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
