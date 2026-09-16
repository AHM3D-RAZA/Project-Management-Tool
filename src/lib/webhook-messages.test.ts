import { describe, expect, it } from 'vitest';
import { buildTaskEventMessage, buildWebhookPayload } from '@/lib/webhook-messages';

describe('buildTaskEventMessage', () => {
  it('uses single-asterisk bold for Slack', () => {
    const msg = buildTaskEventMessage('created', 'Ship the release', 'Priya', 'slack');
    expect(msg).toBe('📝 *Priya* created a new task: *Ship the release*');
  });

  it('uses double-asterisk bold for Discord', () => {
    const msg = buildTaskEventMessage('created', 'Ship the release', 'Priya', 'discord');
    expect(msg).toBe('📝 **Priya** created a new task: **Ship the release**');
  });

  it('uses a different emoji/verb for a completed task', () => {
    const msg = buildTaskEventMessage('completed', 'Ship the release', 'Priya', 'slack');
    expect(msg).toBe('✅ *Priya* completed a task: *Ship the release*');
  });
});

describe('buildWebhookPayload', () => {
  it('wraps text as { text } for Slack', () => {
    expect(buildWebhookPayload('slack', 'hello')).toEqual({ text: 'hello' });
  });

  it('wraps text as { content } for Discord', () => {
    expect(buildWebhookPayload('discord', 'hello')).toEqual({ content: 'hello' });
  });
});
