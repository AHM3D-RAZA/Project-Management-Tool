'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; 
  isLoading: boolean;       
  error: FirestoreError | Error | null; 
}

export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries and properly surfaces permission errors.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    // EARLY EXIT: If no query provided, reset state and return
    if (!memoizedTargetRefOrQuery) {
      console.log('[useCollection] No query provided, skipping');
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Determine the path for identifying the error context
    const isCollectionGroup = !('path' in memoizedTargetRefOrQuery) || !memoizedTargetRefOrQuery.type || memoizedTargetRefOrQuery.type === undefined;
    
    let path: string;
    try {
      path = memoizedTargetRefOrQuery.type === 'collection'
        ? (memoizedTargetRefOrQuery as CollectionReference).path
        : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();
    } catch (e) {
      console.error('[useCollection] Error getting path:', e);
      path = 'unknown';
    }

    console.log('[useCollection] Setting up listener for:', path);

    // Safety check to prevent root-level scans
    if (!isCollectionGroup && (path === "/" || path === "" || path.includes('/databases/(default)/documents/'))) {
      console.warn('[useCollection] Blocked root path query:', path);
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        console.log('[useCollection] Got snapshot for:', path, 'docs:', snapshot.docs.length);
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (error: FirestoreError) => {
        console.error('[useCollection] Error for:', path, error.message);
        const isPermissionError = error.code === 'permission-denied';
        const surfacedError = isPermissionError
          ? new FirestorePermissionError({
              operation: 'list',
              path: path || 'collectionGroup',
            })
          : error;

        setError(surfacedError);
        setData(null);
        setIsLoading(false);

        // Only emit rule-debugging errors for genuine permission failures.
        if (isPermissionError) {
          errorEmitter.emit('permission-error', surfacedError as FirestorePermissionError);
        }
      }
    );

    return () => {
      console.log('[useCollection] Cleaning up listener for:', path);
      unsubscribe();
    };
  }, [memoizedTargetRefOrQuery]); 

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error('Target was not properly memoized using useMemoFirebase');
  }
  return { data, isLoading, error };
}
