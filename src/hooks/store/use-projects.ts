"use client";

import { useCallback, useMemo } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';
import { collection, doc, query } from 'firebase/firestore';
import { useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { deleteProjectCascade } from '@/lib/cascade-delete';
import type { Workspace, Project, AuditLog } from '@/lib/types';

interface DeletionProgress {
  type: 'workspace' | 'project';
  label: string;
  count: number;
}

interface UseProjectsParams {
  db: Firestore | null;
  user: User | null;
  activeWorkspace: Workspace | null;
  activeProjectId: string | null;
  isAuthReady: boolean;
  isAdmin: boolean;
  logAudit: (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, summary: string) => void;
  getMemberUserIdsForWorkspace: (wsId: string) => Promise<string[]>;
  setDeletionProgress: (value: DeletionProgress | null | ((prev: DeletionProgress | null) => DeletionProgress | null)) => void;
  /** Used to also clean up uploaded attachment Storage files when a project's tasks are deleted. */
  storage: FirebaseStorage | null;
}

/**
 * Projects: the collection of projects in the active workspace (filtered
 * to what the current user is allowed to see), the currently-selected
 * one, and create/update/delete/member-access mutations.
 */
export function useProjects({
  db, user, activeWorkspace, activeProjectId, isAuthReady, isAdmin, logAudit, getMemberUserIdsForWorkspace, setDeletionProgress, storage,
}: UseProjectsParams) {
  const projectsQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId || wsId === '' || !isAuthReady) return null;
    return query(collection(db, 'workspaces', wsId, 'projects'));
  }, [db, user?.uid, activeWorkspace?.id, isAuthReady]);

  const { data: projectsData } = useCollection<Project>(projectsQuery);

  const projects = useMemo(() => {
    if (!projectsData) return [];
    if (isAdmin) return projectsData;
    return projectsData.filter(p => p.allowedUserIds?.includes(user?.uid || ''));
  }, [projectsData, isAdmin, user?.uid]);

  const activeProject = useMemo(() =>
    projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const createProject = useCallback(async (wsId: string, name: string, description: string) => {
    if (!db || !wsId) return null;
    const projRef = doc(collection(db, 'workspaces', wsId, 'projects'));
    const creatorId = user?.uid || null;
    const projData: Project = {
      id: projRef.id,
      workspaceId: wsId,
      name,
      description: description || '',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
      allowedUserIds: creatorId ? [creatorId] : [],
      createdByUserId: creatorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      memberUserIds: await getMemberUserIdsForWorkspace(wsId),
    };
    await setDocumentNonBlocking(projRef, projData, { merge: true });
    return projRef.id;
  }, [db, user, getMemberUserIdsForWorkspace]);

  const updateProject = useCallback(async (projectId: string, data: Partial<Project>) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isAdmin || !user) return;
    const project = projects.find((p) => p.id === projectId);
    const ref = doc(db, 'workspaces', wsId, 'projects', projectId);
    await updateDocumentNonBlocking(ref, { ...data, updatedAt: new Date().toISOString() });
    logAudit('update', 'project', projectId, `Updated project "${project?.name || 'Unknown'}"`);
  }, [db, isAdmin, user, activeWorkspace?.id, projects, logAudit]);

  const updateProjectMembers = useCallback((projectId: string, allowedUserIds: string[]) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !projectId || !isAdmin) return;
    const ref = doc(db, 'workspaces', wsId, 'projects', projectId);
    updateDocumentNonBlocking(ref, { allowedUserIds, updatedAt: new Date().toISOString() });
  }, [db, activeWorkspace?.id, isAdmin]);

  const deleteProject = useCallback(async (projectId: string) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isAdmin || !user) return;
    const project = projects.find((p) => p.id === projectId);
    setDeletionProgress({ type: 'project', label: project?.name || 'project', count: 0 });
    try {
      await deleteProjectCascade(db, wsId, projectId, (delta) => {
        setDeletionProgress(prev => (prev ? { ...prev, count: prev.count + delta } : prev));
      }, storage);
      logAudit('delete', 'project', projectId, `Deleted project "${project?.name || 'Unknown'}"`);
    } catch (e) {
      console.error("Failed to delete project:", e);
      throw e;
    } finally {
      setDeletionProgress(null);
    }
  }, [db, isAdmin, user, activeWorkspace?.id, projects, logAudit, setDeletionProgress, storage]);

  return {
    projects,
    activeProject,
    createProject,
    updateProject,
    deleteProject,
    updateProjectMembers,
  };
}
