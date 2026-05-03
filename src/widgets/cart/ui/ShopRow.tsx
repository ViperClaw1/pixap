import { View, Text, Pressable, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useUpdateShoppingCartQuantity, useRemoveShoppingCartItem, type ShoppingCartItem } from "@/entities/shopping";
import { getLatestBusinessCardImage } from "@/lib/businessCardImages";
import { isAuthRequiredError } from "@/lib/authRequired";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { CartScreenStyles } from "./cartStyles";

type Props = {
  item: ShoppingCartItem;
  stylesThemed: CartScreenStyles;
  labelColor: string;
  onAuthRequired: () => void;
};

export function ShopRow({ item, stylesThemed, labelColor, onAuthRequired }: Props) {
  const { colors } = useAppTheme();
  const updateQty = useUpdateShoppingCartQuantity();
  const removeItem = useRemoveShoppingCartItem();
  const line =
    (item.shopping_item?.price || 0) * item.quantity +
    (item.children ?? []).reduce((s, c) => s + (c.shopping_item?.price || 0) * c.quantity, 0);

  const onRemoveLine = async () => {
    try {
      await removeItem.mutateAsync(item.id);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        onAuthRequired();
        return;
      }
      Alert.alert("Failed", "Could not remove this item from your cart.");
    }
  };

  const onDecreaseQty = async () => {
    try {
      if (item.quantity <= 1) {
        await removeItem.mutateAsync(item.id);
        return;
      }
      await updateQty.mutateAsync({ id: item.id, quantity: item.quantity - 1 });
    } catch (error) {
      if (isAuthRequiredError(error)) {
        onAuthRequired();
        return;
      }
      Alert.alert("Failed", "Could not update quantity.");
    }
  };

  const onIncreaseQty = async () => {
    try {
      await updateQty.mutateAsync({ id: item.id, quantity: item.quantity + 1 });
    } catch (error) {
      if (isAuthRequiredError(error)) {
        onAuthRequired();
        return;
      }
      Alert.alert("Failed", "Could not update quantity.");
    }
  };

  return (
    <View style={stylesThemed.card}>
      <SmartImage
        uri={item.shopping_item?.image}
        fallbackUri={getLatestBusinessCardImage(item.business_card?.images)}
        recyclingKey={`shop-${item.id}`}
        style={stylesThemed.thumb}
        contentFit="cover"
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={stylesThemed.shopTitleRow}>
          <View style={stylesThemed.shopTitleCol}>
            <Text style={stylesThemed.name} numberOfLines={3}>
              {item.shopping_item?.name}
            </Text>
            {item.business_card?.name?.trim() ? (
              <View style={stylesThemed.vendorBadge}>
                <Text style={stylesThemed.vendorBadgeText} numberOfLines={1}>
                  {item.business_card.name.trim()}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove item from cart"
            hitSlop={10}
            disabled={removeItem.isPending}
            onPress={() => void onRemoveLine()}
            style={({ pressed }) => [stylesThemed.deleteIconBtn, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        </View>
        <View style={stylesThemed.qtyRow}>
          <Pressable onPress={() => void onDecreaseQty()}>
            <Text style={stylesThemed.qtyBtn}>−</Text>
          </Pressable>
          <Text style={{ color: labelColor, fontWeight: "600" }}>{item.quantity}</Text>
          <Pressable onPress={() => void onIncreaseQty()}>
            <Text style={stylesThemed.qtyBtn}>+</Text>
          </Pressable>
        </View>
        {(item.children ?? []).map((c) => (
          <Text key={c.id} style={stylesThemed.child}>
            + {c.shopping_item?.name} ×{c.quantity}
          </Text>
        ))}
        <Text style={stylesThemed.price}>{line.toLocaleString()} $</Text>
      </View>
    </View>
  );
}
