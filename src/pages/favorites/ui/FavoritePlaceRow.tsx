import { AppPressable } from "@/shared/ui/app-pressable";
import { Text, View } from "react-native";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useFavoritePress } from "@/entities/favorite";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import {
  businessCardDisplayFallback,
  getBusinessCardDisplayUrl,
} from "@/shared/lib/business-card/businessCardDisplayUrl";
import { AnimatedLikeHeart } from "@/shared/ui/animated-like-heart";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { favoritesStaticStyles } from "./favoritesStyles";

type BusinessCardSummary = {
  id: string;
  name: string;
  images: string[] | null;
  address: string;
};

type FavoriteRow = {
  user_id: string;
  business_card_id: string;
  business_card: BusinessCardSummary | null;
};

type FavoritePlaceRowStyles = typeof favoritesStaticStyles;

type Props = {
  item: FavoriteRow;
  styles: FavoritePlaceRowStyles;
  onOpen: (placeId: string) => void;
};

type ContentProps = {
  businessCard: BusinessCardSummary;
  styles: FavoritePlaceRowStyles;
  onOpen: (placeId: string) => void;
};

function FavoritePlaceRowContent({ businessCard, styles, onOpen }: ContentProps) {
  const { colors } = useAppTheme();
  const { isFavorite, onFavoritePress } = useFavoritePress(businessCard.id, {
    placeName: businessCard.name,
  });

  const heroRaw = getPrimaryBusinessCardImage(businessCard.images);
  const heroDisplay = getBusinessCardDisplayUrl(heroRaw, { layoutPx: 168, layoutPxHeight: 168 });

  return (
    <AppPressable style={styles.row} onPress={() => onOpen(businessCard.id)}>
      <SmartImage
        uri={heroDisplay}
        fallbackUri={businessCardDisplayFallback(heroDisplay, heroRaw)}
        recyclingKey={businessCard.id}
        style={styles.thumb}
        contentFit="cover"
        skipBundledPlaceholder
      />
      <View style={styles.body}>
        <Text style={styles.name}>{businessCard.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {businessCard.address}
        </Text>
      </View>
      <AppPressable style={styles.heartBtn} onPress={onFavoritePress} hitSlop={8}>
        <AnimatedLikeHeart
          liked={isFavorite}
          size={16}
          color={colors.text}
          likedColor={colors.danger}
        />
      </AppPressable>
    </AppPressable>
  );
}

export function FavoritePlaceRow({ item, styles, onOpen }: Props) {
  const businessCard = item.business_card;
  if (!businessCard) return null;
  return <FavoritePlaceRowContent businessCard={businessCard} styles={styles} onOpen={onOpen} />;
}
