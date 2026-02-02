/**
 * Model Capability Test Types
 *
 * Types for comprehensive model capability testing and results display.
 * Follows the schema at docs/schemas/model-test-result.schema.json
 */

// Test classification levels
export type TestClassification = 'Excellent' | 'Good' | 'Medium' | 'Weak' | 'Insufficient';

// Capability quality assessment
export type CapabilityQuality = 'excellent' | 'good' | 'partial' | 'poor' | 'none';

// Maestro compatibility rating
export type MaestroCompatibility = 'Excellent' | 'Good' | 'Limited' | 'NotRecommended';

// Evaluation methods for tests
export type EvaluationMethod = 'exact' | 'contains' | 'contains_all' | 'regex' | 'semantic' | 'json_valid' | 'yaml_valid' | 'tool_call_format' | 'word_count' | 'format_check' | 'no_tool_call' | 'manual';

// Test categories
export type TestCategory = 'outputFormat' | 'instructionFollowing' | 'contextMemory' | 'reasoning' | 'toolCalling' | 'codeGeneration' | 'creativity' | 'safety';

/**
 * Test execution metadata
 */
export interface TestMeta {
  testId: string;
  timestamp: string;
  duration: {
    totalMs: number;
    perTestAvgMs: number;
  };
  tester: string;
  environment: {
    llmProviderUrl: string;
    gpu: string;
    vramAvailable: string;
    platform: string;
  };
  templateVersion: string;
}

/**
 * Model information
 */
export interface TestModelInfo {
  id: string;
  displayName: string;
  provider: string;
  version?: string;
  parameters?: string;
  quantization?: 'fp32' | 'fp16' | 'int8' | 'int4' | 'none';
  contextWindow?: number;
  vramUsage?: string;
  loadTimeMs?: number;
}

/**
 * Test result summary
 */
export interface TestSummary {
  totalScore: number;
  maxScore: number;
  percentage: number;
  classification: TestClassification;
  passedTests: number;
  failedTests: number;
  skippedTests?: number;
  categoryScores: Record<TestCategory, {
    score: number;
    maxScore: number;
    percentage: number;
  }>;
}

/**
 * Individual test result
 */
export interface TestResult {
  testId: string;
  name: string;
  description?: string;
  score: number;
  maxScore: number;
  passed: boolean;
  prompt: {
    system?: string;
    user: string;
  };
  response: {
    raw: string;
    truncated: boolean;
    tokensGenerated: number;
    durationMs: number;
  };
  expected: string;
  evaluation: {
    method: EvaluationMethod;
    matched: boolean;
    explanation: string;
    partialCredit: number;
  };
  notes?: string;
}

/**
 * Test category with all tests
 */
export interface TestCategoryResult {
  score: number;
  maxScore: number;
  percentage: number;
  tests: TestResult[];
}

/**
 * Performance metrics
 */
export interface TestPerformance {
  tokensPerSecond: number;
  timeToFirstToken: number;
  avgResponseTimeMs: number;
  totalTokensGenerated: number;
  totalTokensInput: number;
  estimatedCostUsd?: number;
}

/**
 * Capability assessment
 */
export interface CapabilityAssessment {
  supported: boolean;
  confidence: number; // 0-1
  quality: CapabilityQuality;
  notes?: string;
}

/**
 * All capability assessments
 */
export interface ModelCapabilities {
  toolCalling: CapabilityAssessment;
  jsonOutput: CapabilityAssessment;
  codeGeneration: CapabilityAssessment;
  reasoning: CapabilityAssessment;
  multiTurn: CapabilityAssessment;
  systemPromptAdherence: CapabilityAssessment;
}

/**
 * Usage recommendations
 */
export interface TestRecommendations {
  bestUseCases: string[];
  avoidFor: string[];
  suggestedConfig: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    systemPromptTips?: string[];
  };
  maestroCompatibility: {
    forAgents: MaestroCompatibility;
    forInference: MaestroCompatibility;
    forEvaluation: MaestroCompatibility;
  };
}

/**
 * Strength item
 */
export interface StrengthItem {
  area: string;
  description: string;
  evidence: string;
}

/**
 * Weakness item
 */
export interface WeaknessItem {
  area: string;
  description: string;
  evidence: string;
  severity: 'critical' | 'major' | 'minor';
}

/**
 * Quirk/workaround item
 */
export interface QuirkItem {
  behavior: string;
  workaround: string;
}

/**
 * Qualitative analysis
 */
export interface QualitativeAnalysis {
  strengths: StrengthItem[];
  weaknesses: WeaknessItem[];
  quirks: QuirkItem[];
  overallAssessment: string;
}

/**
 * Baseline comparison
 */
export interface ComparisonBaseline {
  baselineModel: string;
  scoreDifference: number;
  betterAt: string[];
  worseAt: string[];
}

/**
 * Complete model test result
 */
export interface ModelTestResult {
  meta: TestMeta;
  model: TestModelInfo;
  summary: TestSummary;
  categories: Partial<Record<TestCategory, TestCategoryResult>>;
  performance: TestPerformance;
  capabilities: ModelCapabilities;
  recommendations: TestRecommendations;
  qualitativeAnalysis: QualitativeAnalysis;
  comparisonBaseline?: ComparisonBaseline;
}

/**
 * List of test runs for a model
 */
export interface ModelTestRunList {
  modelId: string;
  runs: Array<{
    testId: string;
    timestamp: string;
    score: number;
    maxScore: number;
    classification: TestClassification;
  }>;
}

/**
 * Request to run capability tests
 */
export interface RunCapabilityTestsRequest {
  modelId: string;
  categories?: TestCategory[];
  baselineModelId?: string;
}
