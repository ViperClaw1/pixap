import type { CrowdLevel } from "@/entities/venue-crowd";

export type CrowdPresentation = {
  emoji: string;
  accentColor: string;
  headlineKey: string;
  levelKey: string;
};

const PRESENTATION: Record<CrowdLevel, CrowdPresentation> = {
  empty: {
    emoji: "⚪",
    accentColor: "#94a3b8",
    headlineKey: "crowd.calm",
    levelKey: "crowd.empty",
  },
  low: {
    emoji: "🟢",
    accentColor: "#22c55e",
    headlineKey: "crowd.calm",
    levelKey: "crowd.low",
  },
  medium: {
    emoji: "🟡",
    accentColor: "#eab308",
    headlineKey: "crowd.mediumHeadline",
    levelKey: "crowd.medium",
  },
  busy: {
    emoji: "🔥",
    accentColor: "#f97316",
    headlineKey: "crowd.busyNow",
    levelKey: "crowd.busy",
  },
  packed: {
    emoji: "🔴",
    accentColor: "#ef4444",
    headlineKey: "crowd.packedLabel",
    levelKey: "crowd.packed",
  },
};

export function getCrowdPresentation(level: CrowdLevel): CrowdPresentation {
  return PRESENTATION[level];
}
