import type { Task } from '@/lib/types';

/**
 * Would giving `taskId` the blocker list `candidateBlockerIds` create a
 * dependency cycle? True if the task itself is listed as its own blocker,
 * or if any candidate blocker can already (transitively, via its own
 * blockedByTaskIds chain) reach back to `taskId` — meaning `taskId` would
 * end up depending on something that depends on it.
 */
export function wouldCreateCycle(
  tasks: Task[],
  taskId: string,
  candidateBlockerIds: string[]
): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]));

  function canReach(fromId: string, targetId: string, visited: Set<string>): boolean {
    if (fromId === targetId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);
    const blockers = byId.get(fromId)?.blockedByTaskIds ?? [];
    return blockers.some((id) => canReach(id, targetId, visited));
  }

  return candidateBlockerIds.some(
    (blockerId) => blockerId === taskId || canReach(blockerId, taskId, new Set())
  );
}

/**
 * Which of `task`'s blockers haven't reached a completed status yet (and
 * therefore still block `task` from being marked done). A blocker id with
 * no matching task (e.g. it was since deleted) is treated as no longer
 * blocking, rather than as an error.
 */
export function getIncompleteBlockers(
  tasks: Task[],
  task: Task,
  isCompletedStatus: (statusId: string) => boolean
): Task[] {
  if (!task.blockedByTaskIds?.length) return [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return task.blockedByTaskIds
    .map((id) => byId.get(id))
    .filter((blocker): blocker is Task => !!blocker && !isCompletedStatus(blocker.status));
}

/**
 * Tasks that list `taskId` as a blocker — i.e. what this task blocks.
 * Derived on read rather than stored, so it can never drift out of sync
 * with each task's own blockedByTaskIds (the single source of truth).
 */
export function getBlockingTasks(tasks: Task[], taskId: string): Task[] {
  return tasks.filter((t) => t.blockedByTaskIds?.includes(taskId));
}
