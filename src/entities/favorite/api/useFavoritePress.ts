import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useAuth } from "@/app/providers/AuthProvider";
import { navigateToProfileAuth } from "@/app/navigation/navigationHelpers";
import { showErrorToast, showSuccessToast } from "@/shared/ui/app-toast/showToast";
import { useIsFavorite, useToggleFavorite } from "./useFavorites";

type UseFavoritePressOptions = {
  placeName?: string;
};

export function useFavoritePress(businessCardId: string, options?: UseFavoritePressOptions) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { user } = useAuth();
  const isFavorite = useIsFavorite(businessCardId);
  const toggleFavorite = useToggleFavorite();
  const placeName = options?.placeName;

  const onFavoritePress = useCallback(() => {
    if (!user) {
      navigateToProfileAuth(navigation);
      return;
    }
    const wasFavorite = isFavorite;
    toggleFavorite.mutate(
      { businessCardId, isFavorite },
      {
        onSuccess: () => {
          showSuccessToast(
            wasFavorite ? t("favorites.toastRemoved") : t("favorites.toastAdded"),
            placeName,
          );
        },
        onError: () => {
          showErrorToast(t("favorites.toastFailed"), t("messages.toastTryAgain"));
        },
      },
    );
  }, [businessCardId, isFavorite, navigation, placeName, t, toggleFavorite, user]);

  return { isFavorite, onFavoritePress, isPending: toggleFavorite.isPending };
}
