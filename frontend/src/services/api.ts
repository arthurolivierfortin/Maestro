/**
 * API service for communicating with backend.
 * All business logic stays in backend - this is just communication.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:5001';

export const api = {
  /**
   * Hello World endpoint to validate connectivity.
   */
  async hello(): Promise<{ message: string; architecture: string; layers: string[] }> {
    const response = await fetch(`${API_BASE_URL}/api/workflows/hello`);
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get all workflows.
   */
  async getWorkflows(): Promise<Array<{ id: string; name: string; description?: string }>> {
    const response = await fetch(`${API_BASE_URL}/api/workflows`);
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
  },
};
