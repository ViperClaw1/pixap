import { useCallback, useEffect, useMemo } from "react";
import {
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  StyleSheet,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BookingChatContext, BookingChatMessage } from "../model/types";
import type { PixAIPlace } from "@/entities/pixai";
import { useBookingChatStore } from "../model/bookingChatStore";
import { executeBookingAssistantTurn } from "../lib/executeBookingAssistantTurn";
import type { BookingChatListRow } from "../lib/flattenChainedOpeningMessages";
import { bookingChatListRowKey, flattenChainedOpeningMessages } from "../lib/flattenChainedOpeningMessages";
import { BookingChainedOpeningAssistantPair } from "./BookingChainedOpeningAssistantPair";
import { BookingChatComposer } from "./BookingChatComposer";
import { BookingChatMessageRow } from "./BookingChatMessageRow";
import { BookingChatTabsStrip } from "./BookingChatTabsStrip";

type PanelProps = {
  open: boolean;
  onClose: () => void;
  catalogRevision: number;
  bookingContext: BookingChatContext;
  places: PixAIPlace[];
};

const SPRING_OPEN = { damping: 22, stiffness: 220, mass: 0.75 } as const;

function BookingChatPanel({ open, onClose, catalogRevision, bookingContext, places }: PanelProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const panelH = Math.min(winH * 0.48, 420);
  const safeBottom = Math.max(12, insets.bottom);
  const sheetOffY = useMemo(() => Math.min(winH * 0.65, panelH + safeBottom + 120), [winH, panelH, safeBottom]);

  const translateY = useSharedValue(sheetOffY);
  const keyboardOffset = useSharedValue(0);
  const panStartY = useSharedValue(0);

  const tabs = useBookingChatStore((s) => s.tabs);
  const activeTabId = useBookingChatStore((s) => s.activeTabId);
  const isSending = useBookingChatStore((s) => s.isSending);
  const sendError = useBookingChatStore((s) => s.sendError);

  const activeMessages = useMemo(() => {
    const t = tabs.find((x) => x.id === activeTabId);
    return t?.messages ?? [];
  }, [tabs, activeTabId]);

  const listRows = useMemo(() => flattenChainedOpeningMessages(activeMessages), [activeMessages]);

  const ensureActiveTab = useBookingChatStore((s) => s.ensureActiveTab);
  const addTab = useBookingChatStore((s) => s.addTab);
  const closeTab = useBookingChatStore((s) => s.closeTab);
  const setActiveTab = useBookingChatStore((s) => s.setActiveTab);

  useEffect(() => {
    if (open) ensureActiveTab(catalogRevision);
  }, [open, catalogRevision, ensureActiveTab]);

  useEffect(() => {
    if (open) {
      translateY.value = withSpring(0, SPRING_OPEN);
    } else {
      translateY.value = withTiming(sheetOffY, { duration: 260 });
    }
  }, [open, sheetOffY, translateY]);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates.height;
      const duration =
        Platform.OS === "ios" && typeof e.duration === "number" && e.duration > 0 ? e.duration : 240;
      keyboardOffset.value = withTiming(h, { duration: Math.max(120, duration) });
    };
    const onHide = (e: KeyboardEvent) => {
      const duration =
        Platform.OS === "ios" && typeof e.duration === "number" && e.duration > 0 ? e.duration : 200;
      keyboardOffset.value = withTiming(0, { duration: Math.max(100, duration) });
    };
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [keyboardOffset]);

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
    ({ item }: { item: BookingChatListRow }) => {
      if (item.kind === "chained_opening") {
        return (
          <BookingChainedOpeningAssistantPair variant="panel" first={item.first} second={item.second} />
        );
      }
      return <BookingChatMessageRow item={item.item} />;
    },
    [],
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

  const requestClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(open)
        .activeOffsetY(12)
        .failOffsetX([-32, 32])
        .onStart(() => {
          panStartY.value = translateY.value;
        })
        .onUpdate((e) => {
          const y = Math.max(0, panStartY.value + e.translationY);
          translateY.value = y;
        })
        .onEnd((e) => {
          const dismiss = translateY.value > 100 || e.velocityY > 900;
          if (dismiss) {
            runOnJS(requestClose)();
          } else {
            translateY.value = withSpring(0, SPRING_OPEN);
          }
        }),
    [open, panStartY, requestClose],
  );

  const backdropStyle = useAnimatedStyle(() => {
    const o = interpolate(translateY.value, [0, sheetOffY * 0.5], [0.35, 0], Extrapolation.CLAMP);
    return { opacity: o };
  }, [sheetOffY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - keyboardOffset.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents={open ? "auto" : "none"}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityLabel="Dismiss booking assistant"
        />
      </Animated.View>

      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <Animated.View
          style={[
            {
              height: panelH + safeBottom,
              paddingHorizontal: 12,
              paddingTop: 6,
              paddingBottom: safeBottom,
              backgroundColor: colors.card,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "column",
            },
            sheetStyle,
          ]}
          pointerEvents={open ? "auto" : "none"}
        >
          <GestureDetector gesture={panGesture}>
            <View style={styles.sheetHandleZone}>
              <View style={[styles.grabber, { backgroundColor: colors.border }]} />
              <View style={styles.sheetHeaderRow}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>Booking assistant</Text>
                <Pressable
                  accessibilityLabel="Close assistant"
                  onPress={requestClose}
                  hitSlop={10}
                >
                  <Ionicons name="chevron-down" size={26} color={colors.text} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

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

          <View style={{ flex: 1, minHeight: 80 }}>
            <FlashList<BookingChatListRow>
              data={listRows}
              keyExtractor={bookingChatListRowKey}
              estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.aiBookingChat}
              renderItem={renderMessage}
              contentContainerStyle={{ paddingVertical: 8 }}
              keyboardShouldPersistTaps="handled"
            />
          </View>

          <BookingChatComposer disabled={places.length === 0} sending={isSending} onSend={onSend} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetHandleZone: {
    paddingBottom: 4,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

type DockProps = {
  /** Step booking + selected place */
  visible: boolean;
  catalogRevision: number;
  bookingContext: BookingChatContext | null;
  places: PixAIPlace[];
  /** Distance from bottom of screen to FAB center (above footer) */
  fabBottomOffset: number;
};

export function BookingChatDock({ visible, catalogRevision, bookingContext, places, fabBottomOffset }: DockProps) {
  const { colors } = useAppTheme();
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
      />
    </View>
  );
}
