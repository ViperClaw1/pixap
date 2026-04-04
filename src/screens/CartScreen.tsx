import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SmartImage } from "@/components/SmartImage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/contexts/AuthContext";
import { useCartItems, useDeleteCartItem } from "@/hooks/useCartItems";
import { useCreateBooking } from "@/hooks/useBookings";
import {
  useShoppingCart,
  useUpdateShoppingCartQuantity,
  useRemoveShoppingCartItem,
  type ShoppingCartItem,
} from "@/hooks/useShoppingItems";
import { supabase } from "@/integrations/supabase/client";
import { stripeSuccessUrl, stripeCancelUrl } from "@/lib/linking";
import { useAppTheme } from "@/contexts/ThemeContext";
import AuthScreen from "@/screens/AuthScreen";

function ServiceCartRow({
  item,
  stylesThemed,
}: {
  item: import("@/hooks/useCartItems").CartItem;
  stylesThemed: ReturnType<typeof createCartStyles>;
}) {
  const createBooking = useCreateBooking();
  const deleteCartItem = useDeleteCartItem();

  const onBook = async () => {
    try {
      await createBooking.mutateAsync({
        business_card_id: item.business_card_id,
        date_time: item.date_time,
        cost: item.cost,
        persons: item.persons,
        customer_name: item.customer_name,
        customer_phone: item.customer_phone,
        customer_email: item.customer_email,
        comment: item.comment,
      });
      await deleteCartItem.mutateAsync(item.id);
      Alert.alert("Booked", "Your booking is confirmed.");
    } catch {
      Alert.alert("Failed", "Could not complete booking.");
    }
  };

  return (
    <View style={stylesThemed.card}>
      <SmartImage uri={item.business_card?.image} recyclingKey={`svc-${item.id}`} style={stylesThemed.thumb} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={stylesThemed.name}>{item.business_card?.name}</Text>
        <Text style={stylesThemed.meta}>{new Date(item.date_time).toLocaleString()}</Text>
        {item.persons ? <Text style={stylesThemed.meta}>Persons: {item.persons}</Text> : null}
        {item.customer_name ? <Text style={stylesThemed.meta}>Name: {item.customer_name}</Text> : null}
        {item.customer_phone ? <Text style={stylesThemed.meta}>Phone: {item.customer_phone}</Text> : null}
        {item.customer_email ? <Text style={stylesThemed.meta}>Email: {item.customer_email}</Text> : null}
        {item.comment ? <Text style={stylesThemed.meta}>Comment: {item.comment}</Text> : null}
        <Text style={stylesThemed.price}>{Number(item.cost).toLocaleString()} ₸</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <Pressable style={stylesThemed.smallBtn} onPress={() => void onBook()}>
            <Text style={stylesThemed.smallBtnText}>Confirm booking</Text>
          </Pressable>
          <Pressable style={stylesThemed.smallBtnDanger} onPress={() => void deleteCartItem.mutateAsync(item.id)}>
            <Text style={stylesThemed.dangerBtnText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createCartStyles(colors: import("@/theme/palettes").ThemeColors, bottomInset: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { fontSize: 22, fontWeight: "800", paddingHorizontal: 16, marginBottom: 8, color: colors.text },
    tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, gap: 8 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.border, alignItems: "center" },
    tabActive: { backgroundColor: colors.primary },
    tabText: { color: colors.text, fontWeight: "600" },
    tabTextActive: { color: colors.onPrimary, fontWeight: "700" },
    card: {
      flexDirection: "row",
      gap: 12,
      padding: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    thumb: { width: 64, height: 64, borderRadius: 8 },
    name: { fontWeight: "700", color: colors.text },
    meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    price: { marginTop: 6, fontWeight: "700", color: colors.text },
    child: { fontSize: 12, color: colors.textMuted },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
    qtyBtn: { fontSize: 20, fontWeight: "700", color: colors.text },
    smallBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.primary,
      borderRadius: 8,
      alignItems: "center",
    },
    smallBtnDanger: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.danger,
      borderRadius: 8,
      alignItems: "center",
      alignSelf: "flex-start",
    },
    smallBtnText: { color: colors.onPrimary, fontSize: 12, fontWeight: "600" },
    dangerBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
    empty: { textAlign: "center", color: colors.textMuted, marginTop: 32 },
    payBar: {
      marginTop: 16,
      padding: 16,
      paddingBottom: 16 + bottomInset,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalLabel: { fontSize: 14, color: colors.textMuted },
    totalVal: { fontSize: 20, fontWeight: "800", marginTop: 4, color: colors.text },
    payBtn: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    payBtnText: { color: colors.onPrimary, fontWeight: "700" },
    deleteIconBtn: {
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(239,68,68,0.45)",
      backgroundColor: "rgba(239,68,68,0.12)",
    },
  });
}

