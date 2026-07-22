import { AppPressable } from "@/shared/ui/app-pressable";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { PaywallPlanFeatureRow } from "./PaywallPlanFeatureRow";
import type { PaywallPlanFeature } from "../lib/paywallPlanFeatures";

type Props = {
  title: string;
  features: PaywallPlanFeature[];
  price?: string;
  priceSuffix: string;
  selected: boolean;
  highlighted?: boolean;
  onPress: () => void;
  cardStyle: object;
  planStyle: object;
  subtitleStyle: object;
  highlightedCardStyle?: object;
  highlightedPlanStyle?: object;
  selectedCardStyle?: object;
};

export function PaywallPlanCard({
  title,
  features,
  price,
  priceSuffix,
  selected,
  highlighted,
  onPress,
  cardStyle,
  planStyle,
  subtitleStyle,
  highlightedCardStyle,
  highlightedPlanStyle,
  selectedCardStyle,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <AppPressable
      style={[
        cardStyle,
        highlighted && highlightedCardStyle,
        selected && selectedCardStyle,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={[planStyle, highlighted && highlightedPlanStyle]}>{title}</Text>
        {highlighted ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.accentSurface,
            }}
          >
            <Ionicons name="star" size={12} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>
              {t("subscriptionPaywall.mostPopularBadge")}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 8 }}>
        {features.map((feature) => (
          <PaywallPlanFeatureRow
            key={feature.id}
            icon={feature.icon}
            iconColor={feature.iconColor}
            iconBackground={feature.iconBackground}
            label={feature.label}
          />
        ))}
      </View>
      {price ? (
        <Text style={[subtitleStyle, { marginTop: 2, fontWeight: "600" }]}>
          {price}
          {priceSuffix}
        </Text>
      ) : null}
    </AppPressable>
  );
}
