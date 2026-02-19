/**
 * useProjectsInitialization Hook
 *
 * Fetches projects from the backend API and populates the local projectStore.
 * Also handles discovering projects from mounted paths.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';

/**
 * Hook return type
 */
interface UseProjectsInitializationResult {
  isLoading: boolean;
  error: string | null;
  projectsCount: number;
  refresh: () => Promise<void>;
  discoverProjects: (path: string) => Promise<void>;
}

/**
 * Hook to initialize projects from the backend
 */
export function useProjectsInitialization(): UseProjectsInitializationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectsCount, setProjectsCount] = useState(0);
  const fetchProjects = useProjectStore((state) => state.fetchProjects);
  const storeDiscoverProjects = useProjectStore((state) => state.discoverProjects);
  const hasFetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await fetchProjects();
      const projects = useProjectStore.getState().projects;
      setProjectsCount(projects.length);
      console.log(`[ProjectsInit] Loaded ${projects.length} projects from backend`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch projects';
      setError(message);
      console.error('[ProjectsInit] Error fetching projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProjects]);

  const discoverProjects = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await storeDiscoverProjects(path);
      const projects = useProjectStore.getState().projects;
      setProjectsCount(projects.length);
      console.log(`[ProjectsInit] Discovered projects in ${path}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discover projects';
      setError(message);
      console.error('[ProjectsInit] Error discovering projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [storeDiscoverProjects]);

  // Auto-fetch on mount - only once
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      refresh();
    }
  }, [refresh]);

  return {
    isLoading,
    error,
    projectsCount,
    refresh,
    discoverProjects,
  };
}

export default useProjectsInitialization;
