import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import * as Notifications from "expo-notifications";
import { setSeenPermissionsIntro } from "@/lib/permissionsStorage";

type Props = {
  onComplete: () => void;
};

/**
 * Pre-permission explainer (notifications). Camera/photos are requested in-context when using admin upload.
 */
export default function PermissionsOnboardingScreen({ onComplete }: Props) {
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    await setSeenPermissionsIntro();
    setBusy(false);
    onComplete();
  };

  const enableNotifications = async () => {
    setBusy(true);
    try {
      await Notifications.requestPermissionsAsync();
    } finally {
      await setSeenPermissionsIntro();
      setBusy(false);
      onComplete();
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Welcome to PixApp</Text>
      <Text style={styles.body}>
        Stay updated on bookings and offers with notifications. You can change this anytime in system settings.
      </Text>
      <Text style={styles.sub}>
        Camera and photo access are only requested when you upload images (e.g. partner admin tools), not on this
        screen.
      </Text>
      {busy ? (
        <ActivityIndicator size="large" style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.actions}>
          <Pressable style={styles.primary} onPress={() => void enableNotifications()}>
            <Text style={styles.primaryText}>Enable notifications</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => void finish()}>
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "800", color: "#111", marginBottom: 12 },
  body: { fontSize: 16, color: "#444", lineHeight: 22 },
  sub: { fontSize: 13, color: "#888", marginTop: 16, lineHeight: 18 },
  actions: { marginTop: 28, gap: 12 },
  primary: {
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondary: { paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: "#666", fontWeight: "600" },
});
