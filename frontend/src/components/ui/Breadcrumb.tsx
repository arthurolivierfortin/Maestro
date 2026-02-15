/**
 * Phase 23: Breadcrumb navigation component for the web frontend.
 * Mirrors the TUI breadcrumb (shared/tui/components/Breadcrumb.ts).
 */

import './ui.scss';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
}

export function Breadcrumb({ items, separator = '/' }: BreadcrumbProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav className="ui-breadcrumb" aria-label="Breadcrumb">
      <ol style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        listStyle: 'none',
        margin: 0,
        padding: 0,
        fontSize: 'var(--font-size-sm)',
      }}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
              {index > 0 && (
                <span style={{ color: 'var(--text-tertiary)' }}>{separator}</span>
              )}
              {isLast ? (
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href || '#'}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                  style={{
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    transition: 'var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
