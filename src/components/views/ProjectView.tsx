"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutList, 
  Kanban, 
  Plus, 
  Calendar,
  Tag as TagIcon,
  Loader2,
  Users,
  Settings,
  Columns
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskList } from '../tasks/TaskList';
import { KanbanBoard } from '../tasks/KanbanBoard';
import { TaskCalendar } from '../tasks/TaskCalendar';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { EditProjectModal } from '../projects/EditProjectModal';
import { DeleteProjectButton } from '../projects/DeleteProjectButton';
import { AddStatusModal } from '../workspaces/AddStatusModal';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Priority, StatusConfig } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import type { NexusStore } from '@/hooks/use-nexus-store';

export function ProjectView({ store }: { store: NexusStore }) {
  const { toast } = useToast();
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isAddStatusOpen, setIsAddStatusOpen] = useState(false);

  // Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState('todo');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskTags, setNewTaskTags] = useState('');

  const activeProject = store.activeProject;
  const filteredTasks = useMemo(() => {
    const q = (store.globalSearchQuery || '').trim().toLowerCase();
    if (!q) return store.projectTasks;

    return (store.projectTasks || []).filter((t) => {
      const title = (t.title || '').toLowerCase();
      const tags = (t.tags || []).map((x: string) => x.toLowerCase());
      return title.includes(q) || tags.some((tag: string) => tag.includes(q));
    });
  }, [store.projectTasks, store.globalSearchQuery]);

  const eligibleAssignees = useMemo(() => {
    if (!activeProject) return [];
    const allowed = new Set<string>(activeProject.allowedUserIds || []);
    return (store.workspaceMembers || []).filter((m) => {
      const isWorkspaceAdmin = m.role === 'owner' || m.role === 'lead';
      const canSeeProject = isWorkspaceAdmin || allowed.has(m.userId);
      return canSeeProject;
    });
  }, [store.workspaceMembers, activeProject]);

  const kanbanColumns = useMemo(() => {
    return store.allStatuses?.map((s: StatusConfig) => ({
      id: s.id,
      name: s.name,
      color: s.color,
    })) || [];
  }, [store.allStatuses]);

  useEffect(() => {
    if (isCreateTaskOpen && store.currentUser) {
      setNewTaskAssignees([store.currentUser.id]);
    }
  }, [isCreateTaskOpen, store.currentUser]);

  const handleCreateTask = async () => {
    if (newTaskTitle && activeProject) {
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
      setIsCreateTaskOpen(false);
    }
  };

  const handleToggleMember = (userId: string) => {
    if (!activeProject) return;
    const member = store.workspaceMembers?.find((m) => m.userId === userId);
    const isSystemAdmin = member?.role === 'owner' || member?.role === 'lead';
    const isProjectAdmin = Boolean(
      activeProject.createdByUserId && userId === activeProject.createdByUserId
    );
    if (isSystemAdmin || isProjectAdmin) return;
    const current: string[] = activeProject.allowedUserIds || [];
    const updated = current.includes(userId)
      ? current.filter((id: string) => id !== userId)
      : [...current, userId];
    store.updateProjectMembers(activeProject.id, updated);
  };

  if (!activeProject) return null;

  return (
    <div className="flex flex-col h-full space-y-6 w-full min-w-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md">
          <Button 
            variant={view === 'list' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 gap-2"
            onClick={() => setView('list')}
          >
            <LayoutList className="h-4 w-4" />
            List
          </Button>
          <Button 
            variant={view === 'kanban' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 gap-2"
            onClick={() => setView('kanban')}
          >
            <Kanban className="h-4 w-4" />
            Board
          </Button>
          <Button 
            variant={view === 'calendar' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 gap-2"
            onClick={() => setView('calendar')}
          >
            <Calendar className="h-4 w-4" />
            Calendar
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {store.isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8"
              onClick={() => setIsAddStatusOpen(true)}
            >
              <Columns className="h-4 w-4" />
              Add Status
            </Button>
          )}
          {store.isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-8"
                onClick={() => setIsEditProjectOpen(true)}
              >
                <Settings className="h-4 w-4" />
                Edit
              </Button>
              <DeleteProjectButton
                store={store}
                project={activeProject}
                variant="outline"
                size="sm"
                className="gap-2 h-8 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              />
              <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-8">
                    <Users className="h-4 w-4" />
                    Project Team
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Project Access</DialogTitle>
                  <DialogDescription>Assign members who can see this project.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
                  {store.workspaceMembers.map((m) => {
                    // "Admin" in the Project Team UI:
                    // - Workspace owners/leads are always project admins
                    // - The user who created the project is also treated as an admin for that project
                    const isSystemAdmin = m.role === 'owner' || m.role === 'lead';
                    const isProjectAdmin = Boolean(
                      activeProject.createdByUserId && m.userId === activeProject.createdByUserId
                    );
                    const projectAdmin = isSystemAdmin || isProjectAdmin;
                    const hasAccess = projectAdmin || (activeProject.allowedUserIds || []).includes(m.userId);
                    
                    return (
                      <div key={m.userId} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={m.avatarUrl ?? undefined} />
                            <AvatarFallback>{m.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{m.displayName}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {projectAdmin ? 'admin' : 'member'}
                            </span>
                          </div>
                        </div>
                        <Checkbox 
                          checked={hasAccess} 
                          disabled={projectAdmin}
                          onCheckedChange={() => handleToggleMember(m.userId)}
                        />
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
            </>
          )}

          {store.isAdmin && (
            <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 h-8">
                  <Plus className="h-4 w-4" />
                  Add Task
                </Button>
              </DialogTrigger>
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
                  <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateTask}>Create Task</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 max-w-full overflow-hidden">
        {store.isTasksLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading tasks...</p>
          </div>
        ) : view === 'list' ? (
          <TaskList 
            tasks={filteredTasks} 
            onTaskClick={(id) => setSelectedTaskId(id)} 
            updateTask={store.updateTask}
            readOnly={!store.isAdmin}
            subtasks={store.allWorkspaceSubtasks}
            workspaceMembers={store.workspaceMembers}
            currentUser={store.currentUser}
            pipelines={store.allStatuses}
          />
        ) : view === 'calendar' ? (
          <TaskCalendar
            tasks={filteredTasks}
            onTaskClick={(id) => setSelectedTaskId(id)}
            workspaceMembers={store.workspaceMembers}
            currentUser={store.currentUser}
          />
        ) : (
          <div className="h-full w-full min-w-0" style={{ maxWidth: '100%' }}>
            <KanbanBoard 
              tasks={filteredTasks} 
              onTaskClick={(id) => setSelectedTaskId(id)} 
              updateTask={store.updateTask}
              onAddTask={(status) => {
                if (store.isAdmin) {
                  setNewTaskStatus(status);
                  setIsCreateTaskOpen(true);
                }
              }}
              readOnly={!store.isAdmin}
              subtasks={store.allWorkspaceSubtasks}
              workspaceMembers={store.workspaceMembers}
              currentUser={store.currentUser}
              columns={kanbanColumns}
            />
          </div>
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          store={store}
        />
      )}

      <EditProjectModal
        isOpen={isEditProjectOpen}
        onOpenChange={setIsEditProjectOpen}
        store={store}
        project={activeProject}
      />

      <AddStatusModal
        open={isAddStatusOpen}
        onOpenChange={setIsAddStatusOpen}
        onAddStatus={store.addCustomStatus}
        existingStatuses={store.allStatuses || []}
      />
    </div>
  );
}
