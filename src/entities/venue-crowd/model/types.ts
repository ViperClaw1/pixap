export type CrowdLevel = "empty" | "low" | "medium" | "busy" | "packed";

export type VenueLiveCrowd = {
  crowd_score: number;
  crowd_level: CrowdLevel;
  checkins_last_hour: number;
  active_bookings: number;
  stories_velocity: number;
};

export type RecordVenueCheckinResult = {
  recorded: boolean;
  reason?: string;
  distance_m?: number;
};

export type LatLng = {
  latitude: number;
  longitude: number;
};
