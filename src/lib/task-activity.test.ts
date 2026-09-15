import { describe, expect, it } from 'vitest';
import { describeTaskChanges } from '@/lib/task-activity';
import type { Task } from '@/lib/types';

const baseTask: Task = {
  id: 't1',
  workspaceId: 'w1',
  projectId: 'p1',
  title: 'Original title',
  description: 'Original description',
  status: 'todo',
  priority: 'medium',
  dueDate: '2026-01-01T00:00:00.000Z',
  assigneeUserIds: ['u1'],
  tags: ['a'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  memberUserIds: ['u1', 'u2'],
  recurrence: null,
};

const getStatusInfo = (id: string) => ({ name: id === 'done' ? 'Done' : id === 'todo' ? 'To Do' : id });

describe('describeTaskChanges', () => {
  it('returns no lines when nothing changed', () => {
    expect(describeTaskChanges(baseTask, {}, getStatusInfo)).toEqual([]);
  });

  it('describes a title change', () => {
    expect(describeTaskChanges(baseTask, { title: 'New title' }, getStatusInfo))
      .toEqual(['Title changed to "New title"']);
  });

  it('describes a status change using the resolved status name', () => {
    expect(describeTaskChanges(baseTask, { status: 'done' }, getStatusInfo))
      .toEqual(['Status changed to Done']);
  });

  it('describes a priority change', () => {
    expect(describeTaskChanges(baseTask, { priority: 'high' }, getStatusInfo))
      .toEqual(['Priority changed to high']);
  });

  it('describes a due date change and a due date removal separately', () => {
    expect(describeTaskChanges(baseTask, { dueDate: '2026-02-01T00:00:00.000Z' }, getStatusInfo))
      .toEqual(['Due date changed to 2026-02-01']);
    expect(describeTaskChanges(baseTask, { dueDate: null }, getStatusInfo))
      .toEqual(['Due date removed']);
  });

  it('describes assignee, tag, description, and recurrence changes generically', () => {
    expect(describeTaskChanges(baseTask, { assigneeUserIds: ['u1', 'u2'] }, getStatusInfo))
      .toEqual(['Assignees updated']);
    expect(describeTaskChanges(baseTask, { tags: ['a', 'b'] }, getStatusInfo))
      .toEqual(['Tags updated']);
    expect(describeTaskChanges(baseTask, { description: 'New description' }, getStatusInfo))
      .toEqual(['Description updated']);
    expect(describeTaskChanges(baseTask, { recurrence: { frequency: 'daily', interval: 1 } }, getStatusInfo))
      .toEqual(['Repeat schedule updated']);
    expect(describeTaskChanges({ ...baseTask, recurrence: { frequency: 'daily', interval: 1 } }, { recurrence: null }, getStatusInfo))
      .toEqual(['Repeat turned off']);
  });

  it('does not report a field as changed when the update sets it to the same value', () => {
    expect(describeTaskChanges(baseTask, { priority: 'medium', assigneeUserIds: ['u1'] }, getStatusInfo))
      .toEqual([]);
  });

  it('combines multiple simultaneous changes into multiple lines', () => {
    const lines = describeTaskChanges(baseTask, { status: 'done', priority: 'urgent' }, getStatusInfo);
    expect(lines).toEqual(['Status changed to Done', 'Priority changed to urgent']);
  });
});
