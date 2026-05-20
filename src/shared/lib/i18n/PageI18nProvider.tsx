import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { I18nextProvider } from "react-i18next";
import { bootstrapI18n, i18n } from "./init";

type Props = {
  children: ReactNode;
};

/**
 * Ensures i18n is initialized and provides a dedicated I18nextProvider subtree.
 * Use for screens/sections where translations must resolve reliably (e.g. onboarding).
 */
export function PageI18nProvider({ children }: Props) {
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (i18n.isInitialized) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void bootstrapI18n().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48 },
});
