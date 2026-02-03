/**
 * Session type definitions (Phase 11 - Composable Session Architecture)
 *
 * Types for unified sessions, sandbox images, session templates, and user-defined categories.
 */

/**
 * Environment mode for sessions
 */
export type EnvironmentMode = 'sandbox' | 'repo';

/**
 * Source of sandbox images, templates, or categories
 */
export type ImageSource = 'built-in' | 'user-defined';
export type TemplateSource = 'built-in' | 'user-defined';
export type CategorySource = 'built-in' | 'user-defined';

/**
 * Session status
 */
export type SessionStatus =
  | 'created'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stopped';

/**
 * User-defined session category
 * Categories allow users to organize sessions by purpose.
 */
export interface SessionCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  source: CategorySource;
  isSystem: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Repository binding configuration
 */
export interface RepoBind {
  hostPath: string;
  containerPath: string;
  readOnly: boolean;
}

/**
 * Resource limits for containers
 */
export interface ResourceLimits {
  cpuLimit?: string;
  memoryLimit?: string;
  timeoutSeconds?: number;
}

/**
 * Access configuration
 */
export interface AccessConfig {
  level: string;
  allowedPaths: string[];
  deniedPaths: string[];
  requireApprovalPaths: string[];
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  runTests: boolean;
  testCommand?: string;
  runLinter: boolean;
  linterCommand?: string;
  requireCleanDiff: boolean;
  maxSteps: number;
  timeoutMs: number;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  mode: EnvironmentMode;
  sandboxImageId: string;
  categoryId?: string;
  repoBind?: RepoBind;
  templateId?: string;
  resources: ResourceLimits;
  access: AccessConfig;
  validation: ValidationConfig;
  environmentVariables: Record<string, string>;
  workingDirectory: string;
}

/**
 * File change record
 */
export interface FileChange {
  path: string;
  changeType: 'created' | 'modified' | 'deleted';
}

/**
 * Test result
 */
export interface TestResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  output?: string;
  durationMs: number;
}

/**
 * Linter result
 */
export interface LinterResult {
  clean: boolean;
  errorCount: number;
  warningCount: number;
  output?: string;
}

/**
 * Commit information
 */
export interface CommitInfo {
  commitHash: string;
  message: string;
  branch: string;
  pushed: boolean;
  createdAt: string;
}

/**
 * Unified Session entity
 */
export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  authority: string;
  config: SessionConfig;
  containerId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  commandCount: number;
  workingDirectory: string;
  modifiedFiles: FileChange[];
  errorMessage?: string;
  testResult?: TestResult;
  linterResult?: LinterResult;
  commitInfo?: CommitInfo;
}

/**
 * Session summary for lists
 */
export interface SessionSummary {
  id: string;
  name: string;
  status: SessionStatus;
  mode: EnvironmentMode;
  categoryId?: string;
  sandboxImageId: string;
  templateId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

/**
 * Sandbox Image entity
 */
export interface SandboxImage {
  id: string;
  name: string;
  description?: string;
  dockerImage: string;
  source: ImageSource;
  tags: string[];
  tools: string[];
  workingDirectory: string;
  defaultShell: string;
  defaultEnvironment: Record<string, string>;
  verified: boolean;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Session Template entity
 */
export interface SessionTemplate {
  id: string;
  name: string;
  description?: string;
  source: TemplateSource;
  mode: EnvironmentMode;
  sandboxImageId: string;
  categoryId?: string;
  tags: string[];
  resourceLimits?: ResourceLimits;
  accessConfig?: {
    level?: string;
    deniedPaths?: string[];
    deniedCommands?: string[];
  };
  defaultEnvironment: Record<string, string>;
  workingDirectory: string;
  icon?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a session
 */
export interface CreateSessionRequest {
  name: string;
  authority?: string;
  mode?: EnvironmentMode;
  sandboxImageId: string;
  categoryId?: string;
  repoBind?: RepoBind;
  resources?: ResourceLimits;
  access?: Partial<AccessConfig>;
  validation?: Partial<ValidationConfig>;
  environmentVariables?: Record<string, string>;
  workingDirectory?: string;
}

/**
 * Request to create a session from a template
 */
export interface CreateSessionFromTemplateRequest {
  name: string;
  authority?: string;
  repoBind?: RepoBind;
  environmentVariables?: Record<string, string>;
}

/**
 * Request to register a sandbox image
 */
export interface RegisterSandboxImageRequest {
  id: string;
  name: string;
  dockerImage: string;
  description?: string;
  tags?: string[];
  tools?: string[];
  workingDirectory?: string;
  defaultShell?: string;
  defaultEnvironment?: Record<string, string>;
}

/**
 * Request to update a sandbox image
 */
export interface UpdateSandboxImageRequest {
  name?: string;
  description?: string;
  dockerImage?: string;
  tags?: string[];
  tools?: string[];
  workingDirectory?: string;
  defaultShell?: string;
  defaultEnvironment?: Record<string, string>;
}

/**
 * Request to create a session template
 */
export interface CreateSessionTemplateRequest {
  id: string;
  name: string;
  description?: string;
  mode?: EnvironmentMode;
  sandboxImageId: string;
  categoryId?: string;
  tags?: string[];
  resourceLimits?: ResourceLimits;
  accessConfig?: {
    level?: string;
    deniedPaths?: string[];
    deniedCommands?: string[];
  };
  defaultEnvironment?: Record<string, string>;
  workingDirectory?: string;
  icon?: string;
  sortOrder?: number;
}

/**
 * Request to update a session template
 */
export interface UpdateSessionTemplateRequest {
  name?: string;
  description?: string;
  mode?: string;
  sandboxImageId?: string;
  categoryId?: string;
  tags?: string[];
  resourceLimits?: ResourceLimits;
  accessConfig?: {
    level?: string;
    deniedPaths?: string[];
    deniedCommands?: string[];
  };
  defaultEnvironment?: Record<string, string>;
  workingDirectory?: string;
  icon?: string;
  sortOrder?: number;
}

/**
 * Request to create a session category
 */
export interface CreateSessionCategoryRequest {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  displayOrder?: number;
}

/**
 * Request to update a session category
 */
export interface UpdateSessionCategoryRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  displayOrder?: number;
}

/**
 * Sandbox image verification result
 */
export interface SandboxImageVerificationResult {
  success: boolean;
  errorMessage?: string;
  imageId?: string;
  imageDigest?: string;
  verifiedAt: string;
}
