
import { Firestore, collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase';
import { Notification } from './types';

export async function createNotification(
  db: Firestore,
  data: Omit<Notification, 'id' | 'createdAt' | 'read'>
) {
  // Never notify the user about their own actions
  if (data.userId === data.actorId) return;

  const notifRef = doc(collection(db, 'notifications'));
  const notification: Notification = {
    ...data,
    id: notifRef.id,
    read: false,
    createdAt: new Date().toISOString(),
  };

  return setDocumentNonBlocking(notifRef, notification, { merge: true });
}

export async function notifyTaskAssigned(
  db: Firestore,
  recipientId: string,
  actor: { id: string; name: string },
  task: { id: string; title: string; workspaceId: string; projectId: string }
) {
  return createNotification(db, {
    userId: recipientId,
    actorId: actor.id,
    actorName: actor.name,
    type: 'task_assigned',
    title: 'New Assignment',
    message: `${actor.name} assigned you to "${task.title}"`,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
  });
}

export async function notifyTaskUpdated(
  db: Firestore,
  recipientId: string,
  actor: { id: string; name: string },
  task: { id: string; title: string; workspaceId: string; projectId: string },
  changes: string[]
) {
  if (changes.length === 0) return;
  
  const changesText = changes.length > 1 
    ? `${changes.length} properties were updated`
    : `The ${changes[0]} was updated`;

  return createNotification(db, {
    userId: recipientId,
    actorId: actor.id,
    actorName: actor.name,
    type: 'task_updated',
    title: 'Task Modified',
    message: `${actor.name} edited "${task.title}": ${changesText}`,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
  });
}

export async function notifySubtaskAssigned(
  db: Firestore,
  recipientId: string,
  actor: { id: string; name: string },
  task: { id: string; title: string; workspaceId: string; projectId: string },
  subtaskTitle: string
) {
  return createNotification(db, {
    userId: recipientId,
    actorId: actor.id,
    actorName: actor.name,
    type: 'subtask_assigned',
    title: 'New Subtask Assignment',
    message: `${actor.name} assigned you a subtask "${subtaskTitle}" in "${task.title}"`,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
  });
}

export async function notifyMentioned(
  db: Firestore,
  recipientId: string,
  actor: { id: string; name: string },
  task: { id: string; title: string; workspaceId: string; projectId: string },
  commentPreview: string
) {
  return createNotification(db, {
    userId: recipientId,
    actorId: actor.id,
    actorName: actor.name,
    type: 'mentioned',
    title: 'You were mentioned',
    message: `${actor.name} mentioned you in a comment on "${task.title}": ${commentPreview}`,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
  });
}

/**
 * For a recipient who is BOTH an assignee on the task AND @mentioned in the
 * new comment — one notification instead of two separate ones (a plain
 * "comment added" notification would be redundant noise on top of this).
 */
export async function notifyMentionedAssignee(
  db: Firestore,
  recipientId: string,
  actor: { id: string; name: string },
  task: { id: string; title: string; workspaceId: string; projectId: string },
  commentPreview: string
) {
  return createNotification(db, {
    userId: recipientId,
    actorId: actor.id,
    actorName: actor.name,
    type: 'mentioned',
    title: 'You were mentioned',
    message: `${actor.name} mentioned you in a comment on "${task.title}" (a task you're assigned to): ${commentPreview}`,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    taskId: task.id,
  });
}
