import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";

interface ReplyInputProps {
  submitting: boolean;
  onSubmit: (value: string) => Promise<void> | void;
}

function ReplyInputComponent({ submitting, onSubmit }: ReplyInputProps) {
  const { colors } = useAppTheme();
  const [value, setValue] = useState("");

  const submit = async () => {
    const text = value.trim();
    if (!text || submitting) return;
    await onSubmit(text);
    setValue("");
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Reply to story..."
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            borderColor: colors.border,
            color: colors.text,
            backgroundColor: colors.card,
          },
        ]}
        multiline
      />
      <Pressable
        style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
        onPress={() => void submit()}
        disabled={submitting}
      >
        <Text style={[styles.sendText, { color: colors.onPrimary }]}>{submitting ? "..." : "Send"}</Text>
      </Pressable>
    </View>
  );
}

export const ReplyInput = memo(ReplyInputComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 88,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: {
    height: 42,
    minWidth: 62,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    fontWeight: "700",
  },
});
