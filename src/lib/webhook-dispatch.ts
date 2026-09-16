import { sendWebhookNotification } from '@/app/actions/send-webhook-notification';
import { buildTaskEventMessage, type TaskWebhookEvent } from '@/lib/webhook-messages';
import type { Workspace } from '@/lib/types';

/**
 * Fire-and-forget: posts a task-event message to every webhook configured
 * on the workspace (Slack, Discord, both, or neither). Callers don't await
 * this — same pattern as the existing in-app notifyTaskAssigned/
 * notifyTaskUpdated calls in useTasks — since a webhook being slow or
 * temporarily down shouldn't hold up the task create/update itself.
 * Delivery reliability (timeout + retry) lives in the server action.
 */
export function dispatchTaskEventWebhooks(
  workspace: Workspace | null,
  event: TaskWebhookEvent,
  taskTitle: string,
  actorName: string
): void {
  const config = workspace?.notificationWebhooks;
  if (!config) return;

  if (config.slackUrl) {
    sendWebhookNotification(config.slackUrl, 'slack', buildTaskEventMessage(event, taskTitle, actorName, 'slack'))
      .catch((err) => console.error('Slack webhook dispatch failed:', err));
  }
  if (config.discordUrl) {
    sendWebhookNotification(config.discordUrl, 'discord', buildTaskEventMessage(event, taskTitle, actorName, 'discord'))
      .catch((err) => console.error('Discord webhook dispatch failed:', err));
  }
}
