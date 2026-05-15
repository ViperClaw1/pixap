import { useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/app/providers/AuthProvider";
import { usePaidCartItems } from "@/entities/cart";
import type { CartItem } from "@/entities/cart";
import { usePaidShoppingCartItems } from "@/entities/shopping";
import type { ShoppingCartItem } from "@/entities/shopping";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { myPurchasesStaticStyles, myPurchasesThemeStyles } from "./myPurchasesStyles";

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

  const themed = useThemeStyles(({ colors: c }) => myPurchasesThemeStyles(c));
  const styles = useMemo(
    () => mergeStaticAndThemed(myPurchasesStaticStyles, themed),
    [themed],
  );

  if (!loading && !user) {
    return null;
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.header}>
        <Pressable style={{ padding: 8 }} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Ionicons name="bag-handle-outline" size={22} color={colors.textMuted} />
        <Text style={styles.headerTitle}>My purchases</Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom, 24),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { marginTop: 16 }]}>
          {loadingPurchases ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
          {!loadingPurchases && mergedRows.length === 0 ? (
            <Text style={styles.emptyText}>No paid purchases yet.</Text>
          ) : null}
          {!loadingPurchases
            ? mergedRows.map((row) => {
                if (row.kind === "booking") {
                  const item = row.item;
                  const businessName = item.business_card?.name?.trim() ?? "—";
                  const paidAt = item.paid_at ? new Date(item.paid_at).toLocaleString() : "—";
                  const amount = item.persons != null && item.persons > 0 ? item.persons : 1;
                  return (
                    <View key={`b-${item.id}`} style={styles.purchaseCard}>
                      <View style={styles.typePill}>
                        <Text style={styles.typePillText}>Booking</Text>
                      </View>
                      <Text style={styles.purchaseLabel}>Item name</Text>
                      <Text style={styles.purchaseValue}>{businessName}</Text>
                      <Text style={styles.purchaseLabel}>Business card name</Text>
                      <Text style={styles.purchaseValue}>{businessName}</Text>
                      <Text style={styles.purchaseLabel}>Price</Text>
                      <Text style={styles.purchaseValue}>{Number(item.cost).toLocaleString()} ₸</Text>
                      <Text style={styles.purchaseLabel}>Amount</Text>
                      <Text style={styles.purchaseValue}>
                        {amount} {amount === 1 ? "person" : "persons"}
                      </Text>
                      <Text style={styles.purchaseLabel}>Payment date & time</Text>
                      <Text style={styles.purchaseValue}>{paidAt}</Text>

                      <View style={styles.bookingBlock}>
                        <Text style={styles.purchaseLabel}>Booking</Text>
                        <Text style={styles.purchaseValue}>Persons: {item.persons ?? "—"}</Text>
                        {item.customer_name ? (
                          <>
                            <Text style={styles.purchaseLabel}>Customer name</Text>
                            <Text style={styles.purchaseValue}>{item.customer_name}</Text>
                          </>
                        ) : null}
                        {item.customer_phone ? (
                          <>
                            <Text style={styles.purchaseLabel}>Phone</Text>
                            <Text style={styles.purchaseValue}>{item.customer_phone}</Text>
                          </>
                        ) : null}
                        {item.customer_email ? (
                          <>
                            <Text style={styles.purchaseLabel}>Email</Text>
                            <Text style={styles.purchaseValue}>{item.customer_email}</Text>
                          </>
                        ) : null}
                        {item.comment?.trim() ? (
                          <>
                            <Text style={styles.purchaseLabel}>Comment</Text>
                            <Text style={styles.purchaseValue}>{item.comment.trim()}</Text>
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
                  <View key={`s-${item.id}`} style={styles.purchaseCard}>
                    <View style={styles.typePill}>
                      <Text style={styles.typePillText}>Shopping</Text>
                    </View>
                    <Text style={styles.purchaseLabel}>Item name</Text>
                    <Text style={styles.purchaseValue}>{itemName}</Text>
                    <Text style={styles.purchaseLabel}>Business card name</Text>
                    <Text style={styles.purchaseValue}>{businessName}</Text>
                    <Text style={styles.purchaseLabel}>Price</Text>
                    <Text style={styles.purchaseValue}>{lineTotal.toLocaleString()} ₸</Text>
                    <Text style={styles.purchaseLabel}>Amount</Text>
                    <Text style={styles.purchaseValue}>
                      {qtyTotal} {qtyTotal === 1 ? "item" : "items"}
                    </Text>
                    <Text style={styles.purchaseLabel}>Payment date & time</Text>
                    <Text style={styles.purchaseValue}>{paidAt}</Text>
                    {(item.children ?? []).length > 0 ? (
                      <View style={{ marginTop: 8 }}>
                        {(item.children ?? []).map((c) => (
                          <Text key={c.id} style={styles.childLine}>
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
