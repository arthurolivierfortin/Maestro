/**
 * Application Router Configuration
 *
 * Defines all routes and navigation structure.
 *
 * Consolidated pages:
 * - FoundryPage now handles both blocks and AgentFoundry content via tabs
 * - DemoPage removed (development only)
 * - CanvasPage and MultiNodeEditorPage merged into single editor experience
 */

import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { lazy } from 'react';

// Layouts
import IDELayout from '@/layouts/IDELayout';
import { LazyPage } from '@/utils/LazyPage';

// Lazy-loaded pages
const HomePage = lazy(() => import('@/pages/HomePage'));
const CanvasPage = lazy(() => import('@/pages/CanvasPage'));
const ExecutionMonitorPage = lazy(() => import('@/pages/ExecutionMonitorPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));
const ModelsPage = lazy(() => import('@/pages/ModelsPage'));
const ModelDetailPage = lazy(() => import('@/pages/ModelDetailPage'));
const FoundryPage = lazy(() => import('@/pages/FoundryPage'));
const AtomicBlockEditorPage = lazy(() => import('@/pages/AtomicBlockEditorPage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage'));
const TrainingPage = lazy(() => import('@/pages/TrainingPage'));
const MetricsPage = lazy(() => import('@/pages/MetricsPage'));
const MonitoringPage = lazy(() => import('@/pages/MonitoringPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/**
 * Route definitions
 *
 * Consolidated structure:
 * - /foundry - Main Foundry hub with tabs for Blocks, Agents, Tools, Templates
 * - /canvas/:blockId - Visual workflow editor
 * - /projects - Project management
 * - /training - Training sessions and comparison
 * - /models - LLM configuration
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
      // Canvas/Editor routes
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
        path: 'workflows/:id/edit',
        element: (
          <LazyPage>
            <CanvasPage />
          </LazyPage>
        ),
      },
      // Foundry routes - unified hub for blocks, agents, tools
      {
        path: 'foundry',
        element: (
          <LazyPage>
            <FoundryPage />
          </LazyPage>
        ),
      },
      {
        path: 'foundry/:tab',
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
      // Redirect old agent-foundry routes to foundry
      {
        path: 'agent-foundry',
        element: (
          <LazyPage>
            <FoundryPage />
          </LazyPage>
        ),
      },
      {
        path: 'agent-foundry/*',
        element: (
          <LazyPage>
            <FoundryPage />
          </LazyPage>
        ),
      },
      // Project routes
      {
        path: 'projects',
        element: (
          <LazyPage>
            <ProjectsPage />
          </LazyPage>
        ),
      },
      {
        path: 'projects/:id',
        element: (
          <LazyPage>
            <ProjectDetailPage />
          </LazyPage>
        ),
      },
      // Training & Metrics
      {
        path: 'training',
        element: (
          <LazyPage>
            <TrainingPage />
          </LazyPage>
        ),
      },
      {
        path: 'metrics',
        element: (
          <LazyPage>
            <MetricsPage />
          </LazyPage>
        ),
      },
      // Monitoring
      {
        path: 'monitoring',
        element: (
          <LazyPage>
            <MonitoringPage />
          </LazyPage>
        ),
      },
      // Configuration
      {
        path: 'models',
        element: (
          <LazyPage>
            <ModelsPage />
          </LazyPage>
        ),
      },
      {
        path: 'models/:id',
        element: (
          <LazyPage>
            <ModelDetailPage />
          </LazyPage>
        ),
      },
      // Execution & History
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
      // Catch-all
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
