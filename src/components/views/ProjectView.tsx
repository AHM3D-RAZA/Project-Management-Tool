"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { 
  LayoutList, 
  Kanban, 
  Plus, 
  Calendar,
  Loader2,
  Users,
  Settings,
  Columns,
  SlidersHorizontal,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportTasksToCsv, exportTasksToPdf } from '@/lib/export-tasks';
import { TaskList } from '../tasks/TaskList';
import { KanbanBoard } from '../tasks/KanbanBoard';
import { TaskCalendar } from '../tasks/TaskCalendar';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { EditProjectModal } from '../projects/EditProjectModal';
import { DeleteProjectButton } from '../projects/DeleteProjectButton';
import { AddStatusModal } from '../workspaces/AddStatusModal';
import { ManageCustomFieldsModal } from '../workspaces/ManageCustomFieldsModal';
import { CreateTaskDialog } from '../projects/CreateTaskDialog';
import { ProjectTeamDialog } from '../projects/ProjectTeamDialog';
import { StatusConfig } from '@/lib/types';
import type { NexusStore } from '@/hooks/use-nexus-store';

export function ProjectView({ store, initialTaskId, onInitialTaskConsumed }: { store: NexusStore, initialTaskId?: string | null, onInitialTaskConsumed?: () => void }) {
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [createTaskDefaultStatus, setCreateTaskDefaultStatus] = useState<string | undefined>(undefined);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isAddStatusOpen, setIsAddStatusOpen] = useState(false);
  const [isCustomFieldsOpen, setIsCustomFieldsOpen] = useState(false);

  // Opens the task a caller (e.g. a notification click) pointed us at.
  // Runs once per distinct initialTaskId; onInitialTaskConsumed lets the
  // caller clear its own pending state so re-clicking the same
  // notification later can still re-open the panel.
  useEffect(() => {
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
      onInitialTaskConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTaskId]);

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  activeProject && exportTasksToCsv(
                    activeProject,
                    filteredTasks,
                    store.allStatuses || [],
                    store.workspaceMembers || [],
                    store.customFieldDefinitions || []
                  )
                }
              >
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  activeProject && exportTasksToPdf(
                    activeProject,
                    filteredTasks,
                    store.allStatuses || [],
                    store.workspaceMembers || []
                  )
                }
              >
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          {store.isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8"
              onClick={() => setIsCustomFieldsOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Custom Fields
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
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-8"
                onClick={() => setIsMembersOpen(true)}
              >
                <Users className="h-4 w-4" />
                Project Team
              </Button>
            </>
          )}

          {store.isAdmin && (
            <Button
              size="sm"
              className="gap-2 h-8"
              onClick={() => {
                setCreateTaskDefaultStatus(undefined);
                setIsCreateTaskOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
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
            deleteTask={store.deleteTask}
            readOnly={!store.isAdmin}
            subtasks={store.allWorkspaceSubtasks}
            workspaceMembers={store.workspaceMembers}
            currentUser={store.currentUser}
            pipelines={store.allStatuses}
            allWorkspaceTasks={store.allWorkspaceTasks}
            isCompletedStatus={store.isCompletedStatus}
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
                  setCreateTaskDefaultStatus(status);
                  setIsCreateTaskOpen(true);
                }
              }}
              readOnly={!store.isAdmin}
              subtasks={store.allWorkspaceSubtasks}
              workspaceMembers={store.workspaceMembers}
              currentUser={store.currentUser}
              columns={kanbanColumns}
              allWorkspaceTasks={store.allWorkspaceTasks}
              isCompletedStatus={store.isCompletedStatus}
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

      <ManageCustomFieldsModal
        open={isCustomFieldsOpen}
        onOpenChange={setIsCustomFieldsOpen}
        fields={store.customFieldDefinitions || []}
        onAddField={store.addCustomFieldDefinition}
        onDeleteField={store.deleteCustomFieldDefinition}
      />

      {store.isAdmin && (
        <CreateTaskDialog
          open={isCreateTaskOpen}
          onOpenChange={setIsCreateTaskOpen}
          activeProject={activeProject}
          store={store}
          eligibleAssignees={eligibleAssignees}
          defaultStatus={createTaskDefaultStatus}
        />
      )}

      {store.isAdmin && (
        <ProjectTeamDialog
          open={isMembersOpen}
          onOpenChange={setIsMembersOpen}
          activeProject={activeProject}
          store={store}
        />
      )}
    </div>
  );
}
