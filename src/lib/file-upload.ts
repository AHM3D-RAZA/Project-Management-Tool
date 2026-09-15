import { getDownloadURL, ref, uploadBytesResumable, type FirebaseStorage } from 'firebase/storage';

/** Matches the size limit enforced in storage.rules — kept in sync there. */
export const MAX_ATTACHMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export class FileTooLargeError extends Error {
  constructor(fileName: string) {
    super(`"${fileName}" is larger than 25MB and can't be uploaded.`);
    this.name = 'FileTooLargeError';
  }
}

/**
 * Uploads a file to Firebase Storage as a task attachment and resolves
 * with its public download URL — ready to hand to
 * NexusStore.addAttachment, the same as a pasted URL or a Google Drive
 * pick. Storage path mirrors the Firestore task path (workspace/task)
 * so storage.rules can gate access using the same workspace membership
 * check as Firestore.
 */
export function uploadTaskAttachment(
  storage: FirebaseStorage,
  workspaceId: string,
  taskId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string; name: string }> {
  if (file.size > MAX_ATTACHMENT_FILE_SIZE_BYTES) {
    return Promise.reject(new FileTooLargeError(file.name));
  }

  const path = `workspaces/${workspaceId}/tasks/${taskId}/${Date.now()}-${file.name}`;
  const uploadTask = uploadBytesResumable(ref(storage, path), file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        onProgress?.((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url, name: file.name });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}
