import { useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { usePaidCartItems } from "@/hooks/usePaidCartItems";
import type { CartItem } from "@/hooks/useCartItems";
import { usePaidShoppingCartItems } from "@/hooks/usePaidShoppingCartItems";
import type { ShoppingCartItem } from "@/hooks/useShoppingItems";
import type { ProfileStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "MyPurchases">;

function shoppingLineTotal(item: ShoppingCartItem): number {
  return (
    (item.shopping_item?.price || 0) * item.quantity +
    (item.children ?? []).reduce((s, c) => s + (c.shopping_item?.price || 0) * c.quantity, 0)
  );
}

function shoppingQtyTotal(item: ShoppingCartItem): number {
  return item.quantity + (item.children ?? []).reduce((s, c) => s + c.quantity, 0);
}

type MergedRow =
  | { kind: "booking"; created_at: string; item: CartItem }
  | { kind: "shopping"; created_at: string; item: ShoppingCartItem };

export default function MyPurchasesScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user, loading } = useAuth();
  const { data: paidBookings = [], isLoading: loadingBookings } = usePaidCartItems();
  const { data: paidShopping = [], isLoading: loadingShopping } = usePaidShoppingCartItems();

  useEffect(() => {
    if (!loading && !user) {
      navigation.navigate("Auth");
    }
  }, [loading, user, navigation]);

  const mergedRows = useMemo(() => {
    const rows: MergedRow[] = [
      ...paidBookings.map((item) => ({
        kind: "booking" as const,
        created_at: item.paid_at ?? item.created_at,
        item,
      })),
      ...paidShopping.map((item) => ({ kind: "shopping" as const, created_at: item.created_at, item })),
    ];
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return rows;
  }, [paidBookings, paidShopping]);

  const loadingPurchases = loadingBookings || loadingShopping;

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: "#07101d" },
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 8,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#202a3d",
        },
        headerTitle: { fontSize: 20, fontWeight: "800", color: "#f4f7ff", flex: 1 },
        card: {
          backgroundColor: "#111b2a",
          borderRadius: 20,
          borderWidth: 1,
          borderColor: "#202a3d",
          marginBottom: 16,
          padding: 16,
        },
        purchaseCard: {
          backgroundColor: "#0d1625",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#1e2941",
          padding: 14,
          marginBottom: 10,
        },
        typePill: {
          alignSelf: "flex-start",
          marginBottom: 8,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: "#1a2538",
        },
        typePillText: { fontSize: 11, fontWeight: "700", color: "#93a0b5" },
        purchaseLabel: { fontSize: 11, fontWeight: "600", color: "#7a8aa0", marginTop: 8 },
        purchaseValue: { fontSize: 14, color: "#e8edf5", marginTop: 2 },
        childLine: { fontSize: 12, color: "#93a0b5", marginTop: 4 },
        bookingBlock: {
          marginTop: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: "#1e2941",
        },
        emptyText: { color: "#93a0b5", textAlign: "center", marginTop: 12, fontSize: 14 },
      }),
    [],
  );

  if (!loading && !user) {
    return null;
  }

  return (
    <View style={[stylesThemed.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={stylesThemed.header}>
        <Pressable style={{ padding: 8 }} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#f4f7ff" />
        </Pressable>
        <Ionicons name="bag-handle-outline" size={22} color="#9aa8be" />
        <Text style={stylesThemed.headerTitle}>My purchases</Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom, 24),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[stylesThemed.card, { marginTop: 16 }]}>
          {loadingPurchases ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
          {!loadingPurchases && mergedRows.length === 0 ? (
            <Text style={stylesThemed.emptyText}>No paid purchases yet.</Text>
          ) : null}
          {!loadingPurchases
            ? mergedRows.map((row) => {
                if (row.kind === "booking") {
                  const item = row.item;
                  const businessName = item.business_card?.name?.trim() ?? "—";
                  const paidAt = item.paid_at ? new Date(item.paid_at).toLocaleString() : "—";
                  const amount = item.persons != null && item.persons > 0 ? item.persons : 1;
                  return (
                    <View key={`b-${item.id}`} style={stylesThemed.purchaseCard}>
                      <View style={stylesThemed.typePill}>
                        <Text style={stylesThemed.typePillText}>Booking</Text>
                      </View>
                      <Text style={stylesThemed.purchaseLabel}>Item name</Text>
                      <Text style={stylesThemed.purchaseValue}>{businessName}</Text>
                      <Text style={stylesThemed.purchaseLabel}>Business card name</Text>
                      <Text style={stylesThemed.purchaseValue}>{businessName}</Text>
                      <Text style={stylesThemed.purchaseLabel}>Price</Text>
                      <Text style={stylesThemed.purchaseValue}>{Number(item.cost).toLocaleString()} ₸</Text>
                      <Text style={stylesThemed.purchaseLabel}>Amount</Text>
                      <Text style={stylesThemed.purchaseValue}>
                        {amount} {amount === 1 ? "person" : "persons"}
                      </Text>
                      <Text style={stylesThemed.purchaseLabel}>Payment date & time</Text>
                      <Text style={stylesThemed.purchaseValue}>{paidAt}</Text>

                      <View style={stylesThemed.bookingBlock}>
                        <Text style={stylesThemed.purchaseLabel}>Booking</Text>
                        <Text style={stylesThemed.purchaseValue}>Persons: {item.persons ?? "—"}</Text>
                        {item.customer_name ? (
                          <>
                            <Text style={stylesThemed.purchaseLabel}>Customer name</Text>
                            <Text style={stylesThemed.purchaseValue}>{item.customer_name}</Text>
                          </>
                        ) : null}
                        {item.customer_phone ? (
                          <>
                            <Text style={stylesThemed.purchaseLabel}>Phone</Text>
                            <Text style={stylesThemed.purchaseValue}>{item.customer_phone}</Text>
                          </>
                        ) : null}
                        {item.customer_email ? (
                          <>
                            <Text style={stylesThemed.purchaseLabel}>Email</Text>
                            <Text style={stylesThemed.purchaseValue}>{item.customer_email}</Text>
                          </>
                        ) : null}
                        {item.comment?.trim() ? (
                          <>
                            <Text style={stylesThemed.purchaseLabel}>Comment</Text>
                            <Text style={stylesThemed.purchaseValue}>{item.comment.trim()}</Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                  );
                }

                const item = row.item;
                const businessName = item.business_card?.name?.trim() ?? "—";
                const itemName = item.shopping_item?.name?.trim() ?? "—";
                const paidAt = item.paid_at ? new Date(item.paid_at).toLocaleString() : "—";
                const lineTotal = shoppingLineTotal(item);
                const qtyTotal = shoppingQtyTotal(item);
                return (
                  <View key={`s-${item.id}`} style={stylesThemed.purchaseCard}>
                    <View style={stylesThemed.typePill}>
                      <Text style={stylesThemed.typePillText}>Shopping</Text>
                    </View>
                    <Text style={stylesThemed.purchaseLabel}>Item name</Text>
                    <Text style={stylesThemed.purchaseValue}>{itemName}</Text>
                    <Text style={stylesThemed.purchaseLabel}>Business card name</Text>
                    <Text style={stylesThemed.purchaseValue}>{businessName}</Text>
                    <Text style={stylesThemed.purchaseLabel}>Price</Text>
                    <Text style={stylesThemed.purchaseValue}>{lineTotal.toLocaleString()} ₸</Text>
                    <Text style={stylesThemed.purchaseLabel}>Amount</Text>
                    <Text style={stylesThemed.purchaseValue}>
                      {qtyTotal} {qtyTotal === 1 ? "item" : "items"}
                    </Text>
                    <Text style={stylesThemed.purchaseLabel}>Payment date & time</Text>
                    <Text style={stylesThemed.purchaseValue}>{paidAt}</Text>
                    {(item.children ?? []).length > 0 ? (
                      <View style={{ marginTop: 8 }}>
                        {(item.children ?? []).map((c) => (
                          <Text key={c.id} style={stylesThemed.childLine}>
                            + {c.shopping_item?.name ?? "—"} ×{c.quantity}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })
            : null}
        </View>
      </ScrollView>
    </View>
  );
}
