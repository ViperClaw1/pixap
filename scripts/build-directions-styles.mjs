import fs from "fs";

const COLOR_PROPS = new Set([
  "backgroundColor",
  "color",
  "borderColor",
  "borderTopColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderRightColor",
  "shadowColor",
]);

function isThemedValue(v) {
  return /colors\.|mode\s*===|isDark/.test(v);
}

function splitStyleObjectLiteral(inner) {
  const staticProps = [];
  const themeProps = [];
  const parts = inner.split(/,\s*(?=[A-Za-z_][A-Za-z0-9_]*:)/);
  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.+)$/s);
    if (!m) {
      staticProps.push(t);
      continue;
    }
    const [, prop, val] = m;
    if (COLOR_PROPS.has(prop) || isThemedValue(val)) {
      themeProps.push(`${prop}: ${val.replace(/,\s*$/, "")}`);
    } else {
      staticProps.push(t.replace(/,\s*$/, ""));
    }
  }
  return { staticProps, themeProps };
}

function parseKeys(body) {
  const keys = [];
  const re = /([A-Za-z_][A-Za-z0-9_]*):\s*(\{[\s\S]*?\}),?\s*(?=\n\s*[A-Za-z_/]|$)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    keys.push({ key: m[1], inner: m[2].slice(1, -1) });
  }
  return keys;
}

const body = fs.readFileSync("scripts/_directions_body.txt", "utf8");
const keys = parseKeys(body);
const staticLines = [];
const themeLines = [];

for (const { key, inner } of keys) {
  const { staticProps, themeProps } = splitStyleObjectLiteral(inner);
  if (staticProps.length) {
    staticLines.push(`  ${key}: {\n    ${staticProps.join(",\n    ")},\n  },`);
  } else {
    staticLines.push(`  ${key}: {},`);
  }
  if (themeProps.length) {
    themeLines.push(`    ${key}: {\n      ${themeProps.join(",\n      ")},\n    },`);
  }
}

const out = `import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

export const directionsModalStaticStyles = StyleSheet.create({
${staticLines.join("\n\n")}
});

export function directionsModalThemeStyles(
  colors: ThemeColors,
  isDark: boolean,
  topInset: number,
  bottomInset: number,
  screenH: number,
) {
  return {
${themeLines.join("\n")}
    sheetExpanded: {
      marginTop: topInset,
      maxHeight: screenH,
    },
    footer: {
      paddingBottom: bottomInset,
    },
  } satisfies Partial<Record<keyof typeof directionsModalStaticStyles, object>>;
}

export function useDirectionsModalStyles(topInset: number, bottomInset: number, screenH: number) {
  const themed = useThemeStyles(
    ({ colors, isDark }) => directionsModalThemeStyles(colors, isDark, topInset, bottomInset, screenH),
    [topInset, bottomInset, screenH],
  );
  return useMemo(() => mergeStaticAndThemed(directionsModalStaticStyles, themed), [themed]);
}
`;

fs.writeFileSync("src/shared/ui/directions-modal/directionsModalStyles.ts", out);
console.log("keys", keys.length);
