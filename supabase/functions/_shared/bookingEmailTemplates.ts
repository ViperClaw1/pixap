const APP_LOGO_URL =
  "https://ylcyktbppowabnxuwdrr.supabase.co/storage/v1/object/public/logo/icon.png";
const APP_NAME = "Pixap";
const BRAND_COLOR = "#ec6544";

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function baseLayout(content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border-radius:20px;
                    padding:32px 28px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td align="center" style="padding-bottom:20px;">
          <img src="${APP_LOGO_URL}" width="72" height="72" alt="${APP_NAME}"
               style="display:block;border-radius:14px;"/>
        </td></tr>
        ${content}
        <tr><td style="padding-top:28px;border-top:1px solid #f3f4f6;
                        font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
          You received this email because you made a booking through ${APP_NAME}.<br/>
          © ${new Date().getFullYear()} ${APP_NAME}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export interface ReminderEmailParams {
  customerName: string;
  venueName: string;
  dateTime: string;
  persons: number;
  bookingId: string;
  deepLink: string;
}

export function buildReminderEmail(p: ReminderEmailParams): string {
  const name = escapeHtml(p.customerName || "there");
  const venue = escapeHtml(p.venueName);
  const dt = escapeHtml(p.dateTime);

  const content = `
    <tr><td align="center"
            style="font-size:22px;font-weight:800;line-height:1.3;padding-bottom:6px;">
      ⏰ Your booking is in 1 hour
    </td></tr>
    <tr><td align="center"
            style="font-size:15px;color:#4b5563;padding-bottom:24px;">
      Hey ${name}, time to get ready!
    </td></tr>
    <tr><td style="background:#fdf7f5;border:1.5px solid #fde8e0;
                   border-radius:14px;padding:20px 22px;margin-bottom:24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:18px;font-weight:700;color:#111827;
                     padding-bottom:14px;">${venue}</td>
        </tr>
        <tr>
          <td>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#6b7280;width:80px;">📅 Date</td>
                <td style="font-size:14px;font-weight:600;color:#111827;">${dt}</td>
              </tr>
              <tr><td colspan="2" style="height:8px;"></td></tr>
              <tr>
                <td style="font-size:13px;color:#6b7280;">👥 Guests</td>
                <td style="font-size:14px;font-weight:600;color:#111827;">
                  ${p.persons} ${p.persons === 1 ? "person" : "people"}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:20px 0 8px;">
      <a href="${escapeHtml(p.deepLink)}"
         style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;
                text-decoration:none;font-size:15px;font-weight:700;
                padding:13px 28px;border-radius:12px;">
        View booking details
      </a>
    </td></tr>
    <tr><td align="center"
            style="font-size:13px;color:#9ca3af;padding-bottom:8px;">
      See you there! 🎉
    </td></tr>
  `;

  return baseLayout(content);
}

export interface StatusEmailParams {
  customerName: string;
  venueName: string;
  dateTime: string;
  status: "upcoming" | "completed" | "expired";
  deepLink: string;
}

const STATUS_CONFIG = {
  upcoming: {
    emoji: "✅",
    headline: "Your booking is confirmed!",
    subline: "Great news — your table is reserved.",
    ctaLabel: "View booking",
    color: "#10b981",
  },
  completed: {
    emoji: "🌟",
    headline: "Thank you for visiting!",
    subline: "We hope you had a wonderful experience.",
    ctaLabel: "Leave a review",
    color: "#f59e0b",
  },
  expired: {
    emoji: "⌛",
    headline: "Your booking has expired",
    subline: "The reservation time has passed. Book again anytime!",
    ctaLabel: "Book again",
    color: "#6b7280",
  },
} as const;

export function buildStatusEmail(p: StatusEmailParams): string {
  const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.upcoming;
  const name = escapeHtml(p.customerName || "there");
  const venue = escapeHtml(p.venueName);
  const dt = escapeHtml(p.dateTime);

  const content = `
    <tr><td align="center" style="font-size:42px;padding-bottom:8px;">
      ${cfg.emoji}
    </td></tr>
    <tr><td align="center"
            style="font-size:22px;font-weight:800;line-height:1.3;padding-bottom:6px;">
      ${escapeHtml(cfg.headline)}
    </td></tr>
    <tr><td align="center"
            style="font-size:15px;color:#4b5563;padding-bottom:24px;">
      Hey ${name}, ${escapeHtml(cfg.subline)}
    </td></tr>
    <tr><td style="background:#f9fafb;border:1.5px solid #e5e7eb;
                   border-radius:14px;padding:20px 22px;margin-bottom:24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:18px;font-weight:700;color:#111827;
                     padding-bottom:14px;">${venue}</td>
        </tr>
        <tr>
          <td>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#6b7280;width:80px;">📅 Date</td>
                <td style="font-size:14px;font-weight:600;color:#111827;">${dt}</td>
              </tr>
              <tr><td colspan="2" style="height:8px;"></td></tr>
              <tr>
                <td style="font-size:13px;color:#6b7280;">🏢 Venue</td>
                <td style="font-size:14px;font-weight:600;color:#111827;">${venue}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding-bottom:16px;">
      <span style="display:inline-block;background:${cfg.color}1a;
                   color:${cfg.color};border:1px solid ${cfg.color}40;
                   font-size:13px;font-weight:600;padding:5px 14px;
                   border-radius:100px;">
        ${p.status.toUpperCase()}
      </span>
    </td></tr>
    <tr><td align="center" style="padding-bottom:8px;">
      <a href="${escapeHtml(p.deepLink)}"
         style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;
                text-decoration:none;font-size:15px;font-weight:700;
                padding:13px 28px;border-radius:12px;">
        ${escapeHtml(cfg.ctaLabel)}
      </a>
    </td></tr>
  `;

  return baseLayout(content);
}

export interface AdminNewBookingEmailParams {
  venueName: string;
  dateTime: string;
  persons: number;
  customerName: string;
  customerPhone: string;
  bookingId: string;
}

export function buildAdminNewBookingEmail(p: AdminNewBookingEmailParams): string {
  const venue = escapeHtml(p.venueName);
  const dt = escapeHtml(p.dateTime);
  const customer = escapeHtml(p.customerName || "—");
  const phone = escapeHtml(p.customerPhone || "—");

  const content = `
    <tr><td align="center" style="font-size:42px;padding-bottom:8px;">
      🔔
    </td></tr>
    <tr><td align="center"
            style="font-size:22px;font-weight:800;line-height:1.3;padding-bottom:6px;">
      New booking request
    </td></tr>
    <tr><td align="center"
            style="font-size:15px;color:#4b5563;padding-bottom:24px;">
      A customer just requested a booking.
    </td></tr>
    <tr><td style="background:#f9fafb;border:1.5px solid #e5e7eb;
                   border-radius:14px;padding:20px 22px;margin-bottom:24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:18px;font-weight:700;color:#111827;
                     padding-bottom:14px;">${venue}</td>
        </tr>
        <tr>
          <td>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#6b7280;width:100px;">📅 Date</td>
                <td style="font-size:14px;font-weight:600;color:#111827;">${dt}</td>
              </tr>
              <tr><td colspan="2" style="height:8px;"></td></tr>
              <tr>
                <td style="font-size:13px;color:#6b7280;">👥 Guests</td>
                <td style="font-size:14px;font-weight:600;color:#111827;">
                  ${p.persons} ${p.persons === 1 ? "person" : "people"}
                </td>
              </tr>
              <tr><td colspan="2" style="height:8px;"></td></tr>
              <tr>
                <td style="font-size:13px;color:#6b7280;">👤 Customer</td>
                <td style="font-size:14px;font-weight:600;color:#111827;">${customer}</td>
              </tr>
              <tr><td colspan="2" style="height:8px;"></td></tr>
              <tr>
                <td style="font-size:13px;color:#6b7280;">📞 Phone</td>
                <td style="font-size:14px;font-weight:600;color:#111827;">${phone}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td align="center"
            style="font-size:13px;color:#9ca3af;padding-bottom:8px;">
      Open the admin dashboard in the Pixap app for outreach options.
    </td></tr>
  `;

  return baseLayout(content);
}

export function formatBookingDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  });
}
