"use client";

import React, { useState, useEffect } from 'react';
import type { NexusStore } from '@/hooks/use-nexus-store';
import { useAuth } from '@/firebase';
import { DashboardView } from './views/DashboardView';
import { ProjectView } from './views/ProjectView';
import { MembersView } from './views/MembersView';
import { MyTasksView } from './views/MyTasksView';
import { NotificationsView } from './views/NotificationsView';
import { AttendanceLogView } from './views/AttendanceLogView';
import { AuditLogsView } from './views/AuditLogsView';
import { InviteMembersModal } from './invitations/InviteMembersModal';
import { GlobalSearch } from './search/global-search';
import { EditWorkspaceModal } from './workspaces/EditWorkspaceModal';
import { CreateWorkspaceDialog } from './workspaces/CreateWorkspaceDialog';
import { CreateProjectDialog } from './projects/CreateProjectDialog';
import { Sidebar } from './Sidebar';
import { ShellHeader } from './ShellHeader';

export type ViewType = 'dashboard' | 'project' | 'members' | 'my-tasks' | 'notifications' | 'attendance' | 'audit-logs';

export function NexusShell({ store }: { store: NexusStore }) {
  const auth = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [mounted, setMounted] = useState(false);

  // Dialog States
  const [isWsDialogOpen, setIsWsDialogOpen] = useState(false);
  const [isWsEditDialogOpen, setIsWsEditDialogOpen] = useState(false);
  const [isProjDialogOpen, setIsProjDialogOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [notifiedTaskId, setNotifiedTaskId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K opens global search from anywhere in the app.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleProjectClick = (id: string) => {
    store.selectProject(id);
    setCurrentView('project');
  };

  const handleNavClick = (view: ViewType) => {
    if (view !== 'project') store.selectProject(null);
    setCurrentView(view);
  };

  const handleNavigateToTask = (wsId: string, projId: string, taskId: string) => {
    if (store.activeWorkspace?.id !== wsId) {
      store.switchWorkspace(wsId);
    }
    store.selectProject(projId);
    setCurrentView('project');
    setNotifiedTaskId(taskId);
  };

  const handleLogout = () => {
    auth.signOut();
  };

  if (!mounted || !store.currentUser) return <div className="h-screen w-full bg-background" />;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar
        store={store}
        currentView={currentView}
        onNavClick={handleNavClick}
        onProjectClick={handleProjectClick}
        onCreateWorkspaceClick={() => setIsWsDialogOpen(true)}
        onEditWorkspaceClick={() => setIsWsEditDialogOpen(true)}
        onCreateProjectClick={() => setIsProjDialogOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <ShellHeader
          store={store}
          currentView={currentView}
          onSearchClick={() => setIsSearchOpen(true)}
          onNavigateToTask={handleNavigateToTask}
        />

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-background p-6 max-w-full">
          {currentView === 'dashboard' && <DashboardView store={store} onNavigateToProject={handleProjectClick} />}
          {currentView === 'project' && (
            <ProjectView
              store={store}
              initialTaskId={notifiedTaskId}
              onInitialTaskConsumed={() => setNotifiedTaskId(null)}
            />
          )}
          {currentView === 'members' && (
            <MembersView 
              store={store} 
              onInviteClick={() => setIsInviteOpen(true)} 
              isAdmin={store.isAdmin}
            />
          )}
          {currentView === 'my-tasks' && <MyTasksView store={store} />}
          {currentView === 'notifications' && <NotificationsView store={store} />}
          {currentView === 'attendance' && <AttendanceLogView store={store} />}
          {currentView === 'audit-logs' && <AuditLogsView store={store} />}
        </main>
      </div>

      {/* Global Dialogs */}
      <CreateWorkspaceDialog open={isWsDialogOpen} onOpenChange={setIsWsDialogOpen} store={store} />

      <CreateProjectDialog open={isProjDialogOpen} onOpenChange={setIsProjDialogOpen} store={store} />

      <InviteMembersModal 
        isOpen={isInviteOpen} 
        onOpenChange={setIsInviteOpen} 
        store={store} 
      />

      <EditWorkspaceModal
        isOpen={isWsEditDialogOpen}
        onOpenChange={setIsWsEditDialogOpen}
        store={store}
      />

      <GlobalSearch
        store={store}
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onNavigateToProject={handleProjectClick}
        onNavigateToTask={handleNavigateToTask}
      />
    </div>
  );
}
