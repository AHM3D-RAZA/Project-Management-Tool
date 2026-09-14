"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { collection, doc, getDoc, query, where } from 'firebase/firestore';
import { useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import type { Workspace } from '@/lib/types';
import { getMemberUserIds, syncMemberUserIds as syncMemberUserIdsShared } from '@/lib/member-sync';

export interface DeletionProgress {
  type: 'workspace' | 'project';
  label: string;
  count: number;
}

interface UseWorkspaceCoreParams {
  db: Firestore | null;
  user: User | null;
  isAuthReady: boolean;
}

/**
 * The foundational piece every other domain hook builds on: which
 * workspace is active, the current user's role in it, and a handful of
 * cross-cutting utilities (admin checks, member-list syncing) that many
 * domains need. See use-workspace-mutations.ts for
 * create/update/delete — those need logAudit from use-audit-log.ts,
 * which itself needs this hook's output, so they're called after both.
 */
export function useWorkspaceCore({ db, user, isAuthReady }: UseWorkspaceCoreParams) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);
  const [deletionProgress, setDeletionProgress] = useState<DeletionProgress | null>(null);

  // Load the user's last-active workspace, so they land back where they
  // left off rather than an arbitrary first workspace.
  useEffect(() => {
    if (isAuthReady && user?.uid && db) {
      const uid = user.uid;
      const loadUserPrefs = async () => {
        try {
          const userRef = doc(db, 'users', uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.lastActiveWorkspaceId) {
              setActiveWorkspaceId(data.lastActiveWorkspaceId);
            }
          }
        } catch (err) {
          console.error("Store: Error loading user prefs:", err);
        } finally {
          setIsPrefsLoading(false);
        }
      };
      loadUserPrefs();
    } else if (isAuthReady && !user?.uid) {
      setIsPrefsLoading(false);
    }
  }, [isAuthReady, user?.uid, db]);

  const workspacesQuery = useMemoFirebase(() => {
    if (!db || !user?.uid || !isAuthReady) return null;
    return query(
      collection(db, 'workspaces'),
      where(`memberRoles.${user.uid}`, '!=', null)
    );
  }, [db, user?.uid, isAuthReady]);

  const { data: workspacesData, isLoading: isWorkspacesLoading } = useCollection<Workspace>(workspacesQuery);
  const workspaces = useMemo(() => workspacesData || [], [workspacesData]);

  const activeWorkspace = useMemo(() => {
    if (workspaces.length === 0) return null;
    if (activeWorkspaceId) {
      const found = workspaces.find(w => w.id === activeWorkspaceId);
      if (found) return found;
    }
    return workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  const isOwner = useMemo(() => activeWorkspace?.ownerUserId === user?.uid, [activeWorkspace, user?.uid]);
  const currentRole = useMemo(() => {
    if (isOwner) return 'owner';
    return activeWorkspace?.memberRoles?.[user?.uid || ''] || null;
  }, [activeWorkspace, user?.uid, isOwner]);

  const isAdmin = useMemo(
    () => isOwner || currentRole === 'lead' || currentRole === 'owner',
    [isOwner, currentRole]
  );

  const switchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    setActiveProjectId(null);
    if (user?.uid && db) {
      const userRef = doc(db, 'users', user.uid);
      updateDocumentNonBlocking(userRef, { lastActiveWorkspaceId: id });
    }
  }, [user?.uid, db]);

  const selectProject = useCallback((id: string | null) => {
    setActiveProjectId(id);
  }, []);

  // Whether the current user has admin access to a GIVEN workspace, which
  // may not be the currently-active one (e.g. checking permissions for a
  // workspace a task's about to be created in). Fast path reuses the
  // already-loaded activeWorkspace when it matches; otherwise fetches it.
  const hasWorkspaceAdminAccess = useCallback(async (wsId: string) => {
    if (!db || !user?.uid || !wsId) return false;

    if (activeWorkspace?.id === wsId) {
      return isOwner || currentRole === 'lead' || currentRole === 'owner';
    }

    try {
      const wsSnap = await getDoc(doc(db, 'workspaces', wsId));
      if (!wsSnap.exists()) return false;

      const wsData = wsSnap.data() as Workspace;
      if (wsData.ownerUserId === user.uid) return true;

      const role = wsData.memberRoles?.[user.uid];
      return role === 'owner' || role === 'lead';
    } catch (error) {
      console.error('Failed to verify workspace permissions:', error);
      return false;
    }
  }, [db, user?.uid, activeWorkspace?.id, isOwner, currentRole]);

  // Resolve a workspace's current member uids for denormalizing onto a new
  // document (see getMemberUserIds above). Uses the already-loaded
  // activeWorkspace when it matches (the common case — avoids an extra
  // read) and falls back to fetching the workspace doc otherwise.
  const getMemberUserIdsForWorkspace = useCallback(async (wsId: string): Promise<string[]> => {
    if (activeWorkspace?.id === wsId) {
      return getMemberUserIds(activeWorkspace);
    }
    if (!db) return [];
    try {
      const wsSnap = await getDoc(doc(db, 'workspaces', wsId));
      if (!wsSnap.exists()) return [];
      return getMemberUserIds(wsSnap.data() as Workspace);
    } catch (e) {
      console.error('Failed to resolve workspace members for denormalization:', e);
      return [];
    }
  }, [db, activeWorkspace]);

  // Propagates a workspace's current member/admin uid lists onto every
  // EXISTING document across the workspace, whenever membership changes.
  // New documents get memberUserIds/adminUserIds written at creation time
  // by whichever domain hook creates them; this is what keeps documents
  // created *before* a membership change correct afterward. See
  // lib/member-sync.ts for the shared implementation (also used by the
  // self-service join page).
  const syncMemberUserIds = useCallback(async (wsId: string, memberRoles: Workspace['memberRoles']) => {
    if (!db) return;
    await syncMemberUserIdsShared(db, wsId, memberRoles);
  }, [db]);

  // Picks up after a self-service invite acceptance (link/email): that
  // joining user can't list/backfill pre-existing workspace documents with
  // their own membership (they're not in those documents' memberUserIds
  // yet — see lib/member-sync.ts), so they flag pendingMemberSync instead.
  // Any admin's client resolves it here the next time it has this
  // workspace loaded, since admins already have full list access to run
  // the sync themselves.
  // ⚠️ See /TODO.md — the proper fix (instant, no admin wait) needs a
  // Cloud Function and the Firebase project on the Blaze plan.
  const pendingSyncHandledRef = useRef<string | null>(null);
  useEffect(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isAdmin || !activeWorkspace?.pendingMemberSync) return;
    if (pendingSyncHandledRef.current === wsId) return; // already in flight for this workspace
    pendingSyncHandledRef.current = wsId;

    (async () => {
      try {
        await syncMemberUserIdsShared(db, wsId, activeWorkspace.memberRoles);
        await updateDocumentNonBlocking(doc(db, 'workspaces', wsId), { pendingMemberSync: false });
      } catch (e) {
        console.error('Failed to resolve pending member sync:', e);
      } finally {
        pendingSyncHandledRef.current = null;
      }
    })();
  }, [db, isAdmin, activeWorkspace?.id, activeWorkspace?.pendingMemberSync, activeWorkspace?.memberRoles]);

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeProjectId,
    isOwner,
    currentRole,
    isAdmin,
    isWorkspacesLoading: isWorkspacesLoading || isPrefsLoading,
    switchWorkspace,
    selectProject,
    hasWorkspaceAdminAccess,
    getMemberUserIdsForWorkspace,
    syncMemberUserIds,
    deletionProgress,
    setDeletionProgress,
  };
}
