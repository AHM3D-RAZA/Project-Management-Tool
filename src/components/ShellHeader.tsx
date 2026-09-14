"use client";

import React from 'react';
import { Search } from 'lucide-react';
import type { NexusStore } from '@/hooks/use-nexus-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NotificationBell } from './notifications/NotificationBell';
import type { ViewType } from './NexusShell';

const VIEW_TITLES: Partial<Record<ViewType, string>> = {
  dashboard: 'Workspace Overview',
  members: 'Team Members',
  'my-tasks': 'Personal Taskboard',
  notifications: 'Activity Feed',
  attendance: 'Attendance Log',
  'audit-logs': 'Audit Logs',
};

// Views where the per-project filter box doesn't make sense (nothing
// project-scoped is being shown).
const VIEWS_WITHOUT_PROJECT_FILTER: ViewType[] = ['dashboard', 'notifications', 'members', 'attendance', 'audit-logs'];

export function ShellHeader({
  store,
  currentView,
  onSearchClick,
  onNavigateToTask,
}: {
  store: NexusStore;
  currentView: ViewType;
  onSearchClick: () => void;
  onNavigateToTask: (wsId: string, projId: string, taskId: string) => void;
}) {
  return (
    <header className="h-16 border-b flex items-center justify-between px-6 bg-card/50 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold font-headline">
          {VIEW_TITLES[currentView] ?? store.activeProject?.name ?? 'Project'}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="h-9 gap-2 px-3 text-muted-foreground font-normal bg-muted/50 border-none hover:bg-muted"
          onClick={onSearchClick}
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search everywhere...</span>
          <kbd className="hidden sm:inline-flex ml-2 pointer-events-none h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
        {!VIEWS_WITHOUT_PROJECT_FILTER.includes(currentView) && (
          <div className="relative w-64 animate-in fade-in duration-300">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter this project..."
              className="pl-9 h-9 bg-muted/50 border-none"
              value={store.globalSearchQuery}
              onChange={(e) => store.setGlobalSearchQuery(e.target.value)}
            />
          </div>
        )}
        <NotificationBell
          onNavigateToTask={onNavigateToTask}
          markAsRead={store.markNotificationAsRead}
        />
      </div>
    </header>
  );
}
