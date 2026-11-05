#!/usr/bin/env node
/**
 * 5K-Rental Manager — Automated Opaque-Box E2E Test Suite Runner
 *
 * Usage:
 *   npx tsx tests/e2e/runner.ts
 *   npx tsx tests/e2e/runner.ts --tier=1
 *   npx tsx tests/e2e/runner.ts --feature=F14
 *   npx tsx tests/e2e/runner.ts --filter=booking --verbose
 */

import { TestRegistry, runTestSuite, RunnerOptions } from './common/harness';
import { TierLevel } from './common/types';

// Import all test suites
import { tier1FoundationTests } from './tier1-features/f01-f12-foundation.test';
import { tier1TenantTests } from './tier1-features/f13-f26-tenant.test';
import { tier1LandlordTests } from './tier1-features/f27-f44-landlord.test';
import { tier1AdminTests } from './tier1-features/f45-f57-admin-qa.test';

import { tier2FoundationBoundaries } from './tier2-boundaries/f01-f12-boundaries.test';
import { tier2TenantBoundaries } from './tier2-boundaries/f13-f26-boundaries.test';
import { tier2LandlordBoundaries } from './tier2-boundaries/f27-f44-boundaries.test';
import { tier2AdminBoundaries } from './tier2-boundaries/f45-f57-boundaries.test';

import { tier3PairwiseTests } from './tier3-combinations/pairwise.test';
import { tier4ScenariosTests } from './tier4-scenarios/scenarios.test';

// Register all tests into the centralized registry
TestRegistry.registerBatch(tier1FoundationTests);
TestRegistry.registerBatch(tier1TenantTests);
TestRegistry.registerBatch(tier1LandlordTests);
TestRegistry.registerBatch(tier1AdminTests);

TestRegistry.registerBatch(tier2FoundationBoundaries);
TestRegistry.registerBatch(tier2TenantBoundaries);
TestRegistry.registerBatch(tier2LandlordBoundaries);
TestRegistry.registerBatch(tier2AdminBoundaries);

TestRegistry.registerBatch(tier3PairwiseTests);
TestRegistry.registerBatch(tier4ScenariosTests);

// Parse command line arguments
function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if ([1, 2, 3, 4].includes(val)) {
        options.tier = val as TierLevel;
      }
    } else if (arg.startsWith('--feature=')) {
      options.feature = arg.split('=')[1];
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const summary = await runTestSuite(options);

  if (summary.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error during test runner execution:', err);
  process.exit(1);
});
