export type WebhookProvider = 'slack' | 'discord';
export type TaskWebhookEvent = 'created' | 'completed';

/**
 * Builds the message text for a task event, using each provider's own
 * bold-text markdown (Slack: single asterisks, Discord: double).
 */
export function buildTaskEventMessage(
  event: TaskWebhookEvent,
  taskTitle: string,
  actorName: string,
  provider: WebhookProvider
): string {
  const bold = (s: string) => (provider === 'discord' ? `**${s}**` : `*${s}*`);
  const emoji = event === 'created' ? '📝' : '✅';
  const verb = event === 'created' ? 'created a new task' : 'completed a task';
  return `${emoji} ${bold(actorName)} ${verb}: ${bold(taskTitle)}`;
}

/** Wraps message text into the JSON body each provider's webhook expects. */
export function buildWebhookPayload(provider: WebhookProvider, text: string): Record<string, string> {
  return provider === 'slack' ? { text } : { content: text };
}
