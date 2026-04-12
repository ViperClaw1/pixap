import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CartStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";

type Nav = NativeStackNavigationProp<CartStackParamList, "PaymentCanceled">;

export default function PaymentCanceledScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

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
      }),
    [colors, insets.bottom],
  );

  return (
    <View style={stylesThemed.root}>
      <Text style={stylesThemed.title}>Payment canceled</Text>
      <Text style={stylesThemed.body}>You can return to your cart and try again.</Text>
      <Pressable style={stylesThemed.btn} onPress={() => navigation.navigate("CartMain", {})}>
        <Text style={stylesThemed.btnText}>Back to cart</Text>
      </Pressable>
    </View>
  );
}
