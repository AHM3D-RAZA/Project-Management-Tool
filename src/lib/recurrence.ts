import { addDays, addWeeks, addMonths } from 'date-fns';
import type { RecurrenceRule } from '@/lib/types';

/**
 * Given a task's current due date and its recurrence rule, returns the ISO
 * due date for the next occurrence. Used when a recurring task is marked
 * complete, to schedule its replacement.
 */
export function computeNextDueDate(fromDueDate: string, rule: RecurrenceRule): string {
  const base = new Date(fromDueDate);
  const interval = Math.max(1, rule.interval);

  switch (rule.frequency) {
    case 'daily':
      return addDays(base, interval).toISOString();
    case 'weekly':
      return addWeeks(base, interval).toISOString();
    case 'monthly':
      return addMonths(base, interval).toISOString();
  }
}
