"use client";

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Ban, Plus, X } from 'lucide-react';
import { getBlockingTasks, wouldCreateCycle } from '@/lib/task-dependencies';
import type { Task } from '@/lib/types';

/**
 * "Blocked by" (editable) and "Blocks" (read-only, derived) for a task.
 * Candidate blockers are scoped to the same project. A candidate that
 * would create a circular dependency is shown but disabled, rather than
 * hidden, so it's clear why it can't be picked.
 */
export function DependenciesSection({
  task,
  projectTasks,
  allWorkspaceTasks,
  isAdmin,
  isCompletedStatus,
  onChange,
}: {
  task: Task;
  projectTasks: Task[];
  allWorkspaceTasks: Task[];
  isAdmin: boolean;
  isCompletedStatus: (statusId: string) => boolean;
  onChange: (blockedByTaskIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const blockedByIds = task.blockedByTaskIds || [];
  const blockers = blockedByIds
    .map((id) => allWorkspaceTasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t);
  const blocking = getBlockingTasks(allWorkspaceTasks, task.id);
  const candidates = projectTasks.filter((t) => t.id !== task.id && !blockedByIds.includes(t.id));

  const addBlocker = (blockerId: string) => {
    onChange([...blockedByIds, blockerId]);
    setOpen(false);
  };

  const removeBlocker = (blockerId: string) => {
    onChange(blockedByIds.filter((id) => id !== blockerId));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Blocked by</Label>
        <div className="flex flex-wrap gap-2">
          {blockers.map((b) => (
            <Badge key={b.id} variant={isCompletedStatus(b.status) ? 'secondary' : 'outline'} className="gap-1">
              {b.title}
              {isAdmin && (
                <button type="button" onClick={() => removeBlocker(b.id)} aria-label={`Remove ${b.title} as a blocker`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {blockers.length === 0 && (
            <span className="text-xs text-muted-foreground">Not blocked by anything</span>
          )}
        </div>

        {isAdmin && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 border border-dashed rounded-full text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add blocker
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search tasks..." />
                <CommandList>
                  <CommandEmpty>No other tasks in this project.</CommandEmpty>
                  <CommandGroup>
                    {candidates.map((c) => {
                      const disabled = wouldCreateCycle(allWorkspaceTasks, task.id, [c.id]);
                      return (
                        <CommandItem
                          key={c.id}
                          disabled={disabled}
                          onSelect={() => addBlocker(c.id)}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{c.title}</span>
                          {disabled && <Ban className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {blocking.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Blocks</Label>
          <div className="flex flex-wrap gap-2">
            {blocking.map((b) => (
              <Badge key={b.id} variant="outline">{b.title}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
