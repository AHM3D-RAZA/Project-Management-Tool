"use client";

import { useCallback } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { createNotification, notifyMentioned, notifyMentionedAssignee } from '@/lib/notifications';
import { deleteStorageFileIfPresent } from '@/lib/file-upload';
import type { Workspace, Task, AuditLog } from '@/lib/types';
import { getMemberUserIds } from '@/lib/member-sync';

interface UseCommentsAttachmentsParams {
  db: Firestore | null;
  user: User | null;
  activeWorkspace: Workspace | null;
  allWorkspaceTasks: Task[];
  logAudit: (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, summary: string) => void;
  /** Used to also delete the underlying Storage file when an uploaded attachment is removed — see removeAttachment. */
  storage: FirebaseStorage | null;
}

/**
 * A task's comments and attachments — the supplementary content on a
 * task, as opposed to the task's own fields (which live in use-tasks.ts).
 */
export function useCommentsAttachments({ db, user, activeWorkspace, allWorkspaceTasks, logAudit, storage }: UseCommentsAttachmentsParams) {
  const addComment = useCallback(async (taskId: string, body: string, mentionedUserIds: string[] = []) => {
    if (!db || !user || !taskId) return;
    const task = allWorkspaceTasks.find(t => t.id === taskId);
    if (!task) return;

    const commentRef = doc(collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'comments'));
    const commentData = {
      id: commentRef.id,
      workspaceId: task.workspaceId,
      taskId: task.id,
      authorUserId: user.uid,
      body,
      createdAt: new Date().toISOString(),
      memberUserIds: task.memberUserIds || getMemberUserIds(activeWorkspace),
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
  }, [db, user, activeWorkspace, allWorkspaceTasks, logAudit]);

  const updateComment = useCallback(async (taskId: string, commentId: string, body: string) => {
    if (!db || !user || !taskId || !commentId) return;
    const task = allWorkspaceTasks.find(t => t.id === taskId);
    if (!task) return;

    const commentRef = doc(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'comments', commentId);
    await updateDocumentNonBlocking(commentRef, { body, isEdited: true, updatedAt: new Date().toISOString() });
    logAudit('update', 'comment', commentId, `Edited comment on task "${task.title}"`);
  }, [db, user, allWorkspaceTasks, logAudit]);

  const deleteComment = useCallback(async (taskId: string, commentId: string) => {
    if (!db || !user || !taskId || !commentId) return;
    const task = allWorkspaceTasks.find(t => t.id === taskId);
    if (!task) return;

    const commentRef = doc(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'comments', commentId);
    await deleteDocumentNonBlocking(commentRef);
    logAudit('delete', 'comment', commentId, `Deleted comment from task "${task.title}"`);
  }, [db, user, allWorkspaceTasks, logAudit]);

  const addAttachment = useCallback(async (taskId: string, url: string, displayName?: string) => {
    if (!db || !user || !taskId || !url) return;
    const task = allWorkspaceTasks.find(t => t.id === taskId);
    if (!task) return;

    const attachmentRef = doc(collection(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'attachments'));
    const attachmentData = {
      id: attachmentRef.id,
      workspaceId: task.workspaceId,
      taskId: task.id,
      url,
      displayName: displayName || null,
      addedBy: user.uid,
      addedAt: new Date().toISOString(),
      memberUserIds: task.memberUserIds || getMemberUserIds(activeWorkspace),
    };

    await setDocumentNonBlocking(attachmentRef, attachmentData, { merge: true });
    logAudit('create', 'attachment', attachmentRef.id, `Added attachment to task "${task.title}"`);
  }, [db, user, activeWorkspace, allWorkspaceTasks, logAudit]);

  const removeAttachment = useCallback(async (taskId: string, attachmentId: string, url?: string) => {
    if (!db || !user || !taskId || !attachmentId) return;
    const task = allWorkspaceTasks.find(t => t.id === taskId);
    if (!task) return;

    const attachmentRef = doc(db, 'workspaces', task.workspaceId, 'projects', task.projectId, 'tasks', task.id, 'attachments', attachmentId);
    await deleteDocumentNonBlocking(attachmentRef);
    logAudit('delete', 'attachment', attachmentId, `Deleted attachment from task "${task.title}"`);

    // Best-effort — if this was an uploaded file (not a pasted link or a
    // Drive pick), also remove it from Storage so it doesn't linger as
    // an orphaned, unbilled-for-nothing object. See deleteStorageFileIfPresent.
    if (storage && url) {
      await deleteStorageFileIfPresent(storage, url);
    }
  }, [db, user, allWorkspaceTasks, logAudit, storage]);

  return {
    addComment,
    updateComment,
    deleteComment,
    addAttachment,
    removeAttachment,
  };
}
