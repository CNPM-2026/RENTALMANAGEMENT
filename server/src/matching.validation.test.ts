import { describe, expect, it } from 'vitest';
import { matchingPreferencesSchema } from './validations/matching.validation';

describe('matching preference validation', () => {
  it('rejects an empty preference object', () => {
    expect(matchingPreferencesSchema.safeParse({}).success).toBe(false);
  });

  it('accepts district, ward and budget criteria', () => {
    const result = matchingPreferencesSchema.safeParse({
      budgetMin: 1000000,
      budgetMax: 5000000,
      preferredDistrict: 'District 1',
      preferredWard: 'Ben Nghe',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an inverted budget range', () => {
    const result = matchingPreferencesSchema.safeParse({
      budgetMin: 5000000,
      budgetMax: 1000000,
    });

    expect(result.success).toBe(false);
  });
});
