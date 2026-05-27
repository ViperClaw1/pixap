import { useCallback, useEffect, useRef } from "react";
import type { FlashListRef } from "@shopify/flash-list";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";

type Options<T> = {
  entityId: string;
  isActive?: boolean;
  isLoading: boolean;
  itemCount: number;
};

const ESTIMATED_ITEM_HEIGHT = FLASH_LIST_ESTIMATED_SIZE.storyComment;

export function useDiscussionListScroll<T>({ entityId, isActive = true, isLoading, itemCount }: Options<T>) {
  const listRef = useRef<FlashListRef<T>>(null);
  const hasInitialScrolledRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      hasInitialScrolledRef.current = false;
      return;
    }
    hasInitialScrolledRef.current = false;
  }, [entityId, isActive]);

  const scrollToOffset = useCallback((index: number, animated: boolean, viewPosition: 0 | 1) => {
    listRef.current?.scrollToIndex({ index, animated, viewPosition });
  }, []);

  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      if (itemCount <= 0 || index < 0 || index >= itemCount) return;
      requestAnimationFrame(() => {
        scrollToOffset(index, animated, 0);
        setTimeout(() => {
          scrollToOffset(index, animated, 0);
        }, 120);
      });
    },
    [itemCount, scrollToOffset],
  );

  const scrollToBottom = useCallback(
    (animated = false) => {
      if (itemCount <= 0) return;
      const index = itemCount - 1;
      requestAnimationFrame(() => {
        scrollToOffset(index, animated, 1);
        setTimeout(() => {
          listRef.current?.scrollToOffset({
            offset: ESTIMATED_ITEM_HEIGHT * itemCount,
            animated,
          });
        }, 120);
      });
    },
    [itemCount, scrollToOffset],
  );

  useEffect(() => {
    if (!isActive || isLoading || itemCount <= 0 || hasInitialScrolledRef.current) return;
    hasInitialScrolledRef.current = true;
    const timer = setTimeout(() => scrollToBottom(false), 64);
    return () => clearTimeout(timer);
  }, [isActive, isLoading, itemCount, scrollToBottom, entityId]);

  return {
    listRef,
    scrollToIndex,
    scrollToBottom,
  };
}
