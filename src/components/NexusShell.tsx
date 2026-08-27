
"use client";

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Search, 
  Plus, 
  ChevronDown,
  Box,
  ListTodo,
  Bell,
  LogOut,
  Settings,
  Clock,
  Shield
} from 'lucide-react';
import type { NexusStore } from '@/hooks/use-nexus-store';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DashboardView } from './views/DashboardView';
import { ProjectView } from './views/ProjectView';
import { MembersView } from './views/MembersView';
import { MyTasksView } from './views/MyTasksView';
import { NotificationsView } from './views/NotificationsView';
import { AttendanceLogView } from './views/AttendanceLogView';
import { AuditLogsView } from './views/AuditLogsView';
import { InviteMembersModal } from './invitations/InviteMembersModal';
import { NotificationBell } from './notifications/NotificationBell';
import { EditWorkspaceModal } from './workspaces/EditWorkspaceModal';
import { DeleteWorkspaceButton } from './workspaces/DeleteWorkspaceButton';

type ViewType = 'dashboard' | 'project' | 'members' | 'my-tasks' | 'notifications' | 'attendance' | 'audit-logs';

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
  
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

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

  const handleCreateWorkspace = () => {
    if (newWsName) {
      store.createWorkspace(newWsName, newWsDesc);
      setNewWsName('');
      setNewWsDesc('');
      setIsWsDialogOpen(false);
    }
  };

  const handleCreateProject = () => {
    if (newProjName && store.activeWorkspace?.id) {
      store.createProject(store.activeWorkspace.id, newProjName, newProjDesc);
      setNewProjName('');
      setNewProjDesc('');
      setIsProjDialogOpen(false);
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  if (!mounted || !store.currentUser) return <div className="h-screen w-full bg-background" />;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
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
            onClick={() => setIsWsDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          {store.isOwner && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-primary flex-shrink-0"
                onClick={() => setIsWsEditDialogOpen(true)}
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
              onClick={() => handleNavClick('dashboard')}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button 
              variant={currentView === 'my-tasks' ? 'secondary' : 'ghost'} 
              className="w-full justify-start gap-3"
              onClick={() => handleNavClick('my-tasks')}
            >
              <ListTodo className="h-4 w-4" />
              My Tasks
            </Button>
            <Button 
              variant={currentView === 'notifications' ? 'secondary' : 'ghost'} 
              className="w-full justify-start gap-3"
              onClick={() => handleNavClick('notifications')}
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
                    onClick={() => handleNavClick('attendance')}
                  >
                    <Clock className="h-4 w-4" />
                    Attendance Log
                  </Button>
                )}
                <Button 
                  variant={currentView === 'audit-logs' ? 'secondary' : 'ghost'} 
                  className="w-full justify-start gap-3"
                  onClick={() => handleNavClick('audit-logs')}
                >
                  <Shield className="h-4 w-4" />
                  Audit Logs
                </Button>
              </>
            )}
            <Button 
              variant={currentView === 'members' ? 'secondary' : 'ghost'} 
              className="w-full justify-start gap-3"
              onClick={() => handleNavClick('members')}
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
                  onClick={() => setIsProjDialogOpen(true)}
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
                  onClick={() => handleProjectClick(p.id)}
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
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 border-b flex items-center justify-between px-6 bg-card/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold font-headline">
              {currentView === 'dashboard' ? 'Workspace Overview' : 
               currentView === 'members' ? 'Team Members' : 
               currentView === 'my-tasks' ? 'Personal Taskboard' :
               currentView === 'notifications' ? 'Activity Feed' :
               currentView === 'attendance' ? 'Attendance Log' :
               currentView === 'audit-logs' ? 'Audit Logs' :
               store.activeProject?.name || 'Project'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {currentView !== 'dashboard' && currentView !== 'notifications' && currentView !== 'members' && currentView !== 'attendance' && currentView !== 'audit-logs' && (
              <div className="relative w-64 animate-in fade-in duration-300">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  className="pl-9 h-9 bg-muted/50 border-none" 
                  value={store.globalSearchQuery}
                  onChange={(e) => store.setGlobalSearchQuery(e.target.value)}
                />
              </div>
            )}
            <NotificationBell 
              onNavigateToTask={handleNavigateToTask} 
              markAsRead={store.markNotificationAsRead} 
            />
          </div>
        </header>

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
      <Dialog open={isWsDialogOpen} onOpenChange={setIsWsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>Start a new collaborative workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Workspace Name</Label>
              <Input id="ws-name" value={newWsName} onChange={(e) => setNewWsName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-desc">Description</Label>
              <Textarea id="ws-desc" value={newWsDesc} onChange={(e) => setNewWsDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateWorkspace}>Create Workspace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProjDialogOpen} onOpenChange={setIsProjDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>Add a project to this workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Project Name</Label>
              <Input id="proj-name" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea id="proj-desc" value={newProjDesc} onChange={(e) => setNewProjDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProjDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject}>Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
