import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { BrowseFlowParamList } from "@/navigation/types";
import { useCreateStory } from "@/hooks/useCreateStory";

type ComposerRoute = RouteProp<BrowseFlowParamList, "StoryComposer">;
type ComposerNav = NativeStackNavigationProp<BrowseFlowParamList, "StoryComposer">;

export default function StoryComposerScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<ComposerNav>();
  const { params } = useRoute<ComposerRoute>();
  const createStory = useCreateStory();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");

  const onSubmit = async () => {
    try {
      await createStory.mutateAsync({
        placeId: params.placeId,
        content,
        mediaUrl,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert("Failed", error instanceof Error ? error.message : "Could not create story");
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Add Story</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Share your experience..."
          placeholderTextColor={colors.textMuted}
          multiline
          style={[
            styles.textArea,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        />
        <TextInput
          value={mediaUrl}
          onChangeText={setMediaUrl}
          placeholder="Optional media URL"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          autoCapitalize="none"
        />
        <Pressable
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: createStory.isPending ? 0.6 : 1 }]}
          onPress={() => void onSubmit()}
          disabled={createStory.isPending}
        >
          <Text style={[styles.submitText, { color: colors.onPrimary }]}>
            {createStory.isPending ? "Posting..." : "Post story"}
          </Text>
        </Pressable>
      </View>
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  textArea: {
    minHeight: 180,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
    fontSize: 15,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  submitBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
