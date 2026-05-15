/** Inverse of `Easing.out(Easing.exp)`. Returns the time the eased value crosses `threshold`. */
export const computeThresholdDelay = (from: number, to: number, threshold: number, duration: number): number => {
  if (to === from) return 0;
  const progress = (threshold - from) / (to - from);
  if (progress <= 0) return 0;
  if (progress >= 1) return duration;
  // y = 1 - 2^(-10t) → t = -log2(1 - y) / 10
  const t = -Math.log2(1 - progress) / 10;
  return Math.round(Math.min(t, 1) * duration);
};

/** Push delays apart so no two are closer together than `gapMs`. */
export const enforceMinGap = (delays: number[], gapMs: number): number[] => {
  const out: number[] = [];
  let last = -gapMs;
  for (const raw of delays) {
    const d = Math.max(raw, last + gapMs);
    out.push(d);
    last = d;
  }
  return out;
};
