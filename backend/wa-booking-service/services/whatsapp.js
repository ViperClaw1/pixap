const WA_GRAPH_BASE = (process.env.WHATSAPP_GRAPH_BASE_URL || "https://graph.facebook.com").replace(/\/$/, "");
const WA_GRAPH_VERSION = (process.env.WHATSAPP_GRAPH_VERSION || "v22.0").trim();

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

function templateHeaderImageUrl(templateId) {
  const specific = process.env[`WHATSAPP_TEMPLATE_${String(templateId).toUpperCase()}_HEADER_IMAGE_URL`];
  if (specific && String(specific).trim()) return String(specific).trim();
  const byName =
    String(templateId) === "check_availability" ? process.env.WHATSAPP_CHECK_AVAILABILITY_HEADER_IMAGE_URL : undefined;
  if (byName && String(byName).trim()) return String(byName).trim();
  const fallback = process.env.WHATSAPP_TEMPLATE_HEADER_IMAGE_URL;
  return fallback && String(fallback).trim() ? String(fallback).trim() : undefined;
}

function templateRequiresImageHeader(templateId) {
  return String(templateId) === "check_availability";
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
      ...logMeta,
      timestamp: new Date().toISOString(),
    }),
  );
  return {
    message_id: bodyJson?.messages?.[0]?.id || null,
    response: bodyJson,
  };
}

async function sendWhatsAppTemplate(phone, templateId, variables = []) {
  const to = normalizeRecipient(phone);
  const bodyComponent = buildTemplateComponents(variables)?.[0];
  const headerImageUrl = templateHeaderImageUrl(templateId);
  if (templateRequiresImageHeader(templateId) && !headerImageUrl) {
    throw new Error(
      `Missing image header URL for template "${templateId}". Set WHATSAPP_CHECK_AVAILABILITY_HEADER_IMAGE_URL or WHATSAPP_TEMPLATE_${String(templateId).toUpperCase()}_HEADER_IMAGE_URL.`,
    );
  }
  const headerComponent = buildHeaderImageComponent(headerImageUrl);
  const components = [headerComponent, bodyComponent].filter(Boolean);
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: String(templateId),
      language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en" },
      ...(components.length > 0 ? { components } : {}),
    },
  };
  return await postWhatsAppMessage(payload, {
    action: "send_template",
    phone: to,
    template_id: templateId,
    variables,
  });
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
};
