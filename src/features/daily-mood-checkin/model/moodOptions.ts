import type { DailyMoodEnergyLevel, DailyMoodTag } from "@/entities/daily-mood-checkin";

export type DailyMoodOption = {
  tag: DailyMoodTag;
  icon: string;
  labelKey: string;
  fallbackLabel: string;
};

export const DAILY_MOOD_OPTIONS: DailyMoodOption[] = [
  { tag: "energetic", icon: "flash", labelKey: "dailyMoodCheckin.moods.energetic", fallbackLabel: "Energetic" },
  { tag: "chill", icon: "leaf", labelKey: "dailyMoodCheckin.moods.chill", fallbackLabel: "Chill" },
  { tag: "romantic", icon: "heart", labelKey: "dailyMoodCheckin.moods.romantic", fallbackLabel: "Romantic" },
  { tag: "social", icon: "people", labelKey: "dailyMoodCheckin.moods.social", fallbackLabel: "Social" },
  { tag: "solo", icon: "person", labelKey: "dailyMoodCheckin.moods.solo", fallbackLabel: "Solo" },
  { tag: "curious", icon: "sparkles", labelKey: "dailyMoodCheckin.moods.curious", fallbackLabel: "Curious" },
];

export const DAILY_MOOD_ENERGY_LEVELS: DailyMoodEnergyLevel[] = [1, 2, 3, 4, 5];
