"use client";

import { useCallback } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { deleteWorkspaceCascade } from '@/lib/cascade-delete';
import type { Workspace, AuditLog } from '@/lib/types';
import type { DeletionProgress } from '@/hooks/store/use-workspace-core';

interface UseWorkspaceMutationsParams {
  db: Firestore | null;
  user: User | null;
  isOwner: boolean;
  workspaces: Workspace[];
  logAudit: (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, summary: string) => void;
  setActiveWorkspaceId: (id: string) => void;
  setDeletionProgress: (value: DeletionProgress | null | ((prev: DeletionProgress | null) => DeletionProgress | null)) => void;
  /** Used to also clean up uploaded attachment Storage files across every task being deleted. */
  storage: FirebaseStorage | null;
}

/**
 * Create/update/delete for the workspace itself. Separate from
 * use-workspace-core.ts because updateWorkspace needs logAudit, which
 * itself depends on core's own output (activeWorkspace/isAdmin) — so
 * these are called after both use-workspace-core and use-audit-log.
 */
export function useWorkspaceMutations({
  db, user, isOwner, workspaces, logAudit, setActiveWorkspaceId, setDeletionProgress, storage,
}: UseWorkspaceMutationsParams) {
  const createWorkspace = useCallback(async (name: string, description: string) => {
    if (!db || !user) return null;
    const wsRef = doc(collection(db, 'workspaces'));
    const wsData: Workspace = {
      id: wsRef.id,
      name,
      description: description || '',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
      ownerUserId: user.uid,
      memberRoles: { [user.uid]: 'owner' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDocumentNonBlocking(wsRef, wsData, { merge: true });
      const memberRef = doc(db, 'workspaces', wsRef.id, 'members', user.uid);
      await setDocumentNonBlocking(memberRef, {
        id: user.uid,
        workspaceId: wsRef.id,
        userId: user.uid,
        displayName: user.displayName || 'User',
        email: user.email?.toLowerCase() || '',
        avatarUrl: user.photoURL || null,
        memberUserIds: [user.uid],
      }, { merge: true });
      setActiveWorkspaceId(wsRef.id);
      return wsRef.id;
    } catch (e) {
      console.error("Failed to create workspace:", e);
      return null;
    }
  }, [db, user, setActiveWorkspaceId]);

  const updateWorkspace = useCallback(async (workspaceId: string, data: Partial<Workspace>) => {
    if (!db || !isOwner || !user) return;
    const ref = doc(db, 'workspaces', workspaceId);
    await updateDocumentNonBlocking(ref, { ...data, updatedAt: new Date().toISOString() });
    logAudit('update', 'workspace', workspaceId, 'Updated workspace settings');
  }, [db, isOwner, user, logAudit]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    if (!db || !isOwner || !user) return;
    // Only allow deleting if owner
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws || ws.ownerUserId !== user.uid) {
      throw new Error('Only workspace owner can delete the workspace.');
    }

    // No audit log entry for this: audit_logs is one of the collections
    // the cascade below wipes (a trail for a workspace that no longer
    // exists serves no purpose), and logAudit's write isn't awaited, so it
    // could race past the cascade and land as a single, permanently
    // unreadable orphan — exactly the kind of stranded data this fix is
    // meant to eliminate.
    setDeletionProgress({ type: 'workspace', label: ws.name, count: 0 });
    try {
      await deleteWorkspaceCascade(db, workspaceId, (delta) => {
        setDeletionProgress(prev => (prev ? { ...prev, count: prev.count + delta } : prev));
      }, storage);
    } catch (e) {
      console.error("Failed to delete workspace:", e);
      throw e;
    } finally {
      setDeletionProgress(null);
    }
  }, [db, isOwner, user, workspaces, setDeletionProgress, storage]);

  return {
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  };
}
