export type LinkPreviewData = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  resolvedUrl: string;
};

function absUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function pickMeta(html: string, baseUrl: string): LinkPreviewData {
  const og = (prop: string) => {
    const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
    const m = html.match(re);
    return m?.[1]?.trim() || null;
  };
  const ogName = (name: string) => {
    const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
    const m = html.match(re);
    return m?.[1]?.trim() || null;
  };

  let title = og("og:title") || ogName("twitter:title");
  if (!title) {
    const tm = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    title = tm?.[1]?.trim() || null;
  }
  let description = og("og:description") || ogName("twitter:description");
  if (!description) {
    const dm = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
    description = dm?.[1]?.trim() || null;
  }

  let imageUrl = og("og:image") || ogName("twitter:image") || ogName("twitter:image:src");
  if (imageUrl) {
    imageUrl = absUrl(baseUrl, imageUrl);
  }

  return {
    title,
    description,
    imageUrl,
    resolvedUrl: baseUrl,
  };
}

const FETCH_TIMEOUT_MS = 9000;

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return { title: null, description: null, imageUrl: null, resolvedUrl: url };
    }
    const html = await res.text();
    const finalUrl = res.url || url;
    return pickMeta(html, finalUrl);
  } finally {
    clearTimeout(t);
  }
}
