import { useCallback, useEffect, useMemo, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useNavigation } from "@react-navigation/native";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useBookingCreditsSync } from "@/entities/booking-credits";
import type { BookingChatContext, BookingChatMessage } from "../model/types";
import type { PixAIPlace, PixAISearchMeta } from "@/entities/pixai";
import { useBookingChatStore } from "../model/bookingChatStore";
import { executeBookingAssistantTurn } from "../lib/executeBookingAssistantTurn";
import { INSUFFICIENT_AI_CREDITS_ERROR } from "../api/geminiBookingChatAdapter";
import { BookingChatComposer } from "./BookingChatComposer";
import { BookingChatMessageList } from "./BookingChatMessageList";
import { BookingOnboardingControls } from "@/features/ai-booking-onboarding/ui/BookingOnboardingControls";
import type { BookingOnboardingPhase } from "@/features/ai-booking-onboarding";

type Props = {
  catalogRevision: number;
  bookingContext: BookingChatContext | null;
  places: PixAIPlace[];
  searchMeta?: PixAISearchMeta | null;
  composerInputRef?: Ref<TextInput>;
  onComposerInputFocus?: () => void;
  onComposerInputBlur?: () => void;
  onboardingPhase: BookingOnboardingPhase;
  searchPlacesBusy: boolean;
  nearMeLabel: string;
  allPlacesInMyCityLabel: string;
  onOpenCityPicker: () => void;
  onOpenCategoryPicker: () => void;
  onScopeSelected: (scope: "nearby" | "city") => void;
  onOnboardingTypewriterComplete: (messageId: string) => void;
  openingTypewriterEpoch?: number;
  /** Free-form query typed before a search has run yet — bypasses city/category/scope prompts. */
  onFreeTextQuery: (text: string) => void;
};

const PRE_SEARCH_COMPOSER_PHASES: BookingOnboardingPhase[] = [
  "greeting",
  "await_city",
  "await_category",
  "await_scope",
];

export function BookingInlineAssistantChat({
  catalogRevision,
  bookingContext,
  places,
  searchMeta,
  composerInputRef,
  onComposerInputFocus,
  onComposerInputBlur,
  onboardingPhase,
  searchPlacesBusy,
  nearMeLabel,
  allPlacesInMyCityLabel,
  onOpenCityPicker,
  onOpenCategoryPicker,
  onScopeSelected,
  onOnboardingTypewriterComplete,
  openingTypewriterEpoch = 0,
  onFreeTextQuery,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { syncBalance, refreshBalance } = useBookingCreditsSync();
  const navigation = useNavigation<{ navigate: (name: "SubscriptionPaywall", params?: { reason?: "no_credits" | "upgrade" }) => void }>();
  const isSending = useBookingChatStore((s) => s.isSending);
  const sendError = useBookingChatStore((s) => s.sendError);

  useEffect(() => {
    if (sendError !== INSUFFICIENT_AI_CREDITS_ERROR) return;
    void refreshBalance();
    navigation.navigate("SubscriptionPaywall", { reason: "no_credits" });
  }, [sendError, navigation, refreshBalance]);

  const activeMessages = useBookingChatStore(
    useShallow((s) => {
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      return tab?.messages ?? [];
    }),
  );

  const geminiPhase = onboardingPhase === "gemini";

  const placeLite = useMemo(
    () =>
      places.map((p) => ({
        id: p.id,
        name: p.name,
        city: p.city,
        rating: p.rating,
        booking_price: p.booking_price,
        tags: p.tags ?? [],
        cuisine_types: p.cuisine_types ?? [],
        menu_items: p.menu_items ?? [],
        price_tier: p.price_tier ?? null,
        fts_matched: p.fts_matched ?? null,
      })),
    [places],
  );

  const orderedIds = useMemo(() => places.map((p) => p.id), [places]);

  useEffect(() => {
    useBookingChatStore.getState().ensureActiveTab(catalogRevision);
  }, [catalogRevision]);

  const preSearchComposerPhase = PRE_SEARCH_COMPOSER_PHASES.includes(onboardingPhase);

  const onSend = useCallback(
    async (text: string) => {
      if (!geminiPhase) {
        if (preSearchComposerPhase) onFreeTextQuery(text);
        return;
      }
      if (!bookingContext) return;
      const st = useBookingChatStore.getState();
      const tabId = st.activeTabId;
      if (!tabId) return;
      const tabBefore = st.tabs.find((t) => t.id === tabId);
      if (!tabBefore) return;
      const prior = tabBefore.messages
        .filter(
          (m: BookingChatMessage): m is BookingChatMessage & { role: "user" | "assistant" } =>
            m.role === "user" || m.role === "assistant",
        )
        .map((m: BookingChatMessage & { role: "user" | "assistant" }) => ({ role: m.role, content: m.content }));

      await executeBookingAssistantTurn({
        tabId,
        userText: text,
        catalogRevision,
        bookingContext,
        places: placeLite,
        orderedIds,
        prior,
        searchMeta,
        onCreditsChanged: syncBalance,
      });
    },
    [
      bookingContext,
      catalogRevision,
      geminiPhase,
      onFreeTextQuery,
      orderedIds,
      placeLite,
      preSearchComposerPhase,
      searchMeta,
      syncBalance,
    ],
  );

  return (
    <View
      collapsable={false}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.card,
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 8,
      }}
    >
      {sendError && sendError !== INSUFFICIENT_AI_CREDITS_ERROR ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>{sendError}</Text>
      ) : null}
      <Pressable onPress={Keyboard.dismiss} style={{ paddingVertical: 8, gap: 6 }}>
        <BookingChatMessageList
          messages={activeMessages}
          openingTypewriterEpoch={openingTypewriterEpoch}
          onOnboardingTypewriterComplete={onOnboardingTypewriterComplete}
        />
        <BookingOnboardingControls
          phase={onboardingPhase}
          nearMeLabel={nearMeLabel}
          allPlacesInMyCityLabel={allPlacesInMyCityLabel}
          searchPlacesBusy={searchPlacesBusy}
          onOpenCityPicker={onOpenCityPicker}
          onOpenCategoryPicker={onOpenCategoryPicker}
          onScopeSelected={onScopeSelected}
        />
      </Pressable>
      {geminiPhase || preSearchComposerPhase ? (
        <BookingChatComposer
          disabled={geminiPhase ? places.length === 0 || !bookingContext : searchPlacesBusy}
          sending={geminiPhase ? isSending : searchPlacesBusy}
          onSend={onSend}
          inputRef={composerInputRef}
          onInputFocus={onComposerInputFocus}
          onInputBlur={onComposerInputBlur}
          placeholder={geminiPhase ? undefined : t("aiBooking.freeTextComposerPlaceholder")}
        />
      ) : null}
    </View>
  );
}
