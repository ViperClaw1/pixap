import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { passwordResetSentStaticStyles, passwordResetSentThemeStyles } from "./passwordResetSentStyles";

const CHECK_ICON_COLOR = "#22c55e";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "PasswordResetSent">;
type ScreenRoute = RouteProp<ProfileStackParamList, "PasswordResetSent">;

export default function PasswordResetSentPage() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const insets = useSafeAreaInsets();
  const email = route.params?.email?.trim() ?? "";
  const themed = useThemeStyles(
    ({ colors: c }) => passwordResetSentThemeStyles(c, insets.top, insets.bottom),
    [insets.top, insets.bottom],
  );
  const styles = useMemo(
    () => mergeStaticAndThemed(passwordResetSentStaticStyles, themed),
    [themed],
  );

  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle" size={72} color={CHECK_ICON_COLOR} />
      </View>
      {email ? (
        <Text style={styles.description}>
          Reset link was successfully sent to email <Text style={styles.email}>{email}</Text>
        </Text>
      ) : (
        <Text style={styles.description}>Reset link was successfully sent to your email.</Text>
      )}
      <Pressable style={styles.button} onPress={() => navigation.reset({ index: 0, routes: [{ name: "Auth" }] })}>
        <Text style={styles.buttonText}>Back to Log in</Text>
      </Pressable>
    </View>
  );
}
