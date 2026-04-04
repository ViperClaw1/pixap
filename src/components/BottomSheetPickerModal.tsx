import { type ReactNode, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";

const SHEET_MAX_FRACTION = 0.5;
/** Grabber + title row + border — must match layout below */
const SHEET_HEADER_HEIGHT = 88;

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function BottomSheetPickerModal({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = windowHeight * SHEET_MAX_FRACTION;
  const scrollMaxHeight = Math.max(120, sheetMaxHeight - SHEET_HEADER_HEIGHT - Math.max(insets.bottom, 8));

  const translateY = useRef(new Animated.Value(0)).current;
  const metricsRef = useRef({ windowHeight, sheetMaxHeight });
  metricsRef.current = { windowHeight, sheetMaxHeight };
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        const { windowHeight: wh, sheetMaxHeight: smh } = metricsRef.current;
        const threshold = Math.min(100, smh * 0.2);
        if (g.dy > threshold || g.vy > 0.45) {
          Animated.timing(translateY, {
            toValue: wh,
            duration: 240,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) onCloseRef.current();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
    }),
  ).current;

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.45)",
        },
        sheet: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: sheetMaxHeight,
          backgroundColor: colors.card,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 10),
        },
        grabberWrap: {
          alignItems: "center",
          paddingTop: 10,
          paddingBottom: 8,
        },
        grabberHit: {
          paddingVertical: 8,
          paddingHorizontal: 24,
        },
        grabber: {
          width: 40,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.textMuted,
          opacity: 0.55,
        },
        title: {
          color: colors.text,
          fontSize: 16,
          fontWeight: "700",
          paddingHorizontal: 14,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
      }),
    [colors.border, colors.card, colors.text, colors.textMuted, insets.bottom, sheetMaxHeight],
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={stylesThemed.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
        <Animated.View style={[stylesThemed.sheet, { transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers}>
            <Pressable
              style={stylesThemed.grabberWrap}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close picker"
            >
              <View style={stylesThemed.grabberHit}>
                <View style={stylesThemed.grabber} />
              </View>
            </Pressable>
            <Text style={stylesThemed.title}>{title}</Text>
          </View>
          <ScrollView
            style={{ maxHeight: scrollMaxHeight }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
