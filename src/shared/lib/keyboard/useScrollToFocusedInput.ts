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
/** Skip redundant Android scrollTo when the target barely changed. */
const ANDROID_SCROLL_DEDUPE_PX = 8;

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
  const lastAndroidScrollYRef = useRef<number | null>(null);

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
        requestAnimationFrame(() => {
          ensureFocusedInputVisible(keyboardTop, ensureOptions);
        });
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

      if (Platform.OS === "android") {
        // One smooth scroll once keyboard metrics are known — no estimate + snap.
        scheduleEnsureVisible(screenY, { animated: true });
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
        const keyboardTop = keyboardTopRef.current;
        if (keyboardTop == null) return;
        // Keyboard already open — scroll smoothly to the next field.
        scheduleEnsureVisible(keyboardTop, { animated: true });
        return;
      }

      const keyboardTop = keyboardTopRef.current;
      if (keyboardTop != null) {
        scheduleEnsureVisible(keyboardTop);
      }
    },
    [scheduleEnsureVisible],
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
  }, [scrollOffsetYRef]);

  return { onInputFocus, onScroll };
};
