"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import type { NexusStore } from '@/hooks/use-nexus-store';
import type { Project } from '@/lib/types';

export function ProjectTeamDialog({
  open,
  onOpenChange,
  activeProject,
  store,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeProject: Project;
  store: NexusStore;
}) {
  const handleToggleMember = (userId: string) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  );
}
