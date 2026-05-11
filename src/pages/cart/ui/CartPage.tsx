import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { useAuth } from "@/contexts/AuthContext";
import { useCartItems, useConfirmServiceCartBooking, type CartItem } from "@/entities/cart";
import { useShoppingCart } from "@/entities/shopping";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuthSessionRedirect } from "@/features/auth-session-redirect";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CartStackParamList } from "@/navigation/types";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { isAuthRequiredError, navigateToAuthScreen } from "@/lib/authRequired";
import {
  buildAvailabilityMessage,
  openWhatsAppAvailability,
  resolveShoppingWhatsAppPhone,
  shoppingCartContextLines,
} from "@/lib/whatsappAvailability";
import { createCartStyles, ServiceCartRow, ShopRow } from "@/widgets/cart";

export default function CartPage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<CartStackParamList>>();
  const stylesThemed = useMemo(() => createCartStyles(colors, insets.bottom), [colors, insets.bottom]);
  const { user, session, loading } = useAuth();
  useAuthSessionRedirect({
    authLoading: loading,
    hasUser: Boolean(user),
    navigation: navigation as unknown as NavigationProp<ParamListBase>,
  });
  const queryClient = useQueryClient();
  const confirmServiceBooking = useConfirmServiceCartBooking();
  const [tab, setTab] = useState<"services" | "shopping">("services");
  const [checkingShopWa, setCheckingShopWa] = useState(false);
  const { data: cartItems = [], isLoading: cl, refetch: refetchCartItems } = useCartItems();
  const [servicesRefreshing, setServicesRefreshing] = useState(false);
  const { data: shoppingItems = [], isLoading: sl } = useShoppingCart();
  const n8nStartingRef = useRef(new Set<string>());
  const n8nStartFailedRef = useRef(new Set<string>());
  const handleAuthRequired = () => navigateToAuthScreen(navigation);
  const paidServiceDrafts = useMemo(
    () => cartItems.filter((item) => item.status === "created" && Number(item.cost ?? 0) > 0),
    [cartItems],
  );
  const paymentAwaitingServices = useMemo(
    () => paidServiceDrafts.filter((item) => (item.wa_payment_link?.trim()?.length ?? 0) > 0),
    [paidServiceDrafts],
  );

  useEffect(() => {
    if (tab !== "services" || loading || !user) return;
    const accessToken = session?.access_token;
    if (!accessToken) return;
    for (const item of paidServiceDrafts) {
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
  }, [tab, paidServiceDrafts, loading, user, session?.access_token, queryClient]);

  if (loading) {
    return (
      <View style={[stylesThemed.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[stylesThemed.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
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
      Alert.alert(t("cart.bookingConfirmedTitle"), t("cart.bookingConfirmedBody"));
      navigation.getParent()?.dispatch(
        CommonActions.navigate({
          name: "Bookings",
          params: { screen: "BookingsMain" },
        }),
      );
    } catch (e: unknown) {
      if (isAuthRequiredError(e)) {
        handleAuthRequired();
        return;
      }
      Alert.alert(t("cart.couldNotConfirm"), e instanceof Error ? e.message : t("common.unknownError"));
    }
  };

  const handlePayServiceBooking = async (item: CartItem) => {
    const paymentLink = item.wa_payment_link?.trim();
    if (!paymentLink) {
      Alert.alert(t("cart.paymentLinkMissing"), t("cart.paymentLinkMissingBody"));
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(paymentLink);
      if (!canOpen) {
        throw new Error("Cannot open this payment link");
      }
      await Linking.openURL(paymentLink);
    } catch (e: unknown) {
      Alert.alert(t("cart.couldNotOpenPaymentLink"), e instanceof Error ? e.message : t("common.unknownError"));
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

  return (
    <View style={stylesThemed.root}>
      <Text style={[stylesThemed.header, { paddingTop: Math.max(insets.top, 12) }]}>{t("cart.title")}</Text>
      <View style={stylesThemed.tabs}>
        <Pressable style={[stylesThemed.tab, tab === "services" && stylesThemed.tabActive]} onPress={() => setTab("services")}>
          <Text style={tab === "services" ? stylesThemed.tabTextActive : stylesThemed.tabText}>{t("cart.tabServices")}</Text>
        </Pressable>
        <Pressable style={[stylesThemed.tab, tab === "shopping" && stylesThemed.tabActive]} onPress={() => setTab("shopping")}>
          <Text style={tab === "shopping" ? stylesThemed.tabTextActive : stylesThemed.tabText}>{t("cart.tabShopping")}</Text>
        </Pressable>
      </View>

      {tab === "services" ? (
        cl ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        ) : (
          <FlatList
            data={paymentAwaitingServices}
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
            ListEmptyComponent={<Text style={stylesThemed.empty}>{t("cart.emptyPaymentAwaiting")}</Text>}
            renderItem={({ item }) => (
              <ServiceCartRow
                item={item}
                stylesThemed={stylesThemed}
                onConfirmBooking={handleConfirmServiceBooking}
                onPayBooking={handlePayServiceBooking}
                onAuthRequired={handleAuthRequired}
              />
            )}
          />
        )
      ) : sl ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}>
          {shoppingItems.length === 0 ? (
            <Text style={stylesThemed.empty}>{t("cart.emptyShopping")}</Text>
          ) : (
            shoppingItems.map((item) => (
              <ShopRow
                key={item.id}
                item={item}
                stylesThemed={stylesThemed}
                labelColor={colors.text}
                onAuthRequired={handleAuthRequired}
              />
            ))
          )}
          {shoppingItems.length > 0 ? (
            <View style={stylesThemed.payBar}>
              <Text style={stylesThemed.totalLabel}>{t("cart.total")}</Text>
              <Text style={stylesThemed.totalVal}>{shoppingTotal.toLocaleString()} $</Text>
              <Pressable
                style={[stylesThemed.payBtn, checkingShopWa && { opacity: 0.6 }]}
                disabled={checkingShopWa}
                onPress={() => void checkShoppingAvailability()}
              >
                <Text style={stylesThemed.payBtnText}>
                  {checkingShopWa ? t("cart.opening") : t("cart.checkAvailability")}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
