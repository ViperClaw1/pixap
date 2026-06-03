import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ALL_CITIES_OPTION } from "@/entities/business-card";
import { useProfile, useUpdateProfile } from "@/entities/user";
import { queryKeys } from "@/shared/api/queryKeys";

export function useProfileCityPicker() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const [selectedCity, setSelectedCity] = useState(ALL_CITIES_OPTION);

  useEffect(() => {
    const cityFromProfile = profile?.city?.trim();
    setSelectedCity(cityFromProfile ? cityFromProfile : ALL_CITIES_OPTION);
  }, [profile?.city]);

  const profileCityFilter = selectedCity === ALL_CITIES_OPTION ? null : selectedCity.trim() || null;

  const selectCity = useCallback(
    async (city: string) => {
      if (city === selectedCity) return false;
      const previous = selectedCity;
      setSelectedCity(city);
      try {
        await updateProfile.mutateAsync({ city: city === ALL_CITIES_OPTION ? null : city });
        await queryClient.invalidateQueries({ queryKey: queryKeys.businessCards.listPrefix });
        return true;
      } catch {
        setSelectedCity(previous);
        Alert.alert(t("home.alerts.citySaveTitle"), t("home.alerts.citySaveBody"));
        return false;
      }
    },
    [queryClient, selectedCity, t, updateProfile],
  );

  return { selectedCity, profileCityFilter, selectCity };
}
