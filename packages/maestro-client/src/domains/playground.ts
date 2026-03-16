import type { HttpTransport } from '../http.js';

// ── Playground Types ──────────────────────────────────────────

export interface PlaygroundRequest {
  modelId: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface PlaygroundResponse {
  content: string;
  modelId: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface CapabilityTest {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface CapabilityTestRequest {
  modelId: string;
  testId: string;
}

export interface CapabilityTestResult {
  testId: string;
  testName: string;
  passed: boolean;
  content: string;
  validationDetails: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
}

// ── Domain ────────────────────────────────────────────────────

export function playgroundDomain(http: HttpTransport) {
  return {
    /** Send a prompt to a model via the playground. */
    send: (request: PlaygroundRequest) =>
      http.post<PlaygroundResponse>('/api/playground', request),

    /** List available capability tests. */
    listTests: () =>
      http.get<CapabilityTest[]>('/api/playground/tests'),

    /** Run a capability test against a model. */
    runTest: (request: CapabilityTestRequest) =>
      http.post<CapabilityTestResult>('/api/playground/test', request),
  };
}
