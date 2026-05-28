import { useCallback, useMemo } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import { discussionPaletteDark, discussionPaletteLight } from "@/shared/theme/discussionPalette";
import { StoryDiscussionPanelInner } from "@/widgets/story-discussion-panel";

type DiscussionRoute = RouteProp<BrowseFlowParamList, "StoryDiscussion">;
type DiscussionNav = NativeStackNavigationProp<BrowseFlowParamList, "StoryDiscussion">;

export default function StoryDiscussionPage() {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const navigation = useNavigation<DiscussionNav>();
  const { params } = useRoute<DiscussionRoute>();

  const palette = useMemo(() => (isDark ? discussionPaletteDark : discussionPaletteLight), [isDark]);

  const onRequireAuth = useCallback(() => {
    navigateToAuthScreen(navigation);
  }, [navigation]);

  const content = (
    <View style={styles.panelWrap}>
      <StoryDiscussionPanelInner
        storyId={params.storyId}
        onRequireAuth={onRequireAuth}
        discussionPalette={palette}
        onClose={() => navigation.goBack()}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.screenBg }]} edges={["top"]}>
      {Platform.OS === "ios" ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior="padding"
          keyboardVerticalOffset={Math.max(insets.top, 8)}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.flex}>{content}</View>
      )}
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
  panelWrap: {
    flex: 1,
    minHeight: 0,
  },
});
