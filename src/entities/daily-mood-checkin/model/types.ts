export type DailyMoodTag =
  | "energetic"
  | "chill"
  | "romantic"
  | "social"
  | "solo"
  | "curious";

export type DailyMoodEnergyLevel = 1 | 2 | 3 | 4 | 5;

export type DailyMoodCheckin = {
  id: string;
  user_id: string;
  checkin_date: string;
  mood_tags: DailyMoodTag[];
  energy_level: DailyMoodEnergyLevel | null;
  detail_note: string | null;
  skipped: boolean;
  created_at: string;
  updated_at: string;
};

export type DailyMoodCheckinInput = {
  dateYmd: string;
  moodTags: DailyMoodTag[];
  energyLevel: DailyMoodEnergyLevel;
  detailNote?: string | null;
};
