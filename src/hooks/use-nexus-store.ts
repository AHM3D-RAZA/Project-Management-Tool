
"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useDoc,
  useMemoFirebase,
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { 
  collection, 
  query, 
  doc, 
  collectionGroup,
  where,
  getDocs,
  getDoc,
  limit,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { Workspace, Project, Task, WorkspaceMember, Invitation, Subtask, AttendanceEntry, AuditLog, CustomStatus, StatusConfig, WorkUpdate } from '@/lib/types';
import { createNotification, notifyTaskAssigned, notifyTaskUpdated, notifySubtaskAssigned, notifyMentioned, notifyMentionedAssignee } from '@/lib/notifications';
import { sendWorkspaceInviteEmail } from '@/app/actions/send-workspace-invite-email';
import { deleteWorkspaceCascade, deleteProjectCascade, deleteTaskCascade } from '@/lib/cascade-delete';

// How long a user has to undo an accidental check-in. Must match the
// duration enforced server-side in firestore.rules.
const CHECK_IN_GRACE_PERIOD_MS = 5 * 60 * 1000;

// The app's 4 built-in task statuses. Static data — never changes at
// runtime — so it lives at module scope rather than being recreated on
// every render of useNexusStore.
const DEFAULT_STATUSES: StatusConfig[] = [
  { id: 'todo', name: 'To Do', color: 'bg-slate-200', isDefault: true },
  { id: 'in_progress', name: 'In Progress', color: 'bg-accent/20', isDefault: true },
  { id: 'on_hold', name: 'On Hold', color: 'bg-amber-100', isDefault: true },
  { id: 'done', name: 'Done', color: 'bg-green-100', isDefault: true },
];

export function useNexusStore() {
  const { user, isAuthReady } = useUser();
  const db = useFirestore();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);
  const [deletionProgress, setDeletionProgress] = useState<{
    type: 'workspace' | 'project';
    label: string;
    count: number;
  } | null>(null);

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

  const invitesQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspace) return null;
    return query(
      collection(db, 'invitations'),
      where('workspaceId', '==', activeWorkspace.id)
    );
  }, [db, activeWorkspace]);

  const { data: invitesData } = useCollection<Invitation>(invitesQuery);
  const workspaceInvitations = useMemo(() => (invitesData || []).filter((i) => i.status === 'active'), [invitesData]);

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

  // Query for work updates in the workspace
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

  // Query for custom statuses in the workspace
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

  // Helper functions for status operations
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

  // Query for all attendance entries in workspace (for admins)
  // Use collectionGroup to get all attendance documents across the workspace
  const allAttendanceQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || wsId === '' || !isAuthReady || !isAdmin) return null;
    // Use collectionGroup to get all attendance documents with this workspaceId
    return query(collectionGroup(db, 'attendance'), where('workspaceId', '==', wsId));
  }, [db, activeWorkspace?.id, isAuthReady, isAdmin]);

  const { data: allAttendanceData, isLoading: isAllAttendanceLoading } = useCollection<AttendanceEntry>(allAttendanceQuery);
  const allWorkspaceAttendance = useMemo(() => {
    if (!isAdmin) return []; // Only admins can view all attendance
    return allAttendanceData || [];
  }, [allAttendanceData, isAdmin]);

  // Helper to get today's date key in local timezone (YYYY-MM-DD)
  const getTodayDateKey = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Query for today's attendance entry for current user
  const todayDateKey = getTodayDateKey();
  const attendanceDocRef = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId || wsId === '' || !isAuthReady) return null;
    // Simplified structure: attendance/{userId}_{dateKey}
    const docId = `${user.uid}_${todayDateKey}`;
    return doc(db, 'workspaces', wsId, 'attendance', docId);
  }, [db, user?.uid, activeWorkspace?.id, isAuthReady, todayDateKey]);

  const { data: todayAttendanceData, isLoading: isAttendanceLoading } = useDoc<AttendanceEntry>(attendanceDocRef);
  const todayAttendance = useMemo(() => todayAttendanceData, [todayAttendanceData]);

  // Query for today's attendance for ALL workspace members (visible to everyone, not admin-gated)
  const todayTeamAttendanceQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || wsId === '' || !isAuthReady || !user?.uid) return null;
    return query(
      collectionGroup(db, 'attendance'),
      where('workspaceId', '==', wsId),
      where('dateKey', '==', todayDateKey)
    );
  }, [db, activeWorkspace?.id, isAuthReady, user?.uid, todayDateKey]);

  const { data: todayTeamAttendanceData, isLoading: isTodayTeamAttendanceLoading } = useCollection<AttendanceEntry>(todayTeamAttendanceQuery);
  const todayTeamAttendance = useMemo(() => todayTeamAttendanceData || [], [todayTeamAttendanceData]);

  // Query for the current user's open (unchecked-out) attendance entry across ALL days
  const openAttendanceQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId || wsId === '' || !isAuthReady) return null;
    return query(
      collection(db, 'workspaces', wsId, 'attendance'),
      where('userId', '==', user.uid),
      where('checkOutTime', '==', null)
    );
  }, [db, user?.uid, activeWorkspace?.id, isAuthReady]);

  const { data: openAttendanceData } = useCollection<AttendanceEntry>(openAttendanceQuery);
  const openAttendanceEntry = useMemo(() =>
    (openAttendanceData && openAttendanceData.length > 0) ? openAttendanceData[0] : null,
    [openAttendanceData]
  );

  // Query for ALL open (unchecked-out) attendance entries in the workspace (for TeamActivityCard)
  const openTeamAttendanceQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || wsId === '' || !isAuthReady || !user?.uid) return null;
    return query(
      collectionGroup(db, 'attendance'),
      where('workspaceId', '==', wsId),
      where('checkOutTime', '==', null)
    );
  }, [db, activeWorkspace?.id, isAuthReady, user?.uid]);

  const { data: openTeamAttendanceData } = useCollection<AttendanceEntry>(openTeamAttendanceQuery);
  const openTeamAttendance = useMemo(() => openTeamAttendanceData || [], [openTeamAttendanceData]);

  // Auto-checkout effect: if user has an open entry that's 12+ hours old, auto-close it
  useEffect(() => {
    if (!openAttendanceEntry || !db || !activeWorkspace?.id) return;

    const checkInTime = new Date(openAttendanceEntry.checkInTime);
    const now = new Date();
    const hoursSinceCheckIn = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCheckIn >= 12) {
      const autoCheckoutTime = new Date(checkInTime.getTime() + 12 * 60 * 60 * 1000);
      const ref = doc(db, 'workspaces', openAttendanceEntry.workspaceId, 'attendance', openAttendanceEntry.id);
      updateDocumentNonBlocking(ref, {
        checkOutTime: autoCheckoutTime.toISOString(),
        checkOutServerTime: serverTimestamp(),
        autoCheckout: true,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [openAttendanceEntry, db, activeWorkspace?.id]);

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
        timestamp: new Date().toISOString()
      };
      setDocumentNonBlocking(logRef, logData, { merge: true });
    } catch (e) {
      console.error('Failed to write audit log', e);
    }
  }, [db, user, activeWorkspace?.id, isAdmin, currentRole]);

  const cancelInvitation = useCallback(async (inviteId: string) => {
    if (!db || !isAdmin) return;
    const ref = doc(db, 'invitations', inviteId);
    await deleteDocumentNonBlocking(ref);
    logAudit('revoke', 'invitation', inviteId, 'Revoked invitation');
  }, [db, isAdmin, logAudit]);

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


  const createWorkspace = useCallback(async (name: string, description: string) => {
    if (!db || !user) return null;
    const wsRef = doc(collection(db, 'workspaces'));
    const wsData: Workspace = {
      id: wsRef.id,
      name,
      description: description || '',
      color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
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
      }, { merge: true });
      setActiveWorkspaceId(wsRef.id);
      return wsRef.id;
    } catch (e) {
      console.error("Failed to create workspace:", e);
      return null;
    }
  }, [db, user]);

  const createTask = useCallback(async (wsId: string, projectId: string, data: Partial<Task> & { title: string }) => {
    if (!db || !wsId || !projectId || !user) return null;
    const canCreateTask = await hasWorkspaceAdminAccess(wsId);
    if (!canCreateTask) throw new Error('Only admins can create tasks.');
    const taskRef = doc(collection(db, 'workspaces', wsId, 'projects', projectId, 'tasks'));
    const taskData = {
      id: taskRef.id,
      workspaceId: wsId,
      projectId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDocumentNonBlocking(taskRef, taskData, { merge: true });
      
      // Notify assignees if they're not the current user
      if (data.assigneeUserIds && data.assigneeUserIds.length > 0) {
        data.assigneeUserIds.forEach((assigneeId: string) => {
          if (assigneeId !== user.uid) {
            notifyTaskAssigned(db, assigneeId, { id: user.uid, name: user.displayName || 'User' }, {
              id: taskRef.id,
              title: data.title,
              workspaceId: wsId,
              projectId
            });
          }
        });
      }
      return taskRef.id;
    } catch (e) {
      console.error("Failed to create task:", e);
      return null;
    }
  }, [db, user, hasWorkspaceAdminAccess]);

  const updateTask = useCallback((taskId: string, data: Partial<Task>) => {
    if (!db || !isAdmin || !user) return;
    const t = allWorkspaceTasks.find(x => x.id === taskId);
    if (t) {
      const ref = doc(db, 'workspaces', t.workspaceId, 'projects', t.projectId, 'tasks', t.id);
      updateDocumentNonBlocking(ref, { ...data, updatedAt: new Date().toISOString() });
      logAudit('update', 'task', t.id, `Updated task: ${data.title || t.title}`);

      // Detect meaningful changes for notification
      const changes: string[] = [];
      if (data.title && data.title !== t.title) changes.push('title');
      if (data.status && data.status !== t.status) changes.push('status');
      if (data.priority && data.priority !== t.priority) changes.push('priority');
      if (data.dueDate !== undefined && data.dueDate !== t.dueDate) changes.push('due date');

      // Handle assignment changes for notifications
      const oldAssignees = t.assigneeUserIds || [];
      const newAssignees = data.assigneeUserIds || [];

      // Who's actually assigned to the task after this update — the
      // freshly-provided list if this call changed assignment, otherwise
      // the task's existing assignees (data.assigneeUserIds is undefined
      // for every single-field edit like title/status/priority/dueDate,
      // which is how every real edit in this app is made — using
      // newAssignees here would always be [] for those, silently
      // preventing "task updated" notifications from ever reaching real
      // assignees).
      const currentAssignees = data.assigneeUserIds !== undefined ? newAssignees : oldAssignees;

      // Notify newly assigned users
      newAssignees.forEach(assigneeId => {
        if (!oldAssignees.includes(assigneeId) && assigneeId !== user.uid) {
          notifyTaskAssigned(db, assigneeId, { id: user.uid, name: user.displayName || 'User' }, {
            id: t.id,
            title: data.title || t.title,
            workspaceId: t.workspaceId,
            projectId: t.projectId
          });
        }
      });
      
      // Notify unassigned users
      oldAssignees.forEach(assigneeId => {
        if (!newAssignees.includes(assigneeId) && assigneeId !== user.uid && changes.length > 0) {
          // Could add unassignment notification here if needed
        }
      });
      
      // Notify current assignees of task updates
      currentAssignees.forEach(assigneeId => {
        if (assigneeId !== user.uid && changes.length > 0) {
          notifyTaskUpdated(db, assigneeId, { id: user.uid, name: user.displayName || 'User' }, {
            id: t.id,
            title: t.title,
            workspaceId: t.workspaceId,
            projectId: t.projectId
          }, changes);
        }
      });
    }
  }, [db, allWorkspaceTasks, isAdmin, user, logAudit]);

  const createSubtask = useCallback(async (taskId: string, projectId: string, data: Partial<Subtask>) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !projectId || !taskId || !user || !isAdmin) return null;
    const subtaskRef = doc(collection(db, 'workspaces', wsId, 'projects', projectId, 'tasks', taskId, 'subtasks'));
    const taskObj = allWorkspaceTasks.find(t => t.id === taskId);
    const subtaskData = {
      id: subtaskRef.id,
      workspaceId: wsId,
      projectId,
      taskId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDocumentNonBlocking(subtaskRef, subtaskData, { merge: true });
      // Notify assignee if they're not the current user
      if (data.assigneeUserId && data.assigneeUserId !== user.uid) {
        notifySubtaskAssigned(db, data.assigneeUserId, { id: user.uid, name: user.displayName || 'User' }, {
          id: taskId,
          title: taskObj?.title || 'Task',
          workspaceId: wsId,
          projectId
        }, data.title || 'Untitled');
      }
      return subtaskRef.id;
    } catch (e) {
      console.error("Failed to create subtask:", e);
      return null;
    }
  }, [db, user, isAdmin, activeWorkspace?.id, allWorkspaceTasks]);

  const updateSubtask = useCallback((taskId: string, subtaskId: string, data: Partial<Subtask>) => {
    if (!db || !isAdmin || !user) return;
    const s = allWorkspaceSubtasks.find(x => x.id === subtaskId);
    if (s) {
      const ref = doc(db, 'workspaces', s.workspaceId, 'projects', s.projectId, 'tasks', s.taskId, 'subtasks', s.id);
      updateDocumentNonBlocking(ref, { ...data, updatedAt: new Date().toISOString() });
      // Handle subtask assignment changes
      const oldAssignee = s.assigneeUserId;
      const newAssignee = data.assigneeUserId;
      
      // Notify newly assigned user
      if (newAssignee && newAssignee !== oldAssignee && newAssignee !== user.uid) {
        const taskObj = allWorkspaceTasks.find(t => t.id === s.taskId);
        notifySubtaskAssigned(db, newAssignee, { id: user.uid, name: user.displayName || 'User' }, {
          id: s.taskId,
          title: taskObj?.title || 'Task',
          workspaceId: s.workspaceId,
          projectId: s.projectId
        }, data.title || s.title);
      }
    }
  }, [db, isAdmin, user, allWorkspaceSubtasks, allWorkspaceTasks]);

  const deleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    if (!db || !isAdmin) return;
    const s = allWorkspaceSubtasks.find(x => x.id === subtaskId);
    if (s) {
      const ref = doc(db, 'workspaces', s.workspaceId, 'projects', s.projectId, 'tasks', s.taskId, 'subtasks', s.id);
      deleteDocumentNonBlocking(ref);
    }
  }, [db, isAdmin, allWorkspaceSubtasks]);

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

  const sendEmailInvite = useCallback(
    async (params: {
      recipientEmail: string;
      role: 'member' | 'lead';
      targetProjectIds: string[];
      joinUrl: string;
    }) => {
      if (!db || !user || !activeWorkspace?.id || activeWorkspace.id === '' || !isAdmin) {
        throw new Error('You do not have permission to send invitations.');
      }
      const ws = activeWorkspace;
      const normalized = params.recipientEmail.trim().toLowerCase();
      if (!normalized) throw new Error('Email is required.');
      if (user.email?.toLowerCase() === normalized) {
        throw new Error('You cannot invite your own email address.');
      }

      const inviteRef = doc(collection(db, 'invitations'));
      const expiresAt = null;
      const maxUses = 'unlimited' as const;

      const inviteData: Invitation = {
        id: inviteRef.id,
        workspaceId: ws.id,
        workspaceName: ws.name,
        role: params.role,
        invitedBy: user.uid,
        invitedByName: user.displayName || 'Someone',
        type: 'email',
        status: 'active',
        usageCount: 0,
        maxUses,
        createdAt: new Date().toISOString(),
        expiresAt,
        invitedEmail: normalized,
        // If none selected: member invites should grant access to all workspace projects on join.
        ...(params.targetProjectIds.length > 0
          ? { targetProjectIds: params.targetProjectIds }
          : {}),
      };

      await setDocumentNonBlocking(inviteRef, inviteData, { merge: true });

      const emailResult = await sendWorkspaceInviteEmail({
        to: normalized,
        workspaceName: ws.name,
        inviterName: inviteData.invitedByName,
        joinUrl: `${params.joinUrl.replace(/\/$/, '')}/join/${inviteRef.id}`,
      });

      if (!emailResult.ok) {
        await deleteDocumentNonBlocking(inviteRef);
        throw new Error(emailResult.error);
      }

      logAudit('create', 'invitation', inviteRef.id, `Created email invitation for ${normalized}`);
      return inviteRef.id;
    },
    [db, user, activeWorkspace, isAdmin, logAudit]
  );

  const directAddMember = useCallback(
    async (
      targetUser: {
        id: string;
        name?: string;
        email?: string;
        avatarUrl?: string | null;
      },
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
        },
        { merge: true }
      );

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
    [db, user, activeWorkspace, isAdmin, logAudit]
  );

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
      });
    } catch (e) {
      console.error("Failed to delete workspace:", e);
      throw e;
    } finally {
      setDeletionProgress(null);
    }
  }, [db, isOwner, user, workspaces]);

  const updateProject = useCallback(async (projectId: string, data: Partial<Project>) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isAdmin || !user) return;
    const project = projects.find((p) => p.id === projectId);
    const ref = doc(db, 'workspaces', wsId, 'projects', projectId);
    await updateDocumentNonBlocking(ref, { ...data, updatedAt: new Date().toISOString() });
    logAudit('update', 'project', projectId, `Updated project "${project?.name || 'Unknown'}"`);
  }, [db, isAdmin, user, activeWorkspace?.id, projects, logAudit]);

  const deleteProject = useCallback(async (projectId: string) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isAdmin || !user) return;
    const project = projects.find((p) => p.id === projectId);
    setDeletionProgress({ type: 'project', label: project?.name || 'project', count: 0 });
    try {
      await deleteProjectCascade(db, wsId, projectId, (delta) => {
        setDeletionProgress(prev => (prev ? { ...prev, count: prev.count + delta } : prev));
      });
      logAudit('delete', 'project', projectId, `Deleted project "${project?.name || 'Unknown'}"`);
    } catch (e) {
      console.error("Failed to delete project:", e);
      throw e;
    } finally {
      setDeletionProgress(null);
    }
  }, [db, isAdmin, user, activeWorkspace?.id, projects, logAudit]);

  const checkIn = useCallback(async () => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId) return;
    
    // Guard: if user has an open (unchecked-out) entry from any day, block check-in
    if (openAttendanceEntry) {
      console.log("Open check-in exists — must check out first");
      throw new Error("You have an open check-in. Please check out first.");
    }

    // Guard: if already checked in today, don't overwrite
    if (todayAttendance?.checkInTime) {
      console.log("Already checked in today");
      return;
    }

    const dateKey = getTodayDateKey();
    const docId = `${user.uid}_${dateKey}`;
    const attendanceRef = doc(db, 'workspaces', wsId, 'attendance', docId);
    
    const attendanceData: AttendanceEntry = {
      id: docId,
      workspaceId: wsId,
      userId: user.uid,
      dateKey,
      checkInTime: new Date().toISOString(),
      checkOutTime: null,
      checkInServerTime: serverTimestamp(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDocumentNonBlocking(attendanceRef, attendanceData, { merge: true });
    } catch (e) {
      console.error("Failed to check in:", e);
      throw e;
    }
  }, [db, user, activeWorkspace?.id, todayAttendance, openAttendanceEntry, getTodayDateKey]);

  // Undo an accidental check-in. Only allowed within CHECK_IN_GRACE_PERIOD_MS
  // of the check-in itself and only while it's still open (not checked out) —
  // this is a misclick-correction window, not a way to dodge the 8-hour
  // minimum after actually starting work. Enforced both here and, more
  // importantly, server-side in firestore.rules.
  const cancelCheckIn = useCallback(async () => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId) return;

    const entry = openAttendanceEntry;
    if (!entry?.checkInTime || entry.checkOutTime) {
      console.log("No open check-in to cancel");
      return;
    }

    const checkInTime = new Date(entry.checkInTime);
    const msSinceCheckIn = new Date().getTime() - checkInTime.getTime();
    if (msSinceCheckIn > CHECK_IN_GRACE_PERIOD_MS) {
      throw new Error("The grace period to undo this check-in has passed.");
    }

    const attendanceRef = doc(db, 'workspaces', entry.workspaceId, 'attendance', entry.id);

    try {
      await deleteDocumentNonBlocking(attendanceRef);
    } catch (e) {
      console.error("Failed to cancel check-in:", e);
      throw e;
    }
  }, [db, user, activeWorkspace?.id, openAttendanceEntry]);

  const checkOut = useCallback(async () => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId) return;
    
    // Use the open entry (which could be from any day, not just today)
    const entryToClose = openAttendanceEntry;

    if (!entryToClose?.checkInTime) {
      console.log("Not checked in yet");
      return;
    }
    if (entryToClose.checkOutTime) {
      console.log("Already checked out");
      return;
    }

    // Guard: must wait at least the workspace's configured minimum hours
    // (default 8) after check-in before checking out.
    const minHours = activeWorkspace?.minCheckoutHours ?? 8;
    const checkInTime = new Date(entryToClose.checkInTime);
    const now = new Date();
    const hoursSinceCheckIn = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCheckIn < minHours) {
      const hoursRemaining = Math.ceil(minHours - hoursSinceCheckIn);
      console.log(`Must wait ${hoursRemaining} more hours before checking out`);
      throw new Error(`Must wait at least ${minHours} hours after check-in. ${hoursRemaining} hours remaining.`);
    }

    const attendanceRef = doc(db, 'workspaces', entryToClose.workspaceId, 'attendance', entryToClose.id);
    
    try {
      const updateData: Partial<AttendanceEntry> = {
        checkOutTime: new Date().toISOString(),
        checkOutServerTime: serverTimestamp(),
        updatedAt: new Date().toISOString(),
      };
      await updateDocumentNonBlocking(attendanceRef, updateData);
    } catch (e) {
      console.error("Failed to check out:", e);
      throw e;
    }
  }, [db, user, activeWorkspace?.id, activeWorkspace?.minCheckoutHours, openAttendanceEntry]);

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
    };

    try {
      await setDocumentNonBlocking(statusRef, statusData, { merge: true });
      logAudit('create', 'custom_status', statusRef.id, `Created custom status: ${name}`);
      return statusRef.id;
    } catch (e) {
      console.error("Failed to create custom status:", e);
      throw e;
    }
  }, [db, user, activeWorkspace?.id, isOwner, allStatuses, workspaceCustomStatuses, logAudit]);

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
    };
    
    await setDocumentNonBlocking(workUpdateRef, workUpdateData, { merge: true });
    logAudit('create', 'work_update', workUpdateRef.id, `Added work update`);
  }, [db, user, activeWorkspace?.id, logAudit]);

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
    isWorkspacesLoading: isWorkspacesLoading || isPrefsLoading,
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
    setGlobalSearchQuery,
    switchWorkspace,
    selectProject,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    createProject: async (wsId: string, name: string, description: string) => {
      if (!db || !wsId) return null;
      const projRef = doc(collection(db, 'workspaces', wsId, 'projects'));
      const creatorId = user?.uid || null;
      const projData: Project = {
        id: projRef.id,
        workspaceId: wsId,
        name,
        description: description || '',
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        allowedUserIds: creatorId ? [creatorId] : [],
        createdByUserId: creatorId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDocumentNonBlocking(projRef, projData, { merge: true });
      return projRef.id;
    },
    updateProjectMembers: (projectId: string, allowedUserIds: string[]) => {
      const wsId = activeWorkspace?.id;
      if (!db || !wsId || !projectId || !isAdmin) return;
      const ref = doc(db, 'workspaces', wsId, 'projects', projectId);
      updateDocumentNonBlocking(ref, { allowedUserIds, updatedAt: new Date().toISOString() });
    },
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
    deleteTask: async (taskId: string) => {
      if (!db || !isAdmin) return;
      const t = allWorkspaceTasks.find(x => x.id === taskId);
      if (!t) return;
      const taskRef = doc(db, 'workspaces', t.workspaceId, 'projects', t.projectId, 'tasks', t.id);
      try {
        await deleteTaskCascade(db, taskRef);
        logAudit('delete', 'task', taskId, `Deleted task "${t.title}"`);
      } catch (e) {
        console.error("Failed to delete task:", e);
        throw e;
      }
    },
    addComment: async (taskId: string, body: string, mentionedUserIds: string[] = []) => {
      if (!db || !user || !taskId) return;
      const task = allWorkspaceTasks.find(t => t.id === taskId);
      if (!task) return;
      
      const commentRef = doc(collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'comments'));
      const commentData = {
        id: commentRef.id,
        taskId: task.id,
        authorUserId: user.uid,
        body,
        createdAt: new Date().toISOString()
      };
      
      await setDocumentNonBlocking(commentRef, commentData, { merge: true });
      logAudit('create', 'comment', commentRef.id, `Added comment to task "${task.title}"`);

      const actor = { id: user.uid, name: user.displayName || 'User' };
      const taskRef = { id: task.id, title: task.title, workspaceId: task.workspaceId, projectId: task.projectId };
      const commentPreview = body.substring(0, 100) + (body.length > 100 ? '...' : '');
      const mentionedSet = new Set(mentionedUserIds);
      const assigneeIds = task.assigneeUserIds || [];

      // One notification per recipient, never two for the same comment:
      // mentioned + assignee gets the combined message (mention framing
      // wins, since it's the more specific fact); mentioned-only or
      // assignee-only get their normal notification.
      const notifiedUserIds = new Set<string>();

      mentionedSet.forEach(recipientId => {
        if (recipientId === user.uid || notifiedUserIds.has(recipientId)) return;
        notifiedUserIds.add(recipientId);
        if (assigneeIds.includes(recipientId)) {
          notifyMentionedAssignee(db, recipientId, actor, taskRef, commentPreview);
        } else {
          notifyMentioned(db, recipientId, actor, taskRef, commentPreview);
        }
      });

      assigneeIds.forEach(assigneeId => {
        if (assigneeId === user.uid || notifiedUserIds.has(assigneeId)) return;
        notifiedUserIds.add(assigneeId);
        createNotification(db, {
          userId: assigneeId,
          actorId: user.uid,
          actorName: user.displayName || 'User',
          type: 'comment_added',
          title: 'New Comment',
          message: `${user.displayName} commented on "${task.title}"`,
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          taskId: task.id
        });
      });
    },
    updateComment: async (taskId: string, commentId: string, body: string) => {
      if (!db || !user || !taskId || !commentId) return;
      const task = allWorkspaceTasks.find(t => t.id === taskId);
      if (!task) return;
      
      const commentRef = doc(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'comments', commentId);
      await updateDocumentNonBlocking(commentRef, { body, isEdited: true, updatedAt: new Date().toISOString() });
      logAudit('update', 'comment', commentId, `Edited comment on task "${task.title}"`);
    },
    deleteComment: async (taskId: string, commentId: string) => {
      if (!db || !user || !taskId || !commentId) return;
      const task = allWorkspaceTasks.find(t => t.id === taskId);
      if (!task) return;
      
      const commentRef = doc(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'comments', commentId);
      await deleteDocumentNonBlocking(commentRef);
      logAudit('delete', 'comment', commentId, `Deleted comment from task "${task.title}"`);
    },
    addAttachment: async (taskId: string, url: string, displayName?: string) => {
      if (!db || !user || !taskId || !url) return;
      const task = allWorkspaceTasks.find(t => t.id === taskId);
      if (!task) return;
      
      const attachmentRef = doc(collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'attachments'));
      const attachmentData = {
        id: attachmentRef.id,
        taskId: task.id,
        url,
        displayName: displayName || null,
        addedBy: user.uid,
        addedAt: new Date().toISOString()
      };
      
      await setDocumentNonBlocking(attachmentRef, attachmentData, { merge: true });
      logAudit('create', 'attachment', attachmentRef.id, `Added attachment to task "${task.title}"`);
    },
    removeAttachment: async (taskId: string, attachmentId: string) => {
      if (!db || !user || !taskId || !attachmentId) return;
      const task = allWorkspaceTasks.find(t => t.id === taskId);
      if (!task) return;
      
      const attachmentRef = doc(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'attachments', attachmentId);
      await deleteDocumentNonBlocking(attachmentRef);
      logAudit('delete', 'attachment', attachmentId, `Deleted attachment from task "${task.title}"`);
    },
    removeMember: async (userId: string) => {
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
    },
    updateMemberRole: async (userId: string, newRole: 'member' | 'lead') => {
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
      logAudit('update', 'member', userId, `Changed role of "${member?.displayName || 'Unknown'}" to ${newRole}`);
    },
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
