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
}

async function sendWhatsAppTemplate(phone, templateId, variables = []) {
  const to = normalizeRecipient(phone);
  const components = buildTemplateComponents(variables);
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: String(templateId),
      language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US" },
      ...(components ? { components } : {}),
    },
  };
  await postWhatsAppMessage(payload, {
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
  await postWhatsAppMessage(payload, {
    action: "send_message",
    phone: to,
    text,
  });
}

module.exports = {
  sendWhatsAppTemplate,
  sendWhatsAppMessage,
};
