"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Trash2, Plus, Sparkles, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { suggestSubtasks } from '@/ai/flows/ai-subtask-suggestion';
import type { Subtask, WorkspaceMemberWithRole, Task } from '@/lib/types';
import type { NexusStore } from '@/hooks/use-nexus-store';

function SubtaskRow({ subtask, store, projectMembers, isNew, onRemoveNew }: {
  subtask: Partial<Subtask> & { taskId: string };
  store: NexusStore;
  projectMembers: WorkspaceMemberWithRole[];
  isNew?: boolean;
  onRemoveNew?: () => void;
}) {
  const isAdmin = store.isAdmin;
  const [title, setTitle] = useState(subtask.title || '');
  const [description, setDescription] = useState(subtask.description || '');

  useEffect(() => {
    if (isNew) return;
    const timer = setTimeout(() => {
      const updates: Partial<Subtask> = {};
      if (title !== subtask.title) updates.title = title;
      if (description !== (subtask.description || '')) updates.description = description;

      if (Object.keys(updates).length > 0 && subtask.id) {
        store.updateSubtask(subtask.taskId, subtask.id, updates);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [title, description, subtask.title, subtask.description, subtask.id, subtask.taskId, store, isNew]);

  const handleSaveNew = () => {
    if (!title.trim()) {
      onRemoveNew?.();
    } else if (subtask.projectId) {
      store.createSubtask(subtask.taskId, subtask.projectId, { title: title.trim(), description: description.trim(), status: 'todo', priority: 'medium' });
      onRemoveNew?.();
    }
  };

  return (
    <div className="group border rounded-lg p-3 space-y-3 bg-card hover:border-border transition-colors relative">
      <div className="flex items-center gap-3">
        {/* subtask.id! is safe here — see the fuller note further down. */}
        {!isNew && (
          <Checkbox
            checked={subtask.status === 'done'}
            onCheckedChange={(c) => store.updateSubtask(subtask.taskId, subtask.id!, { status: c ? 'done' : 'todo' })}
            disabled={!isAdmin}
          />
        )}
        <Input
          className={cn("h-8 flex-1 font-medium bg-transparent border-transparent hover:border-input focus-visible:ring-1", subtask.status === 'done' && !isNew && "line-through text-muted-foreground opacity-70")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Subtask title..."
          onBlur={isNew ? handleSaveNew : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          autoFocus={isNew}
          disabled={!isAdmin && !isNew}
        />
        {!isNew && isAdmin && (
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => {
            if (confirm("Delete subtask?")) store.deleteSubtask(subtask.taskId, subtask.id!);
          }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="pl-6 pr-8">
         <Input
            className={cn("h-7 text-xs font-normal bg-transparent border-transparent hover:border-input focus-visible:ring-1 text-muted-foreground", store.isCompletedStatus(subtask.status || '') && !isNew && "opacity-70")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description... (optional)"
            onBlur={isNew ? handleSaveNew : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            disabled={!isAdmin && !isNew}
          />
      </div>

      {/*
        subtask.id! below: safe non-null assertions, not blind suppressions.
        subtask.id is optional on the type because the "new subtask"
        placeholder object doesn't have one yet — but this whole block only
        renders when !isNew, and every subtask that reaches this branch was
        loaded from Firestore (via SubtasksTabContent's subtasks.map), so it
        always has a real id here.
      */}
      {!isNew && (
        <div className="flex flex-wrap gap-2 items-center pl-6">
          <Select value={subtask.status} onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id!, { status: val })} disabled={!isAdmin}>
            <SelectTrigger className="h-6 text-[10px] w-auto border-none bg-muted/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select value={subtask.priority} onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id!, { priority: val as Task['priority'] })} disabled={!isAdmin}>
            <SelectTrigger className={cn("h-6 text-[10px] w-auto border-none",
              subtask.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                subtask.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  subtask.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Calendar className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <Input
              type="date"
              className="h-6 text-[10px] pl-6 w-auto border-none bg-muted/50"
              value={subtask.dueDate ? subtask.dueDate.split('T')[0] : ''}
              onChange={(e) => store.updateSubtask(subtask.taskId, subtask.id!, { dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
              disabled={!isAdmin}
            />
          </div>

          <Select 
            value={subtask.assigneeUserId || "unassigned"} 
            onValueChange={(val) => store.updateSubtask(subtask.taskId, subtask.id!, { assigneeUserId: val === "unassigned" ? null : val })} 
            disabled={!isAdmin}
          >
            <SelectTrigger className="h-6 text-[10px] w-auto max-w-[120px] border-none bg-muted/50 truncate flex items-center gap-1.5 px-2">
              {subtask.assigneeUserId ? (
                <div className="flex items-center gap-1 overflow-hidden">
                  <Avatar className="h-4 w-4 shrink-0">
                    <AvatarImage src={projectMembers.find((m) => m.userId === subtask.assigneeUserId)?.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[8px]">{projectMembers.find((m) => m.userId === subtask.assigneeUserId)?.displayName?.charAt(0) || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{projectMembers.find((m) => m.userId === subtask.assigneeUserId)?.displayName?.split(' ')[0]}</span>
                </div>
              ) : (
                <span className="text-muted-foreground mr-2">Unassigned</span>
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <span className="text-xs text-muted-foreground">Unassigned</span>
              </SelectItem>
              {projectMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-4 w-4 shrink-0">
                      <AvatarImage src={m.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[8px]">{m.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{m.displayName}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export function SubtasksTabContent({ task, store, projectMembers }: {
  task: Task;
  store: NexusStore;
  projectMembers: WorkspaceMemberWithRole[];
}) {
  const [addingNew, setAddingNew] = useState(false);
  const [isSuggestingSubtasks, setIsSuggestingSubtasks] = useState(false);
  const { toast } = useToast();
  const subtasks = store.allWorkspaceSubtasks?.filter((s) => s.taskId === task.id) || [];

  const completedCount = subtasks.filter((s) => s.status === 'done').length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleSuggestSubtasks = async () => {
    if (!store.isAdmin) return;
    setIsSuggestingSubtasks(true);
    try {
      const result = await suggestSubtasks({ title: task.title, description: task.description });
      result.subtasks.forEach((title) => {
        store.createSubtask(task.id, task.projectId, { title, status: 'todo', priority: 'medium' });
      });
      toast({ title: `Added ${result.subtasks.length} suggested subtask(s)` });
    } catch (error) {
      console.error(error);
      toast({ title: "Couldn't suggest subtasks", variant: 'destructive' });
    } finally {
      setIsSuggestingSubtasks(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm font-medium">
          <span>{totalCount > 0 ? `${completedCount}/${totalCount} completed` : '0 subtasks'}</span>
          {store.isAdmin && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={handleSuggestSubtasks}
                disabled={isSuggestingSubtasks}
              >
                {isSuggestingSubtasks ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Suggest Subtasks
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingNew(true)} disabled={addingNew}>
                <Plus className="h-3 w-3 mr-1" /> Add Subtask
              </Button>
            </div>
          )}
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {totalCount === 0 && !addingNew && (
        <div className="text-center py-8 text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
          No subtasks yet. Click &apos;+ Add Subtask&apos; to break this task into smaller pieces.
        </div>
      )}

      <div className="space-y-3">
        {subtasks.map((st) => (
          <SubtaskRow key={st.id} subtask={st} store={store} projectMembers={projectMembers} />
        ))}
        {addingNew && (
          <SubtaskRow
            isNew
            onRemoveNew={() => setAddingNew(false)}
            subtask={{ taskId: task.id, projectId: task.projectId }}
            store={store}
            projectMembers={projectMembers}
          />
        )}
      </div>
    </div>
  );
}
