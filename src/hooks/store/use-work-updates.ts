"use client";

import { useCallback, useMemo } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { collection, doc, limit, orderBy, query } from 'firebase/firestore';
import { useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import type { Workspace, WorkUpdate, AuditLog } from '@/lib/types';
import { getMemberUserIds } from '@/lib/member-sync';

interface UseWorkUpdatesParams {
  db: Firestore | null;
  user: User | null;
  activeWorkspace: Workspace | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  logAudit: (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, summary: string) => void;
}

/**
 * Work updates: free-form status notes a member can post for the
 * workspace (not tied to a specific task — see the Comments-vs-Work-
 * Updates distinction in the UI). Visible to admins in the Attendance Log.
 */
export function useWorkUpdates({ db, user, activeWorkspace, isAuthReady, isAdmin, logAudit }: UseWorkUpdatesParams) {
  const workUpdatesQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || wsId === '' || !isAuthReady || !isAdmin) return null;
    return query(
      collection(db, 'workspaces', wsId, 'work_updates'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
  }, [db, activeWorkspace?.id, isAuthReady, isAdmin]);

  const { data: workUpdatesData, isLoading: isWorkUpdatesLoading } = useCollection<WorkUpdate>(workUpdatesQuery);
  const workspaceWorkUpdates = useMemo(() => workUpdatesData || [], [workUpdatesData]);

  const saveWorkUpdate = useCallback(async (updateText: string) => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId || !updateText.trim()) return;

    const workUpdateRef = doc(collection(db, 'workspaces', wsId, 'work_updates'));
    const workUpdateData: WorkUpdate = {
      id: workUpdateRef.id,
      userId: user.uid,
      workspaceId: wsId,
      updateText: updateText.trim(),
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      memberUserIds: getMemberUserIds(activeWorkspace),
    };

    await setDocumentNonBlocking(workUpdateRef, workUpdateData, { merge: true });
    logAudit('create', 'work_update', workUpdateRef.id, `Added work update`);
  }, [db, user, activeWorkspace, logAudit]);

  return {
    workspaceWorkUpdates,
    isWorkUpdatesLoading,
    saveWorkUpdate,
  };
}
