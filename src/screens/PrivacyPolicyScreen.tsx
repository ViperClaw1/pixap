import { View, Text, StyleSheet, ScrollView } from "react-native";

/** Placeholder: replace with your hosted policy URL in WebView or fetch HTML. */
export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Privacy policy</Text>
      <Text style={styles.p}>
        This screen should mirror your production privacy policy (e.g. https://pixapp.kz/privacy). For App Store
        and Google Play, ensure disclosures match data collected: account info, payments (Stripe), push tokens
        (FCM), and Supabase-backed content.
      </Text>
      <Text style={styles.p}>
        REQUIRES LEGAL REVIEW: finalize copy with counsel before submission.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff", paddingTop: 48 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  p: { fontSize: 15, lineHeight: 22, color: "#444", marginBottom: 12 },
});
