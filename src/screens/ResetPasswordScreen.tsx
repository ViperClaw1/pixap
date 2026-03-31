import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import * as Linking from "expo-linking";
import { useAuth } from "@/contexts/AuthContext";

/** Handles deep-link tokens from email; user sets new password here. */
export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const url = Linking.useURL();

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Reset password</Text>
      {url ? <Text style={styles.hint}>Link received. Enter a new password below.</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
      />
      <Pressable
        style={styles.btn}
        onPress={async () => {
          if (password.length < 8) {
            Alert.alert("Too short", "Use at least 8 characters");
            return;
          }
          if (password !== confirm) {
            Alert.alert("Mismatch", "Passwords do not match");
            return;
          }
          const { error } = await updatePassword(password);
          if (error) Alert.alert("Error", error);
          else Alert.alert("Success", "Password updated");
        }}
      >
        <Text style={styles.btnText}>Update password</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  hint: { color: "#666", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  btn: { backgroundColor: "#111", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
});
