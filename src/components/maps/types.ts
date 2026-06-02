import type { TravelMode } from "@/shared/lib/directionsApi";
import type { LatLng } from "@/shared/lib/polylineDecode";

export type RouteMapPoint = {
  venueId: string;
  order: number;
  latitude: number;
  longitude: number;
};

export type VibeRouteMapInteractiveProps = {
  points: RouteMapPoint[];
  polylineCoords: LatLng[];
  travelMode: TravelMode;
  accentColor: string;
  labelColor: string;
  /** Highlights a stop marker (e.g. focused venue). */
  highlightedVenueId?: string | null;
  onMarkerPress?: (venueId: string) => void;
};
