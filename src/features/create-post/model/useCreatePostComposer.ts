import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, Platform } from "react-native";
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { useAuth } from "@/app/providers/AuthProvider";
import { filterBusinessCardsByGeocodeAddress, type BusinessCard } from "@/entities/business-card";
import { useCreatePost } from "@/entities/post";
import { env } from "@/shared/lib/env";
import {
  geocodePlaceIdToSearchItem,
  searchAddressAutocomplete,
  type AddressAutocompleteListItem,
  type GeocodeSearchResultItem,
} from "@/shared/lib/directionsApi";
import { uploadPostPickerAssets } from "@/entities/story/lib/uploadStoriesBucketMedia";
import { encodeBlurHashFromPickerAssetUri } from "@/shared/lib/encodeMediaBlurHash";
import { formatErrorForAlert } from "@/shared/lib/formatErrorForAlert";
import { resolveStoragePublicUrl } from "@/shared/lib/resolveStoragePublicUrl";
import {
  MAX_POST_PHOTOS,
  POST_ADDRESS_AUTOCOMPLETE_DEBOUNCE_MS,
  POST_ADDRESS_SUGGESTIONS_KEYBOARD_GAP,
  POST_ADDRESS_SUGGESTIONS_MIN_HEIGHT,
  POST_PLACE_IMAGE_HEIGHT,
} from "./constants";

const IOS_KEYBOARD_LAYOUT_SETTLE_MS = 320;

export type MatchedPlaceCarouselItem = {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  imageUrl: string | null;
};

