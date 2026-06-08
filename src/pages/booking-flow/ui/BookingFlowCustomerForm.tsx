import { Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { PhoneInput, type PhoneValue } from "@/shared/ui/phone-input";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { bookingFlowCustomerFormStaticStyles, bookingFlowCustomerFormThemeStyles } from "./bookingFlowCustomerFormStyles";

type Props = {
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  customerPhone: PhoneValue;
  onCustomerPhoneChange: (value: PhoneValue) => void;
  customerEmail: string;
  onCustomerEmailChange: (value: string) => void;
  comment: string;
  onCommentChange: (value: string) => void;
};

export function BookingFlowCustomerForm({
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  customerEmail,
  onCustomerEmailChange,
  comment,
  onCommentChange,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const themed = useThemeStyles(({ colors: c }) => bookingFlowCustomerFormThemeStyles(c));
  const styles = mergeStaticAndThemed(bookingFlowCustomerFormStaticStyles, themed);

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("bookingCommon.guestDetails")}</Text>
      <TextInput
        style={styles.input}
        placeholder={t("bookingCommon.fullName")}
        placeholderTextColor={colors.textMuted}
        value={customerName}
        onChangeText={onCustomerNameChange}
      />
      <PhoneInput
        value={customerPhone}
        onChange={onCustomerPhoneChange}
        containerStyle={{ backgroundColor: colors.background }}
      />
      <TextInput
        style={styles.input}
        placeholder={t("bookingCommon.email")}
        placeholderTextColor={colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        value={customerEmail}
        onChangeText={onCustomerEmailChange}
      />
      <TextInput
        style={[styles.input, styles.commentInput]}
        placeholder={t("bookingCommon.commentOptional")}
        placeholderTextColor={colors.textMuted}
        multiline
        value={comment}
        onChangeText={onCommentChange}
      />
    </View>
  );
}
