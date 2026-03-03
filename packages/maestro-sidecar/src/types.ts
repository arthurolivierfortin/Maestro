export interface SidecarOptions {
  /** Root directory of the Maestro project. Auto-detected via MAESTRO_ROOT env or relative paths. */
  maestroRoot?: string;
  /** Directory containing pre-compiled binaries (dist/{platform}/). Enables bundled mode. */
  binaryDir?: string;
  /** Directory containing content/system/ (blocks, templates). Used in bundled mode. */
  contentDir?: string;
  /** Port for the backend. 0 = auto-assign. */
  backendPort?: number;
  /** Port for the LLM-Provider. 0 = auto-assign. */
  llmProviderPort?: number;
  /** Skip starting the LLM-Provider. */
  skipLlm?: boolean;
  /** Pipe child stdout/stderr to parent. */
  inheritStdio?: boolean;
  /** Timeout for health checks in ms. Default: 30000. */
  healthTimeout?: number;
  /** Callback invoked on stdout lines from child processes. */
  onLog?: (service: 'backend' | 'llm-provider', line: string) => void;
  /** Additional env vars to pass to child processes (e.g. provider config). */
  envOverrides?: Record<string, string>;
}

export interface ServiceInfo {
  name: string;
  port: number;
  pid: number | undefined;
  url: string;
  healthy: boolean;
}

export interface SidecarStatus {
  running: boolean;
  backend: ServiceInfo | null;
  llmProvider: ServiceInfo | null;
}
