import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { BusinessCard } from "@/entities/business-card";

type Props = {
  places: BusinessCard[];
  onMarkerPress: (id: string) => void;
};

function isValidCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function SearchMapView({ places, onMarkerPress }: Props) {
  const mappable = useMemo(
    () => places.filter((p) => isValidCoord(p.latitude) && isValidCoord(p.longitude)),
    [places],
  );

  const initialRegion = useMemo(() => {
    if (mappable.length === 0) {
      return {
        latitude: 25.2048,
        longitude: 55.2708,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      };
    }
    const latitudes = mappable.map((p) => p.latitude as number);
    const longitudes = mappable.map((p) => p.longitude as number);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latitude = (minLat + maxLat) / 2;
    const longitude = (minLng + maxLng) / 2;
    const latitudeDelta = Math.max(0.04, (maxLat - minLat) * 1.4 + 0.02);
    const longitudeDelta = Math.max(0.04, (maxLng - minLng) * 1.4 + 0.02);
    return { latitude, longitude, latitudeDelta, longitudeDelta };
  }, [mappable]);

  if (mappable.length === 0) {
    return <View style={styles.empty} />;
  }

  return (
    <MapView style={styles.map} initialRegion={initialRegion}>
      {mappable.map((place) => (
        <Marker
          key={place.id}
          coordinate={{
            latitude: place.latitude as number,
            longitude: place.longitude as number,
          }}
          title={place.name}
          onPress={() => onMarkerPress(place.id)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, minHeight: 360, borderRadius: 16, overflow: "hidden" },
  empty: { flex: 1, minHeight: 120 },
});
