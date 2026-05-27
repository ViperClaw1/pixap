import { useCallback, useMemo } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import { discussionPaletteDark, discussionPaletteLight } from "@/shared/theme/discussionPalette";
import { PostDiscussionPanelInner } from "@/widgets/post-discussion-panel";

type DiscussionRoute = RouteProp<BrowseFlowParamList, "PostDiscussion">;
type DiscussionNav = NativeStackNavigationProp<BrowseFlowParamList, "PostDiscussion">;

export default function PostDiscussionPage() {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const navigation = useNavigation<DiscussionNav>();
  const { params } = useRoute<DiscussionRoute>();

  const palette = useMemo(() => (isDark ? discussionPaletteDark : discussionPaletteLight), [isDark]);

  const onRequireAuth = useCallback(() => {
    navigateToAuthScreen(navigation);
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.screenBg }]} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Math.max(insets.top, 8)}
      >
        <View style={[styles.sheetTop, { backgroundColor: palette.screenBg }]}>
          <View style={[styles.dragHandle, { backgroundColor: palette.grabber }]} />
          <View style={styles.headerRow}>
            <View style={styles.headerSide} />
            <Text style={[styles.headerTitle, { color: palette.text }]}>Comments</Text>
            <View style={styles.headerSide}>
              <Pressable
                hitSlop={8}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="close" size={24} color={palette.text} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.panelWrap}>
          <PostDiscussionPanelInner postId={params.postId} onRequireAuth={onRequireAuth} discussionPalette={palette} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  sheetTop: {
    paddingTop: 6,
    paddingBottom: 4,
  },
  dragHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerSide: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconBtn: {
    alignSelf: "flex-end",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  panelWrap: {
    flex: 1,
    minHeight: 0,
  },
});
