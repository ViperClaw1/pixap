import fs from "fs";

const COLOR_PROPS = new Set([
  "backgroundColor",
  "color",
  "borderColor",
  "borderTopColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderRightColor",
]);

const body = fs.readFileSync("src/pages/messages/ui/_extracted_styles.txt", "utf8");

function parseTopLevelKeys(source) {
  const keys = [];
  const lines = source.split("\n");
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^(\s*)([A-Za-z0-9_]+):\s*(\{)?\s*$/);
    if (m) {
      const key = m[2];
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
    if (pm && (COLOR_PROPS.has(pm[1]) || /colors\./.test(pm[2]))) {
      themeInner.push(`      ${pm[1]}: ${pm[2].replace(/,$/, "")},`);
    } else if (/colors\./.test(t)) {
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

const parsed = parseTopLevelKeys(body);
const staticBlocks = [];
const themeBlocks = [];
for (const { key, block } of parsed) {
  const { staticBlock, themeBlock } = splitBlock(block, key);
  staticBlocks.push(staticBlock);
  if (themeBlock) themeBlocks.push(themeBlock);
}

const out = `import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";

export const messagesStaticStyles = StyleSheet.create({
${staticBlocks.join("\n\n")}
});

export function messagesThemeStyles(colors: ThemeColors, bottomInset: number) {
  return {
${themeBlocks.join("\n")}
    content: { paddingBottom: Math.max(bottomInset, 20) },
  } satisfies Partial<Record<keyof typeof messagesStaticStyles, object>>;
}
`;

fs.writeFileSync("src/pages/messages/ui/messagesStyles.ts", out);
console.log("wrote messagesStyles.ts", staticBlocks.length, "keys");
