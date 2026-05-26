import { useCallback, useMemo, type Ref } from "react";
import { useShallow } from "zustand/react/shallow";
import { Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BookingChatContext, BookingChatMessage } from "../model/types";
import type { PixAIPlace } from "@/entities/pixai";
import { useBookingChatStore } from "../model/bookingChatStore";
import { executeBookingAssistantTurn } from "../lib/executeBookingAssistantTurn";
import { bookingChatListRowKey, flattenChainedOpeningMessages } from "../lib/flattenChainedOpeningMessages";
import { isPixBookingAssistantGreeting } from "../model/constants";
import { BookingChatComposer } from "./BookingChatComposer";
import { BookingChainedOpeningAssistantPair } from "./BookingChainedOpeningAssistantPair";
import { BookingGreetingTypewriterText } from "./BookingGreetingTypewriterText";
import { BookingChatTabsStrip } from "./BookingChatTabsStrip";
import { useBookingInlineThreadStyles } from "./useBookingInlineThreadStyles";

type Props = {
  catalogRevision: number;
  bookingContext: BookingChatContext;
  places: PixAIPlace[];
  composerInputRef?: Ref<TextInput>;
  onComposerInputFocus?: () => void;
  onComposerInputBlur?: () => void;
};

export function BookingInlineAssistantChat({
  catalogRevision,
  bookingContext,
  places,
  composerInputRef,
  onComposerInputFocus,
  onComposerInputBlur,
}: Props) {
  const { colors } = useAppTheme();
  const ts = useBookingInlineThreadStyles();
  const tabs = useBookingChatStore(useShallow((s) => s.tabs));
  const activeTabId = useBookingChatStore((s) => s.activeTabId);
  const isSending = useBookingChatStore((s) => s.isSending);
  const sendError = useBookingChatStore((s) => s.sendError);

  const addTab = useBookingChatStore((s) => s.addTab);
  const closeTab = useBookingChatStore((s) => s.closeTab);
  const setActiveTab = useBookingChatStore((s) => s.setActiveTab);

  const activeMessages = useBookingChatStore(
    useShallow((s) => {
      const t = s.tabs.find((x) => x.id === s.activeTabId);
      return t?.messages ?? [];
    }),
  );

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

  const listRows = useMemo(() => flattenChainedOpeningMessages(activeMessages), [activeMessages]);

  const onSend = useCallback(
    async (text: string) => {
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
    [bookingContext, catalogRevision, orderedIds, placeLite],
  );

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: colors.card,
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 8,
      }}
    >
      <BookingChatTabsStrip
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTab}
        onAdd={() => addTab(catalogRevision)}
        onCloseTab={closeTab}
      />
      {sendError ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>{sendError}</Text>
      ) : null}
      <View style={{ paddingVertical: 8, gap: 6 }}>
        {listRows.map((row) => {
          if (row.kind === "chained_opening") {
            return (
              <BookingChainedOpeningAssistantPair
                key={bookingChatListRowKey(row)}
                variant="inline"
                first={row.first}
                second={row.second}
              />
            );
          }
          const item = row.item;
          const isUser = item.role === "user";
          const greetingTw = !isUser && isPixBookingAssistantGreeting(item);
          return (
            <View key={item.id} style={isUser ? ts.bubbleWrapMine : ts.bubbleWrapPeer}>
              <View style={[ts.bubble, isUser ? ts.bubbleMine : ts.bubblePeer]}>
                {greetingTw ? (
                  <BookingGreetingTypewriterText
                    runOnceKey={item.id}
                    textStyle={isUser ? ts.bubbleTextMine : ts.bubbleTextPeer}
                  />
                ) : (
                  <Text style={isUser ? ts.bubbleTextMine : ts.bubbleTextPeer}>{item.content}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
      <BookingChatComposer
        disabled={places.length === 0}
        sending={isSending}
        onSend={onSend}
        inputRef={composerInputRef}
        onInputFocus={onComposerInputFocus}
        onInputBlur={onComposerInputBlur}
      />
    </View>
  );
}