function ShopRow({
  item,
  stylesThemed,
  labelColor,
}: {
  item: ShoppingCartItem;
  stylesThemed: ReturnType<typeof createCartStyles>;
  labelColor: string;
}) {
  const { colors } = useAppTheme();
  const updateQty = useUpdateShoppingCartQuantity();
  const removeItem = useRemoveShoppingCartItem();
  const line =
    (item.shopping_item?.price || 0) * item.quantity +
    (item.children ?? []).reduce((s, c) => s + (c.shopping_item?.price || 0) * c.quantity, 0);

  const onRemoveLine = async () => {
    try {
      await removeItem.mutateAsync(item.id);
    } catch {
      Alert.alert("Failed", "Could not remove this item from your cart.");
    }
  };

  return (
    <View style={stylesThemed.card}>
      <SmartImage
        uri={item.shopping_item?.image}
        fallbackUri={item.business_card?.image}
        recyclingKey={`shop-${item.id}`}
        style={stylesThemed.thumb}
        contentFit="cover"
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <Text style={[stylesThemed.name, { flex: 1 }]} numberOfLines={3}>
            {item.shopping_item?.name}
          </Text>
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
          <Pressable
            onPress={() =>
              item.quantity <= 1
                ? void removeItem.mutateAsync(item.id)
                : void updateQty.mutateAsync({ id: item.id, quantity: item.quantity - 1 })
            }
          >
            <Text style={stylesThemed.qtyBtn}>−</Text>
          </Pressable>
          <Text style={{ color: labelColor, fontWeight: "600" }}>{item.quantity}</Text>
          <Pressable onPress={() => void updateQty.mutateAsync({ id: item.id, quantity: item.quantity + 1 })}>
            <Text style={stylesThemed.qtyBtn}>+</Text>
          </Pressable>
        </View>
        {(item.children ?? []).map((c) => (
          <Text key={c.id} style={stylesThemed.child}>
            + {c.shopping_item?.name} ×{c.quantity}
          </Text>
        ))}
        <Text style={stylesThemed.price}>{line.toLocaleString()} ₸</Text>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const stylesThemed = useMemo(() => createCartStyles(colors, insets.bottom), [colors, insets.bottom]);
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"services" | "shopping">("services");
  const { data: cartItems = [], isLoading: cl } = useCartItems();
  const { data: shoppingItems = [], isLoading: sl } = useShoppingCart();

  if (loading) {
    return (
      <View style={[stylesThemed.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const shoppingTotal = shoppingItems.reduce(
    (sum, item) =>
      sum +
      (item.shopping_item?.price || 0) * item.quantity +
      (item.children ?? []).reduce((s, c) => s + (c.shopping_item?.price || 0) * c.quantity, 0),
    0,
  );

  const pay = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          success_url: stripeSuccessUrl(),
          cancel_url: stripeCancelUrl(),
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No checkout URL");
      await WebBrowser.openBrowserAsync(url);
    } catch (e: unknown) {
      Alert.alert("Checkout failed", e instanceof Error ? e.message : "Unknown error");
    }
  };

  return (
    <View style={stylesThemed.root}>
      <Text style={[stylesThemed.header, { paddingTop: Math.max(insets.top, 12) }]}>Cart</Text>
      <View style={stylesThemed.tabs}>
        <Pressable style={[stylesThemed.tab, tab === "services" && stylesThemed.tabActive]} onPress={() => setTab("services")}>
          <Text style={tab === "services" ? stylesThemed.tabTextActive : stylesThemed.tabText}>Services</Text>
        </Pressable>
        <Pressable style={[stylesThemed.tab, tab === "shopping" && stylesThemed.tabActive]} onPress={() => setTab("shopping")}>
          <Text style={tab === "shopping" ? stylesThemed.tabTextActive : stylesThemed.tabText}>Shopping</Text>
        </Pressable>
      </View>

      {tab === "services" ? (
        cl ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        ) : (
          <FlatList
            data={cartItems}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
            ListEmptyComponent={<Text style={stylesThemed.empty}>No service bookings in cart</Text>}
            renderItem={({ item }) => (
              <ServiceCartRow item={item} stylesThemed={stylesThemed} />
            )}
          />
        )
      ) : sl ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}>
          {shoppingItems.length === 0 ? (
            <Text style={stylesThemed.empty}>No shopping items</Text>
          ) : (
            shoppingItems.map((item) => (
              <ShopRow key={item.id} item={item} stylesThemed={stylesThemed} labelColor={colors.text} />
            ))
          )}
          {shoppingItems.length > 0 ? (
            <View style={stylesThemed.payBar}>
              <Text style={stylesThemed.totalLabel}>Total</Text>
              <Text style={stylesThemed.totalVal}>{shoppingTotal.toLocaleString()} ₸</Text>
              <Pressable style={stylesThemed.payBtn} onPress={() => void pay()}>
                <Text style={stylesThemed.payBtnText}>Pay {shoppingTotal.toLocaleString()} ₸</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
