import { useMemo } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { AppPopupButton, AppPopupOptions } from "./types";
import { useAppPopupStyles } from "./appPopupStyles";
import { APP_POPUP_VARIANT_META } from "./appPopupVariant";

type Props = AppPopupOptions & {
  visible: boolean;
  onClose: () => void;
  /** When true, content is rendered inside AppPopupHost Modal (no nested Modal). */
  embedded?: boolean;
};

type ResolvedButton = AppPopupButton & { variant: "primary" | "secondary" | "destructive" | "ghost" };

function resolveVariants(list: AppPopupButton[]): ResolvedButton[] {
  const total = list.length;
  const lastDefaultIndex = (() => {
    for (let i = total - 1; i >= 0; i -= 1) {
      const style = list[i]?.style;
      if (style !== "cancel" && style !== "destructive") return i;
    }
    return -1;
  })();

  return list.map((button, index) => {
    let variant: ResolvedButton["variant"];
    if (button.style === "destructive") {
      variant = "destructive";
    } else if (button.style === "cancel") {
      variant = total === 1 ? "secondary" : total === 2 ? "secondary" : "ghost";
    } else if (total === 1) {
      variant = "primary";
    } else if (total === 2) {
      variant = index === lastDefaultIndex ? "primary" : "secondary";
    } else if (index === lastDefaultIndex) {
      variant = "primary";
    } else {
      variant = "secondary";
    }
    return { ...button, variant };
  });
}

export function AppPopupModal({
  visible,
  title,
  message,
  buttons,
  variant,
  loading = false,
  onClose,
  embedded = false,
}: Props) {
  const styles = useAppPopupStyles();
  const { colors } = useAppTheme();
  const variantMeta = variant ? APP_POPUP_VARIANT_META[variant] : null;

  const actions: ResolvedButton[] = useMemo(() => {
    const list: AppPopupButton[] = buttons?.length ? buttons : [{ text: "OK", style: "default" }];
    return resolveVariants(list);
  }, [buttons]);

  if (!visible) return null;

  const onPressAction = (button: AppPopupButton) => {
    const invokePress = () => button.onPress?.();
    if (button.skipCloseOnPress) {
      invokePress();
      return;
    }
    onClose();
    if (!button.onPress) return;
    // Defer until the host Modal finishes dismissing — native pickers won't open over a dismissing Modal.
    // Do not use InteractionManager here: with Reanimated/keyboard it may never run on some screens.
    const dismissMs = Platform.OS === "ios" ? 400 : 250;
    setTimeout(invokePress, dismissMs);
  };

  const renderButton = (button: ResolvedButton, layout: "row" | "stack") => {
    const isPrimary = button.variant === "primary";
    const isSecondary = button.variant === "secondary";
    const isDestructive = button.variant === "destructive";

    return (
      <Pressable
        key={`${button.text}-${button.variant}`}
        onPress={() => onPressAction(button)}
        style={({ pressed }) => [
          styles.btn,
          layout === "row" ? styles.actionFlex : null,
          isPrimary ? styles.btnPrimary : null,
          isSecondary ? styles.btnSecondary : null,
          isDestructive ? styles.btnDestructive : null,
          pressed ? styles.btnPressed : null,
        ]}
        accessibilityRole="button"
      >
        <Text
          style={[
            styles.btnText,
            isPrimary ? styles.btnPrimaryText : null,
            isSecondary ? styles.btnSecondaryText : null,
            isDestructive ? styles.btnDestructiveText : null,
            button.variant === "ghost" ? styles.btnGhostText : null,
          ]}
        >
          {button.text}
        </Text>
      </Pressable>
    );
  };

  const useRowLayout = actions.length === 2;

  return (
    <View style={[styles.overlay, embedded ? StyleSheet.absoluteFillObject : null]} pointerEvents="box-none">
      <View style={styles.card} accessibilityViewIsModal>
        <View style={styles.textBlock}>
          {variantMeta ? (
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: variantMeta.iconBackground(colors) },
              ]}
            >
              <Ionicons
                name={variantMeta.icon}
                size={32}
                color={variantMeta.iconColor(colors)}
              />
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
          ) : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
        {!loading ? (
          <View style={styles.actions}>
            {useRowLayout ? (
              <View style={styles.actionsRow}>{actions.map((button) => renderButton(button, "row"))}</View>
            ) : (
              actions.map((button) => renderButton(button, "stack"))
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}
