import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile } from "@/entities/user";
import { useAppStoreReviewRequest } from "../model/useAppStoreReviewRequest";

export function AppStoreReviewGate() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile({ enabled: !!user });
  const canRequest = Boolean(user && !isLoading && profile?.terms_accepted_at);

  useAppStoreReviewRequest({ enabled: canRequest });

  return null;
}
