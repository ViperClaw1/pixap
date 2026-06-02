import { useMemo } from "react";
import { Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { ALL_CITIES_OPTION } from "@/entities/business-card";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { cityPickerStaticStyles, cityPickerThemeStyles } from "./cityPickerStyles";
import { useCityPickerState } from "./useCityPickerState";

type CityPickerFieldProps = {
  value: string;
  onChange: (city: string) => void | Promise<void>;
  showAllCitiesOption?: boolean;
  triggerStyle?: StyleProp<ViewStyle>;
  variant?: "compact" | "dropdown";
  placeholder?: string;
  onOpen?: () => boolean | void;
};

export function CityPickerField({
  value,
  onChange,
  showAllCitiesOption = true,
  triggerStyle,
  variant = "compact",
  placeholder,
  onOpen,
}: CityPickerFieldProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const picker = useCityPickerState(showAllCitiesOption);

  const styles = useMemo(
    () => mergeStaticAndThemed(cityPickerStaticStyles, cityPickerThemeStyles(colors)),
    [colors],
  );

  const displayValue = useMemo(() => {
    if (!value.trim()) {
      return placeholder ?? t("bookingCommon.selectCity");
    }
    if (value === ALL_CITIES_OPTION) {
      return t("home.allCities");
    }
    return value;
  }, [placeholder, t, value]);

  const handleSelect = (city: string) => {
    picker.close();
    void onChange(city);
  };

  const handleOpen = () => {
    if (onOpen?.() === false) return;
    picker.open();
  };

  const isDropdown = variant === "dropdown";

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("bookingCommon.chooseCity")}
        style={[
          isDropdown ? styles.dropdownTrigger : styles.compactTrigger,
          triggerStyle,
        ]}
        onPress={handleOpen}
      >
        {isDropdown ? (
          <>
            <Text
              style={[
                styles.dropdownTriggerText,
                !value.trim() && styles.dropdownPlaceholder,
              ]}
              numberOfLines={1}
            >
              {displayValue}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
          </>
        ) : (
          <Text style={styles.compactTriggerText} numberOfLines={1}>
            {displayValue}
          </Text>
        )}
      </Pressable>

      <BottomSheetPickerModal
        visible={picker.visible}
        onClose={picker.close}
        title={t("bookingCommon.chooseCity")}
        maxHeightFraction={0.72}
      >
        <View style={styles.citySearchBox}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={picker.searchQuery}
            onChangeText={picker.setSearchQuery}
            placeholder={t("bookingCommon.searchCityOrCountry")}
            placeholderTextColor={colors.textMuted}
            style={styles.citySearchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        {picker.showAllCitiesRow ? (
          <Pressable
            key={ALL_CITIES_OPTION}
            style={styles.cityRow}
            onPress={() => handleSelect(ALL_CITIES_OPTION)}
          >
            <Text style={styles.cityRowText}>{t("home.allCities")}</Text>
            {value === ALL_CITIES_OPTION ? (
              <Text style={styles.cityCheck}>{t("bookingCommon.selected")}</Text>
            ) : null}
          </Pressable>
        ) : null}

        {picker.filteredCityGroups.map(({ country, cities }) => (
          <View key={country}>
            <View style={styles.countryHeader}>
              <Text style={styles.countryHeaderText}>{country}</Text>
            </View>
            {cities.map((city) => (
              <Pressable key={city} style={styles.cityRow} onPress={() => handleSelect(city)}>
                <Text style={styles.cityRowText}>{city}</Text>
                {city === value ? (
                  <Text style={styles.cityCheck}>{t("bookingCommon.selected")}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ))}

        {!picker.showAllCitiesRow && picker.filteredCityGroups.length === 0 ? (
          <View style={styles.cityPickerEmpty}>
            <Text style={styles.cityPickerEmptyText}>{t("bookingCommon.noCitiesMatch")}</Text>
          </View>
        ) : null}
      </BottomSheetPickerModal>
    </>
  );
}
