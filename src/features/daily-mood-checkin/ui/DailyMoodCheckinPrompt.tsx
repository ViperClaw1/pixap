import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { AppPressable } from "@/shared/ui/app-pressable";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { DailyMoodEnergyLevel, DailyMoodTag } from "@/entities/daily-mood-checkin";
import { DAILY_MOOD_ENERGY_LEVELS, DAILY_MOOD_OPTIONS } from "../model/moodOptions";
import { useDailyMoodCheckinGate } from "../model/useDailyMoodCheckinGate";

type Props = {
  enabled?: boolean;
};

export function DailyMoodCheckinPrompt({ enabled = true }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const { shouldPrompt, isSaving, submit, skip } = useDailyMoodCheckinGate(enabled);
  const [selectedTags, setSelectedTags] = useState<DailyMoodTag[]>([]);
  const [energyLevel, setEnergyLevel] = useState<DailyMoodEnergyLevel>(3);
  const [detailNote, setDetailNote] = useState("");

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const canSubmit = selectedTags.length > 0 && !isSaving;

  const toggleTag = useCallback((tag: DailyMoodTag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    void submit({
      moodTags: selectedTags,
      energyLevel,
      detailNote: detailNote.trim() || null,
    });
  }, [canSubmit, detailNote, energyLevel, selectedTags, submit]);

  const handleSkip = useCallback(() => {
    void skip();
  }, [skip]);

  if (!shouldPrompt) return null;

  return (
    <BottomSheetPickerModal
      visible
      fitContent
      maxHeightFraction={0.72}
      minHeightFraction={0.54}
      title={t("dailyMoodCheckin.title", { defaultValue: "What's your vibe today?" })}
      onClose={handleSkip}
      bodyContentContainerStyle={styles.body}
      footer={
        <View style={styles.footer}>
          <AppPressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleSkip}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, isSaving && styles.disabled]}
          >
            <Text style={styles.secondaryButtonText}>
              {t("dailyMoodCheckin.skip", { defaultValue: "Skip today" })}
            </Text>
          </AppPressable>
          <AppPressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && canSubmit && styles.pressed,
              !canSubmit && styles.disabled,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {t("dailyMoodCheckin.submit", { defaultValue: "Match my vibe" })}
              </Text>
            )}
          </AppPressable>
        </View>
      }
    >
      <Text style={styles.subtitle}>
        {t("dailyMoodCheckin.subtitle", {
          defaultValue: "Pix AI will tune today's picks to your mood, energy and intent.",
        })}
      </Text>

      <View style={styles.chipsWrap}>
        {DAILY_MOOD_OPTIONS.map((option) => {
          const selected = selectedTags.includes(option.tag);
          return (
            <AppPressable
              key={option.tag}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => toggleTag(option.tag)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={option.icon as keyof typeof Ionicons.glyphMap}
                size={15}
                color={selected ? colors.onAccent : colors.text}
              />
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {t(option.labelKey, { defaultValue: option.fallbackLabel })}
              </Text>
            </AppPressable>
          );
        })}
      </View>

      <View style={styles.energyBlock}>
        <Text style={styles.sectionLabel}>
          {t("dailyMoodCheckin.energyLabel", { defaultValue: "Energy level" })}
        </Text>
        <View style={styles.energyRow}>
          {DAILY_MOOD_ENERGY_LEVELS.map((level) => {
            const selected = energyLevel === level;
            return (
              <AppPressable
                key={level}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setEnergyLevel(level)}
                style={({ pressed }) => [
                  styles.energyDot,
                  selected && styles.energyDotSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.energyText, selected && styles.energyTextSelected]}>{level}</Text>
              </AppPressable>
            );
          })}
        </View>
      </View>

      <TextInput
        value={detailNote}
        onChangeText={setDetailNote}
        placeholder={t("dailyMoodCheckin.notePlaceholder", {
          defaultValue: "Anything specific? e.g. jazz, rooftop, low-key dinner",
        })}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={140}
        style={styles.noteInput}
      />
    </BottomSheetPickerModal>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], isDark: boolean) {
  return StyleSheet.create({
    body: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 4,
      gap: 16,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    chipsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    chip: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    chipTextSelected: {
      color: colors.onAccent,
    },
    energyBlock: {
      gap: 10,
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    energyRow: {
      flexDirection: "row",
      gap: 8,
    },
    energyDot: {
      minWidth: 44,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    energyDotSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    energyText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    energyTextSelected: {
      color: colors.onPrimary,
    },
    noteInput: {
      minHeight: 76,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      fontSize: 14,
      lineHeight: 20,
      textAlignVertical: "top",
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    primaryButton: {
      flex: 1,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: colors.accent,
    },
    primaryButtonText: {
      color: colors.onAccent,
      fontSize: 15,
      fontWeight: "800",
    },
    secondaryButton: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
    pressed: {
      transform: [{ scale: 0.96 }],
    },
    disabled: {
      opacity: 0.55,
    },
  });
}
