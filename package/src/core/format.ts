import type { KeyedPart, PartKind } from "../types";
import { fallbackFormatToParts } from "./format-to-parts-fallback";

// `Intl.NumberFormat` construction is expensive on hot render paths; cache instances.
const formatterCache = new Map<string, Intl.NumberFormat>();

// Hermes iOS lacks `formatToParts`; detect once and reuse a fallback.
const hasFormatToParts = typeof Intl.NumberFormat.prototype.formatToParts === "function";
const getParts = (formatter: Intl.NumberFormat, value: number): Intl.NumberFormatPart[] =>
  hasFormatToParts ? formatter.formatToParts(value) : fallbackFormatToParts(formatter, value);

const cacheKey = (locales: Intl.LocalesArgument, options: Intl.NumberFormatOptions | undefined): string => {
  const loc = Array.isArray(locales) ? locales.join(",") : (locales ?? "");
  return `${loc}|${JSON.stringify(options ?? {})}`;
};

const getFormatter = (
  locales: Intl.LocalesArgument,
  options: Intl.NumberFormatOptions | undefined
): Intl.NumberFormat => {
  const key = cacheKey(locales, options);
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locales, options);
    formatterCache.set(key, fmt);
  }
  return fmt;
};

const PART_TYPE_TO_KIND: Record<Intl.NumberFormatPartTypes, PartKind> = {
  integer: "integer",
  fraction: "fraction",
  group: "group",
  decimal: "decimal",
  currency: "currency",
  percent: "percent",
  percentSign: "percentSign",
  literal: "literal",
  minusSign: "minusSign",
  plusSign: "plusSign",
  exponentSeparator: "exponentSeparator",
  exponentMinusSign: "exponentMinusSign",
  exponentInteger: "exponentInteger",
  unit: "unit",
  compact: "compact",
  infinity: "infinity",
  nan: "nan",
  unknown: "unknown",
};

/** Returns 0–9 for digit glyphs (any numbering system), -1 otherwise. */
const getDigitValue = (char: string, zeroCodePoint: number): number => {
  if (char.length !== 1) return -1;
  const code = char.codePointAt(0);
  if (code == null) return -1;
  const offset = code - zeroCodePoint;
  return offset >= 0 && offset <= 9 ? offset : -1;
};

const zeroCodePointCache = new WeakMap<Intl.NumberFormat, number>();
const getZeroCodePoint = (formatter: Intl.NumberFormat): number => {
  const cached = zeroCodePointCache.get(formatter);
  if (cached != null) return cached;
  const parts = getParts(formatter, 0);
  let resolved = 48; // ASCII "0"
  for (const p of parts) {
    if (p.type === "integer" && p.value.length > 0) {
      const code = p.value.codePointAt(0);
      if (code != null) {
        resolved = code;
        break;
      }
    }
  }
  zeroCodePointCache.set(formatter, resolved);
  return resolved;
};

/**
 * Compact/scientific/engineering output ("1.2K", "1.23e3") doesn't expose
 * digits whose powers correspond to `value`'s positional digits, so we can't
 * roll them via the master tween. In those modes we treat integer/fraction
 * characters as static symbols — they still update on each new `parts`, but
 * jump instead of rolling.
 */
const isStandardNotation = (options: Intl.NumberFormatOptions | undefined): boolean =>
  !options?.notation || options.notation === "standard";

