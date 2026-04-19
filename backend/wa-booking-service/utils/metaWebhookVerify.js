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

module.exports = { handleMetaWebhookVerify };
