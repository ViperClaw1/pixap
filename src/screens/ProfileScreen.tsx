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

type Nav = NativeStackNavigationProp<ProfileStackParamList, "ProfileMain">;
const PRIVACY_URL = "https://pixapp.kz/privacy";

type ActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export default function ProfileScreen() {
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
        root: { flex: 1, backgroundColor: "#07101d", paddingHorizontal: 16 },
        header: { fontSize: 30, fontWeight: "800", color: "#f4f7ff", marginBottom: 16 },
        card: {
          backgroundColor: "#111b2a",
          borderRadius: 20,
          borderWidth: 1,
          borderColor: "#202a3d",
          marginBottom: 16,
          padding: 16,
        },
        profileRow: { flexDirection: "row", alignItems: "center" },
        avatarWrap: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#2a2230",
          alignItems: "center",
          justifyContent: "center",
        },
        avatarText: { color: "#ff6d47", fontSize: 24, fontWeight: "700" },
        name: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
        email: { color: "#95a2b8", marginTop: 2, fontSize: 16 },
        settingsBtn: {
          marginLeft: "auto",
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: "#39455f",
          alignItems: "center",
          justifyContent: "center",
        },
        statRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
        statCard: {
          flex: 1,
          backgroundColor: "#111b2a",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#202a3d",
          paddingVertical: 14,
          alignItems: "center",
        },
        statValue: { color: "#ffffff", fontSize: 24, fontWeight: "700" },
        statLabel: { color: "#9aa6bb", fontSize: 12 },
        actionsCard: {
          backgroundColor: "#111b2a",
          borderRadius: 20,
          borderWidth: 1,
          borderColor: "#202a3d",
          overflow: "hidden",
        },
        link: {
          paddingVertical: 15,
          paddingHorizontal: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#1d2840",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        linkText: { color: "#f1f4fa", fontSize: 14 },
        linkRight: { marginLeft: "auto" },
        signOut: {
          backgroundColor: "#1a1016",
          marginTop: 16,
          borderRadius: 16,
          paddingVertical: 15,
          alignItems: "center",
          marginBottom: 16,
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
          alignItems: "stretch",
        },
        modalContent: {
          backgroundColor: "#111b2a",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderWidth: 1,
          borderColor: "#25314a",
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
          borderBottomColor: "#25314a",
        },
        modalTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
        modalBody: { padding: 16 },
        notificationCard: {
          backgroundColor: "#0d1625",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#1e2941",
          padding: 12,
          marginBottom: 10,
        },
        notificationText: { color: "#f2f5fa", fontSize: 14 },
        notificationDate: { color: "#93a0b5", fontSize: 11, marginTop: 6 },
        emptyText: { color: "#93a0b5", textAlign: "center", marginTop: 12, fontSize: 12 },
        closeBtn: {
          backgroundColor: "#202c43",
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 6,
        },
        closeText: { color: "#d8e1f1", fontSize: 12, fontWeight: "600" },
      }),
    [colors, insets.bottom],
  );

  const userName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "User";
  const openPrivacy = () => {
    void Linking.openURL(PRIVACY_URL);
  };

  const actions: ActionItem[] = [
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
            <Text style={stylesThemed.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={stylesThemed.name}>{userName}</Text>
            <Text style={stylesThemed.email}>{profile?.email ?? user?.email}</Text>
          </View>
          <Pressable style={stylesThemed.settingsBtn} onPress={() => navigation.navigate("EditProfile")}>
            <Ionicons name="settings-outline" size={16} color="#dce7f8" />
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
            <Ionicons name={item.icon} size={20} color="#9aa8be" />
            <Text style={stylesThemed.linkText}>{item.label}</Text>
            <Ionicons style={stylesThemed.linkRight} name="chevron-forward" size={18} color="#7e8ea9" />
          </Pressable>
        ))}
      </View>
      {(role === "admin" || role === "partner") && (
        <Pressable style={[stylesThemed.link, { marginTop: 10 }]} onPress={() => navigation.navigate("AdminImageUpload")}>
          <Text style={stylesThemed.linkText}>Partner: upload listing image</Text>
        </Pressable>
      )}
      <Pressable style={stylesThemed.signOut} onPress={() => void signOut()}>
        <Text style={{ color: "#cf3548", fontWeight: "700", fontSize: 14 }}>Log Out</Text>
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