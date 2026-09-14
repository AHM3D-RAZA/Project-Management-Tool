"use client";

import { useCallback, useMemo } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { collection, doc, limit, orderBy, query } from 'firebase/firestore';
import { useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import type { Workspace, AuditLog } from '@/lib/types';
import { getMemberUserIds, getAdminUserIds } from '@/lib/member-sync';

interface UseAuditLogParams {
  db: Firestore | null;
  user: User | null;
  activeWorkspace: Workspace | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  currentRole: 'owner' | 'lead' | 'member' | null;
}

/**
 * The workspace's admin-only audit trail: the log entries themselves, and
 * logAudit() for every other domain hook to record an action.
 */
export function useAuditLog({ db, user, activeWorkspace, isAuthReady, isAdmin, currentRole }: UseAuditLogParams) {
  const auditLogsQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || wsId === '' || !isAuthReady || !isAdmin) return null;
    return query(
      collection(db, 'workspaces', wsId, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
  }, [db, activeWorkspace?.id, isAuthReady, isAdmin]);

  const { data: auditLogsData, isLoading: isAuditLogsLoading } = useCollection<AuditLog>(auditLogsQuery);
  const workspaceAuditLogs = useMemo(() => auditLogsData || [], [auditLogsData]);

  const logAudit = useCallback((action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, summary: string) => {
    const wsId = activeWorkspace?.id;
    if (!db || !user || !wsId || !isAdmin) return;
    try {
      const logRef = doc(collection(db, 'workspaces', wsId, 'audit_logs'));
      const logData: AuditLog = {
        id: logRef.id,
        workspaceId: wsId,
        actorId: user.uid,
        actorRole: currentRole as 'owner' | 'lead',
        action,
        entityType,
        entityId,
        summary,
        timestamp: new Date().toISOString(),
        memberUserIds: getMemberUserIds(activeWorkspace),
        adminUserIds: getAdminUserIds(activeWorkspace),
      };
      setDocumentNonBlocking(logRef, logData, { merge: true });
    } catch (e) {
      console.error('Failed to write audit log', e);
    }
  }, [db, user, activeWorkspace, isAdmin, currentRole]);

  return {
    workspaceAuditLogs,
    isAuditLogsLoading,
    logAudit,
  };
}
