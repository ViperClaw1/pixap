import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootTabParamList } from "./types";

/** Used from `App.tsx` to deep-link into auth callbacks when path doesn’t resolve to a nested screen (e.g. tokens only in `#hash`). */
export const rootNavigationRef = createNavigationContainerRef<RootTabParamList>();
