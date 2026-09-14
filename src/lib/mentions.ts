/**
 * Mention utilities for parsing and handling @mentions in comments
 */

export interface Mention {
  userId: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parse @mentions from text.
 *
 * Scans for literal '@' characters and checks whether the text immediately
 * following starts with a real member's exact display name — checking
 * longest names first, so "John Smith" is preferred over a shorter "John"
 * when both could match at the same position. This is deliberately NOT a
 * \w+ regex: that would stop at the first space, truncating any multi-word
 * name (the common case for real people) to just its first word, and a
 * same-first-word member later in the list could then absorb a mention
 * that was actually meant for someone else.
 */
export function parseMentions(text: string, workspaceMembers: Array<{ userId: string; displayName: string }>): Mention[] {
  const mentions: Mention[] = [];

  // Longest display name first, so "John Smith" wins over "John" when the
  // text starts with the longer name.
  const candidates = [...workspaceMembers].sort((a, b) => b.displayName.length - a.displayName.length);

  let searchIndex = 0;
  while (searchIndex < text.length) {
    const atIndex = text.indexOf('@', searchIndex);
    if (atIndex === -1) break;

    const remainder = text.slice(atIndex + 1);
    const remainderLower = remainder.toLowerCase();

    // Primary: the text starts with a real display name exactly as
    // inserted (spaces and all) — this is what replaceMention produces
    // when a name is selected from the dropdown.
    let member = candidates.find((m) => remainderLower.startsWith(m.displayName.toLowerCase()));
    let matchedLength = member?.displayName.length ?? 0;

    // Fallback: a manually-typed mention with no spaces (e.g. "@JohnSmith"
    // for "John Smith"). Bounded to the contiguous word-like run right
    // after '@', compared as an exact match against each candidate's
    // space-stripped name — not a substring/includes check, so this can't
    // attach the mention to the wrong person the way a loose match could.
    if (!member) {
      const wordRun = remainder.match(/^\w+/)?.[0] ?? '';
      const wordRunLower = wordRun.toLowerCase();
      member = candidates.find((m) => m.displayName.replace(/\s+/g, '').toLowerCase() === wordRunLower);
      matchedLength = wordRun.length;
    }

    if (member && matchedLength > 0) {
      const endIndex = atIndex + 1 + matchedLength;
      mentions.push({
        userId: member.userId,
        displayName: member.displayName,
        startIndex: atIndex,
        endIndex,
      });
      searchIndex = endIndex;
    } else {
      searchIndex = atIndex + 1;
    }
  }

  return mentions;
}

/**
 * Extract user IDs from mentions
 */
export function extractMentionedUserIds(mentions: Mention[]): string[] {
  return [...new Set(mentions.map((m) => m.userId))];
}

/**
 * Replace mentions with highlighted spans for rendering
 * Returns an array of segments: { text: string, isMention: boolean, userId?: string, displayName?: string }
 */
export function renderTextWithMentions(
  text: string,
  mentions: Mention[]
): Array<{ text: string; isMention: boolean; userId?: string; displayName?: string }> {
  if (mentions.length === 0) {
    return [{ text, isMention: false }];
  }

  const sortedMentions = [...mentions].sort((a, b) => a.startIndex - b.startIndex);
  const segments: Array<{ text: string; isMention: boolean; userId?: string; displayName?: string }> = [];
  let lastIndex = 0;

  sortedMentions.forEach((mention) => {
    // Add text before the mention
    if (mention.startIndex > lastIndex) {
      segments.push({ text: text.slice(lastIndex, mention.startIndex), isMention: false });
    }

    // Add the mention
    segments.push({
      text: `@${mention.displayName}`,
      isMention: true,
      userId: mention.userId,
      displayName: mention.displayName,
    });

    lastIndex = mention.endIndex;
  });

  // Add remaining text after the last mention
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isMention: false });
  }

  return segments;
}

/**
 * Find the current @mention being typed
 */
export function getCurrentMentionQuery(
  text: string,
  cursorPosition: number
): { query: string; startIndex: number } | null {
  const textBeforeCursor = text.slice(0, cursorPosition);
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');

  if (lastAtIndex === -1) {
    return null;
  }

  // Check if there's a space after the @ (meaning the mention is complete)
  const afterAt = textBeforeCursor.slice(lastAtIndex + 1);
  if (afterAt.includes(' ') || afterAt.includes('\n')) {
    return null;
  }

  return {
    query: afterAt,
    startIndex: lastAtIndex,
  };
}

/**
 * Replace the in-progress @query (the text typed between '@' and the
 * cursor, e.g. "Jo") with the selected member's full display name.
 *
 * Takes the exact query length rather than guessing where it ends by
 * searching for the next whitespace — searching for whitespace breaks as
 * soon as the query is immediately followed by punctuation with no space
 * (e.g. "@Jo, are you free?"), which would incorrectly swallow that
 * punctuation into the replacement.
 */
export function replaceMention(
  text: string,
  startIndex: number,
  displayName: string,
  currentQueryLength: number
): string {
  const beforeMention = text.slice(0, startIndex);
  const afterQuery = text.slice(startIndex + 1 + currentQueryLength);

  return beforeMention + `@${displayName}` + afterQuery;
}
