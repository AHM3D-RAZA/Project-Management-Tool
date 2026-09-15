import type { StatusConfig, Task } from '@/lib/types';

/**
 * Compares a task's current values against an in-flight update and
 * returns one human-readable line per field that actually changed.
 * Used to write task activity history entries — see useTasks.
 *
 * Assignees/tags/description/recurrence are reported as "updated"
 * without their new value (resolving assignee display names or showing
 * full description text isn't available at this layer — see useTasks).
 */
export function describeTaskChanges(
  before: Task,
  after: Partial<Task>,
  getStatusInfo: (statusId: string) => Pick<StatusConfig, 'name'>
): string[] {
  const lines: string[] = [];

  if (after.title !== undefined && after.title !== before.title) {
    lines.push(`Title changed to "${after.title}"`);
  }

  if (after.status !== undefined && after.status !== before.status) {
    lines.push(`Status changed to ${getStatusInfo(after.status).name}`);
  }

  if (after.priority !== undefined && after.priority !== before.priority) {
    lines.push(`Priority changed to ${after.priority}`);
  }

  if (after.dueDate !== undefined && after.dueDate !== before.dueDate) {
    lines.push(after.dueDate ? `Due date changed to ${after.dueDate.split('T')[0]}` : 'Due date removed');
  }

  if (after.assigneeUserIds !== undefined
    && JSON.stringify(after.assigneeUserIds) !== JSON.stringify(before.assigneeUserIds || [])) {
    lines.push('Assignees updated');
  }

  if (after.tags !== undefined && JSON.stringify(after.tags) !== JSON.stringify(before.tags || [])) {
    lines.push('Tags updated');
  }

  if (after.description !== undefined && after.description !== before.description) {
    lines.push('Description updated');
  }

  if (after.recurrence !== undefined
    && JSON.stringify(after.recurrence ?? null) !== JSON.stringify(before.recurrence ?? null)) {
    lines.push(after.recurrence ? 'Repeat schedule updated' : 'Repeat turned off');
  }

  return lines;
}
