import type { TFunction } from "i18next";
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

export type PaywallPlanFeature = {
  id: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  iconBackground: string;
  label: string;
};

const CREDITS = {
  iconColor: "#22c55e",
  iconBackground: "rgba(34,197,94,0.18)",
} as const;

const AI_BOOKING = {
  iconColor: "#ec6544",
  iconBackground: "rgba(236,101,68,0.18)",
} as const;

const VIBE_MATCH = {
  iconColor: "#a855f7",
  iconBackground: "rgba(168,85,247,0.18)",
} as const;

const POST_BOOST = {
  iconColor: "#f59e0b",
  iconBackground: "rgba(245,158,11,0.2)",
} as const;

const FAST_BOOKING = {
  iconColor: "#3b82f6",
  iconBackground: "rgba(59,130,246,0.18)",
} as const;

export function getWeeklyPlanFeatures(t: TFunction): PaywallPlanFeature[] {
  return [
    {
      id: "credits",
      icon: "ticket-outline",
      ...CREDITS,
      label: t("subscriptionPaywall.weeklyCredits"),
    },
    {
      id: "aiBooking",
      icon: "sparkles-outline",
      ...AI_BOOKING,
      label: t("subscriptionPaywall.featureAiBooking"),
    },
    {
      id: "vibeMatch",
      icon: "heart-outline",
      ...VIBE_MATCH,
      label: t("subscriptionPaywall.featureVibeMatch"),
    },
  ];
}

export function getMonthlyPlanFeatures(t: TFunction): PaywallPlanFeature[] {
  return [
    {
      id: "credits",
      icon: "ticket-outline",
      ...CREDITS,
      label: t("subscriptionPaywall.monthlyCredits"),
    },
    {
      id: "aiBooking",
      icon: "sparkles-outline",
      ...AI_BOOKING,
      label: t("subscriptionPaywall.featureAiBooking"),
    },
    {
      id: "vibeMatch",
      icon: "heart-outline",
      ...VIBE_MATCH,
      label: t("subscriptionPaywall.featureVibeMatch"),
    },
    {
      id: "fastBooking",
      icon: "flash-outline",
      ...FAST_BOOKING,
      label: t("subscriptionPaywall.featureFastBooking"),
    },
  ];
}

export function getAnnualPlanFeatures(t: TFunction): PaywallPlanFeature[] {
  return [
    {
      id: "credits",
      icon: "ticket-outline",
      ...CREDITS,
      label: t("subscriptionPaywall.annualCredits"),
    },
    {
      id: "aiBooking",
      icon: "sparkles-outline",
      ...AI_BOOKING,
      label: t("subscriptionPaywall.featureAiBooking"),
    },
    {
      id: "vibeMatch",
      icon: "heart-outline",
      ...VIBE_MATCH,
      label: t("subscriptionPaywall.featureVibeMatch"),
    },
    {
      id: "postBoost",
      icon: "rocket-outline",
      ...POST_BOOST,
      label: t("subscriptionPaywall.featurePostBoost"),
    },
    {
      id: "fastBooking",
      icon: "flash-outline",
      ...FAST_BOOKING,
      label: t("subscriptionPaywall.featureFastBooking"),
    },
  ];
}
