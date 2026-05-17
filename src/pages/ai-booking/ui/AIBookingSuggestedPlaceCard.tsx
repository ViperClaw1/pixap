import { memo } from "react";
import { PixelRatio, Pressable, Text, View } from "react-native";
import type { PixAIPlace } from "@/entities/pixai";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getLatestBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import type { AIBookingStyles } from "./aiBookingStyles";

const THUMB_SIZE = 74;

function placeThumbUris(images: unknown): { uri: string | null; fallbackUri: string | null } {
  const fallbackUri = getLatestBusinessCardImage(images);
  if (!fallbackUri) return { uri: null, fallbackUri: null };
  const dpr = Math.min(2, PixelRatio.get());
  const edge = Math.round(THUMB_SIZE * dpr);
  const uri = getOptimizedImageUrl(fallbackUri, edge, edge, 72) || fallbackUri;
  return { uri, fallbackUri };
}

type Props = {
  styles: AIBookingStyles;
  place: PixAIPlace;
  selected: boolean;
  onSelect: (place: PixAIPlace) => void;
};

function AIBookingSuggestedPlaceCardInner({ styles: s, place, selected, onSelect }: Props) {
  const { uri, fallbackUri } = placeThumbUris(place.images);

  return (
    <Pressable
      onPress={() => onSelect(place)}
      style={[s.placeCard, selected && s.placeCardSelected]}
    >
      <View style={s.placeRow}>
        <SmartImage
          uri={uri}
          fallbackUri={fallbackUri}
          bundledFallback={PLACE_IMAGE_FALLBACK}
          recyclingKey={`${place.id}-thumb`}
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
  );
}

export const AIBookingSuggestedPlaceCard = memo(AIBookingSuggestedPlaceCardInner);
