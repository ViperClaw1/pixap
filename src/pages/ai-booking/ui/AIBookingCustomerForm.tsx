import type { Dispatch, SetStateAction } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { PixAIPlace } from "@/entities/pixai";
import type { AIBookingStyles } from "./aiBookingStyles";

export type AIBookingDraftForm = {
  persons: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  comment: string;
};

type Props = {
  styles: AIBookingStyles;
  colors: ThemeColors;
  form: AIBookingDraftForm;
  setForm: Dispatch<SetStateAction<AIBookingDraftForm>>;
  formatPhoneMask: (raw: string) => string;
  summaryMessage: string;
  selectedPlace: PixAIPlace | null;
  onCreateDraft: () => void;
};

export function AIBookingCustomerForm({
  styles: s,
  colors,
  form,
  setForm,
  formatPhoneMask,
  summaryMessage,
  selectedPlace,
  onCreateDraft,
}: Props) {
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
          <TextInput
            style={[s.field, s.fieldOnCard]}
            value={form.customer_phone}
            onChangeText={(customer_phone) => setForm((prev) => ({ ...prev, customer_phone: formatPhoneMask(customer_phone) }))}
            keyboardType="number-pad"
            placeholder="X-(XXX)-XXX-XXXX"
            placeholderTextColor={colors.textMuted}
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
