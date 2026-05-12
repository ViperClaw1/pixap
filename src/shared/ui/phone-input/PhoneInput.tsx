import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/contexts/ThemeContext";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import {
  buildCountryOptions,
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
}: Props) {
  const { colors } = useAppTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const countryOptions = useMemo(() => buildCountryOptions(), []);
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: "100%",
          height: 58,
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          backgroundColor: colors.card,
          overflow: "hidden",
        },
        containerError: {
          borderColor: colors.danger,
        },
        countryButton: {
          width: 92,
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          borderRightWidth: 1,
          borderRightColor: colors.border,
        },
        flag: { fontSize: 20, lineHeight: 22 },
        countryCodeText: { color: colors.text, fontSize: 12, fontWeight: "700" },
        callingCodeText: {
          color: colors.text,
          fontSize: 14,
          fontWeight: "600",
          marginLeft: 10,
        },
        input: {
          flex: 1,
          height: 56,
          paddingHorizontal: 12,
          color: colors.text,
          fontSize: 14,
          backgroundColor: "transparent",
        },
        pickerRow: {
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        },
        pickerRowText: {
          color: colors.text,
          fontSize: 14,
          fontWeight: "600",
          flex: 1,
        },
      }),
    [colors],
  );

  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, maxDigits);
    if (digits === value.nationalDigits) return;
    onChange({ ...value, nationalDigits: digits });
  };

  const handleSelectCountry = (region: string, callingCode: string) => {
    const nextMax = getNationalMaxDigits(region, callingCode);
    const nextDigits = value.nationalDigits.slice(0, nextMax);
    onChange({ region, callingCode, nationalDigits: nextDigits });
    setPickerOpen(false);
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
          style={[styles.input, textStyle]}
          value={value.nationalDigits}
          onChangeText={handleChangeText}
          keyboardType="phone-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          maxLength={maxDigits}
          onBlur={onBlur}
        />
      </View>

      <BottomSheetPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={pickerTitle}
      >
        {countryOptions.map((option, index) => (
          <Pressable
            key={`${option.region}-${option.callingCode}`}
            style={[
              styles.pickerRow,
              index === countryOptions.length - 1 ? { borderBottomWidth: 0 } : null,
            ]}
            onPress={() => handleSelectCountry(option.region, option.callingCode)}
          >
            <Text style={styles.pickerRowText}>
              {option.flag} {option.region} (+{option.callingCode})
            </Text>
            {value.region === option.region && value.callingCode === option.callingCode ? (
              <Ionicons name="checkmark" size={16} color={colors.primary} />
            ) : null}
          </Pressable>
        ))}
      </BottomSheetPickerModal>
    </>
  );
}
