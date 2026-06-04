import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { Linking, Platform, Share } from "react-native";
import { appAlert } from "@/shared/ui/app-popup";
import type { AppPopupOptions, AppPopupVariant } from "@/shared/ui/app-popup";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { fetchProfilePhone, usePublicProfiles } from "@/entities/user";
import { queryKeys } from "@/shared/api/queryKeys";
import { buildPlaceShareUniversalUrl } from "@/shared/lib/placeShareLink";
import { buildPostShareUniversalUrl } from "@/shared/lib/postShareLink";
import { buildStoryShareUniversalUrl } from "@/shared/lib/storyShareLink";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BrowseFlowParamList } from "@/app/navigation/types";

function normalizePhoneToDigits(value?: string | null) {
  return (value ?? "").replace(/[^\d]/g, "");
}

export function usePostShareSheet(_rootNavigation?: NavigationProp<ParamListBase>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [shareVisible, setShareVisible] = useState(false);
  const [shareSearch, setShareSearch] = useState("");
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [sharePostPlaceId, setSharePostPlaceId] = useState<string | null>(null);
  const [shareOnlyPlaceId, setShareOnlyPlaceId] = useState<string | null>(null);
  const [shareStoryId, setShareStoryId] = useState<string | null>(null);
  const [sharePostImages, setSharePostImages] = useState<string[]>([]);
  const [sharePlaceName, setSharePlaceName] = useState("");
  const [shareSending, setShareSending] = useState(false);
  const [shareAlert, setShareAlert] = useState<AppPopupOptions | null>(null);
  const shareVisibleRef = useRef(shareVisible);
  shareVisibleRef.current = shareVisible;

  const dismissShareAlert = useCallback(() => {
    setShareAlert(null);
  }, []);

  const showShareAlertOptions = useCallback((options: AppPopupOptions) => {
    const payload: AppPopupOptions = {
      title: options.title,
      message: options.message?.trim() || undefined,
      buttons: options.buttons?.length ? options.buttons : [{ text: "OK" }],
      variant: options.variant,
    };
    if (shareVisibleRef.current) {
      setShareAlert(payload);
      return;
    }
    appAlert(payload.title, payload.message, payload.buttons, payload.variant);
  }, []);

  const showShareAlert = useCallback(
    (
      title: string,
      message?: string,
      buttons?: AppPopupOptions["buttons"],
      variant?: AppPopupVariant,
    ) => {
      showShareAlertOptions({ title, message, buttons, variant });
    },
    [showShareAlertOptions],
  );

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
    setShareOnlyPlaceId(null);
    setShareStoryId(null);
    setSharePostImages([]);
    setSharePlaceName("");
    setShareAlert(null);
  }, []);

  const resolveShareUrl = useCallback(() => {
    if (shareStoryId) return buildStoryShareUniversalUrl(shareStoryId);
    if (sharePostId) return buildPostShareUniversalUrl(sharePostId);
    if (shareOnlyPlaceId) return buildPlaceShareUniversalUrl(shareOnlyPlaceId);
    return "";
  }, [shareOnlyPlaceId, sharePostId, shareStoryId]);

  const resolveSharePayload = useCallback(() => {
    const url = resolveShareUrl();
    if (!url) return null;
    return {
      title: t("shareSheet.shareTitle"),
      url,
      message: t("shareSheet.shareMessage", { url }),
      messageWithoutUrl: t("shareSheet.shareMessageWithoutUrl"),
    };
  }, [resolveShareUrl, t]);

  const openShareForPost = useCallback(
    (params: { postId: string; placeId: string | null; images: string[]; placeName: string }) => {
      setShareOnlyPlaceId(null);
      setSharePostId(params.postId);
      setSharePostPlaceId(params.placeId);
      setSharePostImages(params.images);
      setSharePlaceName(params.placeName);
      setShareVisible(true);
    },
    [],
  );

  const openShareForPlace = useCallback(
    (params: { placeId: string; placeName: string; images: string[]; storyId?: string | null }) => {
      setSharePostId(null);
      setSharePostPlaceId(params.placeId);
      setShareOnlyPlaceId(params.placeId);
      setShareStoryId(params.storyId?.trim() || null);
      setSharePostImages(params.images);
      setSharePlaceName(params.placeName);
      setShareVisible(true);
    },
    [],
  );

  const attachShareStoryId = useCallback((storyId: string) => {
    const normalized = storyId.trim();
    if (!normalized) return;
    setShareStoryId(normalized);
  }, []);

  const handleShareToStory = useCallback(
    (navigation: NativeStackNavigationProp<BrowseFlowParamList>) => {
      const postId = sharePostId;
      const placeId = sharePostPlaceId ?? shareOnlyPlaceId;
      if (shareOnlyPlaceId && !postId) {
        return false;
      }
      if (!sharePostImages.length) {
        showShareAlert("Could not open story composer", "Images are required.", undefined, "alert");
        return true;
      }
      if (!postId) {
        showShareAlert("Could not open story composer", "Share target is missing.", undefined, "alert");
        return true;
      }
      resetShareState();
      navigation.navigate("AddStoryFromPost", {
        postId,
        placeId,
        postImages: sharePostImages,
      });
      return true;
    },
    [resetShareState, shareOnlyPlaceId, sharePostId, sharePostPlaceId, sharePostImages, showShareAlert],
  );

  const handleShareToWhatsapp = useCallback(
    async (peerUserId: string) => {
      const payload = resolveSharePayload();
      if (!payload) return;
      setShareSending(true);
      try {
        const phone = await queryClient.fetchQuery({
          queryKey: queryKeys.profile.phone(peerUserId),
          queryFn: () => fetchProfilePhone(peerUserId),
          staleTime: 5 * 60 * 1000,
        });
        const phoneDigits = normalizePhoneToDigits(phone);
        if (!phoneDigits) {
          showShareAlert("No phone number", "This user has no phone number in their profile.", undefined, "info");
          return;
        }
        const whatsappUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(payload.message)}`;
        setShareVisible(false);
        setShareAlert(null);
        await Linking.openURL(whatsappUrl);
      } catch (error) {
        showShareAlert(
          "Could not open WhatsApp",
          error instanceof Error ? error.message : "Please try again.",
          undefined,
          "alert",
        );
      } finally {
        setShareSending(false);
      }
    },
    [queryClient, resolveSharePayload, showShareAlert],
  );

  const handleSystemShare = useCallback(async () => {
    const payload = resolveSharePayload();
    if (!payload) return;
    await Share.share({
      title: payload.title,
      message: Platform.OS === "ios" ? payload.messageWithoutUrl : payload.message,
      url: payload.url,
    });
  }, [resolveSharePayload]);

  const handleCopyPostLink = useCallback(async () => {
    const payload = resolveSharePayload();
    if (!payload) return;
    await Clipboard.setStringAsync(payload.message);
  }, [resolveSharePayload]);

  return {
    shareVisible,
    shareSearch,
    shareUsers,
    shareUsersLoading,
    sharePostId,
    shareOnlyPlaceId,
    shareStoryId,
    sharePostImages,
    sharePlaceName,
    shareSending,
    shareAlert,
    dismissShareAlert,
    showShareAlert,
    showShareAlertOptions,
    setShareSearch,
    openShareForPost,
    openShareForPlace,
    attachShareStoryId,
    resetShareState,
    handleShareToStory,
    handleShareToWhatsapp,
    handleSystemShare,
    handleCopyPostLink,
  };
}
