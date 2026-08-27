'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
  WithFieldValue,
  UpdateData,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';

/**
 * Only genuine security-rule rejections should be surfaced as a
 * FirestorePermissionError and emitted for FirebaseErrorListener to throw
 * (which crashes the app — intentional for loud rule-debugging, but only
 * appropriate when the write really was denied by the rules). Any other
 * failure — offline, a network blip, Firestore temporarily unavailable,
 * a cancelled request — is a normal, recoverable failure that the caller's
 * own try/catch should handle (e.g. a toast), not a reason to crash the
 * whole app.
 */
function isPermissionDenied(error: unknown): boolean {
  return (error as FirestoreError)?.code === 'permission-denied';
}

/**
 * Initiates a setDoc operation for a document reference.
 * Returns the Promise so it can be awaited for sequential operations if needed.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: WithFieldValue<DocumentData>, options: SetOptions) {
  return setDoc(docRef, data, options).catch(error => {
    if (isPermissionDenied(error)) {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: data,
        })
      );
    }
    throw error;
  });
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Returns the Promise for sequential operations.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: WithFieldValue<DocumentData>) {
  return addDoc(colRef, data)
    .catch(error => {
      if (isPermissionDenied(error)) {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: data,
          })
        );
      }
      throw error;
    });
}


/**
 * Initiates an updateDoc operation for a document reference.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: UpdateData<DocumentData>) {
  return updateDoc(docRef, data)
    .catch(error => {
      if (isPermissionDenied(error)) {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: data,
          })
        );
      }
      throw error;
    });
}


/**
 * Initiates a deleteDoc operation for a document reference.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  return deleteDoc(docRef)
    .catch(error => {
      if (isPermissionDenied(error)) {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          })
        );
      }
      throw error;
    });
}