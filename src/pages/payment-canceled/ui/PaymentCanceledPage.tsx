import { AppPressable } from "@/shared/ui/app-pressable";
import { useMemo } from "react";
import { View, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CartStackParamList } from "@/app/navigation/types";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { paymentCanceledStaticStyles, paymentCanceledThemeStyles } from "./paymentCanceledStyles";

type Nav = NativeStackNavigationProp<CartStackParamList, "PaymentCanceled">;

export default function PaymentCanceledScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const themed = useThemeStyles(
    ({ colors: c }) => paymentCanceledThemeStyles(c, insets.bottom),
    [insets.bottom],
  );
  const styles = useMemo(
    () => mergeStaticAndThemed(paymentCanceledStaticStyles, themed),
    [themed],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Payment canceled</Text>
      <Text style={styles.body}>You can return to your cart and try again.</Text>
      <AppPressable style={styles.btn} onPress={() => navigation.navigate("CartMain")}>
        <Text style={styles.btnText}>Back to cart</Text>
      </AppPressable>
    </View>
  );
}
