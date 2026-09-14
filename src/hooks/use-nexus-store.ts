
"use client";

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collectionGroup, doc, query, where } from 'firebase/firestore';
import { Task, Subtask } from '@/lib/types';
import { useWorkspaceCore } from '@/hooks/store/use-workspace-core';
import { useAuditLog } from '@/hooks/store/use-audit-log';
import { useWorkspaceMutations } from '@/hooks/store/use-workspace-mutations';
import { useAttendance } from '@/hooks/store/use-attendance';
import { useCustomStatuses } from '@/hooks/store/use-custom-statuses';
import { useCustomFields } from '@/hooks/store/use-custom-fields';
import { useWorkUpdates } from '@/hooks/store/use-work-updates';
import { useProjects } from '@/hooks/store/use-projects';
import { useTasks } from '@/hooks/store/use-tasks';
import { useCommentsAttachments } from '@/hooks/store/use-comments-attachments';
import { useMembers } from '@/hooks/store/use-members';
import { useInvitations } from '@/hooks/store/use-invitations';

/**
 * The app's central data store. This is a thin composer: almost all
 * actual logic lives in the domain hooks under src/hooks/store/, each
 * owning one area (workspace core, audit log, attendance, projects,
 * tasks, comments/attachments, members, invitations, custom statuses,
 * custom fields, work updates). This file's job is just to call them in
 * the right order (later hooks depend on earlier ones' output) and
 * combine their results into the one object every component consumes via
 * useNexusStore(). Component-facing property names are preserved exactly
 * as they were before this was split up — no component needed to change.
 */
