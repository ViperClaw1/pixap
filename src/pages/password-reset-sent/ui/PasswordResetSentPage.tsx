import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProfileStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import { AUTH_PRIMARY_COLOR, primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

const CHECK_ICON_COLOR = "#22c55e";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "PasswordResetSent">;
type ScreenRoute = RouteProp<ProfileStackParamList, "PasswordResetSent">;

export default function PasswordResetSentPage() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const email = route.params?.email?.trim() ?? "";

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
          justifyContent: "center",
        },
        iconWrap: {
          alignSelf: "center",
          marginBottom: 20,
        },
        description: {
          color: colors.text,
          fontSize: 16,
          lineHeight: 24,
          textAlign: "center",
        },
        email: {
          fontWeight: "700",
        },
        button: {
          ...primaryPressableStyle,
          marginTop: 28,
          borderWidth: 1,
          borderColor: AUTH_PRIMARY_COLOR,
        },
        buttonText: primaryPressableTextStyle,
      }),
    [colors, insets.bottom, insets.top],
  );

  return (
    <View style={stylesThemed.root}>
      <View style={stylesThemed.iconWrap}>
        <Ionicons name="checkmark-circle" size={72} color={CHECK_ICON_COLOR} />
      </View>
      {email ? (
        <Text style={stylesThemed.description}>
          Reset link was successfully sent to email <Text style={stylesThemed.email}>{email}</Text>
        </Text>
      ) : (
        <Text style={stylesThemed.description}>Reset link was successfully sent to your email.</Text>
      )}
      <Pressable style={stylesThemed.button} onPress={() => navigation.reset({ index: 0, routes: [{ name: "Auth" }] })}>
        <Text style={stylesThemed.buttonText}>Back to Log in</Text>
      </Pressable>
    </View>
  );
}
