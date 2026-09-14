'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { getMissingFirebaseEnvVars } from '@/firebase/validate-config';
import { MissingFirebaseConfig } from '@/firebase/missing-config';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // Dev-only: production may rely on Firebase App Hosting's automatic
  // config injection (see the DO-NOT-MODIFY note in firebase/index.ts),
  // which doesn't need these env vars at all, so this check must not run
  // there. In development there's no such auto-injection, so a missing
  // var here reliably means the .env.local setup is incomplete.
  const missingVars = process.env.NODE_ENV === 'development' ? getMissingFirebaseEnvVars() : [];

  const firebaseServices = useMemo(() => {
    if (missingVars.length > 0) return null;
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  if (missingVars.length > 0) {
    return <MissingFirebaseConfig missingVars={missingVars} />;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices!.firebaseApp}
      auth={firebaseServices!.auth}
      firestore={firebaseServices!.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}