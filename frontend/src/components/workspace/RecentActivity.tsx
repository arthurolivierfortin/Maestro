/**
 * Recent Activity Component
 *
 * Displays recent execution activity in the workspace.
 */

import React from 'react';
import './RecentActivity.scss';

interface ActivityItem {
  id: string;
  type: 'execution' | 'create' | 'update' | 'delete';
  blockName: string;
  blockType: string;
  status: 'success' | 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
  result?: string;
}

interface RecentActivityProps {
  workspaceId: string;
  limit?: number;
}

// Mock data - in production, this would come from an API
const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: 'act-1',
    type: 'execution',
    blockName: 'fitness-calculator',
    blockType: 'tool',
    status: 'success',
    message: 'executed',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    result: '0.847 fitness',
  },
  {
    id: 'act-2',
    type: 'execution',
    blockName: 'trainer-agent',
    blockType: 'agent',
    status: 'success',
    message: 'completed iteration 34',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'act-3',
    type: 'execution',
    blockName: 'experiment-pipeline',
    blockType: 'workflow',
    status: 'warning',
    message: 'paused',
    timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 'act-4',
    type: 'execution',
    blockName: 'tester-agent',
    blockType: 'agent',
    status: 'error',
    message: 'failed (timeout)',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
  },
];

const STATUS_CONFIG: Record<string, { icon: string; className: string }> = {
  success: { icon: '🟢', className: 'success' },
  warning: { icon: '🟡', className: 'warning' },
  error: { icon: '🔴', className: 'error' },
  info: { icon: '🔵', className: 'info' },
};

export const RecentActivity: React.FC<RecentActivityProps> = ({
  workspaceId: _workspaceId,
  limit = 5,
}) => {
  const activity = MOCK_ACTIVITY.slice(0, limit);

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  };

  if (activity.length === 0) {
    return (
      <div className="recent-activity recent-activity--empty">
        <h3>Recent Activity</h3>
        <p className="recent-activity__empty-text">
          No recent activity.
        </p>
      </div>
    );
  }

  return (
    <div className="recent-activity">
      <h3>Recent Activity</h3>
      <div className="recent-activity__list">
        {activity.map(item => {
          const statusConfig = STATUS_CONFIG[item.status];
          return (
            <div
              key={item.id}
              className={`recent-activity__item recent-activity__item--${statusConfig.className}`}
            >
              <span className="recent-activity__status">{statusConfig.icon}</span>
              <span className="recent-activity__time">
                {formatRelativeTime(item.timestamp)}
              </span>
              <span className="recent-activity__block">{item.blockName}</span>
              <span className="recent-activity__message">{item.message}</span>
              {item.result && (
                <span className="recent-activity__result">({item.result})</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentActivity;
