import { describe, expect, it } from 'vitest';
import {
  extractMentionedUserIds,
  getCurrentMentionQuery,
  parseMentions,
  renderTextWithMentions,
  replaceMention,
} from '@/lib/mentions';

const members = [
  { userId: 'u1', displayName: 'John' },
  { userId: 'u2', displayName: 'John Smith' },
  { userId: 'u3', displayName: 'Jane Doe' },
];

describe('parseMentions', () => {
  it('matches the longest display name at a position, not a shorter prefix', () => {
    const mentions = parseMentions('Hey @John Smith, take a look', members);
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({ userId: 'u2', displayName: 'John Smith' });
  });

  it('matches a shorter name when the longer one is not present', () => {
    const mentions = parseMentions('Hey @John, can you check?', members);
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({ userId: 'u1', displayName: 'John' });
  });

  it('falls back to a space-stripped exact match for a manually-typed mention', () => {
    const mentions = parseMentions('cc @JaneDoe', members);
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({ userId: 'u3', displayName: 'Jane Doe' });
  });

  it('finds multiple mentions in the same text', () => {
    const mentions = parseMentions('@Jane Doe and @John Smith, please review', members);
    expect(mentions.map((m) => m.userId)).toEqual(['u3', 'u2']);
  });

  it('ignores an @ that matches no member', () => {
    const mentions = parseMentions('this email is a@example.com', members);
    expect(mentions).toHaveLength(0);
  });

  it('returns no mentions for text with no @', () => {
    expect(parseMentions('nothing to see here', members)).toHaveLength(0);
  });
});

describe('extractMentionedUserIds', () => {
  it('deduplicates repeated mentions of the same user', () => {
    const mentions = parseMentions('@John and @John again', members);
    expect(extractMentionedUserIds(mentions)).toEqual(['u1']);
  });

  it('returns an empty array for no mentions', () => {
    expect(extractMentionedUserIds([])).toEqual([]);
  });
});

describe('renderTextWithMentions', () => {
  it('returns the whole text as one non-mention segment when there are no mentions', () => {
    expect(renderTextWithMentions('plain text', [])).toEqual([{ text: 'plain text', isMention: false }]);
  });

  it('splits text around a mention into before/mention/after segments', () => {
    const mentions = parseMentions('Hey @John Smith, look at this', members);
    const segments = renderTextWithMentions('Hey @John Smith, look at this', mentions);
    expect(segments).toEqual([
      { text: 'Hey ', isMention: false },
      { text: '@John Smith', isMention: true, userId: 'u2', displayName: 'John Smith' },
      { text: ', look at this', isMention: false },
    ]);
  });
});

describe('getCurrentMentionQuery', () => {
  it('returns the in-progress query right after an @', () => {
    expect(getCurrentMentionQuery('Hey @Jo', 7)).toEqual({ query: 'Jo', startIndex: 4 });
  });

  it('returns null when there is no @ before the cursor', () => {
    expect(getCurrentMentionQuery('Hey there', 9)).toBeNull();
  });

  it('returns null once the mention is followed by a space', () => {
    expect(getCurrentMentionQuery('Hey @John Smith', 16)).toBeNull();
  });
});

describe('replaceMention', () => {
  it('replaces the in-progress @query with the full display name', () => {
    const result = replaceMention('Hey @Jo', 4, 'John Smith', 2);
    expect(result).toBe('Hey @John Smith');
  });

  it('preserves text after the mention when it is whitespace-separated', () => {
    const result = replaceMention('Hey @Jo are you free?', 4, 'John Smith', 2);
    expect(result).toBe('Hey @John Smith are you free?');
  });

  it('preserves punctuation immediately after the mention (regression: previously dropped it)', () => {
    const result = replaceMention('Hey @Jo, are you free?', 4, 'John Smith', 2);
    expect(result).toBe('Hey @John Smith, are you free?');
  });
});
