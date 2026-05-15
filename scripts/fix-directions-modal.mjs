import fs from "fs";

const p = "src/shared/ui/directions-modal/DirectionsModal.tsx";
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("  const styles = useMemo(");
const end = s.indexOf("  useEffect(() => {\n    sheetScreenH.value = screenH;", start);
if (start < 0 || end < 0) {
  console.error("markers", start, end);
  process.exit(1);
}
s =
  s.slice(0, start) +
  "  const styles = useDirectionsModalStyles(insets.top, insets.bottom, screenH);\n\n" +
  s.slice(end);
if (!s.includes("useDirectionsModalStyles")) {
  s = s.replace(
    'import { useAppTheme } from "@/app/providers/ThemeProvider";',
    'import { useAppTheme } from "@/app/providers/ThemeProvider";\nimport { useDirectionsModalStyles } from "./directionsModalStyles";',
  );
}
fs.writeFileSync(p, s);
console.log("done");
