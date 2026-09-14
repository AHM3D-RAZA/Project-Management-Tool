"use client";

import { useCallback, useMemo } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { collection, collectionGroup, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import type { Workspace, WorkspaceMember, Project, Task, AuditLog } from '@/lib/types';
import { getMemberUserIds } from '@/lib/member-sync';

interface UseMembersParams {
  db: Firestore | null;
  user: User | null;
  activeWorkspace: Workspace | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  projects: Project[];
  logAudit: (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, summary: string) => void;
  syncMemberUserIds: (wsId: string, memberRoles: Workspace['memberRoles']) => Promise<void>;
}

/**
 * Members already in the workspace: the resolved member list (roles +
 * profile data), search for users to add, and add/remove/role-change
 * mutations. See use-invitations.ts for inviting people who aren't
 * members yet.
 */
export function useMembers({ db, user, activeWorkspace, isAuthReady, isAdmin, projects, logAudit, syncMemberUserIds }: UseMembersParams) {
  const membersQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId || wsId === '' || !isAuthReady) return null;
    return query(collection(db, 'workspaces', wsId, 'members'));
  }, [db, user?.uid, activeWorkspace?.id, isAuthReady]);

  const { data: membersData } = useCollection<WorkspaceMember>(membersQuery);
  const profiles = useMemo(() => membersData || [], [membersData]);

  const workspaceMembers = useMemo(() => {
    if (!activeWorkspace) return [];
    const roles = activeWorkspace.memberRoles || {};
    return Object.entries(roles).map(([uid, role]) => {
      const profile = profiles.find(p => p.userId === uid || p.id === uid);
      const isMe = uid === user?.uid;
      return {
        id: uid,
        userId: uid,
        role,
        displayName: profile?.displayName || (isMe ? user.displayName : 'Pending Sync...'),
        email: profile?.email || (isMe ? user.email : ''),
        avatarUrl: profile?.avatarUrl || (isMe ? user.photoURL : null),
      };
    });
  }, [activeWorkspace, profiles, user]);

  const searchUsersByEmail = useCallback(
    async (searchTerm: string) => {
      if (!db || !searchTerm.trim()) return [];
      const term = searchTerm.trim().toLowerCase();
      if (term.length < 2) return [];
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '>=', term),
        where('email', '<=', term + '\uf8ff'),
        limit(25)
      );
      const snap = await getDocs(usersQuery);
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .filter((u) => u.id !== user?.uid) as {
        id: string;
        name?: string;
        email?: string;
        avatarUrl?: string | null;
      }[];
    },
    [db, user?.uid]
  );

  const directAddMember = useCallback(
    async (
      targetUser: { id: string; name?: string; email?: string; avatarUrl?: string | null },
      targetRole: 'member' | 'lead',
      projectIds: string[]
    ) => {
      const wsId = activeWorkspace?.id;
      if (!db || !wsId || !user || !isAdmin) {
        throw new Error('You do not have permission to add members.');
      }
      if (targetUser.id === user.uid) throw new Error('You are already in this workspace.');
      if (activeWorkspace?.memberRoles?.[targetUser.id]) {
        throw new Error('This user is already a member.');
      }

      const wsRef = doc(db, 'workspaces', wsId);
      await updateDocumentNonBlocking(wsRef, {
        [`memberRoles.${targetUser.id}`]: targetRole,
        updatedAt: new Date().toISOString(),
      });

      const memberRef = doc(db, 'workspaces', wsId, 'members', targetUser.id);
      await setDocumentNonBlocking(
        memberRef,
        {
          id: targetUser.id,
          workspaceId: wsId,
          userId: targetUser.id,
          displayName: targetUser.name || 'User',
          email: (targetUser.email || '').toLowerCase(),
          avatarUrl: targetUser.avatarUrl ?? null,
          memberUserIds: [...getMemberUserIds(activeWorkspace), targetUser.id],
        },
        { merge: true }
      );

      syncMemberUserIds(wsId, { ...activeWorkspace?.memberRoles, [targetUser.id]: targetRole });

      for (const projId of projectIds) {
        const projRef = doc(db, 'workspaces', wsId, 'projects', projId);
        const projSnap = await getDoc(projRef);
        if (projSnap.exists()) {
          const projData = projSnap.data() as Project;
          const allowedIds = [...(projData.allowedUserIds || []), targetUser.id];
          await updateDocumentNonBlocking(projRef, {
            allowedUserIds: Array.from(new Set(allowedIds)),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      logAudit('create', 'member', targetUser.id, `Added "${targetUser.name || targetUser.email || 'Unknown'}" as ${targetRole}`);
    },
    [db, user, activeWorkspace, isAdmin, logAudit, syncMemberUserIds]
  );

  const removeMember = useCallback(async (userId: string) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isAdmin || userId === user?.uid) return;
    const wsRef = doc(db, 'workspaces', wsId);
    const roles = { ...activeWorkspace!.memberRoles };
    delete roles[userId];
    await updateDocumentNonBlocking(wsRef, {
      memberRoles: roles,
      updatedAt: new Date().toISOString()
    });
    const member = workspaceMembers.find(m => m.userId === userId);
    const memberRef = doc(db, 'workspaces', wsId, 'members', userId);
    await deleteDocumentNonBlocking(memberRef);

    syncMemberUserIds(wsId, roles);

    // Clean up ghost references to the removed member: unassign them
    // from any task/subtask in this workspace, and drop them from any
    // restricted project's access list. Best-effort — the member has
    // already been removed successfully above, so a failure here is
    // logged but doesn't get reported as "removing the member failed".
    try {
      const tasksQuery = query(
        collectionGroup(db, 'tasks'),
        where('workspaceId', '==', wsId),
        where('assigneeUserIds', 'array-contains', userId)
      );
      const tasksSnap = await getDocs(tasksQuery);
      for (const taskDoc of tasksSnap.docs) {
        const data = taskDoc.data() as Task;
        const updatedAssignees = (data.assigneeUserIds || []).filter(id => id !== userId);
        await updateDocumentNonBlocking(taskDoc.ref, {
          assigneeUserIds: updatedAssignees,
          updatedAt: new Date().toISOString(),
        });
      }

      const subtasksQuery = query(
        collectionGroup(db, 'subtasks'),
        where('workspaceId', '==', wsId),
        where('assigneeUserId', '==', userId)
      );
      const subtasksSnap = await getDocs(subtasksQuery);
      for (const subtaskDoc of subtasksSnap.docs) {
        await updateDocumentNonBlocking(subtaskDoc.ref, {
          assigneeUserId: null,
          updatedAt: new Date().toISOString(),
        });
      }

      for (const proj of projects) {
        if (proj.allowedUserIds?.includes(userId)) {
          const projRef = doc(db, 'workspaces', wsId, 'projects', proj.id);
          await updateDocumentNonBlocking(projRef, {
            allowedUserIds: proj.allowedUserIds.filter(id => id !== userId),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.error("Failed to clean up references to removed member:", e);
    }

    logAudit('remove', 'member', userId, `Removed member "${member?.displayName || 'Unknown'}" from workspace`);
  }, [db, activeWorkspace, isAdmin, user, workspaceMembers, projects, logAudit, syncMemberUserIds]);

  const updateMemberRole = useCallback(async (userId: string, newRole: 'member' | 'lead') => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isAdmin || userId === user?.uid) return;

    const wsRef = doc(db, 'workspaces', wsId);
    const roles = { ...activeWorkspace!.memberRoles };
    const member = workspaceMembers.find(m => m.userId === userId);
    roles[userId] = newRole;
    await updateDocumentNonBlocking(wsRef, {
      memberRoles: roles,
      updatedAt: new Date().toISOString()
    });
    syncMemberUserIds(wsId, roles);
    logAudit('update', 'member', userId, `Changed role of "${member?.displayName || 'Unknown'}" to ${newRole}`);
  }, [db, activeWorkspace, isAdmin, user, workspaceMembers, logAudit, syncMemberUserIds]);

  return {
    workspaceMembers,
    searchUsersByEmail,
    directAddMember,
    removeMember,
    updateMemberRole,
  };
}
