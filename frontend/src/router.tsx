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
const MultiNodeEditorPage = lazy(() => import('@/pages/MultiNodeEditorPage'));
const CanvasPage = lazy(() => import('@/pages/CanvasPage'));
const ExecutionMonitorPage = lazy(() => import('@/pages/ExecutionMonitorPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));
const ModelsPage = lazy(() => import('@/pages/ModelsPage'));
const BlockDemoPage = lazy(() => import('@/pages/BlockDemoPage'));
const FoundryPage = lazy(() => import('@/pages/FoundryPage'));
const AtomicBlockEditorPage = lazy(() => import('@/pages/AtomicBlockEditorPage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
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
        path: 'workflows/:id/edit',
        element: (
          <LazyPage>
            <MultiNodeEditorPage />
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
        path: 'canvas/:blockId',
        element: (
          <LazyPage>
            <CanvasPage />
          </LazyPage>
        ),
      },
      {
        path: 'foundry',
        element: (
          <LazyPage>
            <FoundryPage />
          </LazyPage>
        ),
      },
      {
        path: 'foundry/:blockType',
        element: (
          <LazyPage>
            <FoundryPage />
          </LazyPage>
        ),
      },
      {
        path: 'foundry/:blockId/edit',
        element: (
          <LazyPage>
            <AtomicBlockEditorPage />
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
        path: 'models',
        element: (
          <LazyPage>
            <ModelsPage />
          </LazyPage>
        ),
      },
      {
        path: 'projects',
        element: (
          <LazyPage>
            <ProjectsPage />
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
