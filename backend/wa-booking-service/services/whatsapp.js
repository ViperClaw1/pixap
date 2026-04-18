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
  sendWhatsAppMessage,
};
