import { registerRootComponent } from "expo";
import { enableFreeze, enableScreens } from "react-native-screens";
import { ensurePushNotificationHandler } from "@/shared/lib/push/pushNotifications";

/** Phase 6 baseline: native screen containers + react-freeze for `freezeOnBlur` (tabs/stacks). */
enableScreens(true);
enableFreeze(true);

ensurePushNotificationHandler();

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
