import { describe, expect, it } from 'vitest';
import { isValidDiscordWebhookUrl, isValidSlackWebhookUrl, isValidWebhookUrl } from '@/lib/webhook-validation';

describe('isValidSlackWebhookUrl', () => {
  it('accepts a real Slack webhook URL', () => {
    expect(isValidSlackWebhookUrl('https://hooks.slack.com/services/T00/B00/xxxxxxxx')).toBe(true);
  });

  it('rejects a non-Slack domain', () => {
    expect(isValidSlackWebhookUrl('https://evil.example.com/hooks.slack.com')).toBe(false);
  });

  it('rejects http (non-https)', () => {
    expect(isValidSlackWebhookUrl('http://hooks.slack.com/services/T00/B00/xxxxxxxx')).toBe(false);
  });

  it('rejects a malformed URL', () => {
    expect(isValidSlackWebhookUrl('not a url')).toBe(false);
  });
});

describe('isValidDiscordWebhookUrl', () => {
  it('accepts a real Discord webhook URL', () => {
    expect(isValidDiscordWebhookUrl('https://discord.com/api/webhooks/123/abc')).toBe(true);
  });

  it('accepts the legacy discordapp.com domain', () => {
    expect(isValidDiscordWebhookUrl('https://discordapp.com/api/webhooks/123/abc')).toBe(true);
  });

  it('rejects a Discord domain URL that is not a webhook path', () => {
    expect(isValidDiscordWebhookUrl('https://discord.com/channels/123/456')).toBe(false);
  });

  it('rejects a non-Discord domain', () => {
    expect(isValidDiscordWebhookUrl('https://evil.example.com/api/webhooks/123/abc')).toBe(false);
  });
});

describe('isValidWebhookUrl', () => {
  it('dispatches to the right validator by provider', () => {
    expect(isValidWebhookUrl('slack', 'https://hooks.slack.com/services/T00/B00/xxxxxxxx')).toBe(true);
    expect(isValidWebhookUrl('discord', 'https://hooks.slack.com/services/T00/B00/xxxxxxxx')).toBe(false);
  });
});
