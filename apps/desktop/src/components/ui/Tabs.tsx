/**
 * Design System Tabs component.
 */

import './ui.scss';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeId, onChange, className = '' }: TabsProps) {
  return (
    <div className={`ui-tabs ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeId}
          className={`ui-tabs__tab ${tab.id === activeId ? 'ui-tabs__tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count != null && (
            <span style={{
              marginLeft: '0.375rem',
              fontSize: 'var(--font-size-xs)',
              opacity: 0.7,
            }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
