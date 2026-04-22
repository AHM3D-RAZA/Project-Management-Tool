
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
  checkInTime: string; // ISO timestamp
  checkOutTime: string | null; // ISO timestamp, null until checkout
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
  entityType: 'project' | 'task' | 'workspace' | 'member' | 'invitation' | 'subtask' | 'comment' | 'custom_status' | 'attachment';
  entityId: string;
  summary: string;
  timestamp: string;
}
