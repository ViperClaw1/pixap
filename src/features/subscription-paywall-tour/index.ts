import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { hasSeenPaywallTour, setSeenPaywallTour } from "./lib/paywallTourStorage";

export function usePaywallTourAutoOpen() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void hasSeenPaywallTour(user.id).then((seen) => {
      if (!cancelled && !seen) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const closeTour = () => {
    setVisible(false);
    if (user?.id) void setSeenPaywallTour(user.id);
  };

  const openTour = () => setVisible(true);

  return { tourVisible: visible, openTour, closeTour };
}

export { SubscriptionPaywallTourModal } from "./ui/SubscriptionPaywallTourModal";
