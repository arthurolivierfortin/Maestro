/**
 * Sessions Page
 *
 * Unified page for managing sessions, categories, templates, and sandbox images.
 * Part of the composable session architecture.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';
import { useSessionCategoryStore } from '../store/sessionCategoryStore';
import { useSessionTemplateStore } from '../store/sessionTemplateStore';
import { SessionList } from '../components/Sessions/SessionList';
import { SessionCategoryList } from '../components/Sessions/SessionCategoryList';
import { SessionTemplateList } from '../components/Sessions/SessionTemplateList';
import { SandboxImageList } from '../components/Sessions/SandboxImageList';
import './SessionsPage.scss';

type TabId = 'sessions' | 'categories' | 'templates' | 'images';

interface Tab {
  id: TabId;
  label: string;
  count?: number;
}

const SessionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId) || 'sessions';

  // Store state
  const sessions = useSessionStore((s) => s.sessions);
  const sessionsLoading = useSessionStore((s) => s.isLoading);
  const sessionsError = useSessionStore((s) => s.error);
  const loadSessions = useSessionStore((s) => s.loadSessions);

  const categories = useSessionCategoryStore((s) => s.categories);
  const categoriesLoading = useSessionCategoryStore((s) => s.isLoading);
  const loadCategories = useSessionCategoryStore((s) => s.loadCategories);

  const templates = useSessionTemplateStore((s) => s.templates);
  const templatesLoading = useSessionTemplateStore((s) => s.isLoading);
  const loadTemplates = useSessionTemplateStore((s) => s.loadTemplates);

  const [searchQuery, setSearchQuery] = useState('');

  // Load data on mount
  useEffect(() => {
    loadSessions();
    loadCategories();
    loadTemplates();
  }, [loadSessions, loadCategories, loadTemplates]);

  // Tab definitions
  const tabs: Tab[] = useMemo(
    () => [
      { id: 'sessions', label: 'Sessions', count: sessions.length },
      { id: 'categories', label: 'Categories', count: categories.length },
      { id: 'templates', label: 'Templates', count: templates.length },
      { id: 'images', label: 'Sandbox Images' },
    ],
    [sessions.length, categories.length, templates.length]
  );

  const setActiveTab = (tabId: TabId) => {
    setSearchParams({ tab: tabId });
  };

  // Count running sessions
  const runningCount = useMemo(
    () => sessions.filter((s) => s.status === 'running').length,
    [sessions]
  );

  const isLoading = sessionsLoading || categoriesLoading || templatesLoading;

  return (
    <div className="sessions-page">
      {/* Header */}
      <header className="sessions-page__header">
        <div className="sessions-page__title">
          <h1>Sessions</h1>
          <span className="sessions-page__count">
            {runningCount > 0 && (
              <span className="sessions-page__count-running">{runningCount} running</span>
            )}
            <span className="sessions-page__count-total">{sessions.length} total</span>
          </span>
        </div>

        <div className="sessions-page__actions">
          <div className="sessions-page__search">
            <svg
              className="sessions-page__search-icon"
              viewBox="0 0 16 16"
              fill="currentColor"
              width="16"
              height="16"
            >
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
            </svg>
            <input
              type="search"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sessions-page__search-input"
            />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="sessions-page__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sessions-page__tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="sessions-page__tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {sessionsError && (
        <div className="error-banner">
          <span>{sessionsError}</span>
          <button onClick={() => useSessionStore.getState().clearError()}>Dismiss</button>
        </div>
      )}

      {/* Content */}
      <div className="sessions-page__content">
        {isLoading && sessions.length === 0 && categories.length === 0 ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === 'sessions' && (
              <SessionList
                sessions={sessions}
                categories={categories}
                searchQuery={searchQuery}
              />
            )}
            {activeTab === 'categories' && (
              <SessionCategoryList
                categories={categories}
                searchQuery={searchQuery}
              />
            )}
            {activeTab === 'templates' && (
              <SessionTemplateList
                templates={templates}
                categories={categories}
                searchQuery={searchQuery}
              />
            )}
            {activeTab === 'images' && (
              <SandboxImageList searchQuery={searchQuery} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SessionsPage;
