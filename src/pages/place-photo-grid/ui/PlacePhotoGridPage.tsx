import { useCallback, useEffect, useMemo, useState, memo } from "react";
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
import { useAuth } from "@/app/providers/AuthProvider";
import { resetProfileTabToAuth } from "@/app/navigation/navigationHelpers";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { preloadSmartImages, SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";
import { useDisableGestureDuringTransition } from "@/shared/lib/navigation/useDisableGestureDuringTransition";
import { getBusinessCardDisplayUrls } from "@/shared/lib/business-card/businessCardDisplayUrl";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";
import {
  AddVenuePhotoGridCell,
  useDeleteVenuePhoto,
  useUploadVenuePhoto,
  VenuePhotoDeleteButton,
  VenuePhotoDeleteConfirmModal,
} from "@/features/venue-photo-upload";
import { useTranslation } from "react-i18next";

const GRID_COLUMNS = 3;
const GRID_BATCH_ROWS = 7;

type Route = RouteProp<BrowseFlowParamList, "PlacePhotoGrid">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "PlacePhotoGrid">;

type PhotoGridCell = {
  kind: "photo";
  key: string;
  index: number;
  thumbUri: string;
  rawUri: string;
  thumbFallbackUri?: string;
  canDelete: boolean;
};

type AddGridCell = {
  kind: "add";
  key: "add-photo";
};

type GridItem = PhotoGridCell | AddGridCell;

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index, arr) => arr.indexOf(value) === index);
}

type GridCellProps = {
  item: PhotoGridCell;
  tileWidth: number;
  tileHeight: number;
  cardBackground: string;
  loadingSpinnerColor: string;
  deleteA11y: string;
  onPressCell: (item: PhotoGridCell) => void;
  onDeleteCell: (item: PhotoGridCell) => void;
};

const PhotoGridCell = memo(function PhotoGridCell({
  item,
  tileWidth,
  tileHeight,
  cardBackground,
  loadingSpinnerColor,
  deleteA11y,
  onPressCell,
  onDeleteCell,
}: GridCellProps) {
  const onPress = useCallback(() => {
    onPressCell(item);
  }, [item, onPressCell]);

  const onDelete = useCallback(() => {
    onDeleteCell(item);
  }, [item, onDeleteCell]);

  return (
    <View style={{ width: tileWidth, height: tileHeight, backgroundColor: cardBackground }}>
      <Pressable onPress={onPress} style={{ flex: 1 }}>
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
      {item.canDelete ? (
        <VenuePhotoDeleteButton onPress={onDelete} accessibilityLabel={deleteA11y} variant="grid" />
      ) : null}
    </View>
  );
});

