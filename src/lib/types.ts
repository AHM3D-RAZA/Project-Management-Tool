
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'todo' | 'in_progress' | 'on_hold' | 'done';

export interface CustomFieldDefinition {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
}

export interface CustomStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
  createdBy: string;
  /** Snapshot of the parent workspace's member uids at write time, kept in sync
   * on membership changes. Lets Firestore list rules check membership directly
   * off this document (resource.data) instead of via get() on the parent
   * workspace — Firestore cannot authorize an unbounded list query using a
   * get()-based rule, regardless of what's actually in the collection. */
  memberUserIds: string[];
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

/** A guest can see everything a member can, but cannot create, edit, or delete anything. */
export type WorkspaceRole = 'owner' | 'lead' | 'member' | 'guest';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  color: string;
  ownerUserId: string;
  memberRoles: Record<string, WorkspaceRole>;
  createdAt: string;
  updatedAt: string;
  /** Whether Attendance/Work Updates tracking is enabled for this workspace. Defaults to true when unset, so existing workspaces are unaffected. */
  attendanceEnabled?: boolean;
  /** Minimum hours that must pass after check-in before a member can check out. Defaults to 8 when unset. */
  minCheckoutHours?: number;
  /** Set to true by a self-service invite acceptance (link/email) — that
   * user can't yet list/backfill pre-existing workspace documents with
   * their own membership, since they're not in those documents'
   * memberUserIds yet. The next admin client to load this workspace runs
   * the full member sync and clears this flag. See lib/member-sync.ts and
   * /TODO.md ("Instant member backfill on self-service join") for the
   * planned proper fix (Cloud Function, requires the Blaze plan). */
  pendingMemberSync?: boolean;
  /** Outgoing Slack/Discord webhook URLs for task-event notifications (see webhook-dispatch.ts). Unset/empty means no webhook is configured for that provider. */
  notificationWebhooks?: WorkspaceWebhookConfig;
}

export interface WorkspaceWebhookConfig {
  slackUrl?: string | null;
  discordUrl?: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
}

/**
 * The shape of items in useNexusStore's `workspaceMembers` — a WorkspaceMember
 * profile merged with that user's role from Workspace.memberRoles. Not a
 * Firestore document itself; it's a derived view-model computed in the store.
 */
export interface WorkspaceMemberWithRole {
  id: string;
  userId: string;
  role: WorkspaceRole;
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
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Repeat every N days/weeks/months, e.g. frequency 'weekly' + interval 2 = every 2 weeks. */
  interval: number;
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
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
  /** Values for workspace-defined custom fields (see CustomFieldDefinition), keyed by field id. Text only for now. */
  customFields?: Record<string, string>;
  /** When set, completing this task spins up its next occurrence (see useTasks). Carried forward onto that next task so the series continues. */
  recurrence?: RecurrenceRule | null;
  /**
   * IDs of tasks that must reach a completed status before this task can
   * be marked done (see task-dependencies.ts and useTasks.updateTask).
   * Only this direction is stored — which tasks THIS task blocks is
   * derived by scanning other tasks for this task's id, so the two sides
   * can never drift out of sync.
   */
  blockedByTaskIds?: string[];
  /** userId -> ISO timestamp of when they started their current timer on this task. Absent/no entry for a user means no timer running. See time-tracking.ts. */
  activeTimers?: Record<string, string>;
  /** Cumulative tracked seconds from every completed (stopped) timer session on this task — the source for project-level time rollups. See time-tracking.ts. */
  totalTrackedSeconds?: number;
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
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
}


export interface Comment {
  id: string;
  workspaceId: string;
  taskId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
}

export interface Attachment {
  id: string;
  workspaceId: string;
  taskId: string;
  url: string;
  displayName?: string | null;
  addedBy: string;
  addedAt: string;
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
}

/**
 * One entry in a task's activity history (subcollection under the task —
 * see src/hooks/store/use-tasks.ts, which writes one of these whenever
 * the task is created or a tracked field changes). Distinct from Comment:
 * this is system-generated, not user-written, and immutable once created.
 */
export interface TaskActivityEntry {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  actorId: string;
  actorName: string;
  /** Human-readable description of what happened, e.g. "Status changed to Done". */
  summary: string;
  createdAt: string;
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
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
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
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
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
}

export interface WorkUpdate {
  id: string;
  userId: string;
  workspaceId: string;
  updateText: string;
  timestamp: string; // ISO timestamp
  createdAt: string;
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  actorId: string;
  actorRole: 'owner' | 'lead';
  action: 'update' | 'delete' | 'create' | 'revoke' | 'remove';
  entityType: 'project' | 'task' | 'workspace' | 'member' | 'invitation' | 'subtask' | 'comment' | 'custom_status' | 'custom_field' | 'attachment' | 'work_update';
  entityId: string;
  summary: string;
  timestamp: string;
  /** See CustomStatus.memberUserIds for why this exists. */
  memberUserIds: string[];
  /** Owner + leads only. Audit logs are admin-only (unlike attendance/work
   * updates, which intentionally expose some entries to any member), so
   * their list rule needs admin status specifically, not just membership. */
  adminUserIds: string[];
}
