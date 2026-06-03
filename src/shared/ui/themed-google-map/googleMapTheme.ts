import { useMemo } from "react";
import { useAppTheme } from "@/app/providers/ThemeProvider";

type GoogleMapStyle = Array<{
  elementType?: string;
  featureType?: string;
  stylers: Array<Record<string, string | number | boolean>>;
}>;

const GOOGLE_MAP_DARK_STYLE: GoogleMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#d1d5db" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#374151" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#f3f4f6" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#172033" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#223047" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#123525" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#86efac" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#374151" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#111827" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#e5e7eb" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4b5563" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2937" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#bfdbfe" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f2742" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#93c5fd" }] },
];

export function useThemedGoogleMapStyle() {
  const { isDark } = useAppTheme();

  return useMemo(() => (isDark ? GOOGLE_MAP_DARK_STYLE : undefined), [isDark]);
}
