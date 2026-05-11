const APP_LOGO_URL = "https://ylcyktbppowabnxuwdrr.supabase.co/storage/v1/object/public/logo/icon.png";
const APP_NAME = "Pixap";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailLayout(params: {
  title: string;
  description: string;
  buttonLabel: string;
  actionLink: string;
}): string {
  const safeTitle = escapeHtml(params.title);
  const safeDescription = escapeHtml(params.description);
  const safeButtonLabel = escapeHtml(params.buttonLabel);
  const safeActionLink = escapeHtml(params.actionLink);

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;padding:28px 24px;">
            <tr>
              <td align="center" style="padding-bottom:16px;">
                <img src="${APP_LOGO_URL}" width="82" height="82" alt="${APP_NAME} logo" style="display:block;border-radius:16px;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:24px;font-weight:800;line-height:1.3;padding-bottom:8px;">${safeTitle}</td>
            </tr>
            <tr>
              <td align="center" style="font-size:15px;line-height:1.6;color:#4b5563;padding-bottom:24px;">${safeDescription}</td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:18px;">
                <a href="${safeActionLink}" style="display:inline-block;background:#ec6544;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:12px 24px;border-radius:12px;">
                  ${safeButtonLabel}
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:#6b7280;">
                If the button does not work, copy and paste this URL into your browser:
                <br />
                <a href="${safeActionLink}" style="color:#ec6544;word-break:break-all;">${safeActionLink}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

export function buildVerifyEmailHtml(actionLink: string): string {
  return buildEmailLayout({
    title: "Confirm your email",
    description: "Tap the button below to verify your email and finish creating your Pixap account.",
    buttonLabel: "Verify email",
    actionLink,
  });
}

export function buildVerifyOtpEmailHtml(params: { code: string; subject?: string; name?: string }): string {
  const safeCode = escapeHtml(params.code);
  const safeSubject = escapeHtml(params.subject ?? "Verify your email");
  const safeName = escapeHtml((params.name ?? "").trim() || "there");

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f2f7ff;font-family:Georgia,'Times New Roman',serif;color:#0a2f74;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:18px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #dce9ff;">
            <tr>
              <td style="padding:18px 20px 16px;border-bottom:3px solid #0a53c9;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="42" valign="middle">
                      <img src="${APP_LOGO_URL}" width="34" height="34" alt="${APP_NAME} logo" style="display:block;border-radius:8px;" />
                    </td>
                    <td valign="middle" style="font-size:24px;font-weight:700;color:#0a2f74;">${APP_NAME} Connect</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 30px 8px;color:#0a53c9;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
                Subject
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 20px;font-size:31px;line-height:1.2;font-weight:700;color:#0a2f74;">
                ${safeSubject}
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 14px;font-size:40px;line-height:1.18;font-weight:700;color:#0a2f74;">
                Hi ${safeName},
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 14px;font-size:42px;line-height:1.16;font-weight:700;color:#0a53c9;">
                Welcome to ${APP_NAME} Connect!
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 14px;font-size:17px;line-height:1.7;color:#0a2f74;">
                We are excited to have you here. Use your verification code below to secure your account and unlock the full ${APP_NAME} experience.
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 18px;font-size:17px;line-height:1.7;color:#0a2f74;">
                Please verify your email address to activate your account and continue setup:
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 20px;">
                <div style="border:1px dashed #0a53c9;border-radius:10px;padding:20px 14px;text-align:center;background:#f8fbff;">
                  <div style="font-size:12px;line-height:1.4;color:#6f88be;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:10px;">
                    Your verification code
                  </div>
                  <div style="font-family:'Courier New',monospace;font-size:42px;letter-spacing:8px;font-weight:700;color:#0a2f74;">
                    ${safeCode}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 12px;font-size:17px;line-height:1.7;color:#0a2f74;">
                This code expires in 10 minutes. If you did not request this email, you can safely ignore it.
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 26px;font-size:17px;line-height:1.7;color:#0a2f74;">
                Warmly,<br />
                <strong>The ${APP_NAME} Team</strong>
              </td>
            </tr>
            <tr>
              <td style="background:#03235b;color:#e4edff;text-align:center;padding:18px 16px;font-size:12px;line-height:1.6;">
                © ${new Date().getUTCFullYear()} ${APP_NAME}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

export function buildRecoveryEmailHtml(actionLink: string): string {
  return buildEmailLayout({
    title: "Reset your password",
    description: "Tap the button below to securely set a new password for your Pixap account.",
    buttonLabel: "Reset password",
    actionLink,
  });
}

export function buildRecoveryOtpEmailHtml(params: { code: string; subject?: string; name?: string }): string {
  const safeCode = escapeHtml(params.code);
  const safeSubject = escapeHtml(params.subject ?? "Password reset code");
  const safeName = escapeHtml((params.name ?? "").trim() || "there");

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeSubject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;padding:28px 24px;">
            <tr>
              <td align="center" style="padding-bottom:16px;">
                <img src="${APP_LOGO_URL}" width="82" height="82" alt="${APP_NAME} logo" style="display:block;border-radius:16px;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:26px;font-weight:800;line-height:1.3;padding-bottom:6px;color:#111827;">
                Password reset code
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:15px;line-height:1.6;color:#4b5563;padding-bottom:14px;">
                Hi ${safeName}, use this one-time code to continue resetting your password.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:18px;">
                <div style="display:inline-block;border:1px dashed #ec6544;border-radius:12px;padding:14px 18px;background:#fff7f4;">
                  <div style="font-size:11px;line-height:1.4;color:#9ca3af;letter-spacing:1.6px;text-transform:uppercase;font-weight:700;margin-bottom:6px;">
                    Your reset code
                  </div>
                  <div style="font-family:'Courier New',monospace;font-size:34px;letter-spacing:7px;font-weight:800;color:#111827;">
                    ${safeCode}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:14px;line-height:1.6;color:#4b5563;padding-bottom:14px;">
                This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:14px;line-height:1.6;color:#6b7280;">
                For your security, do not share this code with anyone.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}
