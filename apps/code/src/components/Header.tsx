import { colors, spacing, fontFamily } from '../theme/tokens';
import type { PageId } from '../App';

interface TabDef {
  key: number;
  label: string;
  pageId: PageId | null;
}

const tabs: TabDef[] = [
  { key: 1, label: 'Console', pageId: 'console' },
  { key: 2, label: 'Spaces', pageId: 'spaces' },
  { key: 3, label: 'Catalog', pageId: 'catalog' },
  { key: 4, label: 'Models', pageId: 'models' },
  { key: 5, label: 'Monitor', pageId: null },
];

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export function Header({ currentPage, onNavigate }: HeaderProps) {
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
        {tabs.map((tab) => {
          const isActive = tab.pageId === currentPage;
          const isEnabled = tab.pageId !== null;
          return (
            <span
              key={tab.key}
              onClick={isEnabled ? () => onNavigate(tab.pageId!) : undefined}
              style={{
                color: isActive ? colors.accent : colors.muted,
                opacity: isActive ? 1 : 0.5,
                cursor: isEnabled ? 'pointer' : 'not-allowed',
                fontSize: '13px',
              }}
            >
              [{tab.key}] {tab.label}
            </span>
          );
        })}
      </nav>
    </header>
  );
}
