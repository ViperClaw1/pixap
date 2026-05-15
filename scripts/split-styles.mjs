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
  "tintColor",
]);

function isThemedValue(value) {
  return /colors\.|mode\s*===/.test(value);
}

function splitStyleObject(source) {
  const staticLines = [];
  const themeBlocks = [];
  const lines = source.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\s*)([A-Za-z0-9_]+):\s*\{/);
    if (keyMatch && !line.includes("colors.")) {
      const key = keyMatch[2];
      const indent = keyMatch[1];
      const block = [line];
      i++;
      let depth = 1;
      const staticBlock = [];
      const themeProps = [];
      while (i < lines.length && depth > 0) {
        const inner = lines[i];
        block.push(inner);
        if (inner.includes("{")) depth++;
        if (inner.includes("}")) depth--;
        if (depth > 0) {
          const propMatch = inner.match(/^\s+([A-Za-z]+):\s*(.+?),?\s*$/);
          if (propMatch) {
            const [, prop, val] = propMatch;
            if (COLOR_PROPS.has(prop) || isThemedValue(val)) {
              themeProps.push(`    ${prop}: ${val.replace(/,$/, "")},`);
            } else {
              staticBlock.push(inner);
            }
          } else if (!inner.trim().startsWith("/**") && inner.trim() && !inner.match(/^\s*\},?\s*$/)) {
            staticBlock.push(inner);
          }
        }
        i++;
      }
      staticLines.push(`${indent}${key}: {`);
      staticLines.push(...staticBlock);
      staticLines.push(`${indent}},`);
      if (themeProps.length) {
        themeBlocks.push(`    ${key}: {\n${themeProps.join("\n")}\n    },`);
      }
      continue;
    }
    const singleMatch = line.match(/^(\s*)([A-Za-z0-9_]+):\s*(.+),?\s*$/);
    if (singleMatch && !line.includes("{")) {
      const [, indent, key, val] = singleMatch;
      if (COLOR_PROPS.has(key) || isThemedValue(val) || /colors\./.test(val)) {
        themeBlocks.push(`    ${key}: { ${val.replace(/,$/, "")} },`);
      } else {
        staticLines.push(line);
      }
      i++;
      continue;
    }
    if (line.trim().startsWith("/**")) {
      staticLines.push(line);
      i++;
      continue;
    }
    staticLines.push(line);
    i++;
  }
  return { staticBody: staticLines.join("\n"), themeBody: themeBlocks.join("\n") };
}

const target = process.argv[2];
if (!target) {
  console.error("Usage: node split-styles.mjs <file>");
  process.exit(1);
}
const src = fs.readFileSync(target, "utf8");
const m = src.match(/StyleSheet\.create\(\{([\s\S]*)\}\);/);
if (!m) {
  console.error("StyleSheet.create not found");
  process.exit(1);
}
const { staticBody, themeBody } = splitStyleObject(m[1]);
console.log("=== STATIC ===");
console.log(staticBody.slice(0, 2000));
console.log("\n=== THEME (first 2000) ===");
console.log(themeBody.slice(0, 2000));
