import * as Location from "expo-location";
import { ALL_CITIES_OPTION } from "@/entities/business-card";

type Coords = { lat: number; lng: number };

export type ResolvedPixAIBookingCity = {
  city: string;
  coords: Coords | null;
  source: "selected" | "geolocation" | "all";
};

function normalizeCity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function matchAvailableCity(candidates: Array<string | null>, availableCities: string[]): string {
  const normalizedCandidates = candidates
    .map((candidate) => normalizeCity(candidate ?? ""))
    .filter(Boolean);

  return (
    availableCities.find((availableCity) => {
      if (availableCity === ALL_CITIES_OPTION) return false;
      const normalizedAvailable = normalizeCity(availableCity);
      const cityName = normalizedAvailable.split(",")[0]!.trim();
      return normalizedCandidates.some(
        (candidate) => candidate === normalizedAvailable || candidate === cityName,
      );
    }) ?? ""
  );
}

export async function resolvePixAIBookingCity(input: {
  selectedCity: string;
  availableCities: string[];
  coords?: Coords | null;
}): Promise<ResolvedPixAIBookingCity> {
  const selectedCity = input.selectedCity.trim();
  if (selectedCity && selectedCity !== ALL_CITIES_OPTION) {
    return { city: selectedCity, coords: input.coords ?? null, source: "selected" };
  }

  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      return { city: "", coords: null, source: "all" };
    }

    const coords =
      input.coords ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
        ({ coords: current }) => ({ lat: current.latitude, lng: current.longitude }),
      ));
    const [address] = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lng,
    });
    const city = matchAvailableCity(
      [address?.city ?? null, address?.district ?? null, address?.subregion ?? null, address?.region ?? null],
      input.availableCities,
    );
    return city
      ? { city, coords, source: "geolocation" }
      : { city: "", coords, source: "all" };
  } catch {
    return { city: "", coords: null, source: "all" };
  }
}
