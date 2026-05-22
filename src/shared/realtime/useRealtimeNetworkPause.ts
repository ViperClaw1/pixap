import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { RealtimeConnectionManager } from "./connectionManager";
import { recordRealtimeReconnect } from "./realtimePerf";

/**
 * Pause realtime channels when offline; resume and reconnect when online.
 */
export function useRealtimeNetworkPause(): void {
  useEffect(() => {
    const manager = RealtimeConnectionManager.get();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!online) {
        manager.setPaused(true);
        return;
      }
      if (manager.isPaused()) {
        manager.setPaused(false);
        recordRealtimeReconnect("network_online");
      }
    });

    void NetInfo.fetch().then((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      manager.setPaused(!online);
    });

    return unsubscribe;
  }, []);
}
