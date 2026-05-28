import { colors, spacing, fontFamily } from '../theme/tokens';

const tabs = [
  { key: 1, label: 'Console', active: true },
  { key: 2, label: 'Spaces', active: false },
  { key: 3, label: 'Foundry', active: false },
  { key: 4, label: 'Models', active: false },
  { key: 5, label: 'Monitor', active: false },
];

export function Header() {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${spacing.sm} ${spacing.md}`,
      borderBottom: `1px solid ${colors.border}`,
      fontFamily,
      backgroundColor: colors.bg,
    }}>
      <span style={{ color: colors.accent, fontWeight: 700, fontSize: '14px' }}>
        MAESTRO CODE
      </span>
      <nav style={{ display: 'flex', gap: spacing.sm }}>
        {tabs.map((tab) => (
          <span
            key={tab.key}
            style={{
              color: tab.active ? colors.accent : colors.muted,
              opacity: tab.active ? 1 : 0.5,
              cursor: tab.active ? 'default' : 'not-allowed',
              fontSize: '13px',
            }}
          >
            [{tab.key}] {tab.label}
          </span>
        ))}
      </nav>
    </header>
  );
}
