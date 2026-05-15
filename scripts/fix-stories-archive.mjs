import fs from "fs";

const p = "src/widgets/stories-archive/ui/StoriesArchiveView.tsx";
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("  const stylesThemed = useMemo(");
const end = s.indexOf("  const renderGrid = () => {", start);
if (start < 0 || end < 0) {
  console.error("markers", start, end);
  process.exit(1);
}
s = s.slice(0, start) + "  const styles = useStoriesArchiveStyles(insets.top);\n\n" + s.slice(end);
s = s.replaceAll("stylesThemed", "styles");
if (!s.includes("useStoriesArchiveStyles")) {
  s = s.replace(
    'import { useAppTheme } from "@/app/providers/ThemeProvider";',
    'import { useAppTheme } from "@/app/providers/ThemeProvider";\nimport { useStoriesArchiveStyles } from "./storiesArchiveStyles";',
  );
}
fs.writeFileSync(p, s);
console.log("done");
