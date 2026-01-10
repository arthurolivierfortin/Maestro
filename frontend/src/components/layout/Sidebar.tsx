/**
 * Sidebar Component
 *
 * Left sidebar with file/workflow-style navigation.
 * Hierarchical and collapsible structure.
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.scss';

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  children?: SidebarItem[];
}

const navigationItems: SidebarItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: '🏠',
    path: '/',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: '🔄',
    path: '/workflows',
    children: [{ id: 'new-workflow', label: 'New Workflow', icon: '➕', path: '/workflows/new' }],
  },
  {
    id: 'executions',
    label: 'Executions',
    icon: '▶️',
    children: [{ id: 'execution-history', label: 'History', icon: '📜', path: '/history' }],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: '📊',
    children: [
      { id: 'logs', label: 'Logs', icon: '📝', path: '#' },
      { id: 'metrics', label: 'Metrics', icon: '📈', path: '#' },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['workflows']));

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const renderItem = (item: SidebarItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const active = isActive(item.path);

    return (
      <div key={item.id} className="sidebar-item-wrapper">
        {item.path ? (
          <Link
            to={item.path}
            className={`sidebar-item sidebar-item--level-${level} ${active ? 'sidebar-item--active' : ''}`}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
          >
            {hasChildren && (
              <button
                className="sidebar-item__expand"
                onClick={(e) => {
                  e.preventDefault();
                  toggleExpand(item.id);
                }}
              >
                <span className={`expand-icon ${isExpanded ? 'expand-icon--expanded' : ''}`}>
                  ▸
                </span>
              </button>
            )}
            <span className="sidebar-item__icon">{item.icon}</span>
            <span className="sidebar-item__label">{item.label}</span>
          </Link>
        ) : (
          <button
            className={`sidebar-item sidebar-item--level-${level} sidebar-item--folder`}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
            onClick={() => toggleExpand(item.id)}
          >
            <span className={`expand-icon ${isExpanded ? 'expand-icon--expanded' : ''}`}>▸</span>
            <span className="sidebar-item__icon">{item.icon}</span>
            <span className="sidebar-item__label">{item.label}</span>
          </button>
        )}

        {hasChildren && isExpanded && (
          <div className="sidebar-item__children">
            {item.children!.map((child) => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <h2 className="sidebar__title">Explorer</h2>
      </div>
      <nav className="sidebar__nav">{navigationItems.map((item) => renderItem(item))}</nav>
    </aside>
  );
}
