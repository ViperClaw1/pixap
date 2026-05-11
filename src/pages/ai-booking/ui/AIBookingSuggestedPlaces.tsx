import { Pressable, Text, View } from "react-native";
import type { PixAIPlace } from "@/entities/pixai";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getLatestBusinessCardImage } from "@/lib/businessCardImages";
import type { AIBookingStyles } from "./aiBookingStyles";

type Props = {
  styles: AIBookingStyles;
  places: PixAIPlace[];
  selectedPlace: PixAIPlace | null;
  onSelectPlace: (place: PixAIPlace) => void;
};

export function AIBookingSuggestedPlaces({ styles: s, places, selectedPlace, onSelectPlace }: Props) {
  return (
    <View style={s.semanticSection}>
      <Text style={s.label}>Step 4. Suggested places</Text>
      {places.map((place) => (
        <Pressable
          key={place.id}
          onPress={() => onSelectPlace(place)}
          style={[s.placeCard, selectedPlace?.id === place.id && s.placeCardSelected]}
        >
          <View style={s.placeRow}>
            <SmartImage
              uri={getLatestBusinessCardImage(place.images)}
              recyclingKey={place.id}
              style={s.placeThumb}
              contentFit="cover"
            />
            <View style={s.placeTextCol}>
              <Text style={s.placeName} numberOfLines={2}>
                {place.name}
              </Text>
              <Text style={s.placeMeta} numberOfLines={2}>
                {place.city ?? "City not set"} • {place.address ?? "No address"} • {Number(place.rating).toFixed(1)}★
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
