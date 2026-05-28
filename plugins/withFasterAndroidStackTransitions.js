const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const DURATIONS_TS_RELATIVE = "src/app/navigation/stackTransitionDurations.ts";
const ANDROID_DURATION_RE =
  /export\s+const\s+ANDROID_STACK_SLIDE_DURATION_MS\s*=\s*(\d+)\s*;/;

const SLIDE_ANIM_SPECS = [
  { fileName: "rns_slide_in_from_right", fromXDelta: "100%", toXDelta: "0%" },
  { fileName: "rns_slide_out_to_left", fromXDelta: "0%", toXDelta: "-100%" },
  { fileName: "rns_slide_in_from_left", fromXDelta: "-100%", toXDelta: "0%" },
  { fileName: "rns_slide_out_to_right", fromXDelta: "0%", toXDelta: "100%" },
  { fileName: "rns_slide_in_from_bottom", fromYDelta: "100%", toYDelta: "0%" },
  { fileName: "rns_slide_out_to_bottom", fromYDelta: "0%", toYDelta: "100%" },
];

function readAndroidSlideDurationMs(projectRoot) {
  const tsPath = path.join(projectRoot, DURATIONS_TS_RELATIVE);
  const source = fs.readFileSync(tsPath, "utf8");
  const match = source.match(ANDROID_DURATION_RE);
  if (!match) {
    throw new Error(
      `[withFasterAndroidStackTransitions] Parse ANDROID_STACK_SLIDE_DURATION_MS in ${DURATIONS_TS_RELATIVE}`,
    );
  }
  const durationMs = Number(match[1]);
  if (!Number.isFinite(durationMs) || durationMs < 1) {
    throw new Error(
      `[withFasterAndroidStackTransitions] Invalid ANDROID_STACK_SLIDE_DURATION_MS: ${match[1]}`,
    );
  }
  return durationMs;
}

function buildSlideAnimXml(spec, durationMs) {
  const axisAttrs =
    spec.fromXDelta != null
      ? `    android:fromXDelta="${spec.fromXDelta}"\n    android:toXDelta="${spec.toXDelta}"`
      : `    android:fromYDelta="${spec.fromYDelta}"\n    android:toYDelta="${spec.toYDelta}"`;

  return `<?xml version="1.0" encoding="utf-8"?>
<translate xmlns:android="http://schemas.android.com/apk/res/android"
    android:duration="${durationMs}"
    android:interpolator="@android:interpolator/decelerate_cubic"
${axisAttrs} />
`;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withFasterAndroidStackTransitions = (config) =>
  withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const durationMs = readAndroidSlideDurationMs(projectRoot);
      const animDir = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/res/anim");
      fs.mkdirSync(animDir, { recursive: true });

      for (const spec of SLIDE_ANIM_SPECS) {
        const filePath = path.join(animDir, `${spec.fileName}.xml`);
        fs.writeFileSync(filePath, buildSlideAnimXml(spec, durationMs), "utf8");
      }

      console.log(
        `[withFasterAndroidStackTransitions] Android stack slide anim duration: ${durationMs}ms`,
      );

      return cfg;
    },
  ]);

module.exports = withFasterAndroidStackTransitions;
