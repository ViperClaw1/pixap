import { useMemo } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { BrowseFlowParamList } from "@/navigation/types";
import { useStoryComments } from "@/hooks/useStoryComments";
import { useReplyToStory } from "@/hooks/useReplyToStory";
import { ReplyInput } from "@/components/stories/ReplyInput";
import { isAuthRequiredError, navigateToAuthScreen } from "@/lib/authRequired";

type DiscussionRoute = RouteProp<BrowseFlowParamList, "StoryDiscussion">;
type DiscussionNav = NativeStackNavigationProp<BrowseFlowParamList, "StoryDiscussion">;

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

export default function StoryDiscussionScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DiscussionNav>();
  const { params } = useRoute<DiscussionRoute>();
  const { data: comments = [] } = useStoryComments(params.storyId);
  const replyMutation = useReplyToStory();

  const sorted = useMemo(
    () => [...comments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [comments],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Math.max(insets.top, 8)}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Discussion</Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={[styles.commentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.commentText, { color: colors.text }]}>{item.content}</Text>
              <Text style={[styles.commentTime, { color: colors.textMuted }]}>{formatTime(item.created_at)}</Text>
            </View>
          )}
        />

        <View
          style={[
            styles.inputWrap,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
              paddingBottom: Math.max(8, insets.bottom),
            },
          ]}
        >
          <ReplyInput
            submitting={replyMutation.isPending}
            onSubmit={async (value) => {
              try {
                await replyMutation.mutateAsync({ storyId: params.storyId, content: value });
              } catch (error) {
                if (isAuthRequiredError(error)) {
                  navigateToAuthScreen(navigation as unknown as NavigationProp<ParamListBase>);
                }
              }
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  commentCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentTime: {
    fontSize: 12,
    fontWeight: "500",
  },
  inputWrap: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: 6,
  },
});
