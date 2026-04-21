import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SmartImage } from "@/components/SmartImage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useAuth } from "@/contexts/AuthContext";
import { useCartItems, useDeleteCartItem, useConfirmServiceCartBooking, parseWaStatusLines } from "@/hooks/useCartItems";
import {
  useShoppingCart,
  useUpdateShoppingCartQuantity,
  useRemoveShoppingCartItem,
  type ShoppingCartItem,
} from "@/hooks/useShoppingItems";
import { createPaypalServiceBookingOrder, createPaypalShoppingOrder, capturePaypalOrder } from "@/lib/paypalCheckout";
import { useAppTheme } from "@/contexts/ThemeContext";
import AuthScreen from "@/screens/AuthScreen";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CartStackParamList } from "@/navigation/types";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildAvailabilityMessage,
  openWhatsAppAvailability,
  resolveShoppingWhatsAppPhone,
  shoppingCartContextLines,
} from "@/lib/whatsappAvailability";
import type { CartItem } from "@/hooks/useCartItems";

function ServiceCartRow({
  item,
  stylesThemed,
  onConfirmBooking,
  onPayBooking,
}: {
  item: CartItem;
  stylesThemed: ReturnType<typeof createCartStyles>;
  onConfirmBooking: (item: CartItem) => Promise<void>;
  onPayBooking: (item: CartItem, amount: number) => Promise<void>;
}) {
  const deleteCartItem = useDeleteCartItem();
  const [confirming, setConfirming] = useState(false);
  const statusLines = parseWaStatusLines(item.wa_status_lines);
  const canConfirm = Boolean(item.wa_confirmable);
  const confirmedPrice = item.wa_confirmed_price ? Number(item.wa_confirmed_price) : null;
  const requiresPayment = canConfirm && confirmedPrice != null && Number.isFinite(confirmedPrice) && confirmedPrice > 0;
  const hasVenueWa = Boolean(item.business_card?.contact_whatsapp?.trim());

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
        <Text style={stylesThemed.price}>{Number(item.cost).toLocaleString()} </Text>
        {!hasVenueWa ? (
          <Text style={[stylesThemed.meta, { marginTop: 8 }]}>Venue has no WhatsApp on file — automation cannot start.</Text>
        ) : null}
        {statusLines.length > 0 ? (
          <View style={{ marginTop: 10, gap: 4 }}>
            {statusLines.map((line, idx) => (
              <Text key={`${idx}-${line.slice(0, 24)}`} style={stylesThemed.waStatusLine}>
                {line}
              </Text>
            ))}
          </View>
        ) : item.wa_n8n_started_at ? (
          <Text style={[stylesThemed.meta, { marginTop: 8 }]}>Waiting for venue status…</Text>
        ) : hasVenueWa ? (
          <Text style={[stylesThemed.meta, { marginTop: 8 }]}>Starting venue check…</Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {requiresPayment ? (
            <Pressable
              style={[stylesThemed.smallBtnOutline, confirming && { opacity: 0.55 }]}
              disabled={confirming}
              accessibilityState={{ disabled: confirming }}
              onPress={() => {
                setConfirming(true);
                void Promise.resolve(onPayBooking(item, confirmedPrice!)).finally(() => setConfirming(false));
              }}
            >
              <Text style={stylesThemed.smallBtnOutlineText}>
                {confirming ? "Saving…" : `Pay ${Math.trunc(confirmedPrice!)} $`}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[
                stylesThemed.smallBtnOutline,
                (confirming || !canConfirm) && { opacity: 0.55 },
              ]}
              disabled={confirming || !canConfirm}
              accessibilityState={{ disabled: confirming || !canConfirm }}
              onPress={() => {
                setConfirming(true);
                void Promise.resolve(onConfirmBooking(item)).finally(() => setConfirming(false));
              }}
            >
              <Text style={stylesThemed.smallBtnOutlineText}>{confirming ? "Saving…" : "Confirm"}</Text>
            </Pressable>
          )}
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
    waStatusLine: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
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
        <Text style={stylesThemed.price}>{line.toLocaleString()} $</Text>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<CartStackParamList>>();
  const stylesThemed = useMemo(() => createCartStyles(colors, insets.bottom), [colors, insets.bottom]);
  const { user, session, loading } = useAuth();
  const queryClient = useQueryClient();
  const confirmServiceBooking = useConfirmServiceCartBooking();
  const [tab, setTab] = useState<"services" | "shopping">("services");
  const [isPayingShopping, setIsPayingShopping] = useState(false);
  const [checkingShopWa, setCheckingShopWa] = useState(false);
  const { data: cartItems = [], isLoading: cl, refetch: refetchCartItems } = useCartItems();
  const [servicesRefreshing, setServicesRefreshing] = useState(false);
  const { data: shoppingItems = [], isLoading: sl } = useShoppingCart();
  const n8nStartingRef = useRef(new Set<string>());
  const n8nStartFailedRef = useRef(new Set<string>());

  useEffect(() => {
    if (tab !== "services" || loading || !user) return;
    const accessToken = session?.access_token;
    if (!accessToken) return;
    for (const item of cartItems) {
      if (item.wa_n8n_started_at) continue;
      if (n8nStartFailedRef.current.has(item.id)) continue;
      if (n8nStartingRef.current.has(item.id)) continue;
      if (!item.business_card?.contact_whatsapp?.trim()) {
        n8nStartFailedRef.current.add(item.id);
        continue;
      }
      n8nStartingRef.current.add(item.id);
      void supabase.functions
        .invoke("n8n-wa-booking-start", {
          body: { cart_item_id: item.id },
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((res) => {
          const { data, error } = res;
          if (!error) return;
          let msg = error.message;
          const ctx = (error as { context?: { body?: string } }).context;
          const rawBody = ctx?.body;
          if (rawBody) {
            try {
              const j = JSON.parse(rawBody) as {
                error?: string;
                hint?: string;
                step?: string;
                n8n_status?: number;
                n8n_message?: string;
                n8n_body_preview?: string;
                wa_booking_status?: number;
                wa_booking_body_preview?: string;
              };
              if (j.error) {
                msg = `${msg} [${j.step ?? "?"}] ${j.error}`;
                if (j.n8n_message) msg += `: ${j.n8n_message}`;
                if (j.hint) msg += ` — ${j.hint}`;
                const upstream = j.wa_booking_status ?? j.n8n_status;
                if (upstream != null) {
                  msg += j.wa_booking_status != null ? ` (booking service HTTP ${upstream})` : ` (n8n HTTP ${upstream})`;
                }
              }
            } catch {
              msg = `${msg} ${rawBody.slice(0, 160)}`;
            }
          } else if (data && typeof data === "object" && data !== null && "error" in data) {
            const j = data as { error?: string; hint?: string };
            if (typeof j.error === "string") msg = `${msg}: ${j.error}${j.hint ? ` — ${j.hint}` : ""}`;
          }
          console.warn("[n8n-wa-booking-start]", msg);
          n8nStartFailedRef.current.add(item.id);
        })
        .finally(() => {
          n8nStartingRef.current.delete(item.id);
          void queryClient.invalidateQueries({ queryKey: ["cart_items", user.id] });
        });
    }
  }, [tab, cartItems, loading, user, session?.access_token, queryClient]);

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

  const handleConfirmServiceBooking = async (item: CartItem) => {
    try {
      await confirmServiceBooking.mutateAsync({ cartItemId: item.id, action: "confirm" });
      Alert.alert("Booking confirmed", "Your booking is saved under Bookings.");
      navigation.getParent()?.dispatch(
        CommonActions.navigate({
          name: "Bookings",
          params: { screen: "BookingsMain" },
        }),
      );
    } catch (e: unknown) {
      Alert.alert("Could not confirm", e instanceof Error ? e.message : "Unknown error");
    }
  };

  const handlePayServiceBooking = async (item: CartItem, amount: number) => {
    try {
      await confirmServiceBooking.mutateAsync({ cartItemId: item.id, action: "pay" });
      Alert.alert("Price accepted", `Booking moved to Bookings with pending payment: ${Math.trunc(amount)} $.`);
      navigation.getParent()?.dispatch(
        CommonActions.navigate({
          name: "Bookings",
          params: { screen: "BookingsMain" },
        }),
      );
    } catch (e: unknown) {
      Alert.alert("Could not move booking", e instanceof Error ? e.message : "Unknown error");
    }
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
            refreshControl={
              <RefreshControl
                refreshing={servicesRefreshing}
                onRefresh={() => {
                  n8nStartFailedRef.current.clear();
                  setServicesRefreshing(true);
                  void refetchCartItems().finally(() => setServicesRefreshing(false));
                }}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={<Text style={stylesThemed.empty}>No service bookings in cart</Text>}
            renderItem={({ item }) => (
              <ServiceCartRow
                item={item}
                stylesThemed={stylesThemed}
                onConfirmBooking={handleConfirmServiceBooking}
                onPayBooking={handlePayServiceBooking}
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
              <Text style={stylesThemed.totalVal}>{shoppingTotal.toLocaleString()} $</Text>
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
                    {isPayingShopping ? "Processing..." : `Pay ${shoppingTotal.toLocaleString()} $`}
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
