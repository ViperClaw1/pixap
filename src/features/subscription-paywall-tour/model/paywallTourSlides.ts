import type { ImageSource } from "expo-image";

export type PaywallTourSlide = {
  id: string;
  image: ImageSource;
  titleKey: string;
  descriptionKey: string;
};

export const PAYWALL_TOUR_SLIDES: PaywallTourSlide[] = [
  {
    id: "smart-booking-city",
    image: require("../../../../assets/onboarding/pixai-features/smart-booking-city.png"),
    titleKey: "subscriptionPaywall.tour.slides.smartBookingCity.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingCity.description",
  },
  {
    id: "smart-booking-scope",
    image: require("../../../../assets/onboarding/pixai-features/smart-booking-scope.png"),
    titleKey: "subscriptionPaywall.tour.slides.smartBookingScope.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingScope.description",
  },
  {
    id: "smart-booking-assistant",
    image: require("../../../../assets/onboarding/pixai-features/smart-booking-assistant.png"),
    titleKey: "subscriptionPaywall.tour.slides.smartBookingAssistant.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingAssistant.description",
  },
  {
    id: "smart-booking-slots",
    image: require("../../../../assets/onboarding/pixai-features/smart-booking-slots.png"),
    titleKey: "subscriptionPaywall.tour.slides.smartBookingSlots.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingSlots.description",
  },
  {
    id: "smart-booking-details",
    image: require("../../../../assets/onboarding/pixai-features/smart-booking-details.png"),
    titleKey: "subscriptionPaywall.tour.slides.smartBookingDetails.title",
    descriptionKey: "subscriptionPaywall.tour.slides.smartBookingDetails.description",
  },
  {
    id: "vibe-match-mood",
    image: require("../../../../assets/onboarding/pixai-features/vibe-match-mood.png"),
    titleKey: "subscriptionPaywall.tour.slides.vibeMatchMood.title",
    descriptionKey: "subscriptionPaywall.tour.slides.vibeMatchMood.description",
  },
  {
    id: "vibe-match-route",
    image: require("../../../../assets/onboarding/pixai-features/vibe-match-route.png"),
    titleKey: "subscriptionPaywall.tour.slides.vibeMatchRoute.title",
    descriptionKey: "subscriptionPaywall.tour.slides.vibeMatchRoute.description",
  },
];
