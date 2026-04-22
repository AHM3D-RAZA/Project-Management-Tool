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
 * Parse @mentions from text
 * Matches @username or @displayName patterns
 */
export function parseMentions(text: string, workspaceMembers: Array<{ userId: string; displayName: string }>): Mention[] {
  const mentions: Mention[] = [];
  const mentionRegex = /@(\w+)/g;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionText = match[1];
    const startIndex = match.index;
    const endIndex = match.index + match[0].length;

    // Find matching member
    const member = workspaceMembers.find(
      (m) =>
        m.displayName.toLowerCase().includes(mentionText.toLowerCase()) ||
        m.displayName.replace(/\s+/g, '').toLowerCase() === mentionText.toLowerCase()
    );

    if (member) {
      mentions.push({
        userId: member.userId,
        displayName: member.displayName,
        startIndex,
        endIndex,
      });
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
 * Replace the current @mention with a selected user
 */
export function replaceMention(
  text: string,
  startIndex: number,
  displayName: string
): string {
  const beforeMention = text.slice(0, startIndex);
  const afterMention = text.slice(startIndex);
  const mentionEnd = afterMention.search(/[\s\n]/);
  const actualEnd = mentionEnd === -1 ? afterMention.length : mentionEnd;

  return beforeMention + `@${displayName}` + afterMention.slice(actualEnd);
}
