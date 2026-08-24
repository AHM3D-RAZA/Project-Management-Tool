/**
 * Cascade-delete helpers for workspaces and projects.
 *
 * Design notes (see conversation for the full reasoning):
 *  - Every write is batched (writeBatch, capped well under Firestore's
 *    500-ops/batch limit) instead of firing hundreds/thousands of
 *    independent deletes at once.
 *  - Every collection walk is paginated (limit() + re-query), so a huge
 *    workspace never loads an unbounded number of docs into memory at once.
 *  - Parent docs (task -> project -> workspace) are always deleted LAST,
 *    only after all of their children are confirmed gone. Two reasons:
 *      1. If the browser tab closes or the network drops partway through,
 *         what's left behind is a still-visible, still-normal-looking
 *         project/workspace with fewer children — not a silently vanished
 *         parent with orphaned, invisible children.
 *      2. This app's Firestore security rules authorize deletes on a
 *         workspace's children by looking up the *workspace document*
 *         (ownerUserId / memberRoles). If the workspace doc were deleted
 *         first, every subsequent child delete would start failing
 *         permission checks mid-run.
 *  - Every step re-queries "whatever's left" rather than working off a
 *    single upfront snapshot, which makes the whole thing naturally
 *    resumable: if a run is interrupted, simply calling it again picks up
 *    exactly where it left off. There's no separate resume/retry codepath
 *    to maintain.
 *  - This is still client-driven (runs in the admin's browser), so it
 *    cannot *guarantee* completion the way a server-side job could — only
 *    a Cloud Function surviving a closed tab can promise that. What this
 *    gets you instead: bounded batches, visible progress, and safe,
 *    idempotent resumption if something interrupts it.
 */

import {
  type Firestore,
  type Query,
  type DocumentReference,
  collection,
  query,
  where,
  limit,
  getDocs,
  writeBatch,
  deleteDoc,
  doc,
} from 'firebase/firestore';

// Stay comfortably under Firestore's 500-operation-per-batch ceiling.
const DELETE_BATCH_SIZE = 400;
// Page size for walking parent collections (projects, tasks) where each
// item itself triggers further nested deletes.
const PARENT_PAGE_SIZE = 50;

/** Called with the number of documents deleted in the most recent step. */
export type ProgressCallback = (deletedDelta: number) => void;

/**
 * Deletes every document matched by `q`, a page (and one batch commit) at a
 * time. Safe to re-run: it always queries for whatever matches `q` right
 * now, so previously-deleted documents simply won't reappear.
 */
async function deleteQueryBatched(
  db: Firestore,
  q: Query,
  onProgress?: ProgressCallback
): Promise<number> {
  let totalDeleted = 0;
  // Loop until a page comes back with nothing left to delete.
  while (true) {
    const pageQuery = query(q, limit(DELETE_BATCH_SIZE));
    const snap = await getDocs(pageQuery);
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    totalDeleted += snap.docs.length;
    onProgress?.(snap.docs.length);

    if (snap.docs.length < DELETE_BATCH_SIZE) break;
  }
  return totalDeleted;
}

/**
 * Deletes a task's subtasks, comments, and attachments, then the task
 * document itself (last, once its children are confirmed gone).
 */
export async function deleteTaskCascade(
  db: Firestore,
  taskRef: DocumentReference,
  onProgress?: ProgressCallback
): Promise<void> {
  await deleteQueryBatched(db, collection(taskRef, 'subtasks'), onProgress);
  await deleteQueryBatched(db, collection(taskRef, 'comments'), onProgress);
  await deleteQueryBatched(db, collection(taskRef, 'attachments'), onProgress);
  await deleteDoc(taskRef);
  onProgress?.(1);
}

/**
 * Deletes every task in a project (each with its full subtask/comment/
 * attachment cascade), then the project document itself.
 */
export async function deleteProjectCascade(
  db: Firestore,
  workspaceId: string,
  projectId: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const tasksCol = collection(db, 'workspaces', workspaceId, 'projects', projectId, 'tasks');

  while (true) {
    const snap = await getDocs(query(tasksCol, limit(PARENT_PAGE_SIZE)));
    if (snap.empty) break;

    for (const taskDoc of snap.docs) {
      await deleteTaskCascade(db, taskDoc.ref, onProgress);
    }

    if (snap.docs.length < PARENT_PAGE_SIZE) break;
  }

  await deleteDoc(doc(db, 'workspaces', workspaceId, 'projects', projectId));
  onProgress?.(1);
}

/**
 * Deletes an entire workspace: every project (full cascade), then the
 * workspace-level collections (members, invitations, audit logs, custom
 * statuses, attendance, work updates), then the workspace document itself
 * — last, once everything else is confirmed gone.
 *
 * `invitations` lives at the top level of the database (filtered by a
 * `workspaceId` field) rather than nested under the workspace, so it's
 * queried differently from the rest.
 */
export async function deleteWorkspaceCascade(
  db: Firestore,
  workspaceId: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const projectsCol = collection(db, 'workspaces', workspaceId, 'projects');

  while (true) {
    const snap = await getDocs(query(projectsCol, limit(PARENT_PAGE_SIZE)));
    if (snap.empty) break;

    for (const projDoc of snap.docs) {
      await deleteProjectCascade(db, workspaceId, projDoc.id, onProgress);
    }

    if (snap.docs.length < PARENT_PAGE_SIZE) break;
  }

  // Workspace-nested flat collections.
  const nestedCollections = [
    'members',
    'audit_logs',
    'custom_statuses',
    'attendance',
    'work_updates',
  ];
  for (const name of nestedCollections) {
    await deleteQueryBatched(db, collection(db, 'workspaces', workspaceId, name), onProgress);
  }

  // Top-level `invitations` collection, filtered by workspaceId.
  await deleteQueryBatched(
    db,
    query(collection(db, 'invitations'), where('workspaceId', '==', workspaceId)),
    onProgress
  );

  // The workspace document itself, last.
  await deleteDoc(doc(db, 'workspaces', workspaceId));
  onProgress?.(1);
}
