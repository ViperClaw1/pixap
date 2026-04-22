import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Modal, ActivityIndicator, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { useNotifications } from "@/hooks/useNotifications";
import { useFavorites } from "@/hooks/useFavorites";
import { useBookings } from "@/hooks/useBookings";
import type { ProfileStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import { SmartImage } from "@/components/SmartImage";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "ProfileMain">;
const PRIVACY_URL = "https://pixapp.kz/privacy";

type ActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function ProfileScreenContent() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user, loading, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: notifications = [], isLoading: loadingNotifications } = useNotifications();
  const { data: favorites = [] } = useFavorites();
  const { data: bookings = [] } = useBookings();
  const { role } = useUserRole();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigation.navigate("Auth");
    }
  }, [loading, user, navigation]);

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
        header: { fontSize: 30, fontWeight: "800", color: colors.text, marginBottom: 16 },
        card: {
          backgroundColor: colors.card,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 16,
          padding: 16,
        },
        profileRow: { flexDirection: "row", alignItems: "center" },
        avatarWrap: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        },
        avatarText: { color: colors.primary, fontSize: 24, fontWeight: "700" },
        name: { fontSize: 18, fontWeight: "700", color: colors.text },
        email: { color: colors.textMuted, marginTop: 2, fontSize: 16 },
        settingsBtn: {
          marginLeft: "auto",
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        statRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
        statCard: {
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 14,
          alignItems: "center",
        },
        statValue: { color: colors.text, fontSize: 24, fontWeight: "700" },
        statLabel: { color: colors.textMuted, fontSize: 12 },
        actionsCard: {
          backgroundColor: colors.card,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        },
        link: {
          paddingVertical: 15,
          paddingHorizontal: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        linkText: { color: colors.text, fontSize: 14 },
        linkRight: { marginLeft: "auto" },
        signOut: {
          backgroundColor: colors.surface,
          marginTop: 16,
          borderRadius: 16,
          paddingVertical: 15,
          alignItems: "center",
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
          alignItems: "stretch",
        },
        modalContent: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          borderBottomWidth: 0,
          paddingBottom: Math.max(insets.bottom, 10),
          flexGrow: 0,
          flexShrink: 1,
        },
        modalContentLarge: { maxHeight: "75%" },
        modalHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        modalTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
        modalBody: { padding: 16 },
        notificationCard: {
          backgroundColor: colors.surface,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 12,
          marginBottom: 10,
        },
        notificationText: { color: colors.text, fontSize: 14 },
        notificationDate: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
        emptyText: { color: colors.textMuted, textAlign: "center", marginTop: 12, fontSize: 12 },
        closeBtn: {
          backgroundColor: colors.surface,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: colors.border,
        },
        closeText: { color: colors.text, fontSize: 12, fontWeight: "600" },
      }),
    [colors, insets.bottom],
  );

  const userName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "User";
  const openPrivacy = () => {
    void Linking.openURL(PRIVACY_URL);
  };

  const actions: ActionItem[] = [
    { key: "purchases", label: "My Purchases", icon: "bag-handle-outline", onPress: () => navigation.navigate("MyPurchases") },
    { key: "notifications", label: "Notifications", icon: "notifications-outline", onPress: () => setNotificationsOpen(true) },
    { key: "favorites", label: "Favorites", icon: "star-outline", onPress: () => navigation.navigate("Favorites") },
    { key: "privacy", label: "Privacy & Security", icon: "shield-outline", onPress: openPrivacy },
    { key: "settings", label: "Settings", icon: "settings-outline", onPress: () => navigation.navigate("EditProfile") },
  ];

  if (!loading && !user) {
    return null;
  }

  return (
    <ScrollView
      style={stylesThemed.root}
      contentContainerStyle={{ paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 24) }}
    >
      <Text style={stylesThemed.header}>Profile</Text>
      <View style={stylesThemed.card}>
        <View style={stylesThemed.profileRow}>
          <View style={stylesThemed.avatarWrap}>
            {profile?.avatar_url ? (
              <SmartImage
                uri={profile.avatar_url}
                recyclingKey={profile.avatar_url}
                style={{ width: 56, height: 56, borderRadius: 28 }}
                contentFit="cover"
              />
            ) : (
              <Text style={stylesThemed.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={stylesThemed.name}>{userName}</Text>
            <Text style={stylesThemed.email}>{profile?.email ?? user?.email}</Text>
          </View>
          <Pressable style={stylesThemed.settingsBtn} onPress={() => navigation.navigate("EditProfile")}>
            <Ionicons name="settings-outline" size={16} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <View style={stylesThemed.statRow}>
        <View style={stylesThemed.statCard}>
          <Text style={stylesThemed.statValue}>{bookings.length}</Text>
          <Text style={stylesThemed.statLabel}>Bookings</Text>
        </View>
        <View style={stylesThemed.statCard}>
          <Text style={stylesThemed.statValue}>0</Text>
          <Text style={stylesThemed.statLabel}>Reviews</Text>
        </View>
        <View style={stylesThemed.statCard}>
          <Text style={stylesThemed.statValue}>{favorites.length}</Text>
          <Text style={stylesThemed.statLabel}>Favorites</Text>
        </View>
      </View>

      <View style={stylesThemed.actionsCard}>
        {actions.map((item, index) => (
          <Pressable
            key={item.key}
            style={[stylesThemed.link, index === actions.length - 1 ? { borderBottomWidth: 0 } : null]}
            onPress={item.onPress}
          >
            <Ionicons name={item.icon} size={20} color={colors.textMuted} />
            <Text style={stylesThemed.linkText}>{item.label}</Text>
            <Ionicons style={stylesThemed.linkRight} name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
      {(role === "admin" || role === "partner") && (
        <Pressable style={[stylesThemed.link, { marginTop: 10 }]} onPress={() => navigation.navigate("AdminImageUpload")}>
          <Text style={stylesThemed.linkText}>Partner: upload listing image</Text>
        </Pressable>
      )}
      <Pressable style={stylesThemed.signOut} onPress={() => void signOut()}>
        <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 14 }}>Log Out</Text>
      </Pressable>

      {/* Notifications Modal */}
      <Modal
        visible={notificationsOpen}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setNotificationsOpen(false)}
      >
        <View style={stylesThemed.modalBackdrop}>
          <View style={[stylesThemed.modalContent, stylesThemed.modalContentLarge]}>
            <View style={stylesThemed.modalHeader}>
              <Text style={stylesThemed.modalTitle}>Notifications</Text>
              <Pressable style={stylesThemed.closeBtn} onPress={() => setNotificationsOpen(false)}>
                <Text style={stylesThemed.closeText}>Close</Text>
              </Pressable>
            </View>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={stylesThemed.modalBody}>
              {loadingNotifications ? <ActivityIndicator color={colors.primary} /> : null}
              {!loadingNotifications && notifications.length === 0 ? (
                <Text style={stylesThemed.emptyText}>No notifications yet.</Text>
              ) : null}
              {notifications.map((n) => (
                <View key={n.id} style={stylesThemed.notificationCard}>
                  <Text style={stylesThemed.notificationText}>{n.text}</Text>
                  <Text style={stylesThemed.notificationDate}>{new Date(n.created_at).toLocaleString()}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default function ProfileScreen() {
  return <ProfileScreenContent />;
}