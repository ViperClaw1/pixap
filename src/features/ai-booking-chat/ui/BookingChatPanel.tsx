import { useCallback, useEffect, useMemo } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  StyleSheet,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ThemeColors } from "@/shared/theme/palettes";
import { Ionicons } from "@expo/vector-icons";
import type { BookingChatContext, BookingChatMessage } from "../model/types";
import type { PixAIPlace } from "@/entities/pixai";
import { useBookingChatStore } from "../model/bookingChatStore";
import { defaultBookingChatProvider } from "../api/geminiBookingChatAdapter";
import { sanitizeAiBookingChatResult } from "../lib/sanitizeAiBookingChatResult";
import { BookingChatComposer } from "./BookingChatComposer";
import { BookingChatMessageRow } from "./BookingChatMessageRow";
import { BookingChatTabsStrip } from "./BookingChatTabsStrip";

type PanelProps = {
  open: boolean;
  onClose: () => void;
  catalogRevision: number;
  bookingContext: BookingChatContext;
  places: PixAIPlace[];
  colors: ThemeColors;
};

function BookingChatPanel({ open, onClose, catalogRevision, bookingContext, places, colors }: PanelProps) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const panelH = Math.min(winH * 0.48, 420);

  const safeBottom = Math.max(12, insets.bottom);

  const tabs = useBookingChatStore((s) => s.tabs);
  const activeTabId = useBookingChatStore((s) => s.activeTabId);
  const isSending = useBookingChatStore((s) => s.isSending);
  const sendError = useBookingChatStore((s) => s.sendError);

  const activeMessages = useMemo(() => {
    const t = tabs.find((x) => x.id === activeTabId);
    return t?.messages ?? [];
  }, [tabs, activeTabId]);

  const ensureActiveTab = useBookingChatStore((s) => s.ensureActiveTab);
  const addTab = useBookingChatStore((s) => s.addTab);
  const closeTab = useBookingChatStore((s) => s.closeTab);
  const setActiveTab = useBookingChatStore((s) => s.setActiveTab);
  const appendUserMessage = useBookingChatStore((s) => s.appendUserMessage);
  const applyAiResult = useBookingChatStore((s) => s.applyAiResult);
  const appendAssistantMessage = useBookingChatStore((s) => s.appendAssistantMessage);
  const setSendState = useBookingChatStore((s) => s.setSendState);

  useEffect(() => {
    if (open) ensureActiveTab(catalogRevision);
  }, [open, catalogRevision, ensureActiveTab]);

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

  const renderMessage = useCallback(
    ({ item }: { item: BookingChatMessage }) => <BookingChatMessageRow item={item} colors={colors} />,
    [colors],
  );

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

      appendUserMessage(tabId, text);
      setSendState({ isSending: true, sendError: null });
      try {
        const raw = await defaultBookingChatProvider.sendTurn({
          bookingContext,
          places: placeLite,
          history: prior,
          userText: text,
        });
        const safe = sanitizeAiBookingChatResult(raw, orderedIds);
        applyAiResult(tabId, safe, catalogRevision);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Request failed";
        appendAssistantMessage(tabId, `Sorry — ${msg}. Your place list was not changed.`);
        setSendState({ sendError: msg });
      } finally {
        setSendState({ isSending: false });
      }
    },
    [
      appendUserMessage,
      appendAssistantMessage,
      applyAiResult,
      bookingContext,
      catalogRevision,
      orderedIds,
      placeLite,
      setSendState,
    ],
  );

  if (!open) return null;

  return (
    <KeyboardAvoidingView
      style={StyleSheet.absoluteFill}
      behavior="padding"
    >
      <View style={{ flex: 1 }} pointerEvents="box-none">
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />
        <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
          <View
            style={{
              height: panelH + safeBottom,
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: safeBottom,
              backgroundColor: colors.card,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "column",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>Booking assistant</Text>
              <Pressable
                accessibilityLabel="Close assistant"
                onPress={() => {
                  Keyboard.dismiss();
                  onClose();
                }}
                hitSlop={10}
              >
                <Ionicons name="chevron-down" size={26} color={colors.text} />
              </Pressable>
            </View>

            <BookingChatTabsStrip
              tabs={tabs}
              activeTabId={activeTabId}
              colors={colors}
              onSelect={setActiveTab}
              onAdd={() => addTab(catalogRevision)}
              onCloseTab={closeTab}
            />

            {sendError ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>{sendError}</Text>
            ) : null}

            <View style={{ flex: 1, minHeight: 80 }}>
              <FlashList<BookingChatMessage>
                data={activeMessages}
                keyExtractor={(item) => item.id}
                estimatedItemSize={76}
                renderItem={renderMessage}
                contentContainerStyle={{ paddingVertical: 8 }}
                keyboardShouldPersistTaps="handled"
              />
            </View>

            <BookingChatComposer colors={colors} disabled={places.length === 0} sending={isSending} onSend={onSend} />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

type DockProps = {
  /** Step booking + selected place */
  visible: boolean;
  catalogRevision: number;
  bookingContext: BookingChatContext | null;
  places: PixAIPlace[];
  colors: ThemeColors;
  /** Distance from bottom of screen to FAB center (above footer) */
  fabBottomOffset: number;
};

export function BookingChatDock({ visible, catalogRevision, bookingContext, places, colors, fabBottomOffset }: DockProps) {
  const panelOpen = useBookingChatStore((s) => s.panelOpen);
  const setPanelOpen = useBookingChatStore((s) => s.setPanelOpen);

  useEffect(() => {
    if (!visible) setPanelOpen(false);
  }, [visible, setPanelOpen]);

  if (!visible || !bookingContext) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 40,
      }}
    >
      {!panelOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open booking assistant"
          onPress={() => {
            useBookingChatStore.getState().ensureActiveTab(catalogRevision);
            setPanelOpen(true);
          }}
          style={{
            position: "absolute",
            right: 16,
            bottom: fabBottomOffset,
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            elevation: 4,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            zIndex: 20,
          }}
        >
          <Ionicons name="chatbubbles" size={24} color={colors.onPrimary} />
        </Pressable>
      ) : null}

      <BookingChatPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        catalogRevision={catalogRevision}
        bookingContext={bookingContext}
        places={places}
        colors={colors}
      />
    </View>
  );
}
