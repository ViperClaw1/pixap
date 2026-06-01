import { useMemo, useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { usePhoneInputStyles } from "./phoneInputStyles";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import {
  buildCountryOptions,
  filterCountryOptions,
  getNationalMaxDigits,
  regionToFlagEmoji,
  type PhoneValue,
} from "./lib";

type Props = {
  value: PhoneValue;
  onChange: (next: PhoneValue) => void;
  hasError?: boolean;
  onBlur?: () => void;
  placeholder?: string;
  /** Override the container background/border colors (e.g., when nested in a card). */
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  pickerTitle?: string;
  inputRef?: Ref<TextInput>;
  onFocus?: () => void;
};

export function PhoneInput({
  value,
  onChange,
  hasError,
  onBlur,
  placeholder = "Phone Number",
  containerStyle,
  textStyle,
  pickerTitle = "Select country",
  inputRef,
  onFocus,
}: Props) {
  const { i18n } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en";
  const countryOptions = useMemo(() => buildCountryOptions(locale), [locale]);
  const filteredCountryOptions = useMemo(
    () => filterCountryOptions(countryOptions, countryQuery),
    [countryOptions, countryQuery],
  );
  const selectedCountry = useMemo(
    () =>
      countryOptions.find(
        (option) => option.region === value.region && option.callingCode === value.callingCode,
      ),
    [countryOptions, value.callingCode, value.region],
  );
  const maxDigits = useMemo(
    () => getNationalMaxDigits(value.region, value.callingCode),
    [value.callingCode, value.region],
  );

  const { colors } = useAppTheme();
  const styles = usePhoneInputStyles();

  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, maxDigits);
    if (digits === value.nationalDigits) return;
    onChange({ ...value, nationalDigits: digits });
  };

  const closePicker = () => {
    setPickerOpen(false);
    setCountryQuery("");
  };

  const handleSelectCountry = (region: string, callingCode: string) => {
    const nextMax = getNationalMaxDigits(region, callingCode);
    const nextDigits = value.nationalDigits.slice(0, nextMax);
    onChange({ region, callingCode, nationalDigits: nextDigits });
    closePicker();
  };

  return (
    <>
      <View style={[styles.container, hasError ? styles.containerError : null, containerStyle]}>
        <Pressable style={styles.countryButton} onPress={() => setPickerOpen(true)} hitSlop={10}>
          <Text style={styles.flag}>{selectedCountry?.flag ?? regionToFlagEmoji(value.region)}</Text>
          <Text style={styles.countryCodeText}>{value.region}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.callingCodeText}>+{value.callingCode}</Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, textStyle]}
          value={value.nationalDigits}
          onChangeText={handleChangeText}
          keyboardType="phone-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          maxLength={maxDigits}
          onBlur={onBlur}
          onFocus={onFocus}
        />
      </View>

      <BottomSheetPickerModal
        visible={pickerOpen}
        onClose={closePicker}
        title={pickerTitle}
        maxHeightFraction={0.72}
      >
        <View style={styles.pickerSearchWrap}>
          <TextInput
            value={countryQuery}
            onChangeText={setCountryQuery}
            placeholder="Search country..."
            placeholderTextColor={colors.textMuted}
            style={styles.pickerSearchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
        {filteredCountryOptions.length ? (
          filteredCountryOptions.map((option, index) => (
            <Pressable
              key={`${option.region}-${option.callingCode}`}
              style={[
                styles.pickerRow,
                index === filteredCountryOptions.length - 1 ? { borderBottomWidth: 0 } : null,
              ]}
              onPress={() => handleSelectCountry(option.region, option.callingCode)}
            >
              <Text style={styles.pickerRowText}>
                {option.flag} {option.name} (+{option.callingCode})
              </Text>
              {value.region === option.region && value.callingCode === option.callingCode ? (
                <Ionicons name="checkmark" size={16} color={colors.primary} />
              ) : null}
            </Pressable>
          ))
        ) : (
          <Text style={styles.pickerEmptyText}>No countries found</Text>
        )}
      </BottomSheetPickerModal>
    </>
  );
}
