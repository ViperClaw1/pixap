import { useCallback, useMemo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { PixAIPlace } from "@/entities/pixai";
import type { AIBookingStyles } from "./aiBookingStyles";
import { AIBookingSuggestedPlaceCard } from "./AIBookingSuggestedPlaceCard";

type Props = {
  styles: AIBookingStyles;
  places: PixAIPlace[];
  selectedPlace: PixAIPlace | null;
  personsCount: number;
  bookingTimeLabel?: string | null;
  onBook: (place: PixAIPlace) => void;
};

export function AIBookingSuggestedPlaces({
  styles: s,
  places,
  selectedPlace,
  personsCount,
  bookingTimeLabel,
  onBook,
}: Props) {
  const { t } = useTranslation();
  const onBookPlace = useCallback((place: PixAIPlace) => onBook(place), [onBook]);
  const personsLabel = useMemo(() => t("bookings.persons", { count: personsCount }), [personsCount, t]);

  return (
    <View style={s.semanticSection}>
      <Text style={s.label}>{t("aiBooking.step1PlacesTitle")}</Text>
      {places.map((place) => (
        <AIBookingSuggestedPlaceCard
          key={place.id}
          styles={s}
          place={place}
          selected={selectedPlace?.id === place.id}
          personsLabel={personsLabel}
          bookingTimeLabel={bookingTimeLabel}
          onBook={onBookPlace}
        />
      ))}
    </View>
  );
}
