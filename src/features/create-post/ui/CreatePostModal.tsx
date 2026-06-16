import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { CommentComposer } from "@/shared/ui/comment-composer/CommentComposer";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
import type { useCreatePostComposer } from "../model/useCreatePostComposer";
import { createPostStyles as s } from "./createPostStyles";
import { MAX_POST_PHOTOS } from "../model/constants";

type ComposerState = ReturnType<typeof useCreatePostComposer>;

interface CreatePostModalProps {
  composer: ComposerState;
  onOpenStory: () => void;
  storyAvailable: boolean;
}

export function CreatePostModal({ composer, onOpenStory, storyAvailable }: CreatePostModalProps) {
  const { colors, isDark } = useAppTheme();
  const { t } = useTranslation();
  const c = composer;

  const placeImageDecodeSize = { w: 142, h: 84 };

  return (
    <BottomSheetPickerModal
      visible={c.visible}
      onClose={c.close}
      title={c.step === "menu" ? "Create" : "Create post"}
      maxHeightFraction={c.step === "post" ? 0.95 : 0.82}
      bodyScrollEnabled={c.bodyScrollEnabled}
      parentScrollActive={c.parentScrollActive}
    >
      <Animated.View style={[s.createStepBody, c.createStepFadeStyle]}>
        {c.step === "menu" ? (
          <View style={s.createMenuBody}>
            <View style={s.createOptionGrid}>
              <Pressable
                style={[s.createOptionCard, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => c.setStep("post")}
              >
                <Ionicons name="grid-outline" size={34} color={colors.text} />
                <Text style={[s.createOptionLabel, { color: colors.text }]}>Post</Text>
                <Text style={[s.createOptionHint, { color: colors.textMuted }]}>Create a new post</Text>
              </Pressable>
              <Pressable
                style={[s.createOptionCard, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => {
                  c.close();
                  if (!storyAvailable) {
                    Alert.alert("Place is required", "Please add or select a place first.");
                    return;
                  }
                  onOpenStory();
                }}
              >
                <Ionicons name="add-circle-outline" size={34} color={colors.text} />
                <Text style={[s.createOptionLabel, { color: colors.text }]}>Story</Text>
                <Text style={[s.createOptionHint, { color: colors.textMuted }]}>Share a quick story</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={s.createPostModalBody}>
            {c.postSubmitStage ? (
              <View style={s.createPostLoadingOnlyWrap}>
                <View style={s.createPostLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[s.createPostLoadingText, { color: colors.textMuted }]}>
                    {c.postSubmitStage === "uploading_photos" ? "Uploading photos..." : "Creating post..."}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {!c.mapsApiKey ? (
                  <Text style={[s.postAddressMapsHint, { color: colors.danger }]}>
                    Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY with Places API (Autocomplete) and Geocoding API enabled.
                  </Text>
                ) : null}

                <Text style={[s.postFieldLabel, { color: colors.text }]}>
                  Search address (Google)
                  <Text style={{ color: colors.danger }}> *</Text>
                </Text>
                <Text style={[s.postFieldHint, { color: colors.textMuted }]}>
                  Required — pick an address from the suggestion list
                </Text>

                <View
                  ref={c.postAddressFieldRef}
                  onLayout={c.measurePostAddressFieldBottom}
                  style={s.postAddressFieldWrap}
                >
                  <View
                    style={[
                      s.postAddressInputWrap,
                      {
                        borderColor: c.postPlaceError ? colors.danger : colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                  >
                    {c.selectedGeocode ? (
                      <View style={s.postSelectedAddressWrap}>
                        <View style={s.postSelectedAddressTextCol}>
                          <Text style={[s.postSelectedAddressLabel, { color: colors.textMuted }]}>Selected address</Text>
                          <Text style={[s.postSelectedAddressText, { color: colors.text }]} numberOfLines={3}>
                            {c.selectedGeocode.formattedAddress}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <TextInput
                        value={c.postAddressDraft}
                        onChangeText={(value) => {
                          c.setPostAddressDraft(value);
                          if (c.postPlaceError) c.setPostPlaceError(false);
                        }}
                        placeholder="Search address (Google)"
                        placeholderTextColor={colors.textMuted}
                        style={[s.postAddressInput, { color: colors.text }]}
                        autoCorrect={false}
                        editable={Boolean(c.mapsApiKey)}
                      />
                    )}
                    {c.selectedGeocode || c.postAddressDraft.length > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Clear address"
                        style={s.postAddressClearBtn}
                        onPress={c.clearSelectedAddress}
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>

                  {!c.selectedGeocode && c.postAddressDraft.trim().length >= 2 && c.mapsApiKey ? (
                    <View
                      style={[
                        s.postAddressSuggestionsBox,
                        { borderColor: colors.border, backgroundColor: colors.card, maxHeight: c.postAddressSuggestionsMaxHeight },
                      ]}
                    >
                      {c.addressGeocodeLoading && c.geocodeSuggestions.length === 0 ? (
                        <View style={s.postAddressSuggestionsLoading}>
                          <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                      ) : !c.addressGeocodeLoading && c.geocodeSuggestions.length === 0 ? (
                        <Text style={[s.postAddressSuggestionsEmpty, { color: colors.textMuted }]}>No matching addresses</Text>
                      ) : (
                        <ScrollView
                          style={[s.postAddressSuggestionsScroll, { maxHeight: c.postAddressSuggestionsMaxHeight }]}
                          keyboardShouldPersistTaps="handled"
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                        >
                          {c.geocodeSuggestions.map((item) => (
                            <Pressable
                              key={item.placeId}
                              style={s.postAddressSuggestionRow}
                              onPress={() => void c.selectGeocodeSuggestion(item.placeId)}
                            >
                              <Text style={[s.postAddressSuggestionTitle, { color: colors.text }]} numberOfLines={1}>
                                {item.placeName}
                              </Text>
                              <Text style={[s.postAddressSuggestionSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
                                {item.formattedAddress}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  ) : null}
                </View>

                {c.postPlaceError ? (
                  <Text style={[s.postFieldError, { color: colors.danger }]}>
                    Please select an address from the suggestions.
                  </Text>
                ) : null}

                {c.selectedGeocode ? (
                  c.matchedPlaceCarouselVm.length > 0 ? (
                    <>
                      <Text style={[s.postMatchedPlacesCaption, { color: colors.textMuted }]}>
                        Places at this address in the app (optional)
                      </Text>
                      <Text style={[s.postFieldHint, { color: colors.textMuted }]}>
                        Link your post to a venue, or skip if it is about this address in general.
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.postPlacesRow}
                        keyboardShouldPersistTaps="handled"
                      >
                        {c.matchedPlaceCarouselVm.map((place) => {
                          const isSelected = c.selectedPostPlaceId === place.id;
                          return (
                            <Pressable
                              key={`create-post-place-${place.id}`}
                              style={[
                                s.postPlaceCard,
                                { borderColor: isSelected ? colors.accent : c.postPlaceError ? colors.danger : colors.border, backgroundColor: colors.card },
                              ]}
                              onPress={() => {
                                c.setSelectedPostPlaceId((prev: string | null) => (prev === place.id ? null : place.id));
                                c.setPostPlaceError(false);
                              }}
                            >
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Remove place and clear address"
                                style={[s.postPlaceCardRemoveBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={(event) => {
                                  event.stopPropagation();
                                  c.clearSelectedAddress();
                                }}
                              >
                                <Ionicons name="close" size={11} color={colors.text} />
                              </Pressable>
                              <View style={s.postPlaceImageWrap}>
                                {place.imageUrl ? (
                                  <SmartImage
                                    uri={getOptimizedImageUrl(place.imageUrl, placeImageDecodeSize.w, placeImageDecodeSize.h, 72) || place.imageUrl}
                                    fallbackUri={place.imageUrl}
                                    style={s.postPlaceImage}
                                    contentFit="cover"
                                  />
                                ) : (
                                  <View style={[s.postPlaceImage, s.postPlaceImageFallback, { backgroundColor: colors.background }]}>
                                    <Ionicons name="image-outline" size={18} color={colors.textMuted} />
                                  </View>
                                )}
                                <View style={[s.postPlaceRatingBadge, { backgroundColor: colors.scrim }]}>
                                  <Ionicons name="star" size={10} color="#fbbf24" />
                                  <Text style={s.postPlaceRatingText}>
                                    {Number.isFinite(place.rating) ? (place.rating as number).toFixed(1) : "-"}
                                  </Text>
                                </View>
                              </View>
                              <Text style={[s.postPlaceCardTitle, { color: colors.text }]} numberOfLines={1}>{place.name}</Text>
                              <Text style={[s.postPlaceCardAddress, { color: colors.textMuted }]} numberOfLines={2}>{place.address}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </>
                  ) : (
                    <Text style={[s.postNewPlaceHint, { color: colors.textMuted }]}>
                      No place in the app matches this address. The location will be saved on this post only (not added as a new place in the catalogue).
                    </Text>
                  )
                ) : null}

                <Text style={[s.postFieldLabel, { color: colors.text }]}>
                  Photos<Text style={{ color: colors.danger }}> *</Text>
                  <Text style={[s.postFieldLabelHint, { color: colors.textMuted }]}> (Required — at least one image)</Text>
                </Text>
                <Pressable
                  style={[s.postUploaderBox, { borderColor: c.postPhotosError ? colors.danger : colors.border }]}
                  onPress={() => void c.pickPostPhotos()}
                >
                  <Ionicons name="images-outline" size={22} color={colors.textMuted} />
                  <Text style={[s.postUploaderText, { color: colors.textMuted }]}>Tap to add photos</Text>
                  <Text style={[s.postPhotoCount, { color: colors.textMuted }]}>
                    {c.postPhotos.length ? `${c.postPhotos.length}/${MAX_POST_PHOTOS} selected` : `Up to ${MAX_POST_PHOTOS} photos`}
                  </Text>
                </Pressable>
                {c.postPhotosError ? (
                  <Text style={[s.postFieldError, { color: colors.danger }]}>Please add at least one photo.</Text>
                ) : null}

                {c.postPhotos.length ? (
                  <View style={s.postPhotosList}>
                    {c.postPhotos.map((photo) => (
                      <View key={photo.uri} style={s.postPhotoItem}>
                        <SmartImage uri={photo.uri} style={s.postPhotoThumb} contentFit="cover" />
                        <Pressable
                          style={[s.postPhotoRemoveBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => c.setPostPhotos((prev) => prev.filter((item) => item.uri !== photo.uri))}
                        >
                          <Ionicons name="close" size={11} color={colors.text} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Text style={[s.postFieldLabel, { color: colors.text }]}>
                  Post text<Text style={{ color: colors.danger }}> *</Text>
                  <Text style={[s.postFieldLabelHint, { color: colors.textMuted }]}> (Required — share an update)</Text>
                </Text>
                <CommentComposer
                  avatarUrl={null}
                  showAvatar={false}
                  showStickers
                  showSendButton={false}
                  value={c.postInput}
                  onChangeText={(value) => {
                    c.setPostInput(value);
                    if (c.postInputError && value.trim()) c.setPostInputError(false);
                  }}
                  placeholder="Share an update..."
                  canSend={false}
                  sending={false}
                  onSend={() => undefined}
                  minHeight={120}
                  maxHeight={220}
                  hasError={c.postInputError}
                />
                {c.postInputError ? (
                  <Text style={[s.postFieldError, { color: colors.danger }]}>Please enter your post text.</Text>
                ) : null}

                <View style={s.createPostBackRow}>
                  <Pressable
                    style={[s.createFlowBackBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={c.backToMenu}
                  >
                    <Text style={[s.createFlowBackBtnText, { color: colors.textMuted }]}>Back to create options</Text>
                  </Pressable>
                  <Pressable
                    style={[s.createFlowBackBtn, s.createPostPrimaryBtn, { backgroundColor: colors.accent, borderColor: colors.accent, opacity: c.createPostPending || c.uploadingPostPhotos ? 0.55 : 1 }]}
                    onPress={() => void c.submitPost()}
                    disabled={c.createPostPending || c.uploadingPostPhotos}
                  >
                    <Ionicons name="paper-plane" size={18} color={colors.onAccent} />
                    <Text style={[s.createFlowBackBtnText, { color: colors.onAccent }]}>Create post</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}
      </Animated.View>
    </BottomSheetPickerModal>
  );
}