export function useNexusStore() {
  const { user, isAuthReady } = useUser();
  const db = useFirestore();
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    activeProjectId,
    isOwner,
    currentRole,
    isAdmin,
    isWorkspacesLoading,
    switchWorkspace,
    selectProject,
    hasWorkspaceAdminAccess,
    getMemberUserIdsForWorkspace,
    syncMemberUserIds,
    deletionProgress,
    setDeletionProgress,
  } = useWorkspaceCore({ db, user, isAuthReady });

  // Raw task/subtask data for the whole workspace. Cross-domain glue:
  // allWorkspaceTasks (below, after useProjects) needs both this data and
  // the projects list to filter by access, so it can't live inside a
  // single domain hook.
  const globalTasksQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !isAuthReady || !wsId) return null;
    // Important: constrain the collectionGroup query so we don't read every task in the database.
    return query(collectionGroup(db, 'tasks'), where('workspaceId', '==', wsId));
  }, [db, user?.uid, isAuthReady, activeWorkspace?.id]);

  const { data: globalTasksData, isLoading: isTasksLoading } = useCollection<Task>(globalTasksQuery);

  const globalSubtasksQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !isAuthReady || !wsId) return null;
    return query(collectionGroup(db, 'subtasks'), where('workspaceId', '==', wsId));
  }, [db, user?.uid, isAuthReady, activeWorkspace?.id]);

  const { data: globalSubtasksData } = useCollection<Subtask>(globalSubtasksQuery);
  const allWorkspaceSubtasks = useMemo(() => globalSubtasksData || [], [globalSubtasksData]);

  const { workspaceAuditLogs, isAuditLogsLoading, logAudit } = useAuditLog({
    db, user, activeWorkspace, isAuthReady, isAdmin, currentRole,
  });

  const {
    todayAttendance,
    isAttendanceLoading,
    openAttendanceEntry,
    allWorkspaceAttendance,
    isAllAttendanceLoading,
    todayTeamAttendance,
    isTodayTeamAttendanceLoading,
    openTeamAttendance,
    checkIn,
    checkOut,
    cancelCheckIn,
  } = useAttendance({ db, user, activeWorkspace, isAuthReady, isAdmin });

  const { allStatuses, getStatusInfo, isCompletedStatus, addCustomStatus } = useCustomStatuses({
    db, user, activeWorkspace, isAuthReady, isOwner, logAudit,
  });

  const { customFieldDefinitions, addCustomFieldDefinition, deleteCustomFieldDefinition } = useCustomFields({
    db, user, activeWorkspace, isAuthReady, isOwner, logAudit,
  });

  const { workspaceWorkUpdates, isWorkUpdatesLoading, saveWorkUpdate } = useWorkUpdates({
    db, user, activeWorkspace, isAuthReady, isAdmin, logAudit,
  });

  const { projects, activeProject, createProject, updateProject, deleteProject, updateProjectMembers } = useProjects({
    db, user, activeWorkspace, activeProjectId, isAuthReady, isAdmin, logAudit, getMemberUserIdsForWorkspace, setDeletionProgress,
  });

  const allWorkspaceTasks = useMemo(() => {
    const wsId = activeWorkspace?.id;
    if (!globalTasksData || !wsId) return [];
    return globalTasksData.filter(t => {
      if (t.workspaceId !== wsId) return false;
      if (isAdmin) return true;
      const project = projects.find(p => p.id === t.projectId);
      return !!project;
    });
  }, [globalTasksData, activeWorkspace?.id, isAdmin, projects]);

  const myTasks = useMemo(() => {
    if (!user?.uid) return [];
    return allWorkspaceTasks.filter(t => t.assigneeUserIds?.includes(user.uid));
  }, [allWorkspaceTasks, user?.uid]);

  const projectTasks = useMemo(() => {
    if (!activeProject) return [];
    return allWorkspaceTasks.filter(t => t.projectId === activeProject.id);
  }, [allWorkspaceTasks, activeProject]);

  const { createTask, updateTask, deleteTask, createSubtask, updateSubtask, deleteSubtask } = useTasks({
    db, user, activeWorkspace, isAdmin, allWorkspaceTasks, allWorkspaceSubtasks,
    hasWorkspaceAdminAccess, getMemberUserIdsForWorkspace, logAudit,
  });

  const { addComment, updateComment, deleteComment, addAttachment, removeAttachment } = useCommentsAttachments({
    db, user, activeWorkspace, allWorkspaceTasks, logAudit,
  });

  const { workspaceMembers, searchUsersByEmail, directAddMember, removeMember, updateMemberRole } = useMembers({
    db, user, activeWorkspace, isAuthReady, isAdmin, projects, logAudit, syncMemberUserIds,
  });

  const { workspaceInvitations, cancelInvitation, sendEmailInvite } = useInvitations({
    db, user, activeWorkspace, isAdmin, logAudit,
  });

  const { createWorkspace, updateWorkspace, deleteWorkspace } = useWorkspaceMutations({
    db, user, isOwner, workspaces, logAudit, setActiveWorkspaceId, setDeletionProgress,
  });

  return {
    currentUser: user ? { id: user.uid, name: user.displayName || 'User', email: user.email || '', avatarUrl: user.photoURL || null } : null,
    workspaces,
    activeWorkspace: activeWorkspace || { id: '', name: 'Loading...', description: '', color: '#ccc', memberRoles: {} as Record<string, 'owner' | 'lead' | 'member'>, ownerUserId: '', createdAt: '', updatedAt: '' },
    workspaceProjects: projects,
    activeProject,
    allWorkspaceTasks,
    allWorkspaceSubtasks,
    projectTasks,
    myTasks,
    workspaceMembers,
    workspaceWorkUpdates,
    isWorkUpdatesLoading,
    workspaceInvitations,
    cancelInvitation,
    saveWorkUpdate,
    globalSearchQuery,
    isTasksLoading,
    isWorkspacesLoading,
    isAdmin,
    isOwner,
    currentRole,
    todayAttendance,
    isAttendanceLoading,
    openAttendanceEntry,
    allWorkspaceAttendance,
    isAllAttendanceLoading,
    todayTeamAttendance,
    isTodayTeamAttendanceLoading,
    openTeamAttendance,
    workspaceAuditLogs,
    isAuditLogsLoading,
    allStatuses,
    getStatusInfo,
    isCompletedStatus,
    addCustomStatus,
    customFieldDefinitions,
    addCustomFieldDefinition,
    deleteCustomFieldDefinition,
    setGlobalSearchQuery,
    switchWorkspace,
    selectProject,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    createProject,
    updateProjectMembers,
    updateProject,
    deleteProject,
    createTask,
    updateTask,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    markNotificationAsRead: async (notifId: string) => {
      if (!db || !user) return;
      const ref = doc(db, 'notifications', notifId);
      updateDocumentNonBlocking(ref, { read: true });
    },
    deleteTask,
    addComment,
    updateComment,
    deleteComment,
    addAttachment,
    removeAttachment,
    removeMember,
    updateMemberRole,
    searchUsersByEmail,
    sendEmailInvite,
    directAddMember,
    checkIn,
    checkOut,
    cancelCheckIn,
    deletionProgress,
  };
}

/**
 * The full shape of what useNexusStore() returns. Components that receive
 * the store as a prop (rather than calling the hook directly) should type
 * it as `{ store: NexusStore }` instead of `{ store: any }`.
 */
export type NexusStore = ReturnType<typeof useNexusStore>;
