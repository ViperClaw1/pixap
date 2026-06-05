import type { ImageSource } from "expo-image";

export type PaywallTourSlideId =
  | "smart-booking-assistant"
  | "smart-booking-slots"
  | "smart-booking-confirm"
  | "vibe-matching";

export type PaywallTourLocale = "en" | "ru" | "es" | "fr" | "de" | "pt";

export type PaywallTourSlide = {
  id: PaywallTourSlideId;
  image: ImageSource;
  titleKey: string;
  descriptionKey: string;
};

const SLIDE_DEFS: Array<Pick<PaywallTourSlide, "id" | "titleKey" | "descriptionKey">> = [
  {
    id: "smart-booking-assistant",
    titleKey: "subscriptionPaywall.tour.slides.smartBookingAssistant.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingAssistant.description",
  },
  {
    id: "smart-booking-slots",
    titleKey: "subscriptionPaywall.tour.slides.smartBookingSlots.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingSlots.description",
  },
  {
    id: "smart-booking-confirm",
    titleKey: "subscriptionPaywall.tour.slides.smartBookingConfirm.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingConfirm.description",
  },
  {
    id: "vibe-matching",
    titleKey: "subscriptionPaywall.tour.slides.vibeMatching.title",
    descriptionKey: "subscriptionPaywall.tour.slides.vibeMatching.description",
  },
];

const TOUR_IMAGES_EN: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/smart-booking-slots.png"),
  "smart-booking-confirm": require("../../../../assets/onboarding/pixai-features/smart-booking-confirm.png"),
  "vibe-matching": require("../../../../assets/onboarding/pixai-features/vibe-matching.png"),
};

const TOUR_IMAGES_RU: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/ru/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/ru/smart-booking-slots.png"),
  "smart-booking-confirm": require("../../../../assets/onboarding/pixai-features/ru/smart-booking-confirm.png"),
  "vibe-matching": require("../../../../assets/onboarding/pixai-features/ru/vibe-matching.png"),
};

const TOUR_IMAGES_ES: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/es/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/es/smart-booking-slots.png"),
  "smart-booking-confirm": require("../../../../assets/onboarding/pixai-features/es/smart-booking-confirm.png"),
  "vibe-matching": require("../../../../assets/onboarding/pixai-features/es/vibe-matching.png"),
};

const TOUR_IMAGES_PT: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/pt/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/pt/smart-booking-slots.png"),
  "smart-booking-confirm": require("../../../../assets/onboarding/pixai-features/pt/smart-booking-confirm.png"),
  "vibe-matching": require("../../../../assets/onboarding/pixai-features/pt/vibe-matching.png"),
};

const TOUR_IMAGES_FR: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/fr/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/fr/smart-booking-slots.png"),
  "smart-booking-confirm": require("../../../../assets/onboarding/pixai-features/fr/smart-booking-confirm.png"),
  "vibe-matching": require("../../../../assets/onboarding/pixai-features/fr/vibe-matching.png"),
};

const TOUR_IMAGES_DE: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/de/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/de/smart-booking-slots.png"),
  "smart-booking-confirm": require("../../../../assets/onboarding/pixai-features/de/smart-booking-confirm.png"),
  "vibe-matching": require("../../../../assets/onboarding/pixai-features/de/vibe-matching.png"),
};

const TOUR_IMAGES_BY_LOCALE: Record<PaywallTourLocale, Record<PaywallTourSlideId, ImageSource>> = {
  en: TOUR_IMAGES_EN,
  ru: TOUR_IMAGES_RU,
  es: TOUR_IMAGES_ES,
  fr: TOUR_IMAGES_FR,
  de: TOUR_IMAGES_DE,
  pt: TOUR_IMAGES_PT,
};

export function resolvePaywallTourLocale(language: string): PaywallTourLocale {
  const base = language.split("-")[0]?.toLowerCase();
  if (base === "ru") return "ru";
  if (base === "es") return "es";
  if (base === "fr") return "fr";
  if (base === "de") return "de";
  if (base === "pt") return "pt";
  return "en";
}

export function getPaywallTourSlides(language: string): PaywallTourSlide[] {
  const images = TOUR_IMAGES_BY_LOCALE[resolvePaywallTourLocale(language)];
  return SLIDE_DEFS.map((slide) => ({
    ...slide,
    image: images[slide.id],
  }));
}
