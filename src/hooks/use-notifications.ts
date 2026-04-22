'use client';

import { useMemo } from 'react';
import { query, collection, where, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Notification } from '@/lib/types';

/**
 * Hook to fetch notifications for the currently authenticated user in real-time.
 * It enforces the 'userId' filter required by Firestore Security Rules and 
 * includes defensive guards to prevent premature queries.
 */
export function useNotifications(max: number = 50) {
  const db = useFirestore();
  const { user, isAuthReady } = useUser();

  const notificationsQuery = useMemoFirebase(() => {
    // Guard 1: No database
    if (!db) {
      console.log('[useNotifications] No db, returning null');
      return null;
    }
    
    // Guard 2: Auth not ready
    if (!isAuthReady) {
      console.log('[useNotifications] Auth not ready, returning null');
      return null;
    }
    
    // Guard 3: No user
    if (!user) {
      console.log('[useNotifications] No user, returning null');
      return null;
    }
    
    // Guard 4: No user ID
    if (!user.uid || typeof user.uid !== 'string' || user.uid.length === 0) {
      console.log('[useNotifications] Invalid user.uid, returning null');
      return null;
    }

    console.log('[useNotifications] Creating query for user:', user.uid);
    
    // CRITICAL: We only construct the query if the user is fully authenticated and ready.
    // The query MUST include the 'userId' filter to satisfy the security rules.
    return query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
  }, [db, user?.uid, isAuthReady, max]);

  // useCollection handles the real-time subscription.
  const { data, isLoading, error } = useCollection<Notification>(notificationsQuery);

  const unreadCount = useMemo(() => {
    if (!data) return 0;
    return data.filter(n => !n.read).length;
  }, [data]);

  return {
    notifications: data || [],
    unreadCount,
    isLoading: !isAuthReady || isLoading,
    error
  };
}
