"use client";

import { useCallback, useMemo } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { collection, doc, query, where } from 'firebase/firestore';
import { useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { sendWorkspaceInviteEmail } from '@/app/actions/send-workspace-invite-email';
import type { Workspace, Invitation, AuditLog } from '@/lib/types';
import { getMemberUserIds } from '@/lib/member-sync';

interface UseInvitationsParams {
  db: Firestore | null;
  user: User | null;
  activeWorkspace: Workspace | null;
  isAdmin: boolean;
  logAudit: (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, summary: string) => void;
}

/**
 * Invitations: pending invites to join the workspace (people who aren't
 * members yet). See use-members.ts for people already in the workspace.
 */
export function useInvitations({ db, user, activeWorkspace, isAdmin, logAudit }: UseInvitationsParams) {
  const invitesQuery = useMemoFirebase(() => {
    if (!db || !activeWorkspace) return null;
    return query(
      collection(db, 'invitations'),
      where('workspaceId', '==', activeWorkspace.id)
    );
  }, [db, activeWorkspace]);

  const { data: invitesData } = useCollection<Invitation>(invitesQuery);
  const workspaceInvitations = useMemo(() => (invitesData || []).filter((i) => i.status === 'active'), [invitesData]);

  const cancelInvitation = useCallback(async (inviteId: string) => {
    if (!db || !isAdmin) return;
    const ref = doc(db, 'invitations', inviteId);
    await deleteDocumentNonBlocking(ref);
    logAudit('revoke', 'invitation', inviteId, 'Revoked invitation');
  }, [db, isAdmin, logAudit]);

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
        memberUserIds: getMemberUserIds(ws),
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

  return {
    workspaceInvitations,
    cancelInvitation,
    sendEmailInvite,
  };
}
