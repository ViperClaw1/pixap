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

export function buildRecoveryEmailHtml(actionLink: string): string {
  return buildEmailLayout({
    title: "Reset your password",
    description: "Tap the button below to securely set a new password for your Pixap account.",
    buttonLabel: "Reset password",
    actionLink,
  });
}
