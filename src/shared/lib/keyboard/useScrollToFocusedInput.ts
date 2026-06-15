import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import {
  Keyboard,
  Platform,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type TextInput,
} from "react-native";

const DEFAULT_GAP = Platform.OS === "android" ? 48 : 16;

type Options = {
  gap?: number;
  /** Share scroll offset with an existing ref (e.g. persisted scroll position). */
  scrollOffsetYRef?: MutableRefObject<number>;
};

/**
 * Scrolls a ScrollView so the focused TextInput stays above the software keyboard.
 */
export function useScrollToFocusedInput(
  scrollRef: RefObject<ScrollView | null>,
  options?: Options,
) {
  const gap = options?.gap ?? DEFAULT_GAP;
  const internalScrollOffsetYRef = useRef(0);
  const scrollOffsetYRef = options?.scrollOffsetYRef ?? internalScrollOffsetYRef;
  const activeInputRef = useRef<TextInput | null>(null);
  const keyboardTopRef = useRef<number | null>(null);

  const ensureFocusedInputVisible = useCallback(
    (keyboardTop: number) => {
      const focusedField = activeInputRef.current;
      if (!focusedField || typeof focusedField.measureInWindow !== "function") return;

      focusedField.measureInWindow((_x, y, _w, h) => {
        const overlap = Math.max(0, y + h + gap - keyboardTop);
        if (overlap <= 0) return;
        scrollRef.current?.scrollTo({
          y: scrollOffsetYRef.current + overlap,
          animated: true,
        });
      });
    },
    [gap, scrollRef],
  );

  const scheduleEnsureVisible = useCallback(
    (keyboardTop: number) => {
      ensureFocusedInputVisible(keyboardTop);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ensureFocusedInputVisible(keyboardTop);
        });
      });
    },
    [ensureFocusedInputVisible],
  );

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (event: KeyboardEvent) => {
      const { height, screenY } = event.endCoordinates;
      if (!height || height < 1) {
        keyboardTopRef.current = null;
        return;
      }
      keyboardTopRef.current = screenY;
      scheduleEnsureVisible(screenY);
    };

    const onHide = () => {
      keyboardTopRef.current = null;
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scheduleEnsureVisible]);

  const onInputFocus = useCallback(
    (fieldRef: RefObject<TextInput | null>) => {
      activeInputRef.current = fieldRef.current;
      const keyboardTop = keyboardTopRef.current;
      if (keyboardTop != null) {
        scheduleEnsureVisible(keyboardTop);
      }
    },
    [scheduleEnsureVisible],
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  return { onInputFocus, onScroll };
}
