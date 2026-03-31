import type { LinkingOptions } from "@react-navigation/native";
import { getStateFromPath as getStateFromPathInternal } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { linkingConfig, linkingPrefixes } from "@/lib/linking";
import type { RootTabParamList } from "./types";

const prefixes = [...linkingPrefixes, Linking.createURL("/")];

function normalizePath(path: string) {
  return path.replace(/^\//, "").split("?")[0] ?? "";
}

/** Map legacy root paths (custom scheme) into nested tab state. */
function stateForRootPath(normalized: string) {
  if (normalized === "payment-success") {
    return {
      routes: [
        {
          name: "Cart" as const,
          state: { routes: [{ name: "PaymentSuccess" as const }], index: 0 },
        },
      ],
      index: 0,
    };
  }
  if (normalized === "payment-canceled") {
    return {
      routes: [
        {
          name: "Cart" as const,
          state: { routes: [{ name: "PaymentCanceled" as const }], index: 0 },
        },
      ],
      index: 0,
    };
  }
  return null;
}

export const linking: LinkingOptions<RootTabParamList> = {
  prefixes,
  config: linkingConfig,
  getStateFromPath(path, options) {
    const normalized = normalizePath(path);
    const direct = stateForRootPath(normalized);
    if (direct) {
      return direct as ReturnType<typeof getStateFromPathInternal>;
    }
    return getStateFromPathInternal(path, linkingConfig as Parameters<typeof getStateFromPathInternal>[1]);
  },
};
