import type { Dispatch, SetStateAction } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
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
};

export function AIBookingCustomerForm({
  styles: s,
  form,
  setForm,
  summaryMessage,
  selectedPlace,
  onCreateDraft,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <>
      <View style={s.semanticSection}>
        <Text style={s.label}>Booking details</Text>
        <Text style={s.summaryText}>{summaryMessage}</Text>
      </View>
      <View style={s.semanticSection}>
        <View style={s.formFieldsStack}>
          <TextInput
            style={[s.field, s.fieldOnCard]}
            keyboardType="number-pad"
            value={form.persons}
            onChangeText={(persons) => setForm((prev) => ({ ...prev, persons }))}
            placeholder="Persons"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={[s.field, s.fieldOnCard]}
            value={form.customer_name}
            onChangeText={(customer_name) => setForm((prev) => ({ ...prev, customer_name }))}
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
          />
          <PhoneInput
            value={form.customer_phone}
            onChange={(customer_phone) => setForm((prev) => ({ ...prev, customer_phone }))}
            containerStyle={{ backgroundColor: colors.background }}
          />
          <TextInput
            style={[s.field, s.fieldOnCard]}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.customer_email}
            onChangeText={(customer_email) => setForm((prev) => ({ ...prev, customer_email }))}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={[s.field, s.fieldOnCard, s.commentField]}
            multiline
            value={form.comment}
            onChangeText={(comment) => setForm((prev) => ({ ...prev, comment }))}
            placeholder="Optional comment"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <Pressable style={s.primaryBtn} onPress={() => void onCreateDraft()}>
          <Text style={s.primaryBtnText}>
            {Number(selectedPlace?.booking_price ?? 0) > 0 ? "Create draft booking" : "Confirm booking"}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
