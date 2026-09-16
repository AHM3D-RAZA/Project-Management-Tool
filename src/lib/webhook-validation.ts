/**
 * Restricts webhook URLs to each provider's actual domain. This matters
 * beyond input hygiene: sendWebhookNotification (a server action) does a
 * server-side fetch to whatever URL it's given, so without this check a
 * workspace admin could point it at an arbitrary internal address and use
 * the app as an SSRF relay.
 */

export function isValidSlackWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'hooks.slack.com';
  } catch {
    return false;
  }
}

export function isValidDiscordWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com') &&
      parsed.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

export function isValidWebhookUrl(provider: 'slack' | 'discord', url: string): boolean {
  return provider === 'slack' ? isValidSlackWebhookUrl(url) : isValidDiscordWebhookUrl(url);
}
