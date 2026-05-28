import { useCostData } from '../hooks/useCostData';
import { CostCard } from '../components/CostCard';
import { SpendingBar } from '../components/SpendingBar';
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
    <div className="col" style={{ height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {isLoading && <div className="c2" style={{ fontSize: 13 }}>Loading cost data...</div>}

        {error && <div className="cerr" style={{ fontSize: 13 }}>Error: {error}</div>}

        {!isLoading && !error && summary && (
          <>
            {/* Cost summary cards */}
            <div className="row gap-12" style={{ flexWrap: 'wrap', marginBottom: 16, alignItems: 'stretch' }}>
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
            <div className="box" style={{ marginBottom: 16 }}>
              <div className="box-title">Spending Limits</div>
              <div className="box-body" style={{ paddingLeft: 0, paddingRight: 0 }}>
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
                  <div className="c2" style={{ fontSize: 12, padding: '4px 14px' }}>
                    No spending limits configured.
                  </div>
                )}
              </div>
            </div>

            {/* Provider breakdown */}
            {providerEntries.length > 0 && (
              <div className="box">
                <div className="box-title">Cost by Provider</div>
                <div className="box-body" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>provider</th>
                        <th style={{ textAlign: 'right' }}>cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerEntries.map(([name, data]) => (
                        <tr key={name}>
                          <td className="c1">{name}</td>
                          <td className="ca" style={{ textAlign: 'right' }}>${data.totalCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
