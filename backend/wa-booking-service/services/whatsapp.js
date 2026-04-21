async function sendWhatsAppTemplate(phone, templateId, variables = []) {
  console.log(
    JSON.stringify({
      scope: "whatsapp",
      action: "send_template",
      phone,
      template_id: templateId,
      variables,
      timestamp: new Date().toISOString(),
    }),
  );
}

async function sendWhatsAppMessage(phone, text) {
  console.log(
    JSON.stringify({
      scope: "whatsapp",
      action: "send_message",
      phone,
      text,
      timestamp: new Date().toISOString(),
    }),
  );
}

module.exports = {
  sendWhatsAppTemplate,
  sendWhatsAppMessage,
};
