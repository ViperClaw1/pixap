import { useMemo, useState } from "react";
import {
  ALL_CITIES_OPTION,
  useAvailableCities,
  groupCitiesByCountry,
  filterCityGroups,
  matchesSearchTokens,
} from "@/entities/business-card";

export function useCityPickerState(showAllCitiesOption: boolean) {
  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();

  const concreteCities = useMemo(
    () => availableCities.filter((city) => city !== ALL_CITIES_OPTION),
    [availableCities],
  );

  const filteredCityGroups = useMemo(() => {
    const grouped = groupCitiesByCountry(concreteCities);
    return filterCityGroups(grouped, searchQuery);
  }, [concreteCities, searchQuery]);

  const showAllCitiesRow = useMemo(() => {
    if (!showAllCitiesOption || !availableCities.includes(ALL_CITIES_OPTION)) return false;
    return matchesSearchTokens(ALL_CITIES_OPTION, searchQuery);
  }, [availableCities, searchQuery, showAllCitiesOption]);

  const open = () => {
    setSearchQuery("");
    setVisible(true);
  };

  const close = () => {
    setSearchQuery("");
    setVisible(false);
  };

  return {
    visible,
    searchQuery,
    setSearchQuery,
    filteredCityGroups,
    showAllCitiesRow,
    open,
    close,
  };
}
