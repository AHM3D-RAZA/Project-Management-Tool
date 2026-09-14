"use client";

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Tag as TagIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { NexusStore } from '@/hooks/use-nexus-store';
import type { Project, Priority, RecurrenceRule, WorkspaceMemberWithRole } from '@/lib/types';
import { RecurrencePicker } from '@/components/tasks/RecurrencePicker';

export function CreateTaskDialog({
  open,
  onOpenChange,
  activeProject,
  store,
  eligibleAssignees,
  defaultStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProject: Project;
  store: NexusStore;
  eligibleAssignees: WorkspaceMemberWithRole[];
  defaultStatus?: string;
}) {
  const { toast } = useToast();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState(defaultStatus || 'todo');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskTags, setNewTaskTags] = useState('');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<RecurrenceRule | null>(null);

  useEffect(() => {
    if (open && store.currentUser) {
      setNewTaskAssignees([store.currentUser.id]);
    }
  }, [open, store.currentUser]);

  useEffect(() => {
    if (open && defaultStatus) {
      setNewTaskStatus(defaultStatus);
    }
  }, [open, defaultStatus]);

  const handleCreateTask = async () => {
    if (!newTaskTitle || !activeProject) return;
    const tagsArray = newTaskTags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');

    try {
      await store.createTask(activeProject.workspaceId, activeProject.id, {
        title: newTaskTitle,
        description: newTaskDesc,
        status: newTaskStatus,
        priority: newTaskPriority,
        dueDate: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : null,
        assigneeUserIds: newTaskAssignees.length > 0 ? newTaskAssignees : [store.currentUser?.id].filter((id): id is string => !!id),
        tags: tagsArray,
        recurrence: newTaskRecurrence,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not create task',
        description: (error instanceof Error ? error.message : null) || 'Please try again.',
      });
      return;
    }

    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskStatus('todo');
    setNewTaskPriority('medium');
    setNewTaskDueDate('');
    setNewTaskAssignees([store.currentUser?.id || '']);
    setNewTaskTags('');
    setNewTaskRecurrence(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a new task to {activeProject.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Task Title</Label>
            <Input
              id="task-title"
              placeholder="E.g. Design homepage hero"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newTaskStatus} onValueChange={(val: string) => setNewTaskStatus(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {store.allStatuses?.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={newTaskPriority} onValueChange={(val: Priority) => setNewTaskPriority(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  className="pl-9"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assignees</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {eligibleAssignees.map((m) => (
                  <div key={m.userId} className="flex items-center space-x-2">
                    <Checkbox
                      id={`assignee-${m.userId}`}
                      checked={newTaskAssignees.includes(m.userId)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNewTaskAssignees([...newTaskAssignees, m.userId]);
                        } else {
                          setNewTaskAssignees(newTaskAssignees.filter(id => id !== m.userId));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`assignee-${m.userId}`}
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={m.avatarUrl ?? undefined} />
                        <AvatarFallback>{(m.displayName || '?').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">{m.displayName || 'Unnamed'}</span>
                    </Label>
                  </div>
                ))}
              </div>
              {newTaskAssignees.length === 0 && (
                <p className="text-xs text-muted-foreground">No assignees selected</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Repeat</Label>
            <RecurrencePicker value={newTaskRecurrence} onChange={setNewTaskRecurrence} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              placeholder="What needs to be done?"
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-tags" className="flex items-center gap-1.5">
              <TagIcon className="h-3 w-3" /> Tags
            </Label>
            <Input
              id="task-tags"
              placeholder="E.g. Design, Frontend (comma separated)"
              value={newTaskTags}
              onChange={(e) => setNewTaskTags(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreateTask}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
