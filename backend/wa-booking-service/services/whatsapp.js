const WA_GRAPH_BASE = (process.env.WHATSAPP_GRAPH_BASE_URL || "https://graph.facebook.com").replace(/\/$/, "");
const WA_GRAPH_VERSION = (process.env.WHATSAPP_GRAPH_VERSION || "v22.0").trim();
const WA_TEMPLATE_LANGUAGE = (process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US").trim();

const {
  templateUsesDynamicImageHeader,
  resolveTemplateHeaderImageUrl,
  normalizeMediaUrlForWhatsApp,
  missingHeaderEnvHint,
  FLOW_TEMPLATE_IDS,
} = require("./whatsappHeaderImage");

function waTemplateLanguageCode(interfaceLocale) {
  if (interfaceLocale === "ru") {
    return (process.env.WHATSAPP_TEMPLATE_LANGUAGE_RU || "ru").trim() || "ru";
  }
  return (process.env.WHATSAPP_TEMPLATE_LANGUAGE_EN || process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en")
    .trim() || "en";
}

/** Meta `language.code` must match the locale the template was approved under (suffix `_rus` / `_eng`). */
function waTemplateLanguageCodeForTemplate(templateId, interfaceLocale) {
  const id = String(templateId || "").trim();
  if (id.endsWith("_rus")) {
    return (process.env.WHATSAPP_TEMPLATE_LANGUAGE_RU || "ru").trim() || "ru";
  }
  if (id.endsWith("_eng")) {
    return (
      process.env.WHATSAPP_TEMPLATE_LANGUAGE_EN ||
      process.env.WHATSAPP_TEMPLATE_LANGUAGE ||
      "en"
    )
      .trim() || "en";
  }
  return waTemplateLanguageCode(interfaceLocale);
}

function requireEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function normalizeRecipient(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) throw new Error("Invalid recipient phone number");
  return digits;
}

function buildTemplateComponents(variables) {
  if (!Array.isArray(variables) || variables.length === 0) return undefined;
  return [
    {
      type: "body",
      parameters: variables.map((value) => ({
        type: "text",
        text: String(value ?? ""),
      })),
    },
  ];
}

function buildHeaderImageComponent(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url) return undefined;
  return {
    type: "header",
    parameters: [
      {
        type: "image",
        image: { link: url },
      },
    ],
  };
}

/** @deprecated Use resolveTemplateHeaderImageUrl — kept for /health and tests. */
function templateHeaderImageUrl(templateId) {
  return resolveTemplateHeaderImageUrl(templateId);
}

