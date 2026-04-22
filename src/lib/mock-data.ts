import { User, Workspace, WorkspaceMember, Project, Task, Status, Priority, Comment, Notification } from './types';

export const currentUser: User = {
  id: 'u1',
  name: 'Alex Rivera',
  email: 'alex@nexustrack.io',
  avatarUrl: 'https://picsum.photos/seed/u1/100/100',
};

export const mockUsers: User[] = [
  currentUser,
  { id: 'u2', name: 'Jordan Smith', email: 'jordan@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u2/100/100' },
  { id: 'u3', name: 'Sarah Chen', email: 'sarah@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u3/100/100' },
];

export const mockWorkspaces: Workspace[] = [
  {
    id: 'w1',
    name: 'Product Design',
    description: 'Workspace for the core product design team.',
    color: '#452ED2',
    ownerUserId: 'u1',
    memberRoles: { u1: 'owner', u2: 'member' },
    createdAt: '2025-01-01T10:00:00.000Z',
    updatedAt: '2025-01-01T10:00:00.000Z',
  },
  {
    id: 'w2',
    name: 'Marketing Ops',
    description: 'Marketing campaigns and social media management.',
    color: '#66A9F0',
    ownerUserId: 'u1',
    memberRoles: { u1: 'owner', u3: 'member' },
    createdAt: '2025-01-01T10:00:00.000Z',
    updatedAt: '2025-01-01T10:00:00.000Z',
  },
];

export const mockWorkspaceMembers: WorkspaceMember[] = [
  { id: 'wm1', workspaceId: 'w1', userId: 'u1', displayName: 'Alex Rivera', email: 'alex@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u1/100/100' },
  { id: 'wm2', workspaceId: 'w1', userId: 'u2', displayName: 'Jordan Smith', email: 'jordan@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u2/100/100' },
  { id: 'wm3', workspaceId: 'w2', userId: 'u1', displayName: 'Alex Rivera', email: 'alex@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u1/100/100' },
  { id: 'wm4', workspaceId: 'w2', userId: 'u3', displayName: 'Sarah Chen', email: 'sarah@nexustrack.io', avatarUrl: 'https://picsum.photos/seed/u3/100/100' },
];

export const mockProjects: Project[] = [
  {
    id: 'p1',
    workspaceId: 'w1',
    name: 'Mobile App Redesign',
    description: 'Revamping the core mobile experience.',
    color: '#452ED2',
    allowedUserIds: ['u1', 'u2'],
    createdByUserId: 'u1',
    createdAt: '2025-01-02T09:00:00.000Z',
    updatedAt: '2025-01-02T09:00:00.000Z',
  },
  {
    id: 'p2',
    workspaceId: 'w1',
    name: 'Design System',
    description: 'Unified components for all platforms.',
    color: '#FF7F50',
    allowedUserIds: ['u1'],
    createdByUserId: 'u1',
    createdAt: '2025-01-05T14:30:00.000Z',
    updatedAt: '2025-01-05T14:30:00.000Z',
  },
];

export const mockTasks: Task[] = [
  {
    id: 't1',
    workspaceId: 'w1',
    projectId: 'p1',
    title: 'Finalize navigation patterns',
    description: 'Decide between tab bar and drawer for secondary navigation.',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2025-12-15T17:00:00.000Z',
    assigneeUserIds: ['u2'],
    tags: ['UX', 'Phase 1'],
    createdAt: '2025-01-10T11:00:00.000Z',
    updatedAt: '2025-01-10T11:00:00.000Z',
  },
  {
    id: 't2',
    workspaceId: 'w1',
    projectId: 'p1',
    title: 'Research dark mode colors',
    description: 'Check accessibility contrast for the new palette.',
    status: 'todo',
    priority: 'medium',
    dueDate: '2025-12-20T17:00:00.000Z',
    assigneeUserIds: ['u1'],
    tags: ['UI', 'A11y'],
    createdAt: '2025-01-12T15:00:00.000Z',
    updatedAt: '2025-01-12T15:00:00.000Z',
  },
  {
    id: 't3',
    workspaceId: 'w1',
    projectId: 'p1',
    title: 'User testing setup',
    description: 'Recruit 5 participants for the first round of testing.',
    status: 'done',
    priority: 'low',
    dueDate: '2025-12-30T17:00:00.000Z',
    assigneeUserIds: ['u1'],
    tags: ['Research'],
    createdAt: '2025-01-15T09:00:00.000Z',
    updatedAt: '2025-01-15T09:00:00.000Z',
  },
];

export const mockComments: Comment[] = [
  {
    id: 'c1',
    taskId: 't1',
    authorUserId: 'u2',
    body: 'I think we should stick to the tab bar for better visibility.',
    createdAt: '2025-01-11T10:00:00.000Z',
  },
  {
    id: 'c2',
    taskId: 't1',
    authorUserId: 'u1',
    body: 'Agreed. Let\'s prototype that first.',
    createdAt: '2025-01-11T14:30:00.000Z',
  }
];

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    userId: 'u1',
    actorId: 'u2',
    actorName: 'Jordan Smith',
    type: 'comment_added',
    title: 'New Comment',
    message: 'Jordan Smith commented on \"Finalize navigation patterns\"',
    workspaceId: 'w1',
    projectId: 'p1',
    taskId: 't1',
    createdAt: '2025-01-11T10:00:00.000Z',
    read: false,
  },
  {
    id: 'n2',
    userId: 'u1',
    actorId: 'u3',
    actorName: 'Sarah Chen',
    type: 'task_status_changed',
    title: 'Task Updated',
    message: 'Sarah Chen updated a task status',
    workspaceId: 'w1',
    projectId: 'p1',
    taskId: 't3',
    createdAt: '2025-01-11T14:30:00.000Z',
    read: true,
  },
  {
    id: 'n3',
    userId: 'u2',
    actorId: 'u1',
    actorName: 'Alex Rivera',
    type: 'task_assigned',
    title: 'New Assignment',
    message: 'Alex Rivera assigned you to \"Finalize navigation patterns\"',
    workspaceId: 'w1',
    projectId: 'p1',
    taskId: 't1',
    createdAt: '2025-01-12T09:00:00.000Z',
    read: true,
  },
  {
    id: 'n4',
    userId: 'u3',
    actorId: 'u1',
    actorName: 'Alex Rivera',
    type: 'task_updated',
    title: 'Task Updated',
    message: 'Alex Rivera updated a task',
    workspaceId: 'w2',
    projectId: 'p2',
    taskId: 't2',
    createdAt: '2025-01-09T09:00:00.000Z',
    read: true,
  },
];
