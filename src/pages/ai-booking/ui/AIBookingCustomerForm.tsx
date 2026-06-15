import { AppPressable } from "@/shared/ui/app-pressable";
import { useRef, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { PixAIPlace } from "@/entities/pixai";
import { PhoneInput, type PhoneValue } from "@/shared/ui/phone-input";
import type { AIBookingStyles } from "./aiBookingStyles";

export type AIBookingDraftForm = {
  persons: string;
  customer_name: string;
  customer_phone: PhoneValue;
  customer_email: string;
  comment: string;
};

type Props = {
  styles: AIBookingStyles;
  form: AIBookingDraftForm;
  setForm: Dispatch<SetStateAction<AIBookingDraftForm>>;
  summaryMessage: string;
  selectedPlace: PixAIPlace | null;
  onCreateDraft: () => void;
  submitting?: boolean;
  profileCompleteTip?: ReactNode;
  onInputFocus?: (fieldRef: RefObject<TextInput | null>) => void;
};

export function AIBookingCustomerForm({
  styles: s,
  form,
  setForm,
  summaryMessage,
  selectedPlace,
  onCreateDraft,
  submitting = false,
  profileCompleteTip,
  onInputFocus,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const isPaid = Number(selectedPlace?.booking_price ?? 0) > 0;
  const submitLabel = isPaid ? t("aiBooking.createDraftBooking") : t("aiBooking.confirmBooking");
  const personsInputRef = useRef<TextInput>(null);
  const nameInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const commentInputRef = useRef<TextInput>(null);

  const handleFocus = (fieldRef: RefObject<TextInput | null>) => {
    onInputFocus?.(fieldRef);
  };

  return (
    <>
      <View style={s.semanticSection}>
        <Text style={s.label}>{t("aiBooking.bookingDetails")}</Text>
        <Text style={s.summaryText}>{summaryMessage}</Text>
      </View>
      <View style={s.semanticSection}>
        <View style={s.formFieldsStack}>
          <TextInput
            ref={personsInputRef}
            style={[s.field, s.fieldOnCard]}
            keyboardType="number-pad"
            value={form.persons}
            onChangeText={(persons) => setForm((prev) => ({ ...prev, persons }))}
            placeholder={t("bookingCommon.persons")}
            placeholderTextColor={colors.textMuted}
            onFocus={() => handleFocus(personsInputRef)}
          />
          <TextInput
            ref={nameInputRef}
            style={[s.field, s.fieldOnCard]}
            value={form.customer_name}
            onChangeText={(customer_name) => setForm((prev) => ({ ...prev, customer_name }))}
            placeholder={t("bookingCommon.fullName")}
            placeholderTextColor={colors.textMuted}
            onFocus={() => handleFocus(nameInputRef)}
          />
          <PhoneInput
            inputRef={phoneInputRef}
            value={form.customer_phone}
            onChange={(customer_phone) => setForm((prev) => ({ ...prev, customer_phone }))}
            containerStyle={{ backgroundColor: colors.card }}
            onFocus={() => handleFocus(phoneInputRef)}
          />
          <TextInput
            ref={emailInputRef}
            style={[s.field, s.fieldOnCard]}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.customer_email}
            onChangeText={(customer_email) => setForm((prev) => ({ ...prev, customer_email }))}
            placeholder={t("bookingCommon.email")}
            placeholderTextColor={colors.textMuted}
            onFocus={() => handleFocus(emailInputRef)}
          />
          <TextInput
            ref={commentInputRef}
            style={[s.field, s.fieldOnCard, s.commentField]}
            multiline
            value={form.comment}
            onChangeText={(comment) => setForm((prev) => ({ ...prev, comment }))}
            placeholder={t("bookingCommon.optionalComment")}
            placeholderTextColor={colors.textMuted}
            onFocus={() => handleFocus(commentInputRef)}
          />
        </View>
        {profileCompleteTip}
        <AppPressable
          style={[s.primaryBtn, submitting && { opacity: 0.55 }]}
          disabled={submitting}
          accessibilityState={{ disabled: submitting }}
          onPress={() => void onCreateDraft()}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.primaryBtnText}>{submitLabel}</Text>
          )}
        </AppPressable>
      </View>
    </>
  );
}
