import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  getElapsedSeconds,
  getProjectTrackedSeconds,
  isTimerRunning,
  startTimer,
  stopTimer,
} from '@/lib/time-tracking';
import type { Task } from '@/lib/types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    workspaceId: 'w1',
    projectId: 'p1',
    title: 'Task 1',
    description: '',
    status: 'todo',
    priority: 'medium',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    memberUserIds: [],
    ...overrides,
  };
}

describe('isTimerRunning', () => {
  it('is false when no timer has been started', () => {
    expect(isTimerRunning(makeTask(), 'u1')).toBe(false);
  });

  it('is true once activeTimers has an entry for that user', () => {
    const task = makeTask({ activeTimers: { u1: '2026-01-01T00:00:00.000Z' } });
    expect(isTimerRunning(task, 'u1')).toBe(true);
  });

  it('only reflects the specific user asked about', () => {
    const task = makeTask({ activeTimers: { u1: '2026-01-01T00:00:00.000Z' } });
    expect(isTimerRunning(task, 'u2')).toBe(false);
  });
});

describe('startTimer', () => {
  it('adds an entry under the starting timestamp', () => {
    const now = new Date('2026-01-01T10:00:00.000Z');
    const result = startTimer(makeTask(), 'u1', now);
    expect(result).toEqual({ activeTimers: { u1: '2026-01-01T10:00:00.000Z' } });
  });

  it('preserves other users already running timers', () => {
    const task = makeTask({ activeTimers: { u2: '2026-01-01T09:00:00.000Z' } });
    const result = startTimer(task, 'u1', new Date('2026-01-01T10:00:00.000Z'));
    expect(result).toEqual({
      activeTimers: { u2: '2026-01-01T09:00:00.000Z', u1: '2026-01-01T10:00:00.000Z' },
    });
  });

  it('returns null if that user already has a timer running', () => {
    const task = makeTask({ activeTimers: { u1: '2026-01-01T09:00:00.000Z' } });
    expect(startTimer(task, 'u1', new Date('2026-01-01T10:00:00.000Z'))).toBeNull();
  });
});

describe('stopTimer', () => {
  it('returns null if that user has no timer running', () => {
    expect(stopTimer(makeTask(), 'u1')).toBeNull();
  });

  it('folds elapsed time into totalTrackedSeconds and clears the active entry', () => {
    const task = makeTask({
      activeTimers: { u1: '2026-01-01T10:00:00.000Z' },
      totalTrackedSeconds: 100,
    });
    const result = stopTimer(task, 'u1', new Date('2026-01-01T10:05:00.000Z'));
    expect(result).toEqual({
      update: { activeTimers: {}, totalTrackedSeconds: 400 },
      elapsedSeconds: 300,
    });
  });

  it('leaves other users running timers untouched', () => {
    const task = makeTask({
      activeTimers: { u1: '2026-01-01T10:00:00.000Z', u2: '2026-01-01T09:00:00.000Z' },
    });
    const result = stopTimer(task, 'u1', new Date('2026-01-01T10:01:00.000Z'));
    expect(result?.update.activeTimers).toEqual({ u2: '2026-01-01T09:00:00.000Z' });
  });

  it('starts totalTrackedSeconds from 0 when the task has never tracked time before', () => {
    const task = makeTask({ activeTimers: { u1: '2026-01-01T10:00:00.000Z' } });
    const result = stopTimer(task, 'u1', new Date('2026-01-01T10:00:10.000Z'));
    expect(result?.update.totalTrackedSeconds).toBe(10);
  });
});

describe('getElapsedSeconds', () => {
  it('computes whole seconds between two timestamps', () => {
    expect(getElapsedSeconds('2026-01-01T10:00:00.000Z', new Date('2026-01-01T10:01:30.000Z'))).toBe(90);
  });

  it('clamps to 0 rather than going negative if now is before the start', () => {
    expect(getElapsedSeconds('2026-01-01T10:00:00.000Z', new Date('2026-01-01T09:00:00.000Z'))).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formats hours and minutes when at least an hour has elapsed', () => {
    expect(formatDuration(3725)).toBe('1h 2m');
  });

  it('formats minutes and seconds under an hour', () => {
    expect(formatDuration(125)).toBe('2m 5s');
  });

  it('formats seconds only under a minute', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('treats 0 and negative durations as 0s', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(-5)).toBe('0s');
  });
});

describe('getProjectTrackedSeconds', () => {
  it('sums tracked time only for tasks in the given project', () => {
    const tasks = [
      makeTask({ id: 'a', projectId: 'p1', totalTrackedSeconds: 100 }),
      makeTask({ id: 'b', projectId: 'p1', totalTrackedSeconds: 50 }),
      makeTask({ id: 'c', projectId: 'p2', totalTrackedSeconds: 999 }),
    ];
    expect(getProjectTrackedSeconds(tasks, 'p1')).toBe(150);
  });

  it('treats tasks with no tracked time as 0', () => {
    const tasks = [makeTask({ id: 'a', projectId: 'p1' })];
    expect(getProjectTrackedSeconds(tasks, 'p1')).toBe(0);
  });
});