export function useCreatePostComposer(
  businessCards: BusinessCard[],
  rootNavigation: NavigationProp<ParamListBase>,
  windowHeight: number,
) {
  const { user } = useAuth();
  const createPost = useCreatePost();
  const mapsApiKey = env.googleMapsWebApiKey;

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<"menu" | "post">("menu");
  const [postInput, setPostInput] = useState("");
  const [postInputError, setPostInputError] = useState(false);
  const [postPhotosError, setPostPhotosError] = useState(false);
  const [selectedPostPlaceId, setSelectedPostPlaceId] = useState<string | null>(null);
  const [postPlaceError, setPostPlaceError] = useState(false);
  const [postPhotos, setPostPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploadingPostPhotos, setUploadingPostPhotos] = useState(false);
  const [postSubmitStage, setPostSubmitStage] = useState<"uploading_photos" | "creating_post" | null>(null);
  const [postAddressDraft, setPostAddressDraft] = useState("");
  const [geocodeSuggestions, setGeocodeSuggestions] = useState<AddressAutocompleteListItem[]>([]);
  const [addressGeocodeLoading, setAddressGeocodeLoading] = useState(false);
  const [selectedGeocode, setSelectedGeocode] = useState<GeocodeSearchResultItem | null>(null);
  const [selectedGooglePlaceId, setSelectedGooglePlaceId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [androidKeyboardTransitioning, setAndroidKeyboardTransitioning] = useState(false);
  const [postAddressFieldBottomY, setPostAddressFieldBottomY] = useState(0);

  const postAddressFieldRef = useRef<import("react-native").View | null>(null);
  const createStepFade = useSharedValue(1);
  const isAddressSuggestionsOpen = !selectedGeocode && postAddressDraft.trim().length >= 2 && Boolean(mapsApiKey);

  const measurePostAddressFieldBottom = useCallback(() => {
    requestAnimationFrame(() => {
      postAddressFieldRef.current?.measureInWindow((_x, y, _w, h) => {
        setPostAddressFieldBottomY(y + h + 6);
      });
    });
  }, []);

  const resetComposer = useCallback(() => {
    setStep("menu");
    setPostInput("");
    setPostInputError(false);
    setPostPhotosError(false);
    setSelectedPostPlaceId(null);
    setPostPlaceError(false);
    setPostPhotos([]);
    setPostSubmitStage(null);
    setPostAddressDraft("");
    setGeocodeSuggestions([]);
    setAddressGeocodeLoading(false);
    setSelectedGeocode(null);
    setSelectedGooglePlaceId(null);
    setKeyboardHeight(0);
    setAndroidKeyboardTransitioning(false);
  }, []);

  const openMenu = useCallback(() => {
    setStep("menu");
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    resetComposer();
  }, [resetComposer]);

  useEffect(() => {
    if (!visible) return;
    createStepFade.value = 0;
    createStepFade.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [visible, step, createStepFade]);

  const createStepFadeStyle = useAnimatedStyle(
    () => ({
      opacity: createStepFade.value,
    }),
    [createStepFade],
  );

  useEffect(() => {
    if (Platform.OS === "ios") {
      const showSub = Keyboard.addListener("keyboardWillShow", (event) => {
        setKeyboardHeight(event.endCoordinates?.height ?? 0);
      });
      const hideSub = Keyboard.addListener("keyboardWillHide", () => {
        setKeyboardHeight(0);
      });
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }

    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setAndroidKeyboardTransitioning(false);
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
      setAndroidKeyboardTransitioning(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const dismissAddressKeyboard = useCallback(() => {
    setAndroidKeyboardTransitioning(true);
    Keyboard.dismiss();
  }, []);

  useEffect(() => {
    if (!visible || step !== "post") return;
    if (Platform.OS === "android" && androidKeyboardTransitioning) return;

    if (Platform.OS === "ios") {
      if (selectedGeocode && keyboardHeight > 0) return;
      const delayMs = keyboardHeight > 0 ? IOS_KEYBOARD_LAYOUT_SETTLE_MS : 0;
      const timer = setTimeout(() => {
        measurePostAddressFieldBottom();
      }, delayMs);
      return () => clearTimeout(timer);
    }

    if (Platform.OS === "android" && selectedGeocode) {
      const timer = setTimeout(() => {
        measurePostAddressFieldBottom();
      }, 100);
      return () => clearTimeout(timer);
    }

    measurePostAddressFieldBottom();
  }, [
    visible,
    step,
    keyboardHeight,
    measurePostAddressFieldBottom,
    postAddressDraft,
    selectedGeocode,
    androidKeyboardTransitioning,
  ]);

  const postAddressSuggestionsMaxHeight = useMemo(() => {
    const keyboardTop = windowHeight - keyboardHeight;
    const availableBottom =
      keyboardHeight > 0 ? keyboardTop - POST_ADDRESS_SUGGESTIONS_KEYBOARD_GAP : windowHeight - 8;
    const availableHeight = availableBottom - postAddressFieldBottomY;
    const raw = Math.max(POST_ADDRESS_SUGGESTIONS_MIN_HEIGHT, Math.floor(availableHeight));
    if (Platform.OS !== "ios") return raw;
    return Math.round(raw / 8) * 8;
  }, [keyboardHeight, postAddressFieldBottomY, windowHeight]);

  const matchedPlacesForAddress = useMemo(
    () =>
      selectedGeocode ? filterBusinessCardsByGeocodeAddress(businessCards, selectedGeocode.formattedAddress) : [],
    [businessCards, selectedGeocode],
  );

  const matchedPlaceCarouselVm = useMemo<MatchedPlaceCarouselItem[]>(
    () =>
      matchedPlacesForAddress.map((card) => ({
        id: card.id,
        name: card.name?.trim() || "Unknown place",
        address: card.address?.trim() || "Address unavailable",
        rating: card.rating,
        imageUrl: card.images[0]?.trim()
          ? resolveStoragePublicUrl(card.images[0] as string, "business-cards")
          : null,
      })),
    [matchedPlacesForAddress],
  );

  useEffect(() => {
    if (!selectedPostPlaceId) return;
    if (matchedPlacesForAddress.length === 0) {
      if (selectedGeocode) setSelectedPostPlaceId(null);
      return;
    }
    if (!matchedPlacesForAddress.some((card) => card.id === selectedPostPlaceId)) {
      setSelectedPostPlaceId(null);
    }
  }, [matchedPlacesForAddress, selectedPostPlaceId, selectedGeocode]);

  useEffect(() => {
    if (!visible || step !== "post" || selectedGeocode) {
      return;
    }
    const key = mapsApiKey;
    const q = postAddressDraft.trim();
    if (!key || q.length < 2) {
      setGeocodeSuggestions([]);
      setAddressGeocodeLoading(false);
      return;
    }
    setGeocodeSuggestions([]);
    setAddressGeocodeLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      void searchAddressAutocomplete(q, key, ctrl.signal)
        .then((res) => {
          if (ctrl.signal.aborted) return;
          setGeocodeSuggestions(res.ok ? res.items : []);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setAddressGeocodeLoading(false);
        });
    }, POST_ADDRESS_AUTOCOMPLETE_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
      setAddressGeocodeLoading(false);
    };
  }, [postAddressDraft, visible, step, selectedGeocode, mapsApiKey]);

  const pickPostPhotos = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Storage access is required to choose photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsMultipleSelection: true,
      selectionLimit: MAX_POST_PHOTOS,
      base64: false,
    });
    if (result.canceled) return;
    setPostPhotos((prev) => {
      const merged = [...prev, ...result.assets];
      const dedup = merged.filter((asset, index, all) => all.findIndex((candidate) => candidate.uri === asset.uri) === index);
      const next = dedup.slice(0, MAX_POST_PHOTOS);
      if (next.length) setPostPhotosError(false);
      return next;
    });
  }, []);

  const submitPost = useCallback(async () => {
    const content = postInput.trim();
    const matchedForSubmit = selectedGeocode
      ? filterBusinessCardsByGeocodeAddress(businessCards, selectedGeocode.formattedAddress)
      : [];

    if (!selectedGeocode) {
      setPostPlaceError(true);
      return;
    }

    if (!content) {
      setPostInputError(true);
      return;
    }

    if (!postPhotos.length) {
      setPostPhotosError(true);
      return;
    }

    if (createPost.isPending || uploadingPostPhotos) return;

    try {
      setUploadingPostPhotos(true);
      setPostSubmitStage("uploading_photos");
      const blurHashes: (string | null)[] = [];
      for (const asset of postPhotos) {
        blurHashes.push(await encodeBlurHashFromPickerAssetUri(asset.uri));
      }
      const uploadedUrls = await uploadPostPickerAssets(postPhotos, user?.id);
      if (!uploadedUrls.length) {
        throw new Error("Photo upload failed. Please try again.");
      }

      const placeIdForPost =
        selectedPostPlaceId && matchedForSubmit.some((card) => card.id === selectedPostPlaceId)
          ? selectedPostPlaceId
          : null;
      const mediaUrl = JSON.stringify(uploadedUrls);

      setPostSubmitStage("creating_post");
      const mediaBlurhashes = blurHashes.some((h) => h) ? blurHashes : null;
      const payload =
        placeIdForPost != null
          ? {
              placeId: placeIdForPost,
              content,
              mediaUrl,
              mediaBlurhashes,
            }
          : {
              geo: {
                placeName: selectedGeocode.placeName,
                formattedAddress: selectedGeocode.formattedAddress,
                latitude: selectedGeocode.latitude,
                longitude: selectedGeocode.longitude,
                googlePlaceId: selectedGooglePlaceId,
              },
              content,
              mediaUrl,
              mediaBlurhashes,
            };

      const created = (await createPost.mutateAsync(payload)) as unknown as { id: string | number };
      setVisible(false);
      resetComposer();
      rootNavigation.navigate("Feed", { screen: "FeedMain", params: { focusPostId: String(created.id) } });
    } catch (error) {
      Alert.alert("Post failed", formatErrorForAlert(error, "Could not publish post."));
    } finally {
      setUploadingPostPhotos(false);
      setPostSubmitStage(null);
    }
  }, [
    businessCards,
    createPost,
    postInput,
    postPhotos,
    resetComposer,
    rootNavigation,
    selectedGeocode,
    selectedGooglePlaceId,
    selectedPostPlaceId,
    uploadingPostPhotos,
    user?.id,
  ]);

  const selectGeocodeSuggestion = useCallback(
    async (placeId: string) => {
      if (!mapsApiKey) return;
      if (Platform.OS === "android") {
        dismissAddressKeyboard();
      }
      setAddressGeocodeLoading(true);
      try {
        const res = await geocodePlaceIdToSearchItem(placeId, mapsApiKey);
        if (res.ok) {
          setSelectedGeocode(res.item);
          setSelectedGooglePlaceId(placeId);
          setGeocodeSuggestions([]);
          setPostAddressDraft(res.item.formattedAddress);
          setPostPlaceError(false);
          setSelectedPostPlaceId(null);
        } else {
          Toast.show({
            type: "error",
            text1: "Address lookup failed",
            text2: res.message ?? res.status,
          });
        }
      } catch {
        Toast.show({ type: "error", text1: "Network error", text2: "Try again." });
      } finally {
        setAddressGeocodeLoading(false);
      }
    },
    [mapsApiKey, dismissAddressKeyboard],
  );

  const clearSelectedAddress = useCallback(() => {
    setSelectedGeocode(null);
    setSelectedGooglePlaceId(null);
    setPostAddressDraft("");
    setSelectedPostPlaceId(null);
    setGeocodeSuggestions([]);
    setPostPlaceError(false);
  }, []);

  const backToMenu = useCallback(() => {
    setStep("menu");
    setPostAddressDraft("");
    setGeocodeSuggestions([]);
    setAddressGeocodeLoading(false);
    setSelectedGeocode(null);
    setSelectedGooglePlaceId(null);
    setSelectedPostPlaceId(null);
    setPostPlaceError(false);
  }, []);

  return {
    visible,
    step,
    mapsApiKey,
    isAddressSuggestionsOpen,
    bodyScrollEnabled: true,
    parentScrollActive: !(
      Platform.OS === "android" &&
      step === "post" &&
      (isAddressSuggestionsOpen || androidKeyboardTransitioning)
    ),
    createStepFadeStyle,
    postInput,
    postInputError,
    postPhotosError,
    setPostInput,
    setPostInputError,
    setPostPhotosError,
    selectedPostPlaceId,
    setSelectedPostPlaceId,
    postPlaceError,
    setPostPlaceError,
    postPhotos,
    setPostPhotos,
    postSubmitStage,
    postAddressDraft,
    setPostAddressDraft,
    geocodeSuggestions,
    addressGeocodeLoading,
    selectedGeocode,
    postAddressFieldRef,
    measurePostAddressFieldBottom,
    postAddressSuggestionsMaxHeight,
    matchedPlacesForAddress,
    matchedPlaceCarouselVm,
    placeImageHeight: POST_PLACE_IMAGE_HEIGHT,
    createPostPending: createPost.isPending,
    uploadingPostPhotos,
    openMenu,
    close,
    setVisible,
    setStep,
    resetComposer,
    pickPostPhotos,
    submitPost,
    selectGeocodeSuggestion,
    clearSelectedAddress,
    backToMenu,
  };
}
