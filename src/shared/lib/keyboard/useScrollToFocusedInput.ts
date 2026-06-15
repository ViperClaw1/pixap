import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type TextInput,
} from "react-native";

const DEFAULT_GAP = Platform.OS === "android" ? 48 : 16;
const ANDROID_SCROLL_DEDUPE_PX = 4;
/** Typical Android soft-keyboard height until the first `keyboardDidShow`. */
const ANDROID_DEFAULT_KEYBOARD_HEIGHT = 280;

type Options = {
  gap?: number;
  /** Share scroll offset with an existing ref (e.g. persisted scroll position). */
  scrollOffsetYRef?: MutableRefObject<number>;
};

type EnsureVisibleOptions = {
  animated?: boolean;
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
  const lastKeyboardHeightRef = useRef(ANDROID_DEFAULT_KEYBOARD_HEIGHT);
  const lastAndroidScrollYRef = useRef<number | null>(null);

  const resolveAndroidKeyboardTop = useCallback((knownTop: number | null): number => {
    if (knownTop != null) return knownTop;
    return Dimensions.get("window").height - lastKeyboardHeightRef.current;
  }, []);

  const ensureFocusedInputVisible = useCallback(
    (keyboardTop: number, ensureOptions?: EnsureVisibleOptions) => {
      const focusedField = activeInputRef.current;
      if (!focusedField || typeof focusedField.measureInWindow !== "function") return;

      focusedField.measureInWindow((_x, y, _w, h) => {
        const overlap = Math.max(0, y + h + gap - keyboardTop);
        if (overlap <= 0) return;
        const targetY = scrollOffsetYRef.current + overlap;
        const animated = ensureOptions?.animated ?? true;
        if (
          Platform.OS === "android" &&
          lastAndroidScrollYRef.current != null &&
          Math.abs(lastAndroidScrollYRef.current - targetY) < ANDROID_SCROLL_DEDUPE_PX
        ) {
          return;
        }
        if (Platform.OS === "android") {
          lastAndroidScrollYRef.current = targetY;
        }
        scrollRef.current?.scrollTo({
          y: targetY,
          animated,
        });
      });
    },
    [gap, scrollRef, scrollOffsetYRef],
  );

  const scheduleEnsureVisible = useCallback(
    (keyboardTop: number, ensureOptions?: EnsureVisibleOptions) => {
      if (Platform.OS === "android") {
        ensureFocusedInputVisible(keyboardTop, ensureOptions);
        return;
      }

      ensureFocusedInputVisible(keyboardTop, ensureOptions);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ensureFocusedInputVisible(keyboardTop, ensureOptions);
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
      lastKeyboardHeightRef.current = height;

      if (Platform.OS === "android") {
        // Snap to final position once keyboard metrics are known (focus scroll already ran in parallel).
        scheduleEnsureVisible(screenY, { animated: false });
        return;
      }

      scheduleEnsureVisible(screenY);
    };

    const onHide = () => {
      keyboardTopRef.current = null;
      lastAndroidScrollYRef.current = null;
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
      lastAndroidScrollYRef.current = null;

      if (Platform.OS === "android") {
        // Start scrolling with the keyboard open animation, before `keyboardDidShow`.
        scheduleEnsureVisible(resolveAndroidKeyboardTop(keyboardTopRef.current), { animated: true });
        return;
      }

      const keyboardTop = keyboardTopRef.current;
      if (keyboardTop != null) {
        scheduleEnsureVisible(keyboardTop);
      }
    },
    [resolveAndroidKeyboardTop, scheduleEnsureVisible],
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  return { onInputFocus, onScroll };
}
