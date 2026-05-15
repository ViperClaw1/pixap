import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { AUTH_PRIMARY_COLOR, primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "AuthEmailSent">;
type ScreenRoute = RouteProp<ProfileStackParamList, "AuthEmailSent">;

export default function AuthEmailSentPage() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const { colors } = useAppTheme();
  const email = route.params?.email?.trim() ?? "";

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: 20,
          justifyContent: "center",
        },
        title: {
          color: colors.text,
          fontSize: 32,
          fontWeight: "800",
          marginBottom: 12,
          lineHeight: 42,
        },
        description: {
          color: colors.textMuted,
          fontSize: 14,
          lineHeight: 22,
        },
        email: {
          color: colors.text,
          fontWeight: "700",
        },
        button: {
          ...primaryPressableStyle,
          marginTop: 26,
          borderWidth: 1,
          borderColor: AUTH_PRIMARY_COLOR,
        },
        buttonText: primaryPressableTextStyle,
      }),
    [colors],
  );

  return (
    <View style={stylesThemed.root}>
      <Text style={stylesThemed.title}>Please check your email</Text>
      <Text style={stylesThemed.description}>
        We sent a confirmation link{email ? ` to ${email}` : ""}. Open it to finish sign up and continue in the app.
      </Text>
      <Pressable style={stylesThemed.button} onPress={() => navigation.reset({ index: 0, routes: [{ name: "Auth" }] })}>
        <Text style={stylesThemed.buttonText}>Back to Log in</Text>
      </Pressable>
    </View>
  );
}
