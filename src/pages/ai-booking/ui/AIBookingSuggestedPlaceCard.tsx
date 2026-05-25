import { memo } from "react";
import { PixelRatio, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { PixAIPlace } from "@/entities/pixai";
import { PLACE_IMAGE_FALLBACK } from "@/shared/assets/placeImageFallback";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import type { AIBookingStyles } from "./aiBookingStyles";

const THUMB_SIZE = 74;

function placeThumbUris(images: unknown): { uri: string | null; fallbackUri: string | null } {
  const raw = getPrimaryBusinessCardImage(images);
  if (!raw) return { uri: null, fallbackUri: null };
  const edge = Math.round(THUMB_SIZE * Math.min(2, PixelRatio.get()));
  const uri = getBusinessCardDisplayUrl(raw, { layoutPx: edge, layoutPxHeight: edge });
  return { uri, fallbackUri: businessCardDisplayFallback(uri, raw) ?? null };
}

type Props = {
  styles: AIBookingStyles;
  place: PixAIPlace;
  selected: boolean;
  onSelect: (place: PixAIPlace) => void;
};

function AIBookingSuggestedPlaceCardInner({ styles: s, place, selected, onSelect }: Props) {
  const { t } = useTranslation();
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
            {place.city ?? t("bookingCommon.cityNotSet")} • {place.address ?? t("bookingCommon.noAddress")} •{" "}
            {Number(place.rating).toFixed(1)}★
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export const AIBookingSuggestedPlaceCard = memo(AIBookingSuggestedPlaceCardInner);
