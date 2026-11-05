/**
 * E2E Test Suite Types and Contracts for 5K-Rental Manager
 */

export type TierLevel = 1 | 2 | 3 | 4;

export interface TestCase {
  id: string; // e.g., 'T1-F01-01'
  featureId: string; // e.g., 'F01'
  featureName: string; // e.g., 'Brand Renaming'
  tier: TierLevel;
  name: string; // Descriptive test title
  description: string;
  run: (ctx: TestContext) => Promise<void> | void;
}

export interface TestResult {
  test: TestCase;
  status: 'PASS' | 'FAIL' | 'SKIP';
  durationMs: number;
  error?: Error;
}

export interface TierSummary {
  tier: TierLevel;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export interface FeatureSummary {
  featureId: string;
  featureName: string;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  tier4Count: number;
  total: number;
  passed: number;
  failed: number;
}

export interface OverallSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  tiers: Record<TierLevel, TierSummary>;
  features: Record<string, FeatureSummary>;
}

export interface TestLogger {
  info(msg: string): void;
  debug(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export interface TestContext {
  logger: TestLogger;
  recordStep(stepName: string, details?: any): void;
  state: Record<string, any>;
}
