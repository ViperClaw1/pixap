import { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { authEmailSentStaticStyles, authEmailSentThemeStyles } from "./authEmailSentStyles";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "AuthEmailSent">;
type ScreenRoute = RouteProp<ProfileStackParamList, "AuthEmailSent">;

export default function AuthEmailSentPage() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const email = route.params?.email?.trim() ?? "";
  const themed = useThemeStyles(({ colors: c }) => authEmailSentThemeStyles(c));
  const styles = useMemo(
    () => mergeStaticAndThemed(authEmailSentStaticStyles, themed),
    [themed],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Please check your email</Text>
      <Text style={styles.description}>
        We sent a confirmation link{email ? ` to ${email}` : ""}. Open it to finish sign up and continue in the app.
      </Text>
      <Pressable style={styles.button} onPress={() => navigation.reset({ index: 0, routes: [{ name: "Auth" }] })}>
        <Text style={styles.buttonText}>Back to Log in</Text>
      </Pressable>
    </View>
  );
}