/** Split a formatted number into stably-keyed parts (`integer:N` from right, `fraction:N` from left) for diffing. */
export const formatToKeyedParts = (
  value: number,
  locales: Intl.LocalesArgument,
  options: Intl.NumberFormatOptions | undefined,
  prefix: string | undefined,
  suffix: string | undefined
): KeyedPart[] => {
  const formatter = getFormatter(locales, options);
  const parts = getParts(formatter, value);
  const zeroCp = getZeroCodePoint(formatter);
  const canRoll = isStandardNotation(options);

  // First pass: count integer chars so we can number positions from the right (ones place = 0).
  let totalIntegerDigits = 0;
  for (const part of parts) {
    if (part.type === "integer") totalIntegerDigits += part.value.length;
  }

  const out: KeyedPart[] = [];

  if (prefix) {
    for (let i = 0; i < prefix.length; i++) {
      const ch = prefix[i];
      if (ch == null) continue;
      out.push({ key: `prefix:${i}`, type: "symbol", kind: "prefix", char: ch, digitValue: -1 });
    }
  }

  let integerCursor = 0;
  let fractionCursor = 0;
  const symbolCounts: Partial<Record<PartKind, number>> = {};

  for (const part of parts) {
    const kind = PART_TYPE_TO_KIND[part.type];
    if (part.type === "integer") {
      for (const ch of part.value) {
        const digit = getDigitValue(ch, zeroCp);
        const rollable = canRoll && digit >= 0;
        const positionFromRight = totalIntegerDigits - 1 - integerCursor;
        out.push({
          key: `integer:${positionFromRight}`,
          type: rollable ? "digit" : "symbol",
          kind: "integer",
          char: rollable ? String(digit) : ch,
          digitValue: rollable ? digit : -1,
          power: rollable ? 10 ** positionFromRight : undefined,
        });
        integerCursor++;
      }
    } else if (part.type === "fraction") {
      for (const ch of part.value) {
        const digit = getDigitValue(ch, zeroCp);
        const rollable = canRoll && digit >= 0;
        out.push({
          key: `fraction:${fractionCursor}`,
          type: rollable ? "digit" : "symbol",
          kind: "fraction",
          char: rollable ? String(digit) : ch,
          digitValue: rollable ? digit : -1,
          power: rollable ? 10 ** -(fractionCursor + 1) : undefined,
        });
        fractionCursor++;
      }
    } else if (part.type === "group") {
      // Position-based key: the integer position to the right of the comma.
      // e.g. "1,234" → group:3 (3 digits remain to its right). Stable across
      // digit-count transitions: the same comma keeps the same key.
      const position = totalIntegerDigits - integerCursor;
      out.push({
        key: `group:${position}`,
        type: "symbol",
        kind: "group",
        char: part.value,
        digitValue: -1,
      });
    } else {
      const idx = symbolCounts[kind] ?? 0;
      symbolCounts[kind] = idx + 1;
      out.push({
        key: `${kind}:${idx}`,
        type: "symbol",
        kind,
        char: part.value,
        digitValue: -1,
      });
    }
  }

  if (suffix) {
    for (let i = 0; i < suffix.length; i++) {
      const ch = suffix[i];
      if (ch == null) continue;
      out.push({ key: `suffix:${i}`, type: "symbol", kind: "suffix", char: ch, digitValue: -1 });
    }
  }

  return out;
};

/**
 * Probe Intl with a max-digit value to get the canonical full-layout parts for
 * the active format. Used to pre-allocate slots when `maxIntegerDigits` is set,
 * so the visual order matches what Intl would produce at the upper bound
 * (currency in the right place, groups at the right positions, etc.). Returns
 * `[]` for non-standard notation (compact/scientific), whose layout depends on
 * the value itself.
 */
export const buildPreallocatedParts = (
  maxIntegerDigits: number,
  format: Intl.NumberFormatOptions | undefined,
  locales: Intl.LocalesArgument,
  prefix: string | undefined,
  suffix: string | undefined
): KeyedPart[] => {
  if (!isStandardNotation(format)) return [];
  // For `style: "percent"`, Intl multiplies by 100; counteract so the probe
  // ends up with the requested integer-digit count after Intl scaling.
  const scale = format?.style === "percent" ? 100 : 1;
  const probeInput = (10 ** maxIntegerDigits - 1) / scale;
  return formatToKeyedParts(probeInput, locales, format, prefix, suffix);
};