async function validateHeaderImageUrl(imageUrl) {
  const raw = String(imageUrl || "").trim();
  const url = normalizeMediaUrlForWhatsApp(raw);
  if (!url) return { ok: false, reason: "empty_url" };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "https_required" };
  }

  const skipVerify =
    process.env.WHATSAPP_SKIP_HEADER_IMAGE_VERIFY === "1" ||
    process.env.WHATSAPP_SKIP_HEADER_IMAGE_VERIFY === "true";
  if (skipVerify) {
    return { ok: true, skipped: true, normalized_url: url !== raw ? url : undefined };
  }

  const probe = async (method) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), 8000);
    try {
      return await fetch(url, { method, signal: controller.signal, redirect: "follow" });
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    let res = await probe("HEAD");
    if (res.status === 405 || res.status === 501 || res.status === 400) {
      res = await probe("GET");
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: `http_${res.status}`,
        content_type: res.headers.get("content-type"),
        normalized_url: url !== raw ? url : undefined,
        hint:
          parsed.hostname.includes("supabase.co") && !url.includes("/object/public/")
            ? "Use a public Supabase Storage URL (.../object/public/<bucket>/<file>) or set WHATSAPP_HEADER_LOGO_URL to a direct image CDN link."
            : undefined,
      };
    }
    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (contentType && !contentType.startsWith("image/")) {
      return {
        ok: false,
        reason: "not_image",
        content_type: contentType,
        normalized_url: url !== raw ? url : undefined,
      };
    }
    return { ok: true, content_type: contentType || null, normalized_url: url !== raw ? url : undefined };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function postWhatsAppMessage(payload, logMeta) {
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const url = `${WA_GRAPH_BASE}/${WA_GRAPH_VERSION}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  let bodyJson = null;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    bodyJson = null;
  }

  if (!response.ok) {
    console.error(
      JSON.stringify({
        scope: "whatsapp",
        action: "meta_send_failed",
        status: response.status,
        url,
        response: bodyJson || bodyText,
        ...logMeta,
        timestamp: new Date().toISOString(),
      }),
    );
    throw new Error(`WhatsApp API error ${response.status}: ${bodyText.slice(0, 500)}`);
  }

  console.log(
    JSON.stringify({
      scope: "whatsapp",
      action: "meta_send_ok",
      status: response.status,
      message_id: bodyJson?.messages?.[0]?.id || null,
      message_status: bodyJson?.messages?.[0]?.message_status || null,
      recipient_wa_id: bodyJson?.contacts?.[0]?.wa_id || null,
      ...logMeta,
      timestamp: new Date().toISOString(),
    }),
  );
  return {
    message_id: bodyJson?.messages?.[0]?.id || null,
    response: bodyJson,
  };
}

async function sendWhatsAppTemplate(phone, templateId, variables = [], languageCode) {
  const to = normalizeRecipient(phone);
  const bodyComponent = buildTemplateComponents(variables)?.[0];
  const needsHeader = templateUsesDynamicImageHeader(templateId);
  const headerImageUrl = resolveTemplateHeaderImageUrl(templateId);

  if (needsHeader && !headerImageUrl) {
    throw new Error(missingHeaderEnvHint(templateId));
  }

  let effectiveHeaderUrl = headerImageUrl;
  if (needsHeader && headerImageUrl) {
    const check = await validateHeaderImageUrl(headerImageUrl);
    if (!check.ok) {
      console.error(
        JSON.stringify({
          scope: "whatsapp",
          action: "header_image_precheck_failed",
          template_id: templateId,
          header_image_url: headerImageUrl,
          check,
          timestamp: new Date().toISOString(),
        }),
      );
      throw new Error(
        `Header image URL not usable for template "${templateId}": ${check.reason}${check.content_type ? ` (${check.content_type})` : ""}.${check.hint ? ` ${check.hint}` : ""}`,
      );
    }
    if (check.normalized_url) {
      effectiveHeaderUrl = check.normalized_url;
    }
  }

  const headerComponent = needsHeader ? buildHeaderImageComponent(effectiveHeaderUrl) : undefined;
  const components = [headerComponent, bodyComponent].filter(Boolean);
  const lang =
    typeof languageCode === "string" && languageCode.trim()
      ? languageCode.trim()
      : WA_TEMPLATE_LANGUAGE;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: String(templateId),
      language: { code: lang },
      ...(components.length > 0 ? { components } : {}),
    },
  };
  const sent = await postWhatsAppMessage(payload, {
    action: "send_template",
    phone: to,
    template_id: templateId,
    variables,
    header_mode: needsHeader ? "dynamic_url" : "static_in_meta_template",
    header_image_url: effectiveHeaderUrl || null,
    language_code: lang,
  });
  return {
    ...sent,
    header_image_url: effectiveHeaderUrl || null,
    template_id: templateId,
    language_code: lang,
  };
}

async function sendWhatsAppMessage(phone, text) {
  const to = normalizeRecipient(phone);
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: String(text || "") },
  };
  return await postWhatsAppMessage(payload, {
    action: "send_message",
    phone: to,
    text,
  });
}

module.exports = {
  sendWhatsAppTemplate,
  sendWhatsAppMessage,
  templateHeaderImageUrl,
  resolveTemplateHeaderImageUrl,
  validateHeaderImageUrl,
  waTemplateLanguageCode,
  waTemplateLanguageCodeForTemplate,
  templateUsesDynamicImageHeader,
  FLOW_TEMPLATE_IDS,
};
