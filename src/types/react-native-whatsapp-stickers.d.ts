declare module "react-native-whatsapp-stickers" {
  interface WhatsAppStickersModule {
    isWhatsAppAvailable?: () => Promise<boolean>;
    send?: (...args: unknown[]) => Promise<void>;
  }

  const WhatsAppStickers: WhatsAppStickersModule;
  export default WhatsAppStickers;
}
