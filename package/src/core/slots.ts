import type { SkFont } from "@shopify/react-native-skia";
import type { KeyedPart } from "../types";
import type { GlyphMetrics } from "./metrics";
import { measureChar } from "./metrics";
import { computeThresholdDelay, enforceMinGap } from "./stagger";

/** Merge old + next key lists, keeping exiting keys in place and inserting entering keys positionally. */
export const mergeKeyOrder = (oldKeys: readonly string[], nextKeys: readonly string[]): string[] => {
  const nextSet = new Set(nextKeys);
  const oldSet = new Set(oldKeys);
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < oldKeys.length || j < nextKeys.length) {
    const o = oldKeys[i];
    const n = nextKeys[j];
    if (o != null && !nextSet.has(o)) {
      out.push(o);
      i++;
      continue;
    }
    if (n != null && !oldSet.has(n)) {
      out.push(n);
      j++;
      continue;
    }
    if (o != null && n != null && o === n) {
      out.push(o);
      i++;
      j++;
      continue;
    }
    // Bounded fallback for unexpected de-sync (shouldn't happen with positional keys).
    if (o != null) {
      out.push(o);
      i++;
    } else if (n != null) {
      out.push(n);
      j++;
    } else {
      break;
    }
  }
  return out;
};

// Currency symbols sit too tight against the following digit in most system
// fonts (Helvetica "$4" reads as one glyph). Pad the slot with a small fraction
// of the digit advance so the symbol has breathing room.
const CURRENCY_PAD_RATIO = 0.18;

/**
 * Settled slot width. Digit slots size to the settled digit's advance so narrow
 * glyphs (e.g. "1") don't sit in oversized slots — otherwise "11,711" reads
 * like "1 1 , 7 1 1". Mid-roll, a wider intermediate digit can briefly
 * overshoot the slot, but `DigitSlot`'s `maxDigitWidth` clip rect prevents
 * chopping.
 *
 * The smallest-power digit (`pinnedDigitPower`) stays at `maxDigitWidth`: it
 * cycles through every digit repeatedly during a roll, and any width-bouncing
 * there is highly visible since it has no right-neighbor to shift along with.
 */
export const computeSlotWidth = (
  part: KeyedPart,
  font: SkFont,
  metrics: GlyphMetrics,
  letterSpacing: number,
  pinnedDigitPower?: number
): number => {
  if (part.type === "digit") {
    if (part.power === pinnedDigitPower) return metrics.maxDigitWidth + letterSpacing;
    const glyph = metrics.digitWidths[part.digitValue] ?? metrics.maxDigitWidth;
    return glyph + letterSpacing;
  }
  const base = measureChar(font, metrics, part.char) + letterSpacing;
  if (part.kind === "currency") return base + metrics.maxDigitWidth * CURRENCY_PAD_RATIO;
  return base;
};

/** Inputs for {@link computeStaggerDelays}. */
export interface StaggerInput {
  parts: KeyedPart[];
  enteringKeys: Set<string>;
  exitingKeys: Set<string>;
  prev: number;
  next: number;
  duration: number;
  gapMs: number;
}

/** Stagger delay per entering/exiting key, timed against the master tween's threshold crossings. */
export const computeStaggerDelays = ({
  parts,
  enteringKeys,
  exitingKeys,
  prev,
  next,
  duration,
  gapMs,
}: StaggerInput): Map<string, number> => {
  const out = new Map<string, number>();

  // Bloom low→high during growth, collapse high→low during shrink.
  const enteringDigits: KeyedPart[] = [];
  const enteringSymbols: KeyedPart[] = [];
  const exitingDigits: KeyedPart[] = [];
  const exitingSymbols: KeyedPart[] = [];

  for (const p of parts) {
    if (enteringKeys.has(p.key)) {
      (p.type === "digit" ? enteringDigits : enteringSymbols).push(p);
    } else if (exitingKeys.has(p.key)) {
      (p.type === "digit" ? exitingDigits : exitingSymbols).push(p);
    }
  }

  enteringDigits.sort((a, b) => (a.power ?? 0) - (b.power ?? 0));
  exitingDigits.sort((a, b) => (b.power ?? 0) - (a.power ?? 0));

  // Threshold against `sign(prev)*P` for exits and `sign(next)*P` for
  // entrances so the timing tracks `|v(t)|` (the digit-roll math uses |value|).
  // Required for negative↔positive transitions.
  const prevSign = prev < 0 ? -1 : 1;
  const nextSign = next < 0 ? -1 : 1;

  // Big growth jumps bunch threshold delays at t≈0 (the eased value rushes
  // through small magnitudes early). Anchor the first and last digits to their
  // thresholds and interpolate the middle ones for uniform spacing.
  const enteringThresholds = enteringDigits.map(p =>
    computeThresholdDelay(prev, next, nextSign * (p.power ?? 0), duration)
  );
  const firstThreshold = enteringThresholds[0] ?? 0;
  const lastThreshold = enteringThresholds[enteringThresholds.length - 1] ?? 0;
  const N = enteringThresholds.length;
  const enteringDigitDelays = enforceMinGap(
    enteringThresholds.map((t, i) => {
      if (N <= 1) return t;
      const interp = Math.round(firstThreshold + (i / (N - 1)) * (lastThreshold - firstThreshold));
      return Math.max(t, interp);
    }),
    gapMs
  );
  for (let i = 0; i < enteringDigits.length; i++) {
    const p = enteringDigits[i];
    const d = enteringDigitDelays[i];
    if (p && d != null) out.set(p.key, d);
  }

  const exitingDigitDelays = enforceMinGap(
    exitingDigits.map(p => computeThresholdDelay(prev, next, prevSign * (p.power ?? 0), duration)),
    gapMs
  );
  for (let i = 0; i < exitingDigits.length; i++) {
    const p = exitingDigits[i];
    const d = exitingDigitDelays[i];
    if (p && d != null) out.set(p.key, d);
  }

  // Minus/plus signs animate at the zero crossing, not t=0.
  const zeroCrossingDelay = computeThresholdDelay(prev, next, 0, duration);

  // Group separators inherit the delay of the adjacent digit so the comma
  // blooms with the "1" of "1,000" rather than at t=0 on its own.
  const partIndex = new Map<string, number>();
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p) partIndex.set(p.key, i);
  }
  const isAnimating = (p: KeyedPart) => p.type === "digit" && (enteringKeys.has(p.key) || exitingKeys.has(p.key));
  const inheritedDelay = (sym: KeyedPart): number => {
    if (sym.kind === "minusSign" || sym.kind === "plusSign") return zeroCrossingDelay;
    if (sym.kind !== "group") return 0;
    const idx = partIndex.get(sym.key);
    if (idx == null) return 0;
    for (let step = 1; step < parts.length; step++) {
      const left = parts[idx - step];
      if (left && isAnimating(left)) return out.get(left.key) ?? 0;
      const right = parts[idx + step];
      if (right && isAnimating(right)) return out.get(right.key) ?? 0;
    }
    return 0;
  };

  for (const p of enteringSymbols) out.set(p.key, inheritedDelay(p));
  for (const p of exitingSymbols) out.set(p.key, inheritedDelay(p));

  return out;
};