export default function PlacePhotoGridPage() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  useDisableGestureDuringTransition();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const { pickAndUpload, uploading, canUpload } = useUploadVenuePhoto(params.placeId);
  const { deletePhoto, deleting, canDeletePhoto } = useDeleteVenuePhoto(params.placeId);
  const [addedRawImages, setAddedRawImages] = useState<string[]>([]);
  const [removedRawImages, setRemovedRawImages] = useState<string[]>([]);
  const [pendingDeleteUrl, setPendingDeleteUrl] = useState<string | null>(null);

  const baseRawImages = useMemo(
    () =>
      uniqueStrings(
        (params.rawImages ?? params.images).filter((item) => item.trim().length > 0),
      ),
    [params.images, params.rawImages],
  );

  const rawImages = useMemo(() => {
    const merged = normalizeBusinessCardImages([...addedRawImages, ...baseRawImages]);
    if (!removedRawImages.length) return merged;
    const removed = new Set(removedRawImages);
    return merged.filter((url) => !removed.has(url));
  }, [addedRawImages, baseRawImages, removedRawImages]);

  const thumbImages = useMemo(
    () => getBusinessCardDisplayUrls(rawImages, { size: "list" }),
    [rawImages],
  );

  const gridTileWidth = Math.max(1, Math.floor(windowWidth / GRID_COLUMNS));
  const gridTileHeight = Math.max(1, Math.round((gridTileWidth * 16) / 9));

  const gridItems = useMemo((): GridItem[] => {
    const photos: PhotoGridCell[] = thumbImages.map((thumbUri, index) => {
      const rawUri = rawImages[index] ?? thumbUri;
      return {
        kind: "photo",
        key: `place-photo-${rawUri}`,
        index,
        thumbUri,
        rawUri,
        thumbFallbackUri: rawUri !== thumbUri ? rawUri : undefined,
        canDelete: canDeletePhoto(rawUri),
      };
    });

    if (!user) return photos;

    return [{ kind: "add", key: "add-photo" }, ...photos];
  }, [canDeletePhoto, rawImages, thumbImages, user]);

  useEffect(() => {
    const photoItems = gridItems.filter((item): item is PhotoGridCell => item.kind === "photo");
    if (photoItems.length === 0) return;
    const preloadCount = Math.min(photoItems.length, GRID_COLUMNS * 4);
    const batch = photoItems.slice(0, preloadCount).map((g) => g.thumbUri);
    const task = InteractionManager.runAfterInteractions(() => {
      void preloadSmartImages(batch);
    });
    return () => task.cancel();
  }, [gridItems]);

  const handlePhotoPress = useCallback(
    (cell: PhotoGridCell) => {
      navigation.navigate("PlaceGallery", {
        placeId: params.placeId,
        images: thumbImages.length > 0 ? thumbImages : rawImages,
        rawImages,
        initialIndex: cell.index,
      });
    },
    [navigation, params.placeId, rawImages, thumbImages],
  );

  const handleDeleteRequest = useCallback((cell: PhotoGridCell) => {
    setPendingDeleteUrl(cell.rawUri);
  }, []);

  const handleAddPhotoPress = useCallback(() => {
    if (!user) {
      resetProfileTabToAuth(navigation.getParent() ?? navigation);
      return;
    }
    if (!canUpload || uploading) return;
    void pickAndUpload().then((imageUrl) => {
      if (!imageUrl) return;
      setAddedRawImages((prev) => uniqueStrings([imageUrl, ...prev]));
    });
  }, [canUpload, navigation, pickAndUpload, uploading, user]);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteUrl) return;
    const target = pendingDeleteUrl;
    void deletePhoto(target).then((ok) => {
      if (!ok) return;
      setRemovedRawImages((prev) => uniqueStrings([...prev, target]));
      setAddedRawImages((prev) => prev.filter((url) => url !== target));
      setPendingDeleteUrl(null);
    });
  }, [deletePhoto, pendingDeleteUrl]);

  const renderGridItem = useCallback<ListRenderItem<GridItem>>(
    ({ item }) => {
      if (item.kind === "add") {
        return (
          <AddVenuePhotoGridCell
            tileWidth={gridTileWidth}
            tileHeight={gridTileHeight}
            uploading={uploading}
            onPress={handleAddPhotoPress}
          />
        );
      }

      return (
        <PhotoGridCell
          item={item}
          tileWidth={gridTileWidth}
          tileHeight={gridTileHeight}
          cardBackground={colors.card}
          loadingSpinnerColor={colors.primary}
          deleteA11y={t("placePhotoGrid.deletePhotoA11y")}
          onPressCell={handlePhotoPress}
          onDeleteCell={handleDeleteRequest}
        />
      );
    },
    [
      colors.card,
      colors.primary,
      gridTileHeight,
      gridTileWidth,
      handleAddPhotoPress,
      handleDeleteRequest,
      handlePhotoPress,
      t,
      uploading,
    ],
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
      <VenuePhotoDeleteConfirmModal
        visible={pendingDeleteUrl != null}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDeleteUrl(null)}
      />
    </View>
  );
}
