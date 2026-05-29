import { AppPressable } from "@/shared/ui/app-pressable";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View, Text, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { FLASH_LIST_ESTIMATED_SIZE } from "@/shared/lib/flashListEstimatedSizes";
import { useAuth } from "@/app/providers/AuthProvider";
import { useAutoStartN8nWaBookingForPaidItems, useCartItems, useConfirmServiceCartBooking, type CartItem } from "@/entities/cart";
import { useShoppingCart } from "@/entities/shopping";
import { useAuthSessionRedirect } from "@/features/auth-session-redirect";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { CartStackParamList } from "@/app/navigation/types";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import {
  buildAvailabilityMessage,
  openWhatsAppAvailability,
  resolveShoppingWhatsAppPhone,
  shoppingCartContextLines,
} from "@/entities/shopping/lib/whatsappAvailability";
import { ServiceCartRow, ShopRow, useCartStyles } from "@/widgets/cart";

export default function CartPage() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<CartStackParamList>>();
  const stylesThemed = useCartStyles(insets.bottom);
  const { user, session, loading } = useAuth();
  useAuthSessionRedirect({
    authLoading: loading,
    hasUser: Boolean(user),
    navigation,
  });
  const confirmServiceBooking = useConfirmServiceCartBooking();
  const [tab, setTab] = useState<"services" | "shopping">("services");
  const [checkingShopWa, setCheckingShopWa] = useState(false);
  const { data: cartItems = [], isLoading: cl, refetch: refetchCartItems } = useCartItems();
  const [servicesRefreshing, setServicesRefreshing] = useState(false);
  const { data: shoppingItems = [], isLoading: sl } = useShoppingCart();
  const handleAuthRequired = () => navigateToAuthScreen(navigation);
  const paidServiceDrafts = useMemo(
    () => cartItems.filter((item) => item.status === "created" && Number(item.cost ?? 0) > 0),
    [cartItems],
  );
  const paymentAwaitingServices = useMemo(
    () => paidServiceDrafts.filter((item) => (item.wa_payment_link?.trim()?.length ?? 0) > 0),
    [paidServiceDrafts],
  );

  useAutoStartN8nWaBookingForPaidItems(
    paidServiceDrafts,
    tab === "services" && !loading && Boolean(user),
    session?.access_token,
    user?.id,
  );

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

  const renderServiceCartItem = ({ item }: { item: CartItem }) => (
    <ServiceCartRow
      item={item}
      stylesThemed={stylesThemed}
      onConfirmBooking={handleConfirmServiceBooking}
      onPayBooking={handlePayServiceBooking}
      onAuthRequired={handleAuthRequired}
    />
  );

  const renderShoppingCartItem = ({ item }: { item: (typeof shoppingItems)[number] }) => (
    <ShopRow
      item={item}
      stylesThemed={stylesThemed}
      labelColor={colors.text}
      onAuthRequired={handleAuthRequired}
    />
  );

  return (
    <View style={stylesThemed.root}>
      <Text style={[stylesThemed.header, { paddingTop: Math.max(insets.top, 12) }]}>{t("cart.title")}</Text>
      <View style={stylesThemed.tabs}>
        <AppPressable style={[stylesThemed.tab, tab === "services" && stylesThemed.tabActive]} onPress={() => setTab("services")}>
          <Text style={tab === "services" ? stylesThemed.tabTextActive : stylesThemed.tabText}>{t("cart.tabServices")}</Text>
        </AppPressable>
        <AppPressable style={[stylesThemed.tab, tab === "shopping" && stylesThemed.tabActive]} onPress={() => setTab("shopping")}>
          <Text style={tab === "shopping" ? stylesThemed.tabTextActive : stylesThemed.tabText}>{t("cart.tabShopping")}</Text>
        </AppPressable>
      </View>

      {tab === "services" ? (
        cl ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        ) : (
          <FlashList
            data={paymentAwaitingServices}
            keyExtractor={(i) => i.id}
            estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.cartService}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
            refreshControl={
              <RefreshControl
                refreshing={servicesRefreshing}
                onRefresh={() => {
                  setServicesRefreshing(true);
                  void refetchCartItems().finally(() => setServicesRefreshing(false));
                }}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={<Text style={stylesThemed.empty}>{t("cart.emptyPaymentAwaiting")}</Text>}
            renderItem={renderServiceCartItem}
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={8}
            updateCellsBatchingPeriod={40}
          />
        )
      ) : sl ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <FlashList
          data={shoppingItems}
          keyExtractor={(item) => item.id}
          estimatedItemSize={FLASH_LIST_ESTIMATED_SIZE.cartShopping}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}
          ListEmptyComponent={<Text style={stylesThemed.empty}>{t("cart.emptyShopping")}</Text>}
          ListFooterComponent={
            shoppingItems.length > 0 ? (
              <View style={stylesThemed.payBar}>
                <Text style={stylesThemed.totalLabel}>{t("cart.total")}</Text>
                <Text style={stylesThemed.totalVal}>{shoppingTotal.toLocaleString()} $</Text>
                <AppPressable
                  style={[stylesThemed.payBtn, checkingShopWa && { opacity: 0.6 }]}
                  disabled={checkingShopWa}
                  onPress={() => void checkShoppingAvailability()}
                >
                  <Text style={stylesThemed.payBtnText}>
                    {checkingShopWa ? t("cart.opening") : t("cart.checkAvailability")}
                  </Text>
                </AppPressable>
              </View>
            ) : null
          }
          renderItem={renderShoppingCartItem}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={8}
          updateCellsBatchingPeriod={40}
        />
      )}
    </View>
  );
}
