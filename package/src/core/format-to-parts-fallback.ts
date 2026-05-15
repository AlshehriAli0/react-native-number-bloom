// Hermes on iOS doesn't implement `Intl.NumberFormat.prototype.formatToParts`.
// This is a minimal compatible implementation for the common cases
// (integer/fraction/group/decimal/currency/percent/minus/plus/literal).
// https://github.com/facebook/hermes/issues/1188
//
// If Hermes ignores `style: "currency"` or `style: "percent"`, the symbol
// simply won't render. Treated as unsupported on that runtime; we don't try
// to re-inject what Hermes dropped.

// Regular space, no-break space (U+00A0), narrow no-break space (U+202F).
// Locale formats use these as grouping separators (e.g. fr-FR: "1 000,5").
const LITERAL_CHARS = new Set(["\u0020", "\u00A0", "\u202F"]);

interface Separators {
  group: string;
  decimal: string;
  zeroCp: number;
}

const separatorCache = new Map<string, Separators>();

const probeSeparators = (locale: string): Separators => {
  const cached = separatorCache.get(locale);
  if (cached) return cached;

  // Format a known value with both grouping and a fraction. e.g. "1,000.5" / "1.000,5" / "1 000,5".
  const probe = new Intl.NumberFormat(locale, {
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(1000.5);

  const zeroFmt = new Intl.NumberFormat(locale, { useGrouping: false }).format(0);
  const oneFmt = new Intl.NumberFormat(locale, { useGrouping: false }).format(1);
  const zeroCp = zeroFmt.codePointAt(0) ?? 48;
  const oneCp = oneFmt.codePointAt(0) ?? 49;
  // Sanity check that 0 and 1 are sequential, to guard against non-digit locale prefixes.
  const resolvedZeroCp = oneCp === zeroCp + 1 ? zeroCp : 48;

  const isDigit = (ch: string): boolean => {
    const cp = ch.codePointAt(0);
    return cp != null && cp >= resolvedZeroCp && cp <= resolvedZeroCp + 9;
  };

  const nonDigits: string[] = [];
  for (const ch of probe) if (!isDigit(ch)) nonDigits.push(ch);

  const result: Separators = {
    group: nonDigits.length >= 2 ? (nonDigits[0] ?? "") : "",
    decimal: nonDigits.length >= 1 ? (nonDigits[nonDigits.length - 1] ?? "") : "",
    zeroCp: resolvedZeroCp,
  };
  separatorCache.set(locale, result);
  return result;
};

export const fallbackFormatToParts = (formatter: Intl.NumberFormat, value: number): Intl.NumberFormatPart[] => {
  const opts = formatter.resolvedOptions();
  const formatted = formatter.format(value);
  const { group, decimal, zeroCp } = probeSeparators(opts.locale);

  const isDigit = (ch: string): boolean => {
    const cp = ch.codePointAt(0);
    return cp != null && cp >= zeroCp && cp <= zeroCp + 9;
  };

  const parts: Intl.NumberFormatPart[] = [];
  const chars = [...formatted];
  let i = 0;
  let inFraction = false;

  while (i < chars.length) {
    const ch = chars[i];
    if (ch == null) {
      i++;
      continue;
    }

    if (isDigit(ch)) {
      let run = "";
      while (i < chars.length) {
        const c = chars[i];
        if (c == null) break;
        if (isDigit(c)) {
          run += c;
          i++;
        } else if (!inFraction && group && c === group) {
          if (run) parts.push({ type: "integer", value: run });
          parts.push({ type: "group", value: c });
          run = "";
          i++;
        } else {
          break;
        }
      }
      if (run) parts.push({ type: inFraction ? "fraction" : "integer", value: run });
      continue;
    }

    if (decimal && ch === decimal && !inFraction) {
      parts.push({ type: "decimal", value: ch });
      inFraction = true;
      i++;
      continue;
    }

    if (ch === "-") {
      parts.push({ type: "minusSign", value: ch });
      i++;
      continue;
    }
    if (ch === "+") {
      parts.push({ type: "plusSign", value: ch });
      i++;
      continue;
    }
    if (ch === "%") {
      parts.push({ type: "percentSign", value: ch });
      i++;
      continue;
    }
    if (LITERAL_CHARS.has(ch)) {
      parts.push({ type: "literal", value: ch });
      i++;
      continue;
    }

    // Accumulate any other non-digit run as a currency or literal block.
    let sym = "";
    while (i < chars.length) {
      const c = chars[i];
      if (c == null) break;
      if (isDigit(c) || c === decimal || c === group || c === "-" || c === "+" || c === "%" || LITERAL_CHARS.has(c)) {
        break;
      }
      sym += c;
      i++;
    }
    if (sym) {
      parts.push({ type: opts.style === "currency" ? "currency" : "literal", value: sym });
    }
  }

  return parts;
};
