const ANDROID_PACKAGE = Deno.env.get("PIXAP_ANDROID_PACKAGE")?.trim() || "com.pixap.pixap";
const ANDROID_SHA256 = Deno.env.get("PIXAP_ANDROID_SHA256")?.trim() || "CC:CA:D9:5B:0B:86:17:31:44:A7:6D:E3:55:6D:0B:80:3B:B5:87:16:DF:DF:1C:16:BB:FE:F2:82:E8:91:9F:EC";
const APP_STORE_URL = Deno.env.get("PIXAP_APP_STORE_URL")?.trim() || "https://apps.apple.com/app/pixap/id6760616898";
const PLAY_STORE_URL =
  Deno.env.get("PIXAP_PLAY_STORE_URL")?.trim() || "https://play.google.com/store/apps/details?id=com.pixap.pixap";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=3600",
};

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300",
};

function normalizePath(pathname: string): string {
  const withoutFunctionPrefix = pathname
    .replace(/^\/functions\/v1\/link-router(?=\/|$)/, "")
    .replace(/^\/link-router(?=\/|$)/, "");
  return withoutFunctionPrefix || "/";
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: JSON_HEADERS });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function entityTitle(entityType: string): string {
  if (entityType === "place") return "Открыть заведение в Pixap";
  if (entityType === "post") return "Открыть пост в Pixap";
  return "Открыть историю в Pixap";
}

function fallbackHtml(entityType: "place" | "post" | "story", entityId: string): string {
  const safeEntityType = escapeHtml(entityType);
  const decodedEntityId = safeDecodeURIComponent(entityId);
  const safeEntityId = escapeHtml(decodedEntityId);
  const deepLink = `pixap://${entityType}/${encodeURIComponent(decodedEntityId)}`;
  const title = entityTitle(entityType);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:site_name" content="Pixap" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0f0f0f;
      color: #fff;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }
    h1 { font-size: 28px; margin: 0 0 8px; }
    p { color: #aaa; margin: 0 0 28px; max-width: 360px; line-height: 1.5; }
    .btn {
      display: inline-block;
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
      margin: 8px;
    }
    .primary { background: #7c3aed; color: #fff; }
    .store { background: #1e1e1e; color: #fff; border: 1px solid #333; }
    .meta { margin-top: 16px; font-size: 12px; color: #666; }
  </style>
  <script>
    setTimeout(function () {
      window.location.href = "${deepLink}";
    }, 100);
  </script>
</head>
<body>
  <h1>Pixap</h1>
  <p>Установите Pixap, чтобы открыть эту ссылку.</p>
  <a class="btn primary" href="${deepLink}">Открыть в приложении</a>
  <div>
    <a class="btn store" href="${escapeHtml(APP_STORE_URL)}">App Store</a>
    <a class="btn store" href="${escapeHtml(PLAY_STORE_URL)}">Google Play</a>
  </div>
  <div class="meta">${safeEntityType}: ${safeEntityId}</div>
</body>
</html>`;
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const url = new URL(req.url);
  const path = normalizePath(url.pathname);

  if (path === "/.well-known/apple-app-site-association" || path === "/apple-app-site-association") {
    return new Response(null, {
      status: 301,
      headers: {
        Location: "https://pixapp.kz/.well-known/apple-app-site-association.json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (path === "/.well-known/assetlinks.json") {
    return json([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: [ANDROID_SHA256],
        },
      },
    ]);
  }

  const deepLinkMatch = path.match(/^\/(place|post|story)\/([^/]+)$/);
  if (deepLinkMatch?.[1] && deepLinkMatch[2]) {
    return new Response(fallbackHtml(deepLinkMatch[1] as "place" | "post" | "story", deepLinkMatch[2]), {
      headers: HTML_HEADERS,
    });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: APP_STORE_URL },
  });
});
