import { useCallback } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { PixAIPlace } from "@/entities/pixai";
import type { AIBookingStyles } from "./aiBookingStyles";
import { AIBookingSuggestedPlaceCard } from "./AIBookingSuggestedPlaceCard";

type Props = {
  styles: AIBookingStyles;
  places: PixAIPlace[];
  selectedPlace: PixAIPlace | null;
  onSelectPlace: (place: PixAIPlace) => void;
};

export function AIBookingSuggestedPlaces({ styles: s, places, selectedPlace, onSelectPlace }: Props) {
  const { t } = useTranslation();
  const onSelect = useCallback((place: PixAIPlace) => onSelectPlace(place), [onSelectPlace]);

  return (
    <View style={s.semanticSection}>
      <Text style={s.label}>{t("aiBooking.step4PlacesTitle")}</Text>
      {places.map((place) => (
        <AIBookingSuggestedPlaceCard
          key={place.id}
          styles={s}
          place={place}
          selected={selectedPlace?.id === place.id}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}
