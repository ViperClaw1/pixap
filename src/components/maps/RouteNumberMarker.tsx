import { memo, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

type Props = {
  venueId: string;
  order: number;
  latitude: number;
  longitude: number;
  accentColor: string;
  labelColor: string;
  highlighted?: boolean;
  onPress?: (venueId: string) => void;
};

export const RouteNumberMarker = memo(function RouteNumberMarker({
  venueId,
  order,
  latitude,
  longitude,
  accentColor,
  labelColor,
  highlighted = false,
  onPress,
}: Props) {
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  const [tracksViewChanges, setTracksViewChanges] = useState(Platform.OS === "android");

  useEffect(() => {
    if (Platform.OS !== "android") return;
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), 120);
    return () => clearTimeout(timer);
  }, [order, accentColor, labelColor, highlighted]);

  return (
    <Marker
      identifier={venueId}
      coordinate={coordinate}
      tracksViewChanges={Platform.OS === "android" ? tracksViewChanges : false}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress ? () => onPress(venueId) : undefined}
    >
      <View
        collapsable={false}
        style={[
          styles.bubble,
          {
            backgroundColor: accentColor,
            borderColor: highlighted ? "#ffffff" : accentColor,
          },
          highlighted && styles.bubbleHighlighted,
        ]}
      >
        <Text style={[styles.label, { color: labelColor }]}>{order}</Text>
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  bubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bubbleHighlighted: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    elevation: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
  },
});
