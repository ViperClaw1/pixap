/**
 * @shopify/flash-list v2 typings omit several FlatList-style props that the runtime
 * RecyclerView still accepts. Augment so call sites stay type-safe without casts.
 */
export {};

declare module "@shopify/flash-list" {
  export interface FlashListProps<TItem> {
    estimatedItemSize?: number;
    initialNumToRender?: number;
    maxToRenderPerBatch?: number;
    windowSize?: number;
    updateCellsBatchingPeriod?: number;
    removeClippedSubviews?: boolean;
  }
}
