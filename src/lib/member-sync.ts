import {
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  writeBatch,
  type Firestore,
  type DocumentReference,
  type DocumentData,
} from 'firebase/firestore';
import type { Workspace } from '@/lib/types';

// ⚠️ See /TODO.md ("Instant member backfill on self-service join") — this
// file's known limitation and its proper fix (a Cloud Function, requires
// upgrading the Firebase project to the Blaze plan) are tracked there.


/**
 * Snapshot of a workspace's member uids (the owner is always also present
 * as a memberRoles key, so this covers everyone). Written onto every
 * workspace-scoped document at creation time, and kept in sync via
 * syncMemberUserIds() whenever membership changes. This lets Firestore
 * security rules check membership directly off each document
 * (resource.data) — required for `list` (collection query) requests,
 * since Firestore cannot authorize an unbounded list query using a rule
 * that calls get() on another document, regardless of what's actually in
 * the collection.
 */
export function getMemberUserIds(ws: Pick<Workspace, 'memberRoles'> | null | undefined): string[] {
  return ws?.memberRoles ? Object.keys(ws.memberRoles) : [];
}

/**
 * Owner + leads only. A few collections (currently just audit_logs) are
 * admin-only with no member-visible carve-out, so their list rule needs
 * admin status specifically rather than plain membership.
 */
export function getAdminUserIds(ws: Pick<Workspace, 'memberRoles'> | null | undefined): string[] {
  if (!ws?.memberRoles) return [];
  return Object.entries(ws.memberRoles)
    .filter(([, role]) => role === 'owner' || role === 'lead')
    .map(([uid]) => uid);
}

/**
 * Propagates a workspace's current member/admin uid lists onto every
 * EXISTING document across the workspace, whenever membership changes
 * (someone joins, leaves, or a role changes between member/lead). New
 * documents get both fields written at creation time; this is what keeps
 * documents created *before* a membership change correct afterward.
 *
 * Known limitation: this must be run by someone who can already `list`
 * every affected collection — i.e. an existing member. When a brand-new
 * member joins via a self-service invite link/email, they are not yet in
 * any existing document's memberUserIds, so their own client cannot list
 * (and therefore cannot backfill) pre-existing documents. In that case
 * this best-effort call may only manage to sync collections that were
 * empty or already visible; the new member will still correctly see
 * anything created after they joined, and a full resync happens
 * automatically the next time an admin's client adds, removes, or changes
 * the role of any member. Errors are swallowed here for exactly that
 * reason — a partial or failed sync should never block the join/add/
 * remove/role-change action itself.
 */
export async function syncMemberUserIds(
  db: Firestore,
  wsId: string,
  memberRoles: Workspace['memberRoles']
): Promise<void> {
  const newMemberUserIds = getMemberUserIds({ memberRoles });
  const newAdminUserIds = getAdminUserIds({ memberRoles });
  try {
    const refs: { ref: DocumentReference<unknown, DocumentData> }[] = [];
    const collectFromQuery = async (q: ReturnType<typeof query>) => {
      const snap = await getDocs(q);
      snap.forEach((d) => refs.push({ ref: d.ref }));
    };

    await Promise.all([
      collectFromQuery(query(collection(db, 'workspaces', wsId, 'projects'))),
      collectFromQuery(query(collectionGroup(db, 'tasks'), where('workspaceId', '==', wsId))),
      collectFromQuery(query(collectionGroup(db, 'subtasks'), where('workspaceId', '==', wsId))),
      collectFromQuery(query(collectionGroup(db, 'comments'), where('workspaceId', '==', wsId))),
      collectFromQuery(query(collectionGroup(db, 'attachments'), where('workspaceId', '==', wsId))),
      collectFromQuery(query(collection(db, 'workspaces', wsId, 'attendance'))),
      collectFromQuery(query(collection(db, 'workspaces', wsId, 'work_updates'))),
      collectFromQuery(query(collection(db, 'workspaces', wsId, 'custom_statuses'))),
      collectFromQuery(query(collection(db, 'workspaces', wsId, 'audit_logs'))),
      collectFromQuery(query(collection(db, 'workspaces', wsId, 'members'))),
      collectFromQuery(query(collection(db, 'invitations'), where('workspaceId', '==', wsId))),
    ]);

    const CHUNK_SIZE = 450; // stay comfortably under Firestore's 500-write batch limit
    for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      for (const { ref } of refs.slice(i, i + CHUNK_SIZE)) {
        batch.update(ref, { memberUserIds: newMemberUserIds, adminUserIds: newAdminUserIds });
      }
      await batch.commit();
    }
  } catch (e) {
    console.error('Failed to sync memberUserIds across workspace documents:', e);
  }
}
