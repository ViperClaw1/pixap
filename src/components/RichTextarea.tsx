import { memo } from "react";
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";

type RichTextareaProps = Omit<TextInputProps, "multiline"> & {
  containerStyle?: StyleProp<ViewStyle>;
};

function RichTextareaComponent({ style, containerStyle, ...props }: RichTextareaProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput {...props} multiline textAlignVertical="top" style={[styles.input, style]} />
    </View>
  );
}

export const RichTextarea = memo(RichTextareaComponent);

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  input: {
    minHeight: 56,
    maxHeight: 120,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
});
