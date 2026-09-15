import { describe, expect, it } from 'vitest';
import {
  FileTooLargeError,
  MAX_ATTACHMENT_FILE_SIZE_BYTES,
  deleteStorageFileIfPresent,
  uploadTaskAttachment,
} from '@/lib/file-upload';

// A FirebaseStorage instance is never touched for a file that's rejected
// on size alone, so `null as never` is safe here — this test only
// exercises the size guard, not the actual upload path.
describe('uploadTaskAttachment', () => {
  it('rejects with FileTooLargeError before touching Storage when the file exceeds the limit', async () => {
    const oversized = new File([new Uint8Array(MAX_ATTACHMENT_FILE_SIZE_BYTES + 1)], 'big.zip');
    await expect(uploadTaskAttachment(null as never, 'w1', 't1', oversized)).rejects.toThrow(FileTooLargeError);
  });

  it('includes the file name in the error message', async () => {
    const oversized = new File([new Uint8Array(MAX_ATTACHMENT_FILE_SIZE_BYTES + 1)], 'big.zip');
    await expect(uploadTaskAttachment(null as never, 'w1', 't1', oversized)).rejects.toThrow(/big\.zip/);
  });
});

describe('deleteStorageFileIfPresent', () => {
  it('resolves without throwing for a URL that is not a Storage file (e.g. a Drive link)', async () => {
    // A null storage instance makes `ref()` throw internally — this
    // exercises the same "not actually our file" path as a real Drive
    // URL or an already-deleted file, all of which this function should
    // swallow rather than propagate.
    await expect(deleteStorageFileIfPresent(null as never, 'https://drive.google.com/file/d/abc'))
      .resolves.toBeUndefined();
  });
});
