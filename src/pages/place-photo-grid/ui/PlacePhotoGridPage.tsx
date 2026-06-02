import { useCallback, useEffect, useMemo, memo } from "react";
import {
  InteractionManager,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { preloadSmartImages, SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";

const GRID_COLUMNS = 3;
const GRID_BATCH_ROWS = 7;

type Route = RouteProp<BrowseFlowParamList, "PlacePhotoGrid">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "PlacePhotoGrid">;

type GridCell = {
  key: string;
  index: number;
  thumbUri: string;
  thumbFallbackUri?: string;
};

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, arr) => arr.indexOf(value) === index);
}

type GridCellProps = {
  item: GridCell;
  tileWidth: number;
  tileHeight: number;
  cardBackground: string;
  loadingSpinnerColor: string;
  onPressCell: (item: GridCell) => void;
};

const PhotoGridCell = memo(function PhotoGridCell({
  item,
  tileWidth,
  tileHeight,
  cardBackground,
  loadingSpinnerColor,
  onPressCell,
}: GridCellProps) {
  const onPress = useCallback(() => {
    onPressCell(item);
  }, [item, onPressCell]);

  return (
    <Pressable
      onPress={onPress}
      style={{ width: tileWidth, height: tileHeight, backgroundColor: cardBackground }}
    >
      <SmartImage
        uri={item.thumbUri}
        fallbackUri={item.thumbFallbackUri}
        contentFit="cover"
        priority="low"
        recyclingKey={item.key}
        skipBundledPlaceholder
        showLoadingSpinner
        loadingSpinnerColor={loadingSpinnerColor}
        transition={0}
        style={{ width: "100%", height: "100%" }}
      />
    </Pressable>
  );
});

export default function PlacePhotoGridPage() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);

  const thumbImages = useMemo(
    () => uniqueStrings(params.images.filter((item) => item.trim().length > 0)),
    [params.images],
  );
  const rawImages = useMemo(
    () =>
      uniqueStrings(
        (params.rawImages ?? thumbImages).filter((item) => item.trim().length > 0),
      ),
    [params.rawImages, thumbImages],
  );

  const gridTileWidth = Math.max(1, Math.floor(windowWidth / GRID_COLUMNS));
  const gridTileHeight = Math.max(1, Math.round((gridTileWidth * 16) / 9));

  const gridItems = useMemo((): GridCell[] => {
    return thumbImages.map((thumbUri, index) => ({
      key: `place-photo-${index}`,
      index,
      thumbUri,
      thumbFallbackUri: rawImages[index] !== thumbUri ? rawImages[index] : undefined,
    }));
  }, [rawImages, thumbImages]);

  const galleryImages = rawImages.length > 0 ? rawImages : thumbImages;

  useEffect(() => {
    if (gridItems.length === 0) return;
    const preloadCount = Math.min(gridItems.length, GRID_COLUMNS * 4);
    const batch = gridItems.slice(0, preloadCount).map((g) => g.thumbUri);
    const task = InteractionManager.runAfterInteractions(() => {
      void preloadSmartImages(batch);
    });
    return () => task.cancel();
  }, [gridItems]);

  const handleCellPress = useCallback(
    (cell: GridCell) => {
      navigation.navigate("PlaceGallery", {
        images: galleryImages,
        rawImages,
        initialIndex: cell.index,
      });
    },
    [galleryImages, navigation, rawImages],
  );

  const renderGridItem = useCallback<ListRenderItem<GridCell>>(
    ({ item }) => (
      <PhotoGridCell
        item={item}
        tileWidth={gridTileWidth}
        tileHeight={gridTileHeight}
        cardBackground={colors.card}
        loadingSpinnerColor={colors.primary}
        onPressCell={handleCellPress}
      />
    ),
    [colors.card, colors.primary, gridTileHeight, gridTileWidth, handleCellPress],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} {...androidSwipeBackPanHandlers}>
      <AppHeader
        title={params.title}
        compactTitle
        leftIcon="chevron-back"
        onLeftPress={() => navigation.goBack()}
      />
      <FlashList
        data={gridItems}
        keyExtractor={(item) => item.key}
        numColumns={GRID_COLUMNS}
        estimatedItemSize={gridTileHeight}
        renderItem={renderGridItem}
        removeClippedSubviews
        initialNumToRender={GRID_COLUMNS * 4}
        maxToRenderPerBatch={GRID_BATCH_ROWS * GRID_COLUMNS}
        windowSize={7}
      />
    </View>
  );
}
