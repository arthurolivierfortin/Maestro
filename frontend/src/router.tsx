/**
 * Application Router Configuration
 *
 * Defines all routes and navigation structure.
 */

import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { lazy } from 'react';

// Layouts
import IDELayout from '@/layouts/IDELayout';
import { LazyPage } from '@/utils/LazyPage';

// Lazy-loaded pages
const HomePage = lazy(() => import('@/pages/HomePage'));
const WorkflowsPage = lazy(() => import('@/pages/WorkflowsPage'));
const WorkflowEditorPage = lazy(() => import('@/pages/WorkflowEditorPage'));
const CanvasPage = lazy(() => import('@/pages/CanvasPage'));
const ExecutionMonitorPage = lazy(() => import('@/pages/ExecutionMonitorPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));
const BlockDemoPage = lazy(() => import('@/pages/BlockDemoPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/**
 * Route definitions
 */
const routes: RouteObject[] = [
  {
    path: '/',
    element: <IDELayout />,
    children: [
      {
        index: true,
        element: (
          <LazyPage>
            <HomePage />
          </LazyPage>
        ),
      },
      {
        path: 'workflows',
        element: (
          <LazyPage>
            <WorkflowsPage />
          </LazyPage>
        ),
      },
      {
        path: 'workflows/:id/edit',
        element: (
          <LazyPage>
            <WorkflowEditorPage />
          </LazyPage>
        ),
      },
      {
        path: 'workflows/new',
        element: (
          <LazyPage>
            <WorkflowEditorPage />
          </LazyPage>
        ),
      },
      {
        path: 'canvas',
        element: (
          <LazyPage>
            <CanvasPage />
          </LazyPage>
        ),
      },
      {
        path: 'executions/:id',
        element: (
          <LazyPage>
            <ExecutionMonitorPage />
          </LazyPage>
        ),
      },
      {
        path: 'history',
        element: (
          <LazyPage>
            <HistoryPage />
          </LazyPage>
        ),
      },
      {
        path: 'demo',
        element: (
          <LazyPage>
            <BlockDemoPage />
          </LazyPage>
        ),
      },
      {
        path: '*',
        element: (
          <LazyPage>
            <NotFoundPage />
          </LazyPage>
        ),
      },
    ],
  },
];

/**
 * Application router
 */
export const router = createBrowserRouter(routes);
