import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusinessCard } from "@/hooks/useBusinessCards";
import {
  useShoppingItems,
  useAdditionalItems,
  useAddToShoppingCart,
  type ShoppingItem,
} from "@/hooks/useShoppingItems";
import { useAuth } from "@/contexts/AuthContext";
import type { BrowseFlowParamList } from "@/navigation/types";
import { navigateToProfileAuth } from "@/navigation/navigationHelpers";
import { useAppTheme } from "@/contexts/ThemeContext";
import { getLatestBusinessCardImage } from "@/lib/businessCardImages";

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

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
        header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
        back: { fontSize: 22, color: colors.text },
        title: { fontSize: 18, fontWeight: "700", color: colors.text },
        sub: { fontSize: 12, color: colors.textMuted },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 12,
          backgroundColor: colors.card,
          borderRadius: 12,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: colors.border,
        },
        name: { fontWeight: "700", color: colors.text },
        price: { color: colors.textMuted, marginTop: 4 },
        plus: { fontSize: 22, fontWeight: "700", color: colors.text },
        modalBackdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        },
        modalCard: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20,
          paddingBottom: Math.max(insets.bottom, 20),
          maxHeight: "70%",
          borderTopWidth: 1,
          borderColor: colors.border,
        },
        modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12, color: colors.text },
        extraRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
        extraLabel: { flex: 1, color: colors.text },
        qtyBtn: { fontSize: 20, paddingHorizontal: 8, color: colors.text },
        qtyVal: { minWidth: 24, textAlign: "center", color: colors.text },
        primary: {
          marginTop: 16,
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
        },
        primaryText: { color: colors.onPrimary, fontWeight: "700" },
        cancel: { textAlign: "center", marginTop: 12, color: colors.textMuted },
      }),
    [colors, insets.bottom],
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
    } catch {
      Alert.alert("Failed to add");
    }
  };

  if (placeLoading || isLoading) {
    return (
      <View style={stylesThemed.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={stylesThemed.root}>
      <View style={[stylesThemed.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={stylesThemed.back}>←</Text>
        </Pressable>
        <View>
          <Text style={stylesThemed.title}>{isRestaurant ? "Menu" : "Shop items"}</Text>
          <Text style={stylesThemed.sub}>{place?.name}</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}
        renderItem={({ item }) => (
          <Pressable style={stylesThemed.row} onPress={() => openFlow(item)}>
            <SmartImage
              uri={item.image}
              fallbackUri={getLatestBusinessCardImage(place?.images)}
              recyclingKey={`${item.id}-${id}`}
              style={styles.thumb}
              contentFit="cover"
            />
            <View style={{ flex: 1 }}>
              <Text style={stylesThemed.name}>{item.name}</Text>
              <Text style={stylesThemed.price}>{Number(item.price).toLocaleString()} ₸</Text>
            </View>
            <Text style={stylesThemed.plus}>+</Text>
          </Pressable>
        )}
      />

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={stylesThemed.modalBackdrop}>
          <View style={stylesThemed.modalCard}>
            <Text style={stylesThemed.modalTitle}>Extras</Text>
            <ScrollView>
              {additionalItems.map((ex) => (
                <View key={ex.id} style={stylesThemed.extraRow}>
                  <Text style={stylesThemed.extraLabel}>{ex.name}</Text>
                  <Pressable
                    onPress={() =>
                      setExtraQty((q) => ({
                        ...q,
                        [ex.id]: Math.max(0, (q[ex.id] ?? 0) - 1),
                      }))
                    }
                  >
                    <Text style={stylesThemed.qtyBtn}>−</Text>
                  </Pressable>
                  <Text style={stylesThemed.qtyVal}>{extraQty[ex.id] ?? 0}</Text>
                  <Pressable
                    onPress={() =>
                      setExtraQty((q) => ({
                        ...q,
                        [ex.id]: (q[ex.id] ?? 0) + 1,
                      }))
                    }
                  >
                    <Text style={stylesThemed.qtyBtn}>+</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={stylesThemed.primary}
              onPress={() => selectedItem && void confirmAdd(selectedItem, extraQty)}
            >
              <Text style={stylesThemed.primaryText}>Add to cart</Text>
            </Pressable>
            <Pressable onPress={() => setModalOpen(false)}>
              <Text style={stylesThemed.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 56, height: 56, borderRadius: 8 },
});
