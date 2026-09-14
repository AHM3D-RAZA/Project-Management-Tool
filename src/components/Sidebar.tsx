"use client";

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Plus,
  ChevronDown,
  Box,
  ListTodo,
  Bell,
  LogOut,
  Settings,
  Clock,
  Shield,
} from 'lucide-react';
import type { NexusStore } from '@/hooks/use-nexus-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from './theme-toggle';
import { DeleteWorkspaceButton } from './workspaces/DeleteWorkspaceButton';
import type { ViewType } from './NexusShell';

export function Sidebar({
  store,
  currentView,
  onNavClick,
  onProjectClick,
  onCreateWorkspaceClick,
  onEditWorkspaceClick,
  onCreateProjectClick,
  onLogout,
}: {
  store: NexusStore;
  currentView: ViewType;
  onNavClick: (view: ViewType) => void;
  onProjectClick: (id: string) => void;
  onCreateWorkspaceClick: () => void;
  onEditWorkspaceClick: () => void;
  onCreateProjectClick: () => void;
  onLogout: () => void;
}) {
  if (!store.currentUser) return null;

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      <div className="p-4 border-b flex items-center justify-between gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex-1 justify-between hover:bg-muted font-semibold px-2 overflow-hidden">
              <div className="flex items-center gap-2 overflow-hidden">
                <div
                  className="w-5 h-5 rounded flex-shrink-0"
                  style={{ backgroundColor: store.activeWorkspace?.color || '#ccc' }}
                />
                <span className="truncate">{store.activeWorkspace?.name || 'Loading...'}</span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              My Workspaces
            </div>
            {store.workspaces?.map(w => (
              <DropdownMenuItem key={w.id} onClick={() => store.switchWorkspace(w.id)}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: w.color }}
                  />
                  <span>{w.name}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary flex-shrink-0"
          onClick={onCreateWorkspaceClick}
        >
          <Plus className="h-4 w-4" />
        </Button>
        {store.isOwner && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary flex-shrink-0"
              onClick={onEditWorkspaceClick}
              title="Edit workspace"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <DeleteWorkspaceButton store={store} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0" />
          </>
        )}
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1 mb-6">
          <Button
            variant={currentView === 'dashboard' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-3"
            onClick={() => onNavClick('dashboard')}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant={currentView === 'my-tasks' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-3"
            onClick={() => onNavClick('my-tasks')}
          >
            <ListTodo className="h-4 w-4" />
            My Tasks
          </Button>
          <Button
            variant={currentView === 'notifications' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-3"
            onClick={() => onNavClick('notifications')}
          >
            <Bell className="h-4 w-4" />
            Activity Feed
          </Button>
          {store.isAdmin && (
            <>
              {store.activeWorkspace?.attendanceEnabled !== false && (
                <Button
                  variant={currentView === 'attendance' ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3"
                  onClick={() => onNavClick('attendance')}
                >
                  <Clock className="h-4 w-4" />
                  Attendance Log
                </Button>
              )}
              <Button
                variant={currentView === 'audit-logs' ? 'secondary' : 'ghost'}
                className="w-full justify-start gap-3"
                onClick={() => onNavClick('audit-logs')}
              >
                <Shield className="h-4 w-4" />
                Audit Logs
              </Button>
            </>
          )}
          <Button
            variant={currentView === 'members' ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-3"
            onClick={() => onNavClick('members')}
          >
            <Users className="h-4 w-4" />
            Members
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Projects
            {store.isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-muted"
                onClick={onCreateProjectClick}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {store.workspaceProjects?.map(p => (
              <Button
                key={p.id}
                variant={store.activeProject?.id === p.id && currentView === 'project' ? 'secondary' : 'ghost'}
                className="w-full justify-start gap-3 font-normal"
                onClick={() => onProjectClick(p.id)}
              >
                <Box className="h-4 w-4" style={{ color: p.color }} />
                <span className="truncate">{p.name}</span>
              </Button>
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t mt-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar className="h-8 w-8">
              <AvatarImage src={store.currentUser.avatarUrl ?? undefined} />
              <AvatarFallback>{store.currentUser.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold truncate">{store.currentUser.name}</span>
              <span className="text-xs text-muted-foreground truncate uppercase">{store.currentRole}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle className="h-8 w-8 text-muted-foreground" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
