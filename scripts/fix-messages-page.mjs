import fs from "fs";

const p = "src/pages/messages/ui/Messages.tsx";
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("  const _removedStylesThemed = useMemo(");
const end = s.indexOf("  return (", start);
if (start < 0 || end < 0) {
  console.error("markers not found");
  process.exit(1);
}
s = s.slice(0, start) + s.slice(end);
s = s.replaceAll("stylesThemed", "styles");
if (!s.includes("useMessagesStyles")) {
  s = s.replace(
    'import { useAppTheme } from "@/app/providers/ThemeProvider";',
    'import { useAppTheme } from "@/app/providers/ThemeProvider";\nimport { useMessagesStyles } from "./messagesStyles";',
  );
}
fs.writeFileSync(p, s);
console.log("fixed Messages.tsx");
