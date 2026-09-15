import { describe, expect, it } from 'vitest';
import { getBlockingTasks, getIncompleteBlockers, wouldCreateCycle } from '@/lib/task-dependencies';
import type { Task } from '@/lib/types';

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    workspaceId: 'w1',
    projectId: 'p1',
    title: `Task ${id}`,
    description: '',
    status: 'todo',
    priority: 'medium',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    memberUserIds: [],
    ...overrides,
  };
}

const isCompletedStatus = (statusId: string) => statusId === 'done';

describe('wouldCreateCycle', () => {
  it('is false when the candidate blocker has no dependency chain', () => {
    const tasks = [makeTask('a'), makeTask('b')];
    expect(wouldCreateCycle(tasks, 'a', ['b'])).toBe(false);
  });

  it('is true when a task is set to block itself', () => {
    const tasks = [makeTask('a')];
    expect(wouldCreateCycle(tasks, 'a', ['a'])).toBe(true);
  });

  it('is true for a direct two-task cycle (b already depends on a)', () => {
    const tasks = [makeTask('a'), makeTask('b', { blockedByTaskIds: ['a'] })];
    // Trying to make 'a' depend on 'b' would close the loop a -> b -> a.
    expect(wouldCreateCycle(tasks, 'a', ['b'])).toBe(true);
  });

  it('is true for a longer transitive cycle (c -> b -> a, then a -> c)', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b', { blockedByTaskIds: ['a'] }),
      makeTask('c', { blockedByTaskIds: ['b'] }),
    ];
    expect(wouldCreateCycle(tasks, 'a', ['c'])).toBe(true);
  });

  it('is false when unrelated tasks share no dependency path', () => {
    const tasks = [
      makeTask('a'),
      makeTask('b'),
      makeTask('c', { blockedByTaskIds: ['b'] }),
    ];
    expect(wouldCreateCycle(tasks, 'a', ['c'])).toBe(false);
  });
});

describe('getIncompleteBlockers', () => {
  it('returns an empty array when the task has no blockers', () => {
    const tasks = [makeTask('a')];
    expect(getIncompleteBlockers(tasks, tasks[0], isCompletedStatus)).toEqual([]);
  });

  it('returns blockers that are not yet done', () => {
    const blocker = makeTask('b', { status: 'in_progress' });
    const task = makeTask('a', { blockedByTaskIds: ['b'] });
    expect(getIncompleteBlockers([task, blocker], task, isCompletedStatus)).toEqual([blocker]);
  });

  it('excludes blockers that are already done', () => {
    const blocker = makeTask('b', { status: 'done' });
    const task = makeTask('a', { blockedByTaskIds: ['b'] });
    expect(getIncompleteBlockers([task, blocker], task, isCompletedStatus)).toEqual([]);
  });

  it('treats a blocker id with no matching task as no longer blocking', () => {
    const task = makeTask('a', { blockedByTaskIds: ['deleted-task'] });
    expect(getIncompleteBlockers([task], task, isCompletedStatus)).toEqual([]);
  });
});

describe('getBlockingTasks', () => {
  it('finds tasks that list the given id as a blocker', () => {
    const a = makeTask('a');
    const b = makeTask('b', { blockedByTaskIds: ['a'] });
    const c = makeTask('c');
    expect(getBlockingTasks([a, b, c], 'a')).toEqual([b]);
  });

  it('returns an empty array when nothing depends on the task', () => {
    const tasks = [makeTask('a'), makeTask('b')];
    expect(getBlockingTasks(tasks, 'a')).toEqual([]);
  });
});
