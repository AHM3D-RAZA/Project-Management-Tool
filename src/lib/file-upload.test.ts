import { describe, expect, it } from 'vitest';
import { FileTooLargeError, MAX_ATTACHMENT_FILE_SIZE_BYTES, uploadTaskAttachment } from '@/lib/file-upload';

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
