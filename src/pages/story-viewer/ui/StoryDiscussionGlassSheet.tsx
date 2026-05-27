import { Platform } from "react-native";
import type { AppNavigation } from "@/app/navigation/appNavigation";
import { discussionPaletteDark } from "@/shared/theme/discussionPalette";
import { DiscussionGlassSheet } from "@/shared/ui/discussion-glass-sheet";
import { StoryDiscussionPanelInner } from "@/widgets/story-discussion-panel";

type Props = {
  visible: boolean;
  storyId: string;
  navigation: AppNavigation;
  onDismiss: () => void;
};

const glassFooterBg = Platform.OS === "web" ? "rgba(28,28,30,0.92)" : "rgba(28,28,30,0.72)";

export function StoryDiscussionGlassSheet({ visible, storyId, navigation, onDismiss }: Props) {
  return (
    <DiscussionGlassSheet visible={visible} navigation={navigation} onDismiss={onDismiss}>
      {(panelProps) => (
        <StoryDiscussionPanelInner
          storyId={storyId}
          onRequireAuth={panelProps.onRequireAuth}
          onClose={panelProps.onClose}
          discussionPalette={discussionPaletteDark}
          footerBackgroundColor={glassFooterBg}
          footerBorderColor="rgba(255,255,255,0.12)"
          onListContentSizeChange={panelProps.onListContentSizeChange}
        />
      )}
    </DiscussionGlassSheet>
  );
}
