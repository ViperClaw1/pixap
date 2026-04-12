import { useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CartStackParamList, RootTabParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";

type PaymentSuccessNav = CompositeNavigationProp<
  NativeStackNavigationProp<CartStackParamList, "PaymentSuccess">,
  BottomTabNavigationProp<RootTabParamList>
>;
type PaymentSuccessRoute = RouteProp<CartStackParamList, "PaymentSuccess">;

export default function PaymentSuccessScreen() {
  const navigation = useNavigation<PaymentSuccessNav>();
  const route = useRoute<PaymentSuccessRoute>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["shopping_cart"] });
    void queryClient.invalidateQueries({ queryKey: ["cart_items"] });
    void queryClient.invalidateQueries({ queryKey: ["paid_cart_items"] });
    void queryClient.invalidateQueries({ queryKey: ["paid_shopping_cart_items"] });
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
  }, [queryClient]);

  useEffect(() => {
    if (route.params?.next !== "bookings") return;
    navigation.navigate("Bookings", { screen: "BookingsMain" });
  }, [route.params?.next, navigation]);

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          justifyContent: "center",
          padding: 24,
          backgroundColor: colors.background,
          paddingBottom: Math.max(insets.bottom, 24),
        },
        title: { fontSize: 24, fontWeight: "800", marginBottom: 8, color: colors.text },
        body: { color: colors.textMuted, marginBottom: 24 },
        btn: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
        },
        btnText: { color: colors.onPrimary, fontWeight: "700" },
        secondaryBtn: {
          marginTop: 12,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
        },
        secondaryBtnText: { color: colors.text, fontWeight: "700" },
      }),
    [colors, insets.bottom],
  );

  const goBookings = () => {
    navigation.navigate("Bookings", { screen: "BookingsMain" });
  };

  return (
    <View style={stylesThemed.root}>
      <Text style={stylesThemed.title}>Payment successful</Text>
      <Text style={stylesThemed.body}>Thank you! Your order is confirmed.</Text>
      <Pressable style={stylesThemed.btn} onPress={() => navigation.navigate("CartMain", {})}>
        <Text style={stylesThemed.btnText}>Back to cart</Text>
      </Pressable>
      <Pressable style={stylesThemed.secondaryBtn} onPress={goBookings}>
        <Text style={stylesThemed.secondaryBtnText}>View bookings</Text>
      </Pressable>
    </View>
  );
}
