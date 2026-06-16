type SoftenOpts = {
  isFallback?: boolean;
  hasFtsMatch?: boolean;
};

const NEGATIVE_CLAUSE_REPLACEMENTS: Array<{ pattern: RegExp; replace: string | ((...args: string[]) => string) }> = [
  {
    pattern:
      /\bI couldn'?t find (?:any )?(?:specific )?matches? for ([^,.]+?)(?: in the available details)?,?\s*but\s+/gi,
    replace: (_m, query) => `For ${query.trim()}, these could be good options — `,
  },
  {
    pattern:
      /\bI didn'?t find (?:any )?(?:specific )?matches? for ([^,.]+?)(?: in the available details)?,?\s*but\s+/gi,
    replace: (_m, query) => `For ${query.trim()}, these could be good options — `,
  },
  { pattern: /\bI couldn'?t find[^.!?]+[.!?]\s*/gi, replace: "" },
  { pattern: /\bI didn'?t find[^.!?]+[.!?]\s*/gi, replace: "" },
  { pattern: /\bThere (?:is|are) no[^.!?]+[.!?]\s*/gi, replace: "" },
  { pattern: /\bNothing (?:in the list )?matches?[^.!?]+[.!?]\s*/gi, replace: "" },
  {
    pattern: /\bNo (?:place|venue|restaurant)s? (?:in the list )?(?:has|have|offers?)[^.!?]+[.!?]\s*/gi,
    replace: "",
  },
  { pattern: /\b(?:unfortunately|sadly),?\s*/gi, replace: "" },
  { pattern: /\b(?:я )?не наш[её]л[^.!?]+[.!?]\s*/giu, replace: "" },
  { pattern: /\bне нашлось[^.!?]+[.!?]\s*/giu, replace: "" },
  { pattern: /\bни одн[аоую][^.!?]+не[^.!?]+[.!?]\s*/giu, replace: "" },
  {
    pattern: /\bнет (?:подходящих |конкретных )?(?:заведений|мест|вариантов)[^.!?]+[.!?]\s*/giu,
    replace: "",
  },
  { pattern: /\bк сожалению,?\s*/giu, replace: "" },
];

const BANNED_SNIPPET =
  /\b(?:i couldn'?t find|i didn'?t find|there (?:is|are) no|nothing matches?|no places? (?:has|have)|unfortunately|не наш[её]л|не нашлось|ни одн|нет (?:подходящих |конкретных )?(?:заведений|мест)|к сожалению)\b/i;

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function applyReplacements(text: string): string {
  let out = text;
  for (const { pattern, replace } of NEGATIVE_CLAUSE_REPLACEMENTS) {
    out =
      typeof replace === "function"
        ? out.replace(pattern, (...args) => replace(...args.map(String)))
        : out.replace(pattern, replace);
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function shouldSoften(text: string, opts?: SoftenOpts): boolean {
  if (BANNED_SNIPPET.test(text)) return true;
  if (opts?.isFallback) return true;
  if (opts?.hasFtsMatch === false) return true;
  return false;
}

export function softenAssistantFallbackTone(text: string, opts?: SoftenOpts): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (!shouldSoften(trimmed, opts)) return text;

  const softened = capitalizeFirst(applyReplacements(trimmed));
  if (softened.length >= 12) return softened;

  return capitalizeFirst(
    "Here are strong picks from your current list — I'd suggest calling ahead to confirm the details fit what you had in mind.",
  );
}
