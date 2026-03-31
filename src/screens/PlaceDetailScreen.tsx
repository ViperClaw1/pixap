import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCard } from "@/hooks/useBusinessCards";
import { useReviews } from "@/hooks/useReviews";
import { useAuth } from "@/contexts/AuthContext";
import { useIsFavorite, useToggleFavorite } from "@/hooks/useFavorites";
import { DirectionsModal } from "@/components/DirectionsModal";
import type { BrowseFlowParamList } from "@/navigation/types";
import { navigateToProfileAuth } from "@/navigation/navigationHelpers";
import { useAppTheme } from "@/contexts/ThemeContext";

type R = RouteProp<BrowseFlowParamList, "PlaceDetail">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "PlaceDetail">;

export default function PlaceDetailScreen() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { data: place, isLoading } = useBusinessCard(id);
  const { data: reviews = [] } = useReviews(id);
  const { user } = useAuth();
  const isFavorite = useIsFavorite(id);
  const toggleFavorite = useToggleFavorite();
  const [directionsOpen, setDirectionsOpen] = useState(false);

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, justifyContent: "center", alignItems: "center" },
        heroBar: {
          position: "absolute",
          left: 16,
          right: 16,
          flexDirection: "row",
          justifyContent: "space-between",
        },
        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(255,255,255,0.92)",
          alignItems: "center",
          justifyContent: "center",
        },
        iconBtnText: { fontSize: 18, color: "#111" },
        card: {
          marginTop: -24,
          backgroundColor: colors.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
        },
        title: { fontSize: 22, fontWeight: "800", color: colors.text },
        rating: { marginTop: 6, color: colors.textMuted, fontSize: 14 },
        tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
        tag: {
          fontSize: 12,
          backgroundColor: colors.border,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          color: colors.text,
        },
        desc: { marginTop: 16, color: colors.textMuted, lineHeight: 22 },
        addr: { marginTop: 12, color: colors.text },
        actions: { flexDirection: "row", gap: 10, marginTop: 16 },
        secondaryBtn: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: colors.border,
          alignItems: "center",
        },
        secondaryBtnText: { fontWeight: "600", color: colors.text },
        primaryBtn: {
          marginTop: 16,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
        },
        primaryBtnText: { color: colors.onPrimary, fontWeight: "700" },
        outlineBtn: {
          marginTop: 10,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: "center",
        },
        outlineBtnText: { fontWeight: "700", color: colors.primary },
      }),
    [colors],
  );

  if (isLoading || !place) {
    return (
      <View style={[stylesThemed.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const onFavorite = () => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    toggleFavorite.mutate({ businessCardId: place.id, isFavorite });
  };

  const onCall = () => {
    if (!place.phone) {
      Alert.alert("Unavailable", "Phone number not available");
      return;
    }
    void Linking.openURL(`tel:${place.phone}`);
  };

  const heroTop = Math.max(insets.top, 12);

  return (
    <ScrollView
      style={stylesThemed.root}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
    >
      <View>
        <SmartImage uri={place.image} recyclingKey={place.id} style={styles.hero} contentFit="cover" />
        <View style={[stylesThemed.heroBar, { top: heroTop }]}>
          <Pressable style={stylesThemed.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={stylesThemed.iconBtnText}>←</Text>
          </Pressable>
          <Pressable style={stylesThemed.iconBtn} onPress={onFavorite}>
            <Text style={stylesThemed.iconBtnText}>{isFavorite ? "♥" : "♡"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={stylesThemed.card}>
        <Text style={stylesThemed.title}>{place.name}</Text>
        <Text style={stylesThemed.rating}>
          {Number(place.rating).toFixed(1)} ({reviews.length} reviews) · {Number(place.booking_price).toLocaleString()}{" "}
          ₸
        </Text>
        <View style={stylesThemed.tags}>
          {place.tags.map((tag) => (
            <Text key={tag} style={stylesThemed.tag}>
              {tag}
            </Text>
          ))}
        </View>
        <Text style={stylesThemed.desc}>{place.description}</Text>
        <Text style={stylesThemed.addr}>📍 {place.address}</Text>

        <View style={stylesThemed.actions}>
          <Pressable style={stylesThemed.secondaryBtn} onPress={onCall}>
            <Text style={stylesThemed.secondaryBtnText}>Call</Text>
          </Pressable>
          <Pressable style={stylesThemed.secondaryBtn} onPress={() => setDirectionsOpen(true)}>
            <Text style={stylesThemed.secondaryBtnText}>Directions</Text>
          </Pressable>
        </View>

        <Pressable style={stylesThemed.primaryBtn} onPress={() => navigation.navigate("BookingFlow", { id: place.id })}>
          <Text style={stylesThemed.primaryBtnText}>Book now</Text>
        </Pressable>
        <Pressable style={stylesThemed.outlineBtn} onPress={() => navigation.navigate("ShoppingItems", { id: place.id })}>
          <Text style={stylesThemed.outlineBtnText}>Order items</Text>
        </Pressable>
      </View>

      <DirectionsModal
        visible={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        placeName={place.name}
        address={place.address}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", height: 280 },
});
