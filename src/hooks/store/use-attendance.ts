"use client";

import { useCallback, useEffect, useMemo } from 'react';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  useCollection,
  useDoc,
  useMemoFirebase,
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, query, doc, collectionGroup, where, serverTimestamp } from 'firebase/firestore';
import type { Workspace, AttendanceEntry } from '@/lib/types';
import { getMemberUserIds } from '@/lib/member-sync';

// How long a user has to undo an accidental check-in. Must match the
// duration enforced server-side in firestore.rules.
const CHECK_IN_GRACE_PERIOD_MS = 5 * 60 * 1000;

interface UseAttendanceParams {
  db: Firestore | null;
  user: User | null;
  activeWorkspace: Workspace | null;
  isAuthReady: boolean;
  isAdmin: boolean;
}

/**
 * Attendance: check-in/check-out, today's and open entries (both "just
 * mine" and workspace-wide), and the full admin history view. Kept as its
 * own hook since it's fully self-contained — it doesn't touch logAudit or
 * any other domain, unlike almost everything else in the store.
 */
export function useAttendance({ db, user, activeWorkspace, isAuthReady, isAdmin }: UseAttendanceParams) {
  const getTodayDateKey = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const todayDateKey = getTodayDateKey();

  // This user's entry for today.
  const attendanceDocRef = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId || wsId === '' || !isAuthReady) return null;
    // Simplified structure: attendance/{userId}_{dateKey}
    const docId = `${user.uid}_${todayDateKey}`;
    return doc(db, 'workspaces', wsId, 'attendance', docId);
  }, [db, user?.uid, activeWorkspace?.id, isAuthReady, todayDateKey]);

  const { data: todayAttendanceData, isLoading: isAttendanceLoading } = useDoc<AttendanceEntry>(attendanceDocRef);
  const todayAttendance = useMemo(() => todayAttendanceData, [todayAttendanceData]);

  // Today's attendance for ALL workspace members — visible to everyone,
  // not admin-gated (unlike the full history query below).
  const todayTeamAttendanceQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || wsId === '' || !isAuthReady || !user?.uid) return null;
    return query(
      collectionGroup(db, 'attendance'),
      where('workspaceId', '==', wsId),
      where('dateKey', '==', todayDateKey)
    );
  }, [db, activeWorkspace?.id, isAuthReady, user?.uid, todayDateKey]);

  const { data: todayTeamAttendanceData, isLoading: isTodayTeamAttendanceLoading } = useCollection<AttendanceEntry>(todayTeamAttendanceQuery);
  const todayTeamAttendance = useMemo(() => todayTeamAttendanceData || [], [todayTeamAttendanceData]);

  // This user's open (unchecked-out) entry, across ALL days — not just today.
  const openAttendanceQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId || wsId === '' || !isAuthReady) return null;
    return query(
      collection(db, 'workspaces', wsId, 'attendance'),
      where('userId', '==', user.uid),
      where('checkOutTime', '==', null)
    );
  }, [db, user?.uid, activeWorkspace?.id, isAuthReady]);

  const { data: openAttendanceData } = useCollection<AttendanceEntry>(openAttendanceQuery);
  const openAttendanceEntry = useMemo(() =>
    (openAttendanceData && openAttendanceData.length > 0) ? openAttendanceData[0] : null,
    [openAttendanceData]
  );

  // ALL open (unchecked-out) entries in the workspace, for TeamActivityCard.
  const openTeamAttendanceQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || wsId === '' || !isAuthReady || !user?.uid) return null;
    return query(
      collectionGroup(db, 'attendance'),
      where('workspaceId', '==', wsId),
      where('checkOutTime', '==', null)
    );
  }, [db, activeWorkspace?.id, isAuthReady, user?.uid]);

  const { data: openTeamAttendanceData } = useCollection<AttendanceEntry>(openTeamAttendanceQuery);
  const openTeamAttendance = useMemo(() => openTeamAttendanceData || [], [openTeamAttendanceData]);

  // Full attendance history for the workspace — admin only.
  const allAttendanceQuery = useMemoFirebase(() => {
    const wsId = activeWorkspace?.id;
    if (!db || !wsId || wsId === '' || !isAuthReady || !isAdmin) return null;
    return query(collectionGroup(db, 'attendance'), where('workspaceId', '==', wsId));
  }, [db, activeWorkspace?.id, isAuthReady, isAdmin]);

  const { data: allAttendanceData, isLoading: isAllAttendanceLoading } = useCollection<AttendanceEntry>(allAttendanceQuery);
  const allWorkspaceAttendance = useMemo(() => {
    if (!isAdmin) return []; // Only admins can view all attendance
    return allAttendanceData || [];
  }, [allAttendanceData, isAdmin]);

  // Auto-checkout: if the user has an open entry that's 12+ hours old, auto-close it.
  useEffect(() => {
    if (!openAttendanceEntry || !db || !activeWorkspace?.id) return;

    const checkInTime = new Date(openAttendanceEntry.checkInTime);
    const now = new Date();
    const hoursSinceCheckIn = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCheckIn >= 12) {
      const autoCheckoutTime = new Date(checkInTime.getTime() + 12 * 60 * 60 * 1000);
      const ref = doc(db, 'workspaces', openAttendanceEntry.workspaceId, 'attendance', openAttendanceEntry.id);
      updateDocumentNonBlocking(ref, {
        checkOutTime: autoCheckoutTime.toISOString(),
        checkOutServerTime: serverTimestamp(),
        autoCheckout: true,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [openAttendanceEntry, db, activeWorkspace?.id]);

  const checkIn = useCallback(async () => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId) return;

    // Guard: if user has an open (unchecked-out) entry from any day, block check-in
    if (openAttendanceEntry) {
      console.log("Open check-in exists — must check out first");
      throw new Error("You have an open check-in. Please check out first.");
    }

    // Guard: if already checked in today, don't overwrite
    if (todayAttendance?.checkInTime) {
      console.log("Already checked in today");
      return;
    }

    const dateKey = getTodayDateKey();
    const docId = `${user.uid}_${dateKey}`;
    const attendanceRef = doc(db, 'workspaces', wsId, 'attendance', docId);

    const attendanceData: AttendanceEntry = {
      id: docId,
      workspaceId: wsId,
      userId: user.uid,
      dateKey,
      checkInTime: new Date().toISOString(),
      checkOutTime: null,
      checkInServerTime: serverTimestamp(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      memberUserIds: getMemberUserIds(activeWorkspace),
    };

    try {
      await setDocumentNonBlocking(attendanceRef, attendanceData, { merge: true });
    } catch (e) {
      console.error("Failed to check in:", e);
      throw e;
    }
  }, [db, user, activeWorkspace, todayAttendance, openAttendanceEntry, getTodayDateKey]);

  // Undo an accidental check-in. Only allowed within CHECK_IN_GRACE_PERIOD_MS
  // of the check-in itself and only while it's still open (not checked out) —
  // this is a misclick-correction window, not a way to dodge the 8-hour
  // minimum after actually starting work. Enforced both here and, more
  // importantly, server-side in firestore.rules.
  const cancelCheckIn = useCallback(async () => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId) return;

    const entry = openAttendanceEntry;
    if (!entry?.checkInTime || entry.checkOutTime) {
      console.log("No open check-in to cancel");
      return;
    }

    const checkInTime = new Date(entry.checkInTime);
    const msSinceCheckIn = new Date().getTime() - checkInTime.getTime();
    if (msSinceCheckIn > CHECK_IN_GRACE_PERIOD_MS) {
      throw new Error("The grace period to undo this check-in has passed.");
    }

    const attendanceRef = doc(db, 'workspaces', entry.workspaceId, 'attendance', entry.id);

    try {
      await deleteDocumentNonBlocking(attendanceRef);
    } catch (e) {
      console.error("Failed to cancel check-in:", e);
      throw e;
    }
  }, [db, user, activeWorkspace?.id, openAttendanceEntry]);

  const checkOut = useCallback(async () => {
    const wsId = activeWorkspace?.id;
    if (!db || !user?.uid || !wsId) return;

    // Use the open entry (which could be from any day, not just today)
    const entryToClose = openAttendanceEntry;

    if (!entryToClose?.checkInTime) {
      console.log("Not checked in yet");
      return;
    }
    if (entryToClose.checkOutTime) {
      console.log("Already checked out");
      return;
    }

    // Guard: must wait at least the workspace's configured minimum hours
    // (default 8) after check-in before checking out.
    const minHours = activeWorkspace?.minCheckoutHours ?? 8;
    const checkInTime = new Date(entryToClose.checkInTime);
    const now = new Date();
    const hoursSinceCheckIn = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCheckIn < minHours) {
      const hoursRemaining = Math.ceil(minHours - hoursSinceCheckIn);
      console.log(`Must wait ${hoursRemaining} more hours before checking out`);
      throw new Error(`Must wait at least ${minHours} hours after check-in. ${hoursRemaining} hours remaining.`);
    }

    const attendanceRef = doc(db, 'workspaces', entryToClose.workspaceId, 'attendance', entryToClose.id);

    try {
      const updateData: Partial<AttendanceEntry> = {
        checkOutTime: new Date().toISOString(),
        checkOutServerTime: serverTimestamp(),
        updatedAt: new Date().toISOString(),
      };
      await updateDocumentNonBlocking(attendanceRef, updateData);
    } catch (e) {
      console.error("Failed to check out:", e);
      throw e;
    }
  }, [db, user, activeWorkspace?.id, activeWorkspace?.minCheckoutHours, openAttendanceEntry]);

  return {
    todayAttendance,
    isAttendanceLoading,
    openAttendanceEntry,
    allWorkspaceAttendance,
    isAllAttendanceLoading,
    todayTeamAttendance,
    isTodayTeamAttendanceLoading,
    openTeamAttendance,
    checkIn,
    checkOut,
    cancelCheckIn,
  };
}
