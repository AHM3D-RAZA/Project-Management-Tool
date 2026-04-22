'use server';

const RESEND_API = 'https://api.resend.com/emails';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type SendWorkspaceInviteEmailInput = {
  to: string;
  workspaceName: string;
  inviterName: string;
  joinUrl: string;
};

export type SendWorkspaceInviteEmailResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendWorkspaceInviteEmail(
  input: SendWorkspaceInviteEmailInput
): Promise<SendWorkspaceInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: 'Email is not configured. Add RESEND_API_KEY to your environment (see Resend.com).',
    };
  }

  const to = input.to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  const from =
    process.env.INVITE_FROM_EMAIL?.trim() || 'PSF Project Tracker <onboarding@resend.dev>';

  const subject = `${input.inviterName} invited you to ${input.workspaceName}`;
  const safeWs = escapeHtml(input.workspaceName);
  const safeInviter = escapeHtml(input.inviterName);
  const safeUrl = escapeHtml(input.joinUrl);
  const safeRecipient = escapeHtml(to);

  const text = [
    `PSF Project Tracker invitation`,
    ``,
    `${input.inviterName} invited you to join the workspace "${input.workspaceName}".`,
    ``,
    `Accept invitation: ${input.joinUrl}`,
    ``,
    `Why you received this email: someone on PSF Project Tracker invited ${to} to collaborate in this workspace.`,
    `If you were not expecting this invitation, you can safely ignore this email.`,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Inter,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:linear-gradient(135deg,#452ED2 0%,#6D5AF5 100%);color:#ffffff;">
              <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">PSF Project Tracker</div>
              <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;font-weight:700;">You have been invited to join a workspace</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hello,</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                <strong>${safeInviter}</strong> invited <strong>${safeRecipient}</strong> to collaborate in
                <strong>${safeWs}</strong> on PSF Project Tracker.
              </p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4b5563;">
                Use the button below to sign in and join the workspace. Once you accept, you will be able to view the projects and tasks shared with you.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td>
                    <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;background:#452ED2;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
                      Accept invitation
                    </a>
                  </td>
                </tr>
              </table>

              <div style="margin:0 0 24px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa;">
                <div style="font-size:13px;font-weight:600;color:#111827;margin:0 0 8px;">Why you received this email</div>
                <div style="font-size:14px;line-height:1.6;color:#4b5563;">
                  This invitation was sent because someone in PSF Project Tracker entered <strong>${safeRecipient}</strong> as the recipient for the workspace <strong>${safeWs}</strong>.
                </div>
              </div>

              <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6b7280;">
                If the button does not work, copy and paste this secure link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.7;word-break:break-all;">
                <a href="${safeUrl}" style="color:#452ED2;text-decoration:underline;">${safeUrl}</a>
              </p>

              <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;">
                If you were not expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;border-top:1px solid #e5e7eb;background:#fafafa;">
              <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#6b7280;">
                Sent by PSF Project Tracker
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                This transactional email contains a workspace invitation requested by a PSF Project Tracker user.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      text,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      errors?: { message?: string }[];
    };
    if (!res.ok) {
      const fromErrors = body.errors?.[0]?.message;
      const msg = fromErrors || body.message || res.statusText;
      return { ok: false, error: msg || 'Failed to send invitation email.' };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send invitation email.';
    return { ok: false, error: message };
  }
}
