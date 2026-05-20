import { Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { Temperament } from "@/entities/user-preferences";

type Props = {
  value: Temperament;
  onChange: (key: keyof Temperament, v: number) => void;
};

const TEMPERAMENT_PREFIX = "onboarding.temperament";

/** Red (left) → green (right) across five discrete steps. */
const SEGMENT_COLORS: Record<number, string> = {
  0: "#EF4444",
  25: "#F97316",
  50: "#EAB308",
  75: "#84CC16",
  100: "#22C55E",
};

const SEGMENT_INACTIVE_OPACITY = 0.38;

const SLIDER_KEYS: { key: keyof Temperament; lowKey: string; highKey: string }[] = [
  { key: "introvert", lowKey: "introvertLow", highKey: "introvertHigh" },
  { key: "socialEnergy", lowKey: "energyLow", highKey: "energyHigh" },
  { key: "adventurousness", lowKey: "adventureLow", highKey: "adventureHigh" },
  { key: "planning", lowKey: "planningLow", highKey: "planningHigh" },
];

function TemperamentRow({
  labelLow,
  labelHigh,
  value,
  onChange,
  colors,
}: {
  labelLow: string;
  labelHigh: string;
  value: number;
  onChange: (v: number) => void;
  colors: { text: string; textMuted: string };
}) {
  const segments = [0, 25, 50, 75, 100];

  return (
    <View style={styles.block}>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{labelLow}</Text>
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.label, { color: colors.textMuted }]}>{labelHigh}</Text>
      </View>
      <View style={styles.segments}>
        {segments.map((seg) => {
          const active = value >= seg - 12 && value <= seg + 12;
          const segColor = SEGMENT_COLORS[seg];
          return (
            <Pressable
              key={seg}
              onPress={() => onChange(seg)}
              style={[styles.segHit, { flex: seg === 0 || seg === 100 ? 0.8 : 1 }]}
              accessibilityRole="adjustable"
              accessibilityState={{ selected: active }}
            >
              <View
                style={[
                  styles.segBar,
                  {
                    backgroundColor: segColor,
                    opacity: active ? 1 : SEGMENT_INACTIVE_OPACITY,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.adjust}>
        <Pressable onPress={() => onChange(Math.max(0, value - 5))} style={styles.adjustBtn}>
          <Text style={{ color: colors.text, fontSize: 18 }}>−</Text>
        </Pressable>
        <Pressable onPress={() => onChange(Math.min(100, value + 5))} style={styles.adjustBtn}>
          <Text style={{ color: colors.text, fontSize: 18 }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function TemperamentSliders({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrap}>
      {SLIDER_KEYS.map(({ key, lowKey, highKey }) => (
        <TemperamentRow
          key={key}
          labelLow={t(lowKey, { keyPrefix: TEMPERAMENT_PREFIX })}
          labelHigh={t(highKey, { keyPrefix: TEMPERAMENT_PREFIX })}
          value={value[key]}
          onChange={(v) => onChange(key, v)}
          colors={colors}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  block: { gap: 8 },
  labels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 12, fontWeight: "500", flex: 1 },
  value: { fontSize: 14, fontWeight: "700", textAlign: "center", minWidth: 32 },
  segments: { flexDirection: "row", gap: 6, alignItems: "center" },
  segHit: {
    minHeight: 44,
    justifyContent: "center",
  },
  segBar: { height: 14, borderRadius: 7 },
  adjust: { flexDirection: "row", justifyContent: "center", gap: 24, marginTop: 4 },
  adjustBtn: { padding: 8 },
});
