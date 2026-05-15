import fs from "fs";

const p = "src/pages/profile/ui/ProfilePage.tsx";
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("  const stylesThemed = useMemo(");
if (start < 0) {
  console.error("start not found");
  process.exit(1);
}
const end = s.indexOf("  const userName = ", start);
if (end < 0) {
  console.error("end not found");
  process.exit(1);
}
s = s.slice(0, start) + "  const styles = useProfileStyles();\n\n" + s.slice(end);
s = s.replaceAll("stylesThemed", "styles");
if (!s.includes("useProfileStyles")) {
  s = s.replace(
    'import { useAppTheme } from "@/app/providers/ThemeProvider";',
    'import { useAppTheme } from "@/app/providers/ThemeProvider";\nimport { useProfileStyles } from "./profileStyles";',
  );
}
fs.writeFileSync(p, s);
console.log("fixed profile");
