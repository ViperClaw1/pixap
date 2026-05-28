import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCard } from "@/entities/business-card";
import {
  useShoppingItems,
  useAdditionalItems,
  useAddToShoppingCart,
  type ShoppingItem,
} from "@/entities/shopping";
import { useAuth } from "@/app/providers/AuthProvider";
import type { BrowseFlowParamList } from "@/app/navigation/types";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import { isAuthRequiredError } from "@/shared/lib/auth/authRequired";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { shoppingItemsStaticStyles, shoppingItemsThemeStyles } from "./shoppingItemsStyles";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";

type R = RouteProp<BrowseFlowParamList, "ShoppingItems">;
type Nav = NativeStackNavigationProp<BrowseFlowParamList, "ShoppingItems">;

export default function ShoppingItemsScreen() {
  const { id } = useRoute<R>().params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { data: place, isLoading: placeLoading } = useBusinessCard(id);
  const { data: items = [], isLoading } = useShoppingItems(id);
  const { data: additionalItems = [] } = useAdditionalItems(id);
  const addToCart = useAddToShoppingCart();

  const [selectedItem, setSelectedItem] = useState<ShoppingItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [extraQty, setExtraQty] = useState<Record<string, number>>({});

  const isRestaurant = place?.category?.name === "Restaurants";

  const themed = useThemeStyles(
    ({ colors: c }) => shoppingItemsThemeStyles(c, insets.bottom),
    [insets.bottom],
  );
  const styles = useMemo(
    () => mergeStaticAndThemed(shoppingItemsStaticStyles, themed),
    [themed],
  );

  const openFlow = (item: ShoppingItem) => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    setSelectedItem(item);
    setExtraQty({});
    if (isRestaurant && additionalItems.length > 0) {
      setModalOpen(true);
    } else {
      void confirmAdd(item, {});
    }
  };

  const confirmAdd = async (item: ShoppingItem, extras: Record<string, number>) => {
    try {
      const mainRows = [{ shopping_item_id: item.id, business_card_id: id, quantity: 1 }];
      const result = await addToCart.mutateAsync(mainRows);
      const parentId = result[0].id as string;
      const addItems = Object.entries(extras)
        .filter(([, q]) => q > 0)
        .map(([itemId, qty]) => ({
          shopping_item_id: itemId,
          business_card_id: id,
          quantity: qty,
          parent_id: parentId,
        }));
      if (addItems.length > 0) {
        await addToCart.mutateAsync(addItems);
      }
      Alert.alert("Added to cart", item.name);
      setModalOpen(false);
      setSelectedItem(null);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        navigateToProfileAuth(navigation);
        return;
      }
      Alert.alert("Failed to add");
    }
  };

  const renderShoppingItem = useCallback(
    ({ item }: { item: ShoppingItem }) => (
      <Pressable style={styles.row} onPress={() => openFlow(item)}>
        <SmartImage
          uri={item.image}
          fallbackUri={getPrimaryBusinessCardImage(place?.images)}
          recyclingKey={`${item.id}-${id}`}
          style={shoppingItemsStaticStyles.thumb}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.price}>{Number(item.price).toLocaleString()} ₸</Text>
        </View>
        <Text style={styles.plus}>+</Text>
      </Pressable>
    ),
    [id, place?.images, styles.name, styles.plus, styles.price, styles.row],
  );

  if (placeLoading || isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>{isRestaurant ? "Menu" : "Shop items"}</Text>
          <Text style={styles.sub}>{place?.name}</Text>
        </View>
      </View>

      <FlashList
        data={items}
        keyExtractor={(i) => i.id}
        estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.shoppingItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}
        renderItem={renderShoppingItem}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={8}
        updateCellsBatchingPeriod={40}
      />

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Extras</Text>
            <ScrollView>
              {additionalItems.map((ex) => (
                <View key={ex.id} style={styles.extraRow}>
                  <Text style={styles.extraLabel}>{ex.name}</Text>
                  <Pressable
                    onPress={() =>
                      setExtraQty((q) => ({
                        ...q,
                        [ex.id]: Math.max(0, (q[ex.id] ?? 0) - 1),
                      }))
                    }
                  >
                    <Text style={styles.qtyBtn}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyVal}>{extraQty[ex.id] ?? 0}</Text>
                  <Pressable
                    onPress={() =>
                      setExtraQty((q) => ({
                        ...q,
                        [ex.id]: (q[ex.id] ?? 0) + 1,
                      }))
                    }
                  >
                    <Text style={styles.qtyBtn}>+</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={styles.primary}
              onPress={() => selectedItem && void confirmAdd(selectedItem, extraQty)}
            >
              <Text style={styles.primaryText}>Add to cart</Text>
            </Pressable>
            <Pressable onPress={() => setModalOpen(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
