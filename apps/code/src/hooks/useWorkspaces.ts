import { useState, useEffect, useCallback } from 'react';
import { getWorkspaces as fetchWorkspaces } from '../services/workspaceService';
import type { WorkspaceDto } from '../services/workspaceService';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);
      setError(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load workspaces';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return {
    workspaces,
    isLoading,
    error,
  };
}
