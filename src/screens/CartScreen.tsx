import { useEffect, useMemo, useState } from "react";
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
import * as Linking from "expo-linking";
import { useAuth } from "@/contexts/AuthContext";
import { useCartItems, useDeleteCartItem } from "@/hooks/useCartItems";
import {
  useShoppingCart,
  useUpdateShoppingCartQuantity,
  useRemoveShoppingCartItem,
  type ShoppingCartItem,
} from "@/hooks/useShoppingItems";
import { createPaypalServiceBookingOrder, createPaypalShoppingOrder, capturePaypalOrder } from "@/lib/paypalCheckout";
import { useAppTheme } from "@/contexts/ThemeContext";
import AuthScreen from "@/screens/AuthScreen";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CartStackParamList } from "@/navigation/types";
import { supabase } from "@/integrations/supabase/client";
import {
  buildAvailabilityMessage,
  openWhatsAppAvailability,
  resolveShoppingWhatsAppPhone,
  resolveWhatsAppPhone,
  serviceCartContextLines,
  shoppingCartContextLines,
} from "@/lib/whatsappAvailability";
import type { CartItem } from "@/hooks/useCartItems";

function ServiceCartRow({
  item,
  stylesThemed,
  onBookPress,
  onConfirmWhatsApp,
}: {
  item: CartItem;
  stylesThemed: ReturnType<typeof createCartStyles>;
  onBookPress: (cartItemId: string) => Promise<void>;
  onConfirmWhatsApp: (item: CartItem) => void | Promise<void>;
}) {
  const deleteCartItem = useDeleteCartItem();
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const onBook = async () => {
    if (paying) return;
    setPaying(true);
    try {
      await onBookPress(item.id);
    } catch (e: unknown) {
      Alert.alert("Checkout failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setPaying(false);
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
          <Pressable
            style={[stylesThemed.smallBtnOutline, confirming && { opacity: 0.6 }]}
            disabled={confirming}
            onPress={() => {
              setConfirming(true);
              void Promise.resolve(onConfirmWhatsApp(item)).finally(() => setConfirming(false));
            }}
          >
            <Text style={stylesThemed.smallBtnOutlineText}>{confirming ? "Opening…" : "Confirm"}</Text>
          </Pressable>
          <Pressable
            style={[stylesThemed.smallBtn, paying && { opacity: 0.6 }]}
            disabled={paying}
            onPress={() => void onBook()}
          >
            <Text style={stylesThemed.smallBtnText}>{paying ? "Opening checkout…" : "Pay for booking"}</Text>
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
    shopTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
    },
    shopTitleCol: { flex: 1, minWidth: 0 },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
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
    smallBtnOutline: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
      alignItems: "center",
    },
    smallBtnOutlineText: { color: colors.text, fontSize: 12, fontWeight: "600" },
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
    payRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    payRowBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    payBtn: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    payBtnText: { color: colors.onPrimary, fontWeight: "700" },
    payRowBtnPrimary: { backgroundColor: colors.primary },
    payRowBtnOutline: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    payRowBtnOutlineText: { color: colors.text, fontWeight: "700" },
    deleteIconBtn: {
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(239,68,68,0.45)",
      backgroundColor: "rgba(239,68,68,0.12)",
    },
    vendorBadge: {
      alignSelf: "flex-start",
      maxWidth: "100%",
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    vendorBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
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
  const route = useRoute<RouteProp<CartStackParamList, "CartMain">>();
  const navigation = useNavigation<NativeStackNavigationProp<CartStackParamList>>();
  const stylesThemed = useMemo(() => createCartStyles(colors, insets.bottom), [colors, insets.bottom]);
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"services" | "shopping">("services");
  const [isPayingShopping, setIsPayingShopping] = useState(false);
  const [checkingShopWa, setCheckingShopWa] = useState(false);
  const { data: cartItems = [], isLoading: cl } = useCartItems();
  const { data: shoppingItems = [], isLoading: sl } = useShoppingCart();

  const autoWhatsApp = route.params?.autoWhatsApp;
  useEffect(() => {
    if (!autoWhatsApp?.businessCardId || !autoWhatsApp.kind) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("business_cards")
        .select("name, contact_whatsapp")
        .eq("id", autoWhatsApp.businessCardId)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        navigation.setParams({ autoWhatsApp: undefined });
        return;
      }
      const phone = resolveWhatsAppPhone(data.contact_whatsapp);
      const msg = buildAvailabilityMessage(autoWhatsApp.kind, {
        businessName: data.name ?? "—",
        extraLines: [],
      });
      await openWhatsAppAvailability(phone, msg);
      navigation.setParams({ autoWhatsApp: undefined });
    })();
    return () => {
      cancelled = true;
    };
  }, [autoWhatsApp?.businessCardId, autoWhatsApp?.kind, navigation]);

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

  const confirmServiceWhatsApp = async (item: CartItem) => {
    const kind = item.is_restaurant_table ? "restaurant" : "service";
    const phone = resolveWhatsAppPhone(item.business_card?.contact_whatsapp);
    const msg = buildAvailabilityMessage(kind, {
      businessName: item.business_card?.name ?? "—",
      extraLines: serviceCartContextLines({
        dateTimeLabel: new Date(item.date_time).toLocaleString(),
        persons: item.persons,
        customer_name: item.customer_name,
        customer_phone: item.customer_phone,
        customer_email: item.customer_email,
        comment: item.comment,
      }),
    });
    await openWhatsAppAvailability(phone, msg);
  };

  const checkShoppingAvailability = async () => {
    if (checkingShopWa || shoppingItems.length === 0) return;
    setCheckingShopWa(true);
    try {
      const phone = resolveShoppingWhatsAppPhone(shoppingItems);
      const mains = shoppingItems.filter((i) => !i.parent_id);
      const vendorIds = new Set(mains.map((i) => i.business_card_id));
      const businessName =
        vendorIds.size === 1 ? (mains[0]?.business_card?.name?.trim() ?? "—") : "Multiple vendors";
      const msg = buildAvailabilityMessage("goods", {
        businessName,
        extraLines: shoppingCartContextLines(shoppingItems),
      });
      await openWhatsAppAvailability(phone, msg);
    } finally {
      setCheckingShopWa(false);
    }
  };

  const runPaypalCheckout = async (cartItemId?: string) => {
    const created = cartItemId
      ? await createPaypalServiceBookingOrder(cartItemId)
      : await createPaypalShoppingOrder();
    // Use runtime callback URL so Expo Go / Dev Client / standalone all match PayPal return URL.
    const callbackUrl = Linking.createURL("payment-success");
    const result = await WebBrowser.openAuthSessionAsync(created.approveUrl, callbackUrl);

    if (result.type !== "success" || !result.url) {
      navigation.navigate("PaymentCanceled");
      return;
    }

    const url = result.url;
    if (url.includes("payment-canceled")) {
      navigation.navigate("PaymentCanceled");
      return;
    }
    if (!url.includes("payment-success")) {
      throw new Error("Invalid payment redirect URL");
    }

    const parsed = Linking.parse(url);
    const qp = (parsed.queryParams ?? {}) as Record<string, string | string[] | undefined>;
    const firstParam = (v: string | string[] | undefined): string | undefined => {
      if (v == null) return undefined;
      if (Array.isArray(v)) return v[0];
      return v;
    };
    const rawOrderId = firstParam(qp.token) ?? firstParam(qp.order_id) ?? firstParam(qp.orderId) ?? created.orderId;
    let orderId = rawOrderId;
    if (orderId) {
      try {
        orderId = decodeURIComponent(orderId);
      } catch {
        /* keep raw */
      }
    }
    if (!orderId) {
      throw new Error("Missing PayPal order id");
    }

    const capture = await capturePaypalOrder(orderId);
    if (capture.status !== "COMPLETED") {
      if (capture.status === "PENDING") {
        throw new Error("Payment is processing. Please wait a few seconds and try again.");
      }
      throw new Error("Payment failed. Please try again.");
    }

    const next = capture.bookingNext ?? (cartItemId ? "bookings" : undefined);
    navigation.navigate("PaymentSuccess", next ? { next } : undefined);
  };

  const pay = async () => {
    if (isPayingShopping) return;
    setIsPayingShopping(true);
    try {
      await runPaypalCheckout();
    } catch (e: unknown) {
      Alert.alert("Checkout failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsPayingShopping(false);
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
              <ServiceCartRow
                item={item}
                stylesThemed={stylesThemed}
                onBookPress={runPaypalCheckout}
                onConfirmWhatsApp={confirmServiceWhatsApp}
              />
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
              <View style={stylesThemed.payRow}>
                <Pressable
                  style={[
                    stylesThemed.payRowBtn,
                    stylesThemed.payRowBtnOutline,
                    (checkingShopWa || isPayingShopping) && { opacity: 0.6 },
                  ]}
                  disabled={checkingShopWa || isPayingShopping}
                  onPress={() => void checkShoppingAvailability()}
                >
                  <Text style={stylesThemed.payRowBtnOutlineText}>
                    {checkingShopWa ? "Opening…" : "Check availability"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    stylesThemed.payRowBtn,
                    stylesThemed.payRowBtnPrimary,
                    isPayingShopping && { opacity: 0.6 },
                  ]}
                  disabled={isPayingShopping || checkingShopWa}
                  onPress={() => void pay()}
                >
                  <Text style={stylesThemed.payBtnText}>
                    {isPayingShopping ? "Processing..." : `Pay ${shoppingTotal.toLocaleString()} ₸`}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
