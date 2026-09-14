"use client";

import { useCallback, useMemo } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import type { Workspace, CustomStatus, StatusConfig, AuditLog } from '@/lib/types';
import { getMemberUserIds } from '@/lib/member-sync';

// The app's 4 built-in task statuses. Static data — never changes at
// runtime — so it lives at module scope rather than being recreated on
// every render.
const DEFAULT_STATUSES: StatusConfig[] = [
  { id: 'todo', name: 'To Do', color: 'bg-slate-200', isDefault: true },
  { id: 'in_progress', name: 'In Progress', color: 'bg-accent/20', isDefault: true },
  { id: 'on_hold', name: 'On Hold', color: 'bg-amber-100', isDefault: true },
  { id: 'done', name: 'Done', color: 'bg-green-100', isDefault: true },
];

interface UseCustomStatusesParams {
  db: Firestore | null;
  user: User | null;
  activeWorkspace: Workspace | null;
  isAuthReady: boolean;
  isOwner: boolean;
  logAudit: (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, summary: string) => void;
}

/**
 * Custom statuses: workspace-defined task statuses (owner-managed),
 * combined with the 4 built-in defaults into a single lookup used
 * throughout the app for displaying/resolving a task's status.
 */
export function useCustomStatuses({ db, user, activeWorkspace, isAuthReady, isOwner, logAudit }: UseCustomStatusesParams) {
  const customStatusesQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || wsId === '' || !isAuthReady) return null;
    return query(
      collection(db, 'workspaces', wsId, 'custom_statuses'),
      orderBy('order', 'asc')
    );
  }, [db, activeWorkspace?.id, isAuthReady]);

  const { data: customStatusesData } = useCollection<CustomStatus>(customStatusesQuery);
  const workspaceCustomStatuses = useMemo(() => customStatusesData || [], [customStatusesData]);

  const allStatuses = useMemo((): StatusConfig[] => {
    const customConfigs: StatusConfig[] = workspaceCustomStatuses.map(cs => ({
      id: cs.id,
      name: cs.name,
      color: cs.color,
      isDefault: false,
    }));
    return [...DEFAULT_STATUSES, ...customConfigs];
  }, [workspaceCustomStatuses]);

  const getStatusInfo = useCallback((statusId: string): StatusConfig => {
    return allStatuses.find(s => s.id === statusId) || {
      id: statusId,
      name: statusId,
      color: '#94a3b8',
      isDefault: false,
    };
  }, [allStatuses]);

  const isCompletedStatus = useCallback((statusId: string): boolean => {
    return statusId === 'done';
  }, []);

  const addCustomStatus = useCallback(async (name: string, color: string) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !user || !isOwner) {
      throw new Error('Only workspace owners can create custom statuses.');
    }

    // Validate name is not empty
    if (!name || !name.trim()) {
      throw new Error('Status name is required.');
    }

    // Check for duplicate names (case-insensitive)
    const normalizedName = name.trim().toLowerCase();
    const existingNames = allStatuses.map(s => s.name.toLowerCase());
    if (existingNames.includes(normalizedName)) {
      throw new Error('A status with this name already exists.');
    }

    // Generate a slug-based ID
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let statusId = slug;

    // Handle collision by appending number if needed
    let counter = 1;
    while (allStatuses.some(s => s.id === statusId)) {
      statusId = `${slug}-${counter}`;
      counter++;
    }

    // Determine order (append after existing statuses)
    const maxOrder = Math.max(0, ...workspaceCustomStatuses.map(s => s.order || 0));

    const statusRef = doc(collection(db, 'workspaces', wsId, 'custom_statuses'));
    const statusData: CustomStatus = {
      id: statusRef.id,
      name: name.trim(),
      color,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
      memberUserIds: getMemberUserIds(activeWorkspace),
    };

    try {
      await setDocumentNonBlocking(statusRef, statusData, { merge: true });
      logAudit('create', 'custom_status', statusRef.id, `Created custom status: ${name}`);
      return statusRef.id;
    } catch (e) {
      console.error("Failed to create custom status:", e);
      throw e;
    }
  }, [db, user, activeWorkspace, isOwner, allStatuses, workspaceCustomStatuses, logAudit]);

  return {
    allStatuses,
    getStatusInfo,
    isCompletedStatus,
    addCustomStatus,
  };
}
