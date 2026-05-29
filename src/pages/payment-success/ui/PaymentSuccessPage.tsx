import { AppPressable } from "@/shared/ui/app-pressable";
import { useEffect, useMemo } from "react";
import { View, Text } from "react-native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/app/providers/AuthProvider";
import { queryKeys } from "@/shared/api/queryKeys";
import type { CartStackParamList, RootTabParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { paymentSuccessStaticStyles, paymentSuccessThemeStyles } from "./paymentSuccessStyles";

type PaymentSuccessNav = CompositeNavigationProp<
  NativeStackNavigationProp<CartStackParamList, "PaymentSuccess">,
  BottomTabNavigationProp<RootTabParamList>
>;
type PaymentSuccessRoute = RouteProp<CartStackParamList, "PaymentSuccess">;

export default function PaymentSuccessScreen() {
  const navigation = useNavigation<PaymentSuccessNav>();
  const route = useRoute<PaymentSuccessRoute>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopping.cartPrefix });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.itemsPrefix });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.paidItemsPrefix });
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopping.paidCartItemsPrefix });
    void queryClient.invalidateQueries({ queryKey: queryKeys.bookings.prefix });
  }, [queryClient, user?.id]);

  useEffect(() => {
    if (route.params?.next !== "bookings") return;
    navigation.navigate("Bookings", { screen: "BookingsMain" });
  }, [route.params?.next, navigation]);

  const themed = useThemeStyles(
    ({ colors: c }) => paymentSuccessThemeStyles(c, insets.bottom),
    [insets.bottom],
  );
  const styles = useMemo(
    () => mergeStaticAndThemed(paymentSuccessStaticStyles, themed),
    [themed],
  );

  const goBookings = () => {
    navigation.navigate("Bookings", { screen: "BookingsMain" });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Payment successful</Text>
      <Text style={styles.body}>Thank you! Your order is confirmed.</Text>
      <AppPressable style={styles.btn} onPress={() => navigation.navigate("CartMain")}>
        <Text style={styles.btnText}>Back to cart</Text>
      </AppPressable>
      <AppPressable style={styles.secondaryBtn} onPress={goBookings}>
        <Text style={styles.secondaryBtnText}>View bookings</Text>
      </AppPressable>
    </View>
  );
}
