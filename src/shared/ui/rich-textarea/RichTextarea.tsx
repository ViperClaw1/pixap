import { forwardRef, memo } from "react";
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";

type RichTextareaProps = Omit<TextInputProps, "multiline"> & {
  containerStyle?: StyleProp<ViewStyle>;
};

const RichTextareaComponent = forwardRef<TextInput, RichTextareaProps>(function RichTextareaComponent(
  { style, containerStyle, textAlignVertical = "top", ...props },
  ref,
) {
  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        ref={ref}
        {...props}
        multiline
        textAlignVertical={textAlignVertical}
        style={[styles.input, style]}
      />
    </View>
  );
});

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
