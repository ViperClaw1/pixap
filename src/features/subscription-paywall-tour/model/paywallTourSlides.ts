import type { ImageSource } from "expo-image";

export type PaywallTourSlideId =
  | "smart-booking-city"
  | "smart-booking-category"
  | "smart-booking-scope"
  | "smart-booking-assistant"
  | "smart-booking-slots"
  | "smart-booking-details"
  | "vibe-match-mood"
  | "vibe-match-route";

export type PaywallTourLocale = "en" | "ru" | "es" | "fr" | "de" | "pt";

export type PaywallTourSlide = {
  id: PaywallTourSlideId;
  image: ImageSource;
  titleKey: string;
  descriptionKey: string;
};

const SLIDE_DEFS: Array<Pick<PaywallTourSlide, "id" | "titleKey" | "descriptionKey">> = [
  {
    id: "smart-booking-city",
    titleKey: "subscriptionPaywall.tour.slides.smartBookingCity.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingCity.description",
  },
  {
    id: "smart-booking-category",
    titleKey: "subscriptionPaywall.tour.slides.smartBookingCategory.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingCategory.description",
  },
  {
    id: "smart-booking-scope",
    titleKey: "subscriptionPaywall.tour.slides.smartBookingScope.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingScope.description",
  },
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
    id: "smart-booking-details",
    titleKey: "subscriptionPaywall.tour.slides.smartBookingDetails.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingDetails.description",
  },
  {
    id: "vibe-match-mood",
    titleKey: "subscriptionPaywall.tour.slides.vibeMatchMood.title",
    descriptionKey: "subscriptionPaywall.tour.slides.vibeMatchMood.description",
  },
  {
    id: "vibe-match-route",
    titleKey: "subscriptionPaywall.tour.slides.vibeMatchRoute.title",
    descriptionKey: "subscriptionPaywall.tour.slides.vibeMatchRoute.description",
  },
];

const TOUR_IMAGES_EN: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-city": require("../../../../assets/onboarding/pixai-features/smart-booking-city.png"),
  "smart-booking-category": require("../../../../assets/onboarding/pixai-features/smart-booking-category.png"),
  "smart-booking-scope": require("../../../../assets/onboarding/pixai-features/smart-booking-scope.png"),
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/smart-booking-slots.png"),
  "smart-booking-details": require("../../../../assets/onboarding/pixai-features/smart-booking-details.png"),
  "vibe-match-mood": require("../../../../assets/onboarding/pixai-features/vibe-match-mood.png"),
  "vibe-match-route": require("../../../../assets/onboarding/pixai-features/vibe-match-route.png"),
};

const TOUR_IMAGES_RU: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-city": require("../../../../assets/onboarding/pixai-features/ru/smart-booking-city.png"),
  "smart-booking-category": require("../../../../assets/onboarding/pixai-features/ru/smart-booking-category.png"),
  "smart-booking-scope": require("../../../../assets/onboarding/pixai-features/ru/smart-booking-scope.png"),
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/ru/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/ru/smart-booking-slots.png"),
  "smart-booking-details": require("../../../../assets/onboarding/pixai-features/ru/smart-booking-details.png"),
  "vibe-match-mood": require("../../../../assets/onboarding/pixai-features/ru/vibe-match-mood.png"),
  "vibe-match-route": require("../../../../assets/onboarding/pixai-features/ru/vibe-match-route.png"),
};

const TOUR_IMAGES_ES: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-city": require("../../../../assets/onboarding/pixai-features/es/smart-booking-city.png"),
  "smart-booking-category": require("../../../../assets/onboarding/pixai-features/es/smart-booking-category.png"),
  "smart-booking-scope": require("../../../../assets/onboarding/pixai-features/es/smart-booking-scope.png"),
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/es/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/es/smart-booking-slots.png"),
  "smart-booking-details": require("../../../../assets/onboarding/pixai-features/es/smart-booking-details.png"),
  "vibe-match-mood": require("../../../../assets/onboarding/pixai-features/es/vibe-match-mood.png"),
  "vibe-match-route": require("../../../../assets/onboarding/pixai-features/es/vibe-match-route.png"),
};

const TOUR_IMAGES_FR: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-city": require("../../../../assets/onboarding/pixai-features/fr/smart-booking-city.png"),
  "smart-booking-category": require("../../../../assets/onboarding/pixai-features/fr/smart-booking-category.png"),
  "smart-booking-scope": require("../../../../assets/onboarding/pixai-features/fr/smart-booking-scope.png"),
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/fr/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/fr/smart-booking-slots.png"),
  "smart-booking-details": require("../../../../assets/onboarding/pixai-features/fr/smart-booking-details.png"),
  "vibe-match-mood": require("../../../../assets/onboarding/pixai-features/fr/vibe-match-mood.png"),
  "vibe-match-route": require("../../../../assets/onboarding/pixai-features/fr/vibe-match-route.png"),
};

const TOUR_IMAGES_DE: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-city": require("../../../../assets/onboarding/pixai-features/de/smart-booking-city.png"),
  "smart-booking-category": require("../../../../assets/onboarding/pixai-features/de/smart-booking-category.png"),
  "smart-booking-scope": require("../../../../assets/onboarding/pixai-features/de/smart-booking-scope.png"),
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/de/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/de/smart-booking-slots.png"),
  "smart-booking-details": require("../../../../assets/onboarding/pixai-features/de/smart-booking-details.png"),
  "vibe-match-mood": require("../../../../assets/onboarding/pixai-features/de/vibe-match-mood.png"),
  "vibe-match-route": require("../../../../assets/onboarding/pixai-features/de/vibe-match-route.png"),
};

const TOUR_IMAGES_PT: Record<PaywallTourSlideId, ImageSource> = {
  "smart-booking-city": require("../../../../assets/onboarding/pixai-features/pt/smart-booking-city.png"),
  "smart-booking-category": require("../../../../assets/onboarding/pixai-features/pt/smart-booking-category.png"),
  "smart-booking-scope": require("../../../../assets/onboarding/pixai-features/pt/smart-booking-scope.png"),
  "smart-booking-assistant": require("../../../../assets/onboarding/pixai-features/pt/smart-booking-assistant.png"),
  "smart-booking-slots": require("../../../../assets/onboarding/pixai-features/pt/smart-booking-slots.png"),
  "smart-booking-details": require("../../../../assets/onboarding/pixai-features/pt/smart-booking-details.png"),
  "vibe-match-mood": require("../../../../assets/onboarding/pixai-features/pt/vibe-match-mood.png"),
  "vibe-match-route": require("../../../../assets/onboarding/pixai-features/pt/vibe-match-route.png"),
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
