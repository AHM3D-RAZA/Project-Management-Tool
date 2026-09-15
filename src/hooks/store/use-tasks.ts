"use client";

import { useCallback } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { deleteTaskCascade } from '@/lib/cascade-delete';
import { notifyTaskAssigned, notifyTaskUpdated, notifySubtaskAssigned } from '@/lib/notifications';
import { computeNextDueDate } from '@/lib/recurrence';
import { describeTaskChanges } from '@/lib/task-activity';
import { getIncompleteBlockers, wouldCreateCycle } from '@/lib/task-dependencies';
import type { Workspace, Task, Subtask, AuditLog, StatusConfig, TaskActivityEntry } from '@/lib/types';
import { getMemberUserIds } from '@/lib/member-sync';

interface UseTasksParams {
  db: Firestore | null;
  user: User | null;
  activeWorkspace: Workspace | null;
  isAdmin: boolean;
  allWorkspaceTasks: Task[];
  allWorkspaceSubtasks: Subtask[];
  hasWorkspaceAdminAccess: (wsId: string) => Promise<boolean>;
  getMemberUserIdsForWorkspace: (wsId: string) => Promise<string[]>;
  logAudit: (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, summary: string) => void;
  /** Whether a status id counts as "completed" (currently just the built-in 'done' status). Used to detect the moment a recurring task should spin up its next occurrence. */
  isCompletedStatus: (statusId: string) => boolean;
  /** Resolves a status id to its display info (name/color). Used to write human-readable status names into task activity history. */
  getStatusInfo: (statusId: string) => StatusConfig;
}

/**
 * Tasks and subtasks: create/update/delete for both, plus the
 * assignment/update notifications that go along with them.
 */
export function useTasks({
  db, user, activeWorkspace, isAdmin, allWorkspaceTasks, allWorkspaceSubtasks,
  hasWorkspaceAdminAccess, getMemberUserIdsForWorkspace, logAudit, isCompletedStatus, getStatusInfo,
}: UseTasksParams) {
  /**
   * Writes one entry to a task's activity subcollection. `memberUserIds`
   * is passed in rather than looked up here, since every call site
   * (createTask, updateTask) already has an accurate list on hand for the
   * specific task/workspace involved.
   */
  const logTaskActivity = useCallback((
    wsId: string, projectId: string, taskId: string, summary: string, memberUserIds: string[]
  ) => {
    if (!db || !user) return;
    const activityRef = doc(collection(db, 'workspaces', wsId, 'projects', projectId, 'tasks', taskId, 'activity'));
    const entry: TaskActivityEntry = {
      id: activityRef.id,
      workspaceId: wsId,
      projectId,
      taskId,
      actorId: user.uid,
      actorName: user.displayName || 'User',
      summary,
      createdAt: new Date().toISOString(),
      memberUserIds,
    };
    try {
      setDocumentNonBlocking(activityRef, entry, { merge: true });
    } catch (e) {
      console.error('Failed to log task activity', e);
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
      memberUserIds: await getMemberUserIdsForWorkspace(wsId),
    };
    try {
      await setDocumentNonBlocking(taskRef, taskData, { merge: true });
      logTaskActivity(wsId, projectId, taskRef.id, 'Created this task', taskData.memberUserIds);

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
  }, [db, user, hasWorkspaceAdminAccess, getMemberUserIdsForWorkspace, logTaskActivity]);

  /**
   * When a recurring task (one with a `recurrence` rule and a due date)
   * transitions into a completed status, create its next occurrence:
   * same details, due date advanced by the rule, status reset to 'todo',
   * and the same recurrence rule carried forward so the series continues.
   */
  const spinOffNextRecurrence = useCallback((t: Task) => {
    if (!t.recurrence || !t.dueDate) return;
    createTask(t.workspaceId, t.projectId, {
      title: t.title,
      description: t.description,
      priority: t.priority,
      assigneeUserIds: t.assigneeUserIds,
      tags: t.tags,
      customFields: t.customFields,
      recurrence: t.recurrence,
      dueDate: computeNextDueDate(t.dueDate, t.recurrence),
      status: 'todo',
    });
  }, [createTask]);

  /**
   * Applies an update to a task, subject to two dependency guards:
   *  - Setting blockedByTaskIds is rejected outright if it would create a
   *    circular dependency.
   *  - Marking a task done is rejected if any of its blockers haven't
   *    reached a completed status yet.
   * Returns false (and writes nothing) when a guard rejects the update,
   * true otherwise — callers that care (e.g. a "mark done" checkbox) can
   * check this to show an explanation; callers that don't can ignore it,
   * same as before this returned anything.
   */
  const updateTask = useCallback((taskId: string, data: Partial<Task>): boolean => {
    if (!db || !isAdmin || !user) return false;
    const t = allWorkspaceTasks.find(x => x.id === taskId);
    if (!t) return false;

    if (data.blockedByTaskIds !== undefined
      && wouldCreateCycle(allWorkspaceTasks, t.id, data.blockedByTaskIds)) {
      console.error('Rejected task update: would create a circular dependency.');
      return false;
    }

    if (data.status && isCompletedStatus(data.status) && !isCompletedStatus(t.status)) {
      const effectiveBlockedBy = data.blockedByTaskIds !== undefined ? data.blockedByTaskIds : t.blockedByTaskIds;
      const incompleteBlockers = getIncompleteBlockers(
        allWorkspaceTasks, { ...t, blockedByTaskIds: effectiveBlockedBy }, isCompletedStatus
      );
      if (incompleteBlockers.length > 0) {
        console.error(
          `Rejected task update: still blocked by ${incompleteBlockers.map((b) => b.title).join(', ')}.`
        );
        return false;
      }
    }

    const ref = doc(db, 'workspaces', t.workspaceId, 'projects', t.projectId, 'tasks', t.id);
    updateDocumentNonBlocking(ref, { ...data, updatedAt: new Date().toISOString() });
    logAudit('update', 'task', t.id, `Updated task: ${data.title || t.title}`);

    // Only spin off a next occurrence the moment the task *becomes*
    // completed (not on every subsequent edit while already done).
    if (data.status && !isCompletedStatus(t.status) && isCompletedStatus(data.status)) {
      spinOffNextRecurrence(t);
    }

    // Record one activity history entry per field that actually changed.
    describeTaskChanges(t, data, getStatusInfo).forEach((summary) => {
      logTaskActivity(t.workspaceId, t.projectId, t.id, summary, t.memberUserIds);
    });

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

    return true;
  }, [db, allWorkspaceTasks, isAdmin, user, logAudit, isCompletedStatus, spinOffNextRecurrence, getStatusInfo, logTaskActivity]);

  const deleteTask = useCallback(async (taskId: string) => {
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
  }, [db, isAdmin, allWorkspaceTasks, logAudit]);

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
      memberUserIds: getMemberUserIds(activeWorkspace),
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
  }, [db, user, isAdmin, activeWorkspace, allWorkspaceTasks]);

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

  return {
    createTask,
    updateTask,
    deleteTask,
    createSubtask,
    updateSubtask,
    deleteSubtask,
  };
}
