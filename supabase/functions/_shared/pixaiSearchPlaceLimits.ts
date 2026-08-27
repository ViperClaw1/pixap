export const PIXAI_DIRECT_MATCH_LIMIT = { min: 8, max: 15 } as const;
export const PIXAI_INDIRECT_MATCH_LIMIT = { min: 5, max: 8 } as const;

export function randomIntInclusive(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function resolvePixaiSearchPlaceLimits(): { direct: number; fallback: number } {
  return {
    direct: randomIntInclusive(PIXAI_DIRECT_MATCH_LIMIT.min, PIXAI_DIRECT_MATCH_LIMIT.max),
    fallback: randomIntInclusive(PIXAI_INDIRECT_MATCH_LIMIT.min, PIXAI_INDIRECT_MATCH_LIMIT.max),
  };
}
