/**
 * Agent type definitions
 *
 * Represents AI agents and their capabilities.
 */

export type AgentType = 'Planner' | 'Coder' | 'Tester' | 'Reviewer' | 'Debugger';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  capabilities: string[];
  availableTools: string[];
}

export interface AgentExecution {
  agentId: string;
  agentType: AgentType;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'Running' | 'Completed' | 'Failed';
  startedAt: string;
  completedAt?: string;
  tokensUsed?: number;
  error?: string;
}

/**
 * Planner Agent - Breaks down tasks
 */
export interface PlannerAgent extends Agent {
  type: 'Planner';
}

export interface PlannerInput {
  task: string;
  context?: string;
  constraints?: string[];
}

export interface PlannerOutput {
  steps: PlanStep[];
  estimatedDuration?: string;
  dependencies?: string[];
}

export interface PlanStep {
  id: string;
  description: string;
  type: 'code' | 'test' | 'review' | 'debug';
  priority: 'high' | 'medium' | 'low';
}

/**
 * Coder Agent - Writes/modifies code
 */
export interface CoderAgent extends Agent {
  type: 'Coder';
}

export interface CoderInput {
  specification: string;
  language: string;
  existingCode?: string;
  context?: string;
}

export interface CoderOutput {
  code: string;
  explanation: string;
  files: CodeFile[];
}

export interface CodeFile {
  path: string;
  content: string;
  language: string;
}

/**
 * Tester Agent - Creates/runs tests
 */
export interface TesterAgent extends Agent {
  type: 'Tester';
}

export interface TesterInput {
  codeToTest: string;
  language: string;
  testFramework?: string;
}

export interface TesterOutput {
  tests: TestFile[];
  coverage?: number;
  summary: string;
}

export interface TestFile {
  path: string;
  content: string;
  testCount: number;
}

/**
 * Reviewer Agent - Code review
 */
export interface ReviewerAgent extends Agent {
  type: 'Reviewer';
}

export interface ReviewerInput {
  code: string;
  language: string;
  guidelines?: string[];
}

export interface ReviewerOutput {
  overallScore: number;
  issues: ReviewIssue[];
  suggestions: string[];
  approved: boolean;
}

export interface ReviewIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'performance' | 'style' | 'logic';
  message: string;
  line?: number;
  suggestion?: string;
}

/**
 * Debugger Agent - Investigates issues
 */
export interface DebuggerAgent extends Agent {
  type: 'Debugger';
}

export interface DebuggerInput {
  errorMessage: string;
  stackTrace?: string;
  code: string;
  context?: string;
}

export interface DebuggerOutput {
  rootCause: string;
  explanation: string;
  suggestedFix: string;
  fixedCode?: string;
}
