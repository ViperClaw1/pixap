import { Platform } from "react-native";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile } from "@/entities/user";
import { useAppStoreReviewRequest } from "../model/useAppStoreReviewRequest";

export function AppStoreReviewGate() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile({ enabled: !!user });
  const canRequest = Boolean(
    user &&
      !isLoading &&
      profile?.terms_accepted_at &&
      (Platform.OS === "ios" || Platform.OS === "android"),
  );

  useAppStoreReviewRequest({ enabled: canRequest });

  return null;
}
