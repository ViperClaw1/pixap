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

function isThemedValue(value) {
  return /colors\.|mode\s*===/.test(value);
}

function parseTopLevelKeys(source) {
  const keys = [];
  const lines = source.split("\n");
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^(\s*)([A-Za-z0-9_]+):\s*(\{)?\s*$/);
    if (m) {
      const key = m[2];
      const indent = m[1];
      const hasBlock = Boolean(m[3]);
      const start = i;
      i++;
      if (hasBlock) {
        let depth = 1;
        while (i < lines.length && depth > 0) {
          if (lines[i].includes("{")) depth++;
          if (lines[i].includes("}")) depth--;
          i++;
        }
      }
      keys.push({ key, block: lines.slice(start, i).join("\n") });
      continue;
    }
    const single = lines[i].match(/^(\s*)([A-Za-z0-9_]+):\s*(\{[^}]*\}|[^,]+),?\s*$/);
    if (single) {
      keys.push({ key: single[2], block: lines[i] });
      i++;
      continue;
    }
    i++;
  }
  return keys;
}

function splitBlock(block, key) {
  const lines = block.split("\n");
  const staticInner = [];
  const themeInner = [];
  const header = lines[0];
  const footer = lines[lines.length - 1];
  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t || t.startsWith("//")) continue;
    const pm = t.match(/^([A-Za-z]+):\s*(.+?),?\s*$/);
    if (pm && (COLOR_PROPS.has(pm[1]) || isThemedValue(pm[2]))) {
      themeInner.push(`      ${pm[1]}: ${pm[2].replace(/,$/, "")},`);
    } else if (/colors\.|mode\s*===/.test(t)) {
      themeInner.push(`      ${t.replace(/,$/, "")},`);
    } else {
      staticInner.push(line);
    }
  }
  const staticBlock =
    staticInner.length > 0
      ? [header, ...staticInner, footer].join("\n")
      : `${lines[0].replace(/:\s*\{/, ": {}")}`;
  const themeBlock =
    themeInner.length > 0 ? `    ${key}: {\n${themeInner.join("\n")}\n    },` : null;
  return { staticBlock, themeBlock };
}

const src = fs.readFileSync("src/pages/profile/ui/ProfilePage.tsx", "utf8");
const m = src.match(/const stylesThemed = useMemo\(\s*\(\) =>\s*StyleSheet\.create\(\{([\s\S]*?)\}\),\s*\[/);
if (!m) {
  console.error("profile block not found");
  process.exit(1);
}
const parsed = parseTopLevelKeys(m[1]);
const staticBlocks = [];
const themeBlocks = [];
for (const { key, block } of parsed) {
  const { staticBlock, themeBlock } = splitBlock(block, key);
  staticBlocks.push(staticBlock);
  if (themeBlock) themeBlocks.push(themeBlock);
}

const out = `import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

export const profileStaticStyles = StyleSheet.create({
${staticBlocks.join("\n\n")}
});

export function profileThemeStyles(colors: ThemeColors, mode: ThemeMode) {
  return {
${themeBlocks.join("\n")}
  } satisfies Partial<Record<keyof typeof profileStaticStyles, object>>;
}

export function useProfileStyles() {
  const themed = useThemeStyles(({ colors, mode }) => profileThemeStyles(colors, mode));
  return useMemo(() => mergeStaticAndThemed(profileStaticStyles, themed), [themed]);
}
`;

fs.writeFileSync("src/pages/profile/ui/profileStyles.ts", out);
console.log("profile keys", staticBlocks.length);
