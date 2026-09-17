"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration, getElapsedSeconds, isTimerRunning } from '@/lib/time-tracking';
import type { Task } from '@/lib/types';
import type { NexusStore } from '@/hooks/use-nexus-store';

/**
 * Start/Stop timer control for a task, plus its running total and who
 * else (if anyone) currently has a timer going on it. The live "current
 * session" number is never stored — it's recomputed every second from
 * the stored start time, so it stays correct even if this panel is
 * closed and reopened mid-session.
 */
export function TimeTrackingSection({ task, store }: { task: Task; store: NexusStore }) {
  const currentUserId = store.currentUser?.id;
  const isRunningForMe = currentUserId ? isTimerRunning(task, currentUserId) : false;
  const myStartedAt = currentUserId ? task.activeTimers?.[currentUserId] : undefined;

  // Re-renders once a second while my timer runs so the live elapsed
  // time updates — the number itself is always derived fresh from
  // myStartedAt, nothing is accumulated in this component's state.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!isRunningForMe) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunningForMe]);

  const currentSessionSeconds = myStartedAt ? getElapsedSeconds(myStartedAt) : 0;

  const otherActiveTimerNames = Object.keys(task.activeTimers || {})
    .filter((uid) => uid !== currentUserId)
    .map((uid) => store.workspaceMembers.find((m) => m.userId === uid)?.displayName)
    .filter((name): name is string => !!name);

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Time Tracking</Label>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant={isRunningForMe ? 'destructive' : 'outline'}
          className="h-8 gap-1.5"
          onClick={() => (isRunningForMe ? store.stopTaskTimer(task.id) : store.startTaskTimer(task.id))}
        >
          {isRunningForMe ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {isRunningForMe ? 'Stop' : 'Start'} Timer
        </Button>

        <div className="text-sm">
          {isRunningForMe && (
            <span className="font-mono text-primary">{formatDuration(currentSessionSeconds)}</span>
          )}
          <span className={cn('text-muted-foreground', isRunningForMe && 'ml-2')}>
            Total: {formatDuration(task.totalTrackedSeconds || 0)}
          </span>
        </div>
      </div>

      {otherActiveTimerNames.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Also tracking now: {otherActiveTimerNames.join(', ')}
        </p>
      )}
    </div>
  );
}
