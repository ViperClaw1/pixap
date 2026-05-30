import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { navigateToFeedStoryViewer } from "@/app/navigation/navigateToStoryViewer";
import { navigateToMessageThread } from "@/app/navigation/navigationHelpers";
import type { AdminContentReport } from "@/entities/admin-moderation";
import { getModerationOpenTarget } from "./getModerationOpenTarget";

type BrowseNav = NavigationProp<ParamListBase> & {
  navigate: (name: string, params?: object) => void;
};

export async function navigateModerationContent(
  navigation: BrowseNav,
  report: AdminContentReport,
  viewerUserId: string | null,
): Promise<boolean> {
  const target = getModerationOpenTarget(report);
  if (!target) return false;

  switch (target.kind) {
    case "post":
      navigation.navigate("PostDetail", { postId: target.postId });
      return true;
    case "post_discussion":
      navigation.navigate("PostDiscussion", { postId: target.postId });
      return true;
    case "story_discussion":
      navigation.navigate("StoryDiscussion", {
        storyId: target.storyId,
        placeId: target.placeId,
      });
      return true;
    case "story":
      return navigateToFeedStoryViewer(navigation, target.storyId, viewerUserId);
    case "message_thread":
      navigateToMessageThread(navigation, {
        threadId: target.threadId,
        peerId: target.peerId,
        peerFirstName: target.peerFirstName,
        peerLastName: target.peerLastName,
      });
      return true;
    default:
      return false;
  }
}
