'use client';

import * as React from 'react';
import { FolderKanban, ListTodo } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { NexusStore } from '@/hooks/use-nexus-store';

const MAX_RESULTS_PER_GROUP = 8;

export function GlobalSearch({
  store,
  open,
  onOpenChange,
  onNavigateToProject,
  onNavigateToTask,
}: {
  store: NexusStore;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToProject: (projectId: string) => void;
  onNavigateToTask: (workspaceId: string, projectId: string, taskId: string) => void;
}) {
  const [query, setQuery] = React.useState('');

  // Reset the query each time the dialog closes, so it doesn't linger
  // stale the next time it's opened.
  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();

  const matchedProjects = React.useMemo(() => {
    if (!normalizedQuery) return [];
    return store.workspaceProjects
      .filter((p) =>
        p.name.toLowerCase().includes(normalizedQuery) ||
        (p.description || '').toLowerCase().includes(normalizedQuery)
      )
      .slice(0, MAX_RESULTS_PER_GROUP);
  }, [store.workspaceProjects, normalizedQuery]);

  const matchedTasks = React.useMemo(() => {
    if (!normalizedQuery) return [];
    return store.allWorkspaceTasks
      .filter((t) =>
        t.title.toLowerCase().includes(normalizedQuery) ||
        (t.description || '').toLowerCase().includes(normalizedQuery) ||
        (t.tags || []).some((tag) => tag.toLowerCase().includes(normalizedQuery))
      )
      .slice(0, MAX_RESULTS_PER_GROUP);
  }, [store.allWorkspaceTasks, normalizedQuery]);

  const selectProject = (projectId: string) => {
    onOpenChange(false);
    onNavigateToProject(projectId);
  };

  const selectTask = (task: (typeof store.allWorkspaceTasks)[number]) => {
    onOpenChange(false);
    onNavigateToTask(task.workspaceId, task.projectId, task.id);
  };

  const projectName = (projectId: string) => store.workspaceProjects.find((p) => p.id === projectId)?.name;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search projects and tasks..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {normalizedQuery && matchedProjects.length === 0 && matchedTasks.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {matchedProjects.length > 0 && (
          <CommandGroup heading="Projects">
            {matchedProjects.map((project) => (
              <CommandItem
                key={project.id}
                value={`project-${project.id}-${project.name}`}
                onSelect={() => selectProject(project.id)}
              >
                <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{project.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedTasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {matchedTasks.map((task) => (
              <CommandItem
                key={task.id}
                value={`task-${task.id}-${task.title}`}
                onSelect={() => selectTask(task)}
              >
                <ListTodo className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{task.title}</span>
                  {projectName(task.projectId) && (
                    <span className="text-xs text-muted-foreground truncate">
                      {projectName(task.projectId)}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
