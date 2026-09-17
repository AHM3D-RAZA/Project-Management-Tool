import type { Task } from '@/lib/types';

/**
 * Time tracking is modeled as two fields directly on the Task document
 * rather than a subcollection of individual sessions:
 *  - activeTimers: who currently has a timer running (userId -> start time)
 *  - totalTrackedSeconds: a running total, updated when a timer stops
 * This means "is someone tracking time on this task right now" and "how
 * much time has been tracked" both come for free from the task listener
 * every other field already uses — no separate query or listener needed
 * — and a project-level rollup is just summing a field already present
 * on every loaded task (see getProjectTrackedSeconds).
 *
 * Deliberately NOT modeled here: a per-session history log (who tracked
 * what, when) — only the running total survives past a stop. Scoped this
 * way to keep the feature to "start/stop a timer and see totals," not a
 * full timesheet/audit trail.
 *
 * Concurrency note: like every other mutation in this app (see
 * useTasks.updateTask), these compute their update from the caller's
 * locally-synced copy of the task rather than a Firestore transaction —
 * consistent with the rest of the codebase, not a gap introduced here.
 * Two people stopping the same OTHER person's timer can't happen (each
 * user only ever touches their own activeTimers entry), so the only real
 * race is two rapid stop/start calls for the same user, which is a
 * single-user UI interaction, not a cross-user one.
 */

/** Multiple users can each have their own timer running on the same task at once. */
export function isTimerRunning(task: Task, userId: string): boolean {
  return !!task.activeTimers?.[userId];
}

/**
 * Starts a timer for `userId` on `task`. Returns the partial update to
 * write, or null if that user already has a timer running here (call
 * stopTimer first).
 */
export function startTimer(
  task: Task,
  userId: string,
  now: Date = new Date()
): Pick<Task, 'activeTimers'> | null {
  if (isTimerRunning(task, userId)) return null;
  return {
    activeTimers: { ...(task.activeTimers || {}), [userId]: now.toISOString() },
  };
}

export interface StopTimerResult {
  update: Pick<Task, 'activeTimers' | 'totalTrackedSeconds'>;
  elapsedSeconds: number;
}

/**
 * Stops `userId`'s running timer on `task`, folding the elapsed time into
 * totalTrackedSeconds. Returns null if that user had no timer running.
 */
export function stopTimer(
  task: Task,
  userId: string,
  now: Date = new Date()
): StopTimerResult | null {
  const startedAtIso = task.activeTimers?.[userId];
  if (!startedAtIso) return null;

  const elapsedSeconds = getElapsedSeconds(startedAtIso, now);
  const remainingTimers = { ...task.activeTimers };
  delete remainingTimers[userId];

  return {
    update: {
      activeTimers: remainingTimers,
      totalTrackedSeconds: (task.totalTrackedSeconds || 0) + elapsedSeconds,
    },
    elapsedSeconds,
  };
}

/** Whole seconds elapsed between an ISO timestamp and `now`. Never negative (clamped to 0). */
export function getElapsedSeconds(startedAtIso: string, now: Date = new Date()): number {
  const startMs = new Date(startedAtIso).getTime();
  return Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
}

/** Formats a duration for display: "1h 23m", "45m 12s", or "12s" — whichever units are non-zero, coarsest first. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

/** Sums totalTrackedSeconds across every task in a project — the project-level time rollup. */
export function getProjectTrackedSeconds(tasks: Task[], projectId: string): number {
  return tasks
    .filter((t) => t.projectId === projectId)
    .reduce((sum, t) => sum + (t.totalTrackedSeconds || 0), 0);
}
