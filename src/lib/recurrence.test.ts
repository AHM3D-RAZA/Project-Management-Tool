import { describe, expect, it } from 'vitest';
import { computeNextDueDate } from '@/lib/recurrence';

describe('computeNextDueDate', () => {
  it('advances by one day for a daily rule', () => {
    const next = computeNextDueDate('2026-01-01T00:00:00.000Z', { frequency: 'daily', interval: 1 });
    expect(next).toBe('2026-01-02T00:00:00.000Z');
  });

  it('advances by N weeks for a weekly rule with interval > 1', () => {
    const next = computeNextDueDate('2026-01-01T00:00:00.000Z', { frequency: 'weekly', interval: 2 });
    expect(next).toBe('2026-01-15T00:00:00.000Z');
  });

  it('advances by one month for a monthly rule', () => {
    const next = computeNextDueDate('2026-01-31T00:00:00.000Z', { frequency: 'monthly', interval: 1 });
    // date-fns clamps to the shorter month rather than overflowing into March.
    expect(next).toBe('2026-02-28T00:00:00.000Z');
  });

  it('treats an interval of 0 or negative as 1', () => {
    const next = computeNextDueDate('2026-01-01T00:00:00.000Z', { frequency: 'daily', interval: 0 });
    expect(next).toBe('2026-01-02T00:00:00.000Z');
  });
});
