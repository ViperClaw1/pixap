import { useCallback, useEffect, useMemo, type Ref } from "react";
import { useShallow } from "zustand/react/shallow";
import { Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BookingChatContext, BookingChatMessage } from "../model/types";
import type { PixAIPlace } from "@/entities/pixai";
import { useBookingChatStore } from "../model/bookingChatStore";
import { executeBookingAssistantTurn } from "../lib/executeBookingAssistantTurn";
import { BookingChatComposer } from "./BookingChatComposer";
import { BookingChatMessageList } from "./BookingChatMessageList";
import { BookingOnboardingControls } from "@/features/ai-booking-onboarding/ui/BookingOnboardingControls";
import type { BookingOnboardingPhase } from "@/features/ai-booking-onboarding";

type Props = {
  catalogRevision: number;
  bookingContext: BookingChatContext | null;
  places: PixAIPlace[];
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
};

export function BookingInlineAssistantChat({
  catalogRevision,
  bookingContext,
  places,
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
}: Props) {
  const { colors } = useAppTheme();
  const isSending = useBookingChatStore((s) => s.isSending);
  const sendError = useBookingChatStore((s) => s.sendError);

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
      })),
    [places],
  );

  const orderedIds = useMemo(() => places.map((p) => p.id), [places]);

  useEffect(() => {
    useBookingChatStore.getState().ensureActiveTab(catalogRevision);
  }, [catalogRevision]);

  const onSend = useCallback(
    async (text: string) => {
      if (!bookingContext || !geminiPhase) return;
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
      });
    },
    [bookingContext, catalogRevision, geminiPhase, orderedIds, placeLite],
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
      {sendError ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>{sendError}</Text>
      ) : null}
      <View style={{ paddingVertical: 8, gap: 6 }}>
        <BookingChatMessageList
          messages={activeMessages}
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
      </View>
      {geminiPhase ? (
        <BookingChatComposer
          disabled={places.length === 0 || !bookingContext}
          sending={isSending}
          onSend={onSend}
          inputRef={composerInputRef}
          onInputFocus={onComposerInputFocus}
          onInputBlur={onComposerInputBlur}
        />
      ) : null}
    </View>
  );
}
