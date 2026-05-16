import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Alert, InteractionManager, Linking, Share } from "react-native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import { fetchProfilePhone, usePublicProfiles } from "@/entities/user";
import { useOpenOrCreateThread } from "@/entities/messages";
import { queryKeys } from "@/shared/api/queryKeys";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BrowseFlowParamList } from "@/app/navigation/types";

function buildPostShareUrl(postId: string) {
  return `https://pixapp.kz/feed?focusPostId=${encodeURIComponent(postId)}`;
}

function normalizePhoneToDigits(value?: string | null) {
  return (value ?? "").replace(/[^\d]/g, "");
}

export function usePostShareSheet(rootNavigation: NavigationProp<ParamListBase>) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const openOrCreateShareThread = useOpenOrCreateThread();

  const [shareVisible, setShareVisible] = useState(false);
  const [shareSearch, setShareSearch] = useState("");
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [sharePostPlaceId, setSharePostPlaceId] = useState<string | null>(null);
  const [sharePostImages, setSharePostImages] = useState<string[]>([]);
  const [sharePlaceName, setSharePlaceName] = useState("");
  const [shareSending, setShareSending] = useState(false);

  const { data: shareUsersRaw = [], isLoading: shareUsersLoading } = usePublicProfiles(shareSearch, shareVisible, {
    accountRole: "user",
  });
  const shareUsers = useMemo(
    () => shareUsersRaw.filter((profile) => profile.id !== user?.id),
    [shareUsersRaw, user?.id],
  );

  const resetShareState = useCallback(() => {
    setShareVisible(false);
    setShareSearch("");
    setSharePostId(null);
    setSharePostPlaceId(null);
    setSharePostImages([]);
    setSharePlaceName("");
  }, []);

  const openShareForPost = useCallback(
    (params: { postId: string; placeId: string | null; images: string[]; placeName: string }) => {
      setSharePostId(params.postId);
      setSharePostPlaceId(params.placeId);
      setSharePostImages(params.images);
      setSharePlaceName(params.placeName);
      setShareVisible(true);
    },
    [],
  );

  const openThreadWithPrefill = useCallback(
    async (peerUserId: string, prefilledText: string) => {
      const thread = await openOrCreateShareThread.mutateAsync(peerUserId);
      const peer = shareUsers.find((u) => u.id === peerUserId);
      resetShareState();
      const threadParams = {
        threadId: thread.threadId,
        peerId: peerUserId,
        peerFirstName: peer?.first_name,
        peerLastName: peer?.last_name,
        peerAvatarUrl: peer?.avatar_url,
        initialDraft: prefilledText,
      };
      InteractionManager.runAfterInteractions(() => {
        rootNavigation.navigate("Cart", { screen: "CartMain" });
        requestAnimationFrame(() => {
          rootNavigation.navigate("Cart", { screen: "MessageThread", params: threadParams });
        });
      });
    },
    [openOrCreateShareThread, resetShareState, rootNavigation, shareUsers],
  );

  const handleShareToStory = useCallback(
    (navigation: NativeStackNavigationProp<BrowseFlowParamList>) => {
      const postId = sharePostId;
      const placeId = sharePostPlaceId;
      if (!postId || !sharePostImages.length) {
        Alert.alert("Could not open story composer", "Post images are required.");
        return;
      }
      resetShareState();
      navigation.navigate("AddStoryFromPost", {
        postId,
        placeId,
        postImages: sharePostImages,
      });
    },
    [resetShareState, sharePostId, sharePostPlaceId, sharePostImages],
  );

  const handleShareToWhatsapp = useCallback(
    async (peerUserId: string) => {
      const postId = sharePostId;
      if (!postId) return;
      setShareSending(true);
      try {
        const link = buildPostShareUrl(postId);
        const phone = await queryClient.fetchQuery({
          queryKey: queryKeys.profile.phone(peerUserId),
          queryFn: () => fetchProfilePhone(peerUserId),
          staleTime: 5 * 60 * 1000,
        });
        const phoneDigits = normalizePhoneToDigits(phone);
        if (!phoneDigits) {
          Toast.show({
            type: "info",
            text1: "No WhatsApp number",
            text2: "Opened internal chat instead.",
          });
          await openThreadWithPrefill(peerUserId, link);
          return;
        }
        const whatsappUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(link)}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (!canOpen) {
          await openThreadWithPrefill(peerUserId, link);
          return;
        }
        await Linking.openURL(whatsappUrl);
      } catch (error) {
        Alert.alert("Could not open WhatsApp", error instanceof Error ? error.message : "Please try again.");
      } finally {
        setShareSending(false);
      }
    },
    [openThreadWithPrefill, queryClient, sharePostId],
  );

  const handleSystemShare = useCallback(async () => {
    const postId = sharePostId;
    if (!postId) return;
    const link = buildPostShareUrl(postId);
    await Share.share({ message: link, url: link });
  }, [sharePostId]);

  const handleCopyPostLink = useCallback(async () => {
    const postId = sharePostId;
    if (!postId) return;
    const link = buildPostShareUrl(postId);
    await Clipboard.setStringAsync(link);
    Toast.show({
      type: "success",
      text1: "Link copied",
      text2: "Post link copied to clipboard.",
    });
  }, [sharePostId]);

  return {
    shareVisible,
    shareSearch,
    shareUsers,
    shareUsersLoading,
    sharePostId,
    sharePostImages,
    sharePlaceName,
    shareSending,
    setShareSearch,
    openShareForPost,
    resetShareState,
    handleShareToStory,
    handleShareToWhatsapp,
    handleSystemShare,
    handleCopyPostLink,
  };
}
