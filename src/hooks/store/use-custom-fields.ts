"use client";

import { useCallback, useMemo } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { collection, doc, orderBy, query } from 'firebase/firestore';
import { useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import type { Workspace, CustomFieldDefinition, AuditLog } from '@/lib/types';
import { getMemberUserIds } from '@/lib/member-sync';

interface UseCustomFieldsParams {
  db: Firestore | null;
  user: User | null;
  activeWorkspace: Workspace | null;
  isAuthReady: boolean;
  isOwner: boolean;
  logAudit: (action: AuditLog['action'], entityType: AuditLog['entityType'], entityId: string, summary: string) => void;
}

/**
 * Custom field definitions: extra text fields an owner can define for a
 * workspace (e.g. "Client Name", "Budget Code"), available on every task.
 */
export function useCustomFields({ db, user, activeWorkspace, isAuthReady, isOwner, logAudit }: UseCustomFieldsParams) {
  const customFieldDefinitionsQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || wsId === '' || !isAuthReady) return null;
    return query(
      collection(db, 'workspaces', wsId, 'custom_field_definitions'),
      orderBy('createdAt', 'asc')
    );
  }, [db, activeWorkspace?.id, isAuthReady]);

  const { data: customFieldDefinitionsData } = useCollection<CustomFieldDefinition>(customFieldDefinitionsQuery);
  const customFieldDefinitions = useMemo(() => customFieldDefinitionsData || [], [customFieldDefinitionsData]);

  const addCustomFieldDefinition = useCallback(async (name: string) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !user || !isOwner) {
      throw new Error('Only workspace owners can create custom fields.');
    }

    if (!name || !name.trim()) {
      throw new Error('Field name is required.');
    }

    const normalizedName = name.trim().toLowerCase();
    const existingNames = customFieldDefinitions.map(f => f.name.toLowerCase());
    if (existingNames.includes(normalizedName)) {
      throw new Error('A custom field with this name already exists.');
    }

    const fieldRef = doc(collection(db, 'workspaces', wsId, 'custom_field_definitions'));
    const fieldData: CustomFieldDefinition = {
      id: fieldRef.id,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
      memberUserIds: getMemberUserIds(activeWorkspace),
    };

    try {
      await setDocumentNonBlocking(fieldRef, fieldData, { merge: true });
      logAudit('create', 'custom_field', fieldRef.id, `Created custom field: ${name}`);
      return fieldRef.id;
    } catch (e) {
      console.error("Failed to create custom field:", e);
      throw e;
    }
  }, [db, user, activeWorkspace, isOwner, customFieldDefinitions, logAudit]);

  const deleteCustomFieldDefinition = useCallback(async (fieldId: string) => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || !isOwner) {
      throw new Error('Only workspace owners can delete custom fields.');
    }
    const field = customFieldDefinitions.find(f => f.id === fieldId);
    const fieldRef = doc(db, 'workspaces', wsId, 'custom_field_definitions', fieldId);
    try {
      await deleteDocumentNonBlocking(fieldRef);
      logAudit('delete', 'custom_field', fieldId, `Deleted custom field: ${field?.name || 'Unknown'}`);
    } catch (e) {
      console.error("Failed to delete custom field:", e);
      throw e;
    }
  }, [db, activeWorkspace, isOwner, customFieldDefinitions, logAudit]);

  return {
    customFieldDefinitions,
    addCustomFieldDefinition,
    deleteCustomFieldDefinition,
  };
}
