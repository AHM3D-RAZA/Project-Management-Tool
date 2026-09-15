"use client";

import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Task, Priority, Subtask, WorkspaceMemberWithRole, CurrentUser, StatusConfig } from '@/lib/types';
import { getIncompleteBlockers } from '@/lib/task-dependencies';
import { 
  CheckCircle2, 
  MoreVertical,
  ChevronDown,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const priorityColors: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const getStatusInfo = (statuses: StatusConfig[], statusId: string) => {
  const status = statuses.find(s => s.id === statusId);
  return status || { id: statusId, name: statusId, color: '#94a3b8', isDefault: false };
};

export function TaskList({ 
  tasks, 
  onTaskClick, 
  updateTask,
  deleteTask,
  readOnly = false,
  subtasks = [],
  workspaceMembers = [],
  currentUser = null,
  pipelines = [],
  allWorkspaceTasks = [],
  isCompletedStatus = (statusId: string) => statusId === 'done',
}: { 
  tasks: Task[], 
  onTaskClick: (id: string) => void,
  updateTask: (id: string, data: Partial<Task>) => boolean,
  deleteTask?: (id: string) => void | Promise<void>,
  readOnly?: boolean,
  subtasks?: Subtask[],
  workspaceMembers?: WorkspaceMemberWithRole[],
  currentUser?: CurrentUser | null,
  pipelines?: StatusConfig[],
  /** Full (unfiltered) task set, used to look up blockers that may not be in the currently-visible `tasks` list. */
  allWorkspaceTasks?: Task[],
  isCompletedStatus?: (statusId: string) => boolean,
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Drop any selected ids that are no longer in view (filtered out, or the
  // task itself was deleted/moved elsewhere) so the count stays accurate.
  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(tasks.map((t) => t.id));
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);

  const firstPipelineId = pipelines.length > 0 ? pipelines[0].id : 'todo';
  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(tasks.map((t) => t.id)));
  };

  const toggleSelectOne = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkStatusChange = (statusId: string) => {
    selectedIds.forEach((id) => updateTask(id, { status: statusId }));
    toast({ title: `Status updated for ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}` });
    clearSelection();
  };

  const handleBulkAssign = (memberId: string) => {
    selectedIds.forEach((id) => updateTask(id, { assigneeUserIds: [memberId] }));
    toast({ title: `Assigned ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}` });
    clearSelection();
  };

  const handleBulkUnassign = () => {
    selectedIds.forEach((id) => updateTask(id, { assigneeUserIds: [] }));
    toast({ title: `Unassigned ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}` });
    clearSelection();
  };

  const handleBulkDelete = async () => {
    if (!deleteTask) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map((id) => deleteTask(id)));
      toast({ title: `Deleted ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}` });
      clearSelection();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete some tasks',
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setIsBulkDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border overflow-hidden shadow-sm">
      {!readOnly && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/40">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-border mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                Set status <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {pipelines.map((status) => (
                <DropdownMenuItem key={status.id} onClick={() => handleBulkStatusChange(status.id)}>
                  {status.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                Assign to <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {workspaceMembers.map((member) => (
                <DropdownMenuItem key={member.userId} onClick={() => handleBulkAssign(member.userId)}>
                  {member.userId === currentUser?.id ? 'You' : (member.displayName || member.email)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={handleBulkUnassign}>Unassign</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {deleteTask && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}

          <Button variant="ghost" size="sm" className="gap-1 ml-auto" onClick={clearSelection}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} task{selectedIds.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete all subtasks, comments, and attachments on {selectedIds.size === 1 ? 'this task' : 'these tasks'}. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleBulkDelete(); }}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            {!readOnly && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all tasks"
                />
              </TableHead>
            )}
            <TableHead className="w-[40px]"></TableHead>
            <TableHead className="min-w-[300px]">Task Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assignees</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow 
              key={task.id} 
              className={cn("cursor-pointer group hover:bg-muted/50", selectedIds.has(task.id) && "bg-muted/40")}
              onClick={() => onTaskClick(task.id)}
            >
              {!readOnly && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(task.id)}
                    onCheckedChange={() => toggleSelectOne(task.id)}
                    aria-label={`Select ${task.title}`}
                  />
                </TableCell>
              )}
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                  checked={task.status === 'done'} 
                  disabled={readOnly}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      const incomplete = getIncompleteBlockers(allWorkspaceTasks, task, isCompletedStatus);
                      if (incomplete.length > 0) {
                        toast({
                          title: "Can't mark as done",
                          description: `Still blocked by: ${incomplete.map((b) => b.title).join(', ')}`,
                          variant: 'destructive',
                        });
                        return;
                      }
                    }
                    updateTask(task.id, { status: checked ? 'done' : firstPipelineId });
                  }}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className={cn(
                    "font-medium",
                    task.status === 'done' && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </span>
                  {task.blockedByTaskIds && task.blockedByTaskIds.length > 0
                    && getIncompleteBlockers(allWorkspaceTasks, task, isCompletedStatus).length > 0 && (
                    <Badge variant="destructive" className="w-fit text-[10px] px-1.5 py-0 mt-1">Blocked</Badge>
                  )}
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {task.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const st = (subtasks || []).filter(s => s.taskId === task.id);
                    if (st.length === 0) return null;
                    const done = st.filter(s => s.status === 'done').length;
                    const total = st.length;
                    return (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{done}/{total} subtasks</span>
                        <Progress value={(done/total)*100} className="h-1 w-12 ml-1" />
                      </div>
                    );
                  })()}
                </div>
              </TableCell>
              <TableCell>
                {(() => {
                  const status = getStatusInfo(pipelines, task.status);
                  return (
                    <div className="flex items-center gap-2">
                      <div
                        className={cn("h-3 w-3 rounded-full", status.color?.startsWith('bg-') && status.color)}
                        style={status.color?.startsWith('bg-') ? undefined : { backgroundColor: status.color }}
                      />
                      <span className="text-xs text-muted-foreground">{status.name}</span>
                    </div>
                  );
                })()}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("capitalize border-none", priorityColors[task.priority])}>
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {(task.assigneeUserIds || []).slice(0, 3).map((assigneeId: string) => {
                    const isCurrentUser = assigneeId === currentUser?.id;
                    const member = workspaceMembers.find((m) => m.userId === assigneeId);
                    const isOwner = member?.role === 'owner';
                    let displayName = '';
                    let initials = '';
                    
                    if (isCurrentUser) {
                      displayName = 'You';
                      initials = 'Y';
                    } else {
                      displayName = member?.displayName || member?.email || assigneeId;
                      initials = displayName.charAt(0).toUpperCase();
                    }
                    
                    return (
                      <div key={assigneeId} className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                        <span className={cn("text-[8px] font-medium", 
                          isCurrentUser ? "text-green-600" : isOwner ? "text-green-600" : "text-foreground"
                        )}>{initials}</span>
                      </div>
                    );
                  })}
                  {(task.assigneeUserIds || []).length > 3 && (
                    <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                      <span className="text-[8px] text-muted-foreground">+{(task.assigneeUserIds || []).length - 3}</span>
                    </div>
                  )}
                  {(!task.assigneeUserIds || task.assigneeUserIds.length === 0) && (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {mounted && task.dueDate ? new Date(task.dueDate).toLocaleDateString() : (task.dueDate ? '...' : 'No date')}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}