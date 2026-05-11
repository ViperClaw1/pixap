import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useMyFollowing, usePublicProfiles } from "@/entities/user";
import { useCreateStory } from "@/entities/story";
import { useOpenOrCreateThread, useSendMessage } from "@/entities/messages";
import { buildShareStoryMessageBody } from "@/shared/lib/placeShareMessage";

type Params = {
  placeId: string;
  postImages: string[];
};

function normalizeName(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.trim() ?? ""} ${lastName?.trim() ?? ""}`.trim() || "Unknown user";
}

export function useAddStoryFromPost({ placeId, postImages }: Params) {
  const [caption, setCaption] = useState("");
  const [friendsModalVisible, setFriendsModalVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [createdStoryId, setCreatedStoryId] = useState<string | null>(null);
  const { followingSet } = useMyFollowing();
  const { data: publicProfiles = [], isLoading: followersLoading } = usePublicProfiles(search);
  const createStory = useCreateStory();
  const openOrCreateThread = useOpenOrCreateThread();
  const sendMessage = useSendMessage();

  const followers = useMemo(
    () =>
      publicProfiles
        .filter((profile) => followingSet.has(profile.id))
        .map((profile) => ({
          ...profile,
          fullName: normalizeName(profile.first_name, profile.last_name),
        })),
    [followingSet, publicProfiles],
  );

  const createStoryIfNeeded = async () => {
    if (createdStoryId) return createdStoryId;
    const mediaPayload = JSON.stringify(postImages.filter((value) => value.trim().length > 0));
    const normalizedContent = caption.trim() || "New story";
    const created = (await createStory.mutateAsync({
      placeId,
      content: normalizedContent,
      mediaUrl: mediaPayload,
    })) as { id?: string };
    const newStoryId = String(created.id ?? "");
    if (!newStoryId) throw new Error("Could not resolve created story id.");
    setCreatedStoryId(newStoryId);
    return newStoryId;
  };

  const shareToYourStory = async () => {
    try {
      await createStoryIfNeeded();
      return true;
    } catch (error) {
      Alert.alert("Story failed", error instanceof Error ? error.message : "Could not create story.");
      return false;
    }
  };

  const toggleFriend = (userId: string) => {
    setSelectedFriendIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const openFriendsModal = () => setFriendsModalVisible(true);
  const closeFriendsModal = () => {
    setFriendsModalVisible(false);
    setSearch("");
  };

  const shareWithFriends = async () => {
    if (!selectedFriendIds.length) {
      Alert.alert("Select followers", "Please select at least one follower.");
      return false;
    }
    try {
      const storyId = await createStoryIfNeeded();
      const messageBody = buildShareStoryMessageBody("Check my new story", storyId, "Story");
      let successCount = 0;
      for (const followerId of selectedFriendIds) {
        try {
          const thread = await openOrCreateThread.mutateAsync(followerId);
          await sendMessage.mutateAsync({ threadId: thread.threadId, content: messageBody });
          successCount += 1;
        } catch {
          // Continue with remaining recipients to avoid all-or-nothing UX.
        }
      }
      closeFriendsModal();
      if (!successCount) {
        Alert.alert("Share failed", "Could not send story to followers.");
        return false;
      }
      if (successCount < selectedFriendIds.length) {
        Alert.alert("Partially shared", `Shared with ${successCount} of ${selectedFriendIds.length} followers.`);
      }
      return true;
    } catch (error) {
      Alert.alert("Share failed", error instanceof Error ? error.message : "Please try again.");
      return false;
    }
  };

  return {
    caption,
    setCaption,
    followers,
    followersLoading,
    friendsModalVisible,
    openFriendsModal,
    closeFriendsModal,
    search,
    setSearch,
    selectedFriendIds,
    toggleFriend,
    shareToYourStory,
    shareWithFriends,
    isSubmitting: createStory.isPending || openOrCreateThread.isPending || sendMessage.isPending,
  };
}
