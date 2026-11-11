const crypto = require("crypto");

/**
 * Meta (Facebook / WhatsApp Cloud API) subscription verification — GET only.
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {boolean} true if a response was sent (Meta handshake or error)
 */
function handleMetaWebhookVerify(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode !== "subscribe" || challenge === undefined || challenge === "") {
    return false;
  }

  const expected = (
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    ""
  ).trim();

  if (!expected) {
    console.error(
      "[meta-webhook] META_WEBHOOK_VERIFY_TOKEN (or WHATSAPP_VERIFY_TOKEN) is not set — cannot complete Meta GET verification",
    );
    res.status(503).type("text/plain").send("Server misconfigured: verify token not set");
    return true;
  }

  if (token !== expected) {
    res.status(403).type("text/plain").send("Forbidden");
    return true;
  }

  res.status(200).type("text/plain").send(String(challenge));
  return true;
}

/**
 * Verifies Meta `X-Hub-Signature-256` (HMAC-SHA256 of raw body with the app secret).
 * Fails closed when META_APP_SECRET is unset.
 * @param {import("express").Request} req
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
function verifyMetaSignature(req) {
  const secret = (process.env.META_APP_SECRET || "").trim();
  if (!secret) {
    console.error("[meta-webhook] META_APP_SECRET is not set — rejecting Meta webhook POST");
    return { ok: false, status: 503, error: "Server misconfigured" };
  }
  const header = String(req.get("x-hub-signature-256") || "");
  if (!header.startsWith("sha256=") || !req.rawBody) {
    return { ok: false, status: 401, error: "Missing signature" };
  }
  const expected = Buffer.from(
    "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex"),
  );
  const received = Buffer.from(header);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return { ok: false, status: 401, error: "Invalid signature" };
  }
  return { ok: true };
}

module.exports = { handleMetaWebhookVerify, verifyMetaSignature };
