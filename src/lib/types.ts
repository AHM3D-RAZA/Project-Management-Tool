
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'todo' | 'in_progress' | 'on_hold' | 'done';

export interface CustomStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
  createdBy: string;
}

export interface StatusConfig {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  updatedAt?: string;
  lastActiveWorkspaceId?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerUserId: string;
  memberRoles: Record<string, 'owner' | 'lead' | 'member'>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
}

/**
 * The shape of items in useNexusStore's `workspaceMembers` — a WorkspaceMember
 * profile merged with that user's role from Workspace.memberRoles. Not a
 * Firestore document itself; it's a derived view-model computed in the store.
 */
export interface WorkspaceMemberWithRole {
  id: string;
  userId: string;
  role: 'owner' | 'lead' | 'member';
  displayName: string | null;
  email: string | null;
  avatarUrl?: string | null;
}

/**
 * The shape of useNexusStore's `currentUser` — a small view of the signed-in
 * Firebase user, not a Firestore document. Distinct from WorkspaceMember /
 * WorkspaceMemberWithRole (different field names: `name` not `displayName`,
 * no `role`).
 */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * The shape of items in useNexusStore's `searchUsersByEmail` results —
 * matches directAddMember's targetUser param, since results are meant to be
 * passed straight into it.
 */
export interface SearchedUser {
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
  allowedUserIds?: string[];
  /** The user who created the project (used to mark them as project admin in UI). */
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: Priority;
  dueDate?: string | null;
  assigneeUserIds?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  title: string;
  description: string;
  status: string;
  priority: Priority;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface Comment {
  id: string;
  taskId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
}

export interface Attachment {
  id: string;
  taskId: string;
  url: string;
  displayName?: string | null;
  addedBy: string;
  addedAt: string;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: 'member' | 'lead';
  invitedBy: string;
  invitedByName: string;
  type: 'link' | 'direct' | 'email';
  status: 'active' | 'accepted' | 'expired' | 'cancelled';
  usageCount: number;
  maxUses: number | 'unlimited';
  targetProjectIds?: string[];
  createdAt: string;
  expiresAt: string | null;
  /** When set (email invites), only this address may accept the invitation. */
  invitedEmail?: string | null;
}

export type NotificationType = 
  | 'task_assigned' 
  | 'task_unassigned' 
  | 'task_updated' 
  | 'task_status_changed' 
  | 'comment_added'
  | 'subtask_assigned'
  | 'mentioned';

export interface Notification {
  id: string;
  userId: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
  createdAt: string;
}

export interface AttendanceEntry {
  id: string; // dateKey (document ID)
  workspaceId: string;
  userId: string;
  dateKey: string; // YYYY-MM-DD
  checkInTime: string; // ISO timestamp (client clock) — used for display
  checkOutTime: string | null; // ISO timestamp (client clock), null until checkout — used for display
  // Server-authoritative timestamps, set via Firestore's serverTimestamp().
  // Used only by firestore.rules for time-based checks (the check-in undo
  // window, the minimum-hours-before-checkout rule) — the UI never reads
  // these, so a skewed device clock can't be used to game either rule.
  // Optional: records written before this field existed won't have it.
  checkInServerTime?: unknown;
  checkOutServerTime?: unknown;
  autoCheckout?: boolean; // true when system auto-checked-out after 12h
  createdAt: string;
  updatedAt: string;
}

export interface WorkUpdate {
  id: string;
  userId: string;
  workspaceId: string;
  updateText: string;
  timestamp: string; // ISO timestamp
  createdAt: string;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  actorId: string;
  actorRole: 'owner' | 'lead';
  action: 'update' | 'delete' | 'create' | 'revoke' | 'remove';
  entityType: 'project' | 'task' | 'workspace' | 'member' | 'invitation' | 'subtask' | 'comment' | 'custom_status' | 'attachment' | 'work_update';
  entityId: string;
  summary: string;
  timestamp: string;
}
