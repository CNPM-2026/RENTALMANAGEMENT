/**
 * Opaque-Box E2E Test Execution Engine & Assertion Harness
 */

import { TestCase, TestResult, OverallSummary, TestContext, TierLevel } from './types';
import { ALL_FEATURES } from './contracts';

export class Assert {
  public static ok(value: any, message?: string) {
    if (!value) {
      throw new Error(message || `Assertion failed: expected truthy value, got ${JSON.stringify(value)}`);
    }
  }

  public static strictEqual(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
      throw new Error(message || `Assertion failed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  public static notStrictEqual(actual: any, expected: any, message?: string) {
    if (actual === expected) {
      throw new Error(message || `Assertion failed: expected values to differ, but both were ${JSON.stringify(actual)}`);
    }
  }

  public static deepStrictEqual(actual: any, expected: any, message?: string) {
    const act = JSON.stringify(actual);
    const exp = JSON.stringify(expected);
    if (act !== exp) {
      throw new Error(message || `Assertion failed: deep equality check failed.\nExpected: ${exp}\nActual:   ${act}`);
    }
  }

  public static match(str: string, regex: RegExp, message?: string) {
    if (!regex.test(str)) {
      throw new Error(message || `Assertion failed: expected "${str}" to match ${regex}`);
    }
  }

  public static doesNotMatch(str: string, regex: RegExp, message?: string) {
    if (regex.test(str)) {
      throw new Error(message || `Assertion failed: expected "${str}" NOT to match ${regex}`);
    }
  }

  public static includes(container: string | any[], element: any, message?: string) {
    if (!container.includes(element as any)) {
      throw new Error(message || `Assertion failed: expected collection to include ${JSON.stringify(element)}`);
    }
  }

  public static throws(fn: () => any, message?: string) {
    let threw = false;
    try {
      fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Assertion failed: expected function to throw error');
    }
  }
}

export class TestRegistry {
  private static tests: TestCase[] = [];

  public static register(test: TestCase) {
    this.tests.push(test);
  }

  public static registerBatch(tests: TestCase[]) {
    this.tests.push(...tests);
  }

  public static getAll(): TestCase[] {
    return this.tests;
  }

  public static clear() {
    this.tests = [];
  }
}

export interface RunnerOptions {
  tier?: TierLevel;
  feature?: string;
  filter?: string;
  verbose?: boolean;
  quiet?: boolean;
}

export async function runTestSuite(options: RunnerOptions = {}): Promise<OverallSummary> {
  const allTests = TestRegistry.getAll();
  const startTime = Date.now();

  const filteredTests = allTests.filter((t) => {
    if (options.tier && t.tier !== options.tier) return false;
    if (options.feature && t.featureId.toUpperCase() !== options.feature.toUpperCase()) return false;
    if (options.filter && !t.name.toLowerCase().includes(options.filter.toLowerCase()) && !t.id.toLowerCase().includes(options.filter.toLowerCase())) return false;
    return true;
  });

  if (!options.quiet) {
    console.log(`\n================================================================================`);
    console.log(`  5K-Rental Manager — Automated Opaque-Box E2E Test Suite Execution`);
    console.log(`================================================================================`);
    console.log(`Registered tests: ${allTests.length} | Target tests to run: ${filteredTests.length}\n`);
  }

  const results: TestResult[] = [];
  const overallSummary: OverallSummary = {
    totalTests: filteredTests.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    tiers: {
      1: { tier: 1, total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
      2: { tier: 2, total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
      3: { tier: 3, total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
      4: { tier: 4, total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
    },
    features: {},
  };

  for (const f of ALL_FEATURES) {
    overallSummary.features[f.id] = {
      featureId: f.id,
      featureName: f.name,
      tier1Count: 0,
      tier2Count: 0,
      tier3Count: 0,
      tier4Count: 0,
      total: 0,
      passed: 0,
      failed: 0,
    };
  }

  let currentTier: TierLevel | 0 = 0;

  for (const test of filteredTests) {
    if (test.tier !== currentTier && !options.quiet) {
      currentTier = test.tier;
      console.log(`\n--------------------------------------------------------------------------------`);
      console.log(`  RUNNING TIER ${currentTier} SUITE`);
      console.log(`--------------------------------------------------------------------------------`);
    }

    const testStart = Date.now();
    const ctx: TestContext = {
      logger: {
        info: (m) => options.verbose && console.log(`   [INFO] ${m}`),
        debug: (m) => options.verbose && console.log(`  [DEBUG] ${m}`),
        warn: (m) => console.log(`   [WARN] ${m}`),
        error: (m) => console.error(`  [ERROR] ${m}`),
      },
      recordStep: (step, details) => {
        if (options.verbose) {
          console.log(`   -> Step: ${step} ${details ? JSON.stringify(details) : ''}`);
        }
      },
      state: {},
    };

    let status: 'PASS' | 'FAIL' = 'PASS';
    let caughtError: Error | undefined;

    try {
      await test.run(ctx);
    } catch (err: any) {
      status = 'FAIL';
      caughtError = err;
    }

    const duration = Date.now() - testStart;
    results.push({ test, status, durationMs: duration, error: caughtError });

    // Update statistics
    overallSummary.tiers[test.tier].total++;
    overallSummary.tiers[test.tier].durationMs += duration;

    const featStat = overallSummary.features[test.featureId];
    if (featStat) {
      featStat.total++;
      if (test.tier === 1) featStat.tier1Count++;
      if (test.tier === 2) featStat.tier2Count++;
      if (test.tier === 3) featStat.tier3Count++;
      if (test.tier === 4) featStat.tier4Count++;
    }

    if (status === 'PASS') {
      overallSummary.passed++;
      overallSummary.tiers[test.tier].passed++;
      if (featStat) featStat.passed++;
      if (!options.quiet && options.verbose) {
        console.log(`  [PASS] ${test.id} - ${test.name} (${duration}ms)`);
      }
    } else {
      overallSummary.failed++;
      overallSummary.tiers[test.tier].failed++;
      if (featStat) featStat.failed++;
      console.error(`  [FAIL] ${test.id} - ${test.name} (${duration}ms)`);
      if (caughtError) {
        console.error(`         Reason: ${caughtError.message}`);
        if (options.verbose && caughtError.stack) {
          console.error(`         ${caughtError.stack.split('\n').slice(1, 4).join('\n         ')}`);
        }
      }
    }
  }

  overallSummary.durationMs = Date.now() - startTime;

  if (!options.quiet) {
    printSummaryReport(overallSummary);
  }

  return overallSummary;
}

function printSummaryReport(summary: OverallSummary) {
  console.log(`\n================================================================================`);
  console.log(`                           E2E TEST SUMMARY REPORT`);
  console.log(`================================================================================`);
  console.log(`Total Executed: ${summary.totalTests} | Passed: ${summary.passed} | Failed: ${summary.failed} | Elapsed: ${summary.durationMs}ms`);
  console.log(`Pass Rate: ${((summary.passed / (summary.totalTests || 1)) * 100).toFixed(2)}%\n`);

  console.log(`Tier Breakdown:`);
  console.log(`  Tier 1 (Feature Coverage):           ${summary.tiers[1].passed}/${summary.tiers[1].total} passed (${summary.tiers[1].durationMs}ms)`);
  console.log(`  Tier 2 (Boundary & Corner Cases):    ${summary.tiers[2].passed}/${summary.tiers[2].total} passed (${summary.tiers[2].durationMs}ms)`);
  console.log(`  Tier 3 (Cross-Feature Interactions): ${summary.tiers[3].passed}/${summary.tiers[3].total} passed (${summary.tiers[3].durationMs}ms)`);
  console.log(`  Tier 4 (Real-World User Scenarios):  ${summary.tiers[4].passed}/${summary.tiers[4].total} passed (${summary.tiers[4].durationMs}ms)`);
  console.log(`--------------------------------------------------------------------------------`);

  if (summary.failed === 0) {
    console.log(`  STATUS: ALL TESTS PASSED SUCCESSFULLY (Exit Code 0)`);
  } else {
    console.log(`  STATUS: TEST SUITE FAILED WITH ${summary.failed} DEFECT(S) (Exit Code 1)`);
  }
  console.log(`================================================================================\n`);
}
