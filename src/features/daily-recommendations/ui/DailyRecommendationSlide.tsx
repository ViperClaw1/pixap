import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { DailyRecommendation } from "@/entities/daily-recommendation";
import BusinessPlaceCard from "@/widgets/place-card";
import { recommendationToBusinessCard } from "../lib/recommendationToBusinessCard";

type Props = {
  item: DailyRecommendation;
  slideWidth: number;
  slideHeight: number;
  slideGap: number;
  textMutedColor: string;
  heroLoadingSpinnerColor: string;
};

function DailyRecommendationSlideInner({
  item,
  slideWidth,
  slideHeight,
  slideGap,
  textMutedColor,
  heroLoadingSpinnerColor,
}: Props) {
  return (
    <View style={[styles.slide, { width: slideWidth, marginRight: slideGap, height: slideHeight }]}>
      <View style={styles.cardBody}>
        <BusinessPlaceCard
          place={recommendationToBusinessCard(item)}
          variant="vertical"
          verticalLayout="fill"
          fillWidth={slideWidth}
          fillHeight={slideHeight}
          showHeroLoadingSpinner
          heroLoadingSpinnerColor={heroLoadingSpinnerColor}
        />
      </View>
      <View style={styles.reasons}>
        {(item.recommendation_reasons ?? []).slice(0, 3).map((reason) => (
          <Text key={`${item.venue_id}-${reason}`} style={[styles.reasonText, { color: textMutedColor }]}>
            • {reason}
          </Text>
        ))}
      </View>
    </View>
  );
}

export const DailyRecommendationSlide = memo(DailyRecommendationSlideInner);

const styles = StyleSheet.create({
  slide: {
    flex: 1,
  },
  cardBody: {
    flex: 1,
    minHeight: 0,
  },
  reasons: {
    marginTop: 10,
    gap: 4,
    flexShrink: 0,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
