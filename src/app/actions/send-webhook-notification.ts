'use server';

import { isValidWebhookUrl } from '@/lib/webhook-validation';
import { buildWebhookPayload, type WebhookProvider } from '@/lib/webhook-messages';

const REQUEST_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

export type SendWebhookNotificationResult =
  | { ok: true }
  | { ok: false; error: string };

async function postOnce(url: string, body: Record<string, string>): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res.ok;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Posts `text` to a Slack or Discord incoming webhook. Rejects the URL
 * outright if it doesn't match the provider's real domain (see
 * webhook-validation.ts) — this runs server-side, so an unvalidated URL
 * would let this action be used as an open relay to fetch anything.
 *
 * Reliability: an 8s timeout per attempt, one retry after a 1s delay on
 * failure (network error or non-2xx), so a single dropped request or a
 * slow provider doesn't silently lose the notification.
 */
export async function sendWebhookNotification(
  url: string,
  provider: WebhookProvider,
  text: string
): Promise<SendWebhookNotificationResult> {
  if (!isValidWebhookUrl(provider, url)) {
    return { ok: false, error: `That doesn't look like a valid ${provider === 'slack' ? 'Slack' : 'Discord'} webhook URL.` };
  }

  const body = buildWebhookPayload(provider, text);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (await postOnce(url, body)) return { ok: true };
    } catch {
      // Network error or timeout — fall through to retry/give up below.
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  return { ok: false, error: 'Webhook delivery failed after retrying.' };
}
