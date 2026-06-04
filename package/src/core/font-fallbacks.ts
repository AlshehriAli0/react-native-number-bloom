import type { SkFont } from "@shopify/react-native-skia";
import type { KeyedPart } from "../types";

// Locale-specific punctuation that Intl emits but most app fonts lack.
// Substituting avoids `.notdef` (em-width advance) overflowing the slot.
const LATIN_FALLBACKS: Record<string, string> = {
  "٬": ",", // ARABIC THOUSANDS SEPARATOR
  "٫": ".", // ARABIC DECIMAL SEPARATOR
  "٪": "%", // ARABIC PERCENT SIGN
  "،": ",", // ARABIC COMMA
  "؛": ";", // ARABIC SEMICOLON
  " ": " ", // NO-BREAK SPACE
  " ": " ", // NARROW NO-BREAK SPACE
  "‎": "", // LEFT-TO-RIGHT MARK
  "‏": "", // RIGHT-TO-LEFT MARK
};

const cache = new WeakMap<SkFont, Map<string, string>>();

const getCache = (font: SkFont): Map<string, string> => {
  let m = cache.get(font);
  if (m) return m;
  m = new Map();
  cache.set(font, m);
  return m;
};

const fontHasAllGlyphs = (font: SkFont, char: string): boolean => {
  const ids = font.getGlyphIDs(char);
  for (const id of ids) if (id === 0) return false;
  return true;
};

const substituteForFont = (font: SkFont, char: string): string => {
  if (char.length === 0) return char;
  const c = getCache(font);
  const cached = c.get(char);
  if (cached !== undefined) return cached;

  if (fontHasAllGlyphs(font, char)) {
    c.set(char, char);
    return char;
  }

  let out = "";
  for (const ch of char) {
    const fallback = LATIN_FALLBACKS[ch];
    if (fallback !== undefined) {
      out += fallback;
      continue;
    }
    out += fontHasAllGlyphs(font, ch) ? ch : "";
  }
  c.set(char, out);
  return out;
};

// Returns the input array referentially when nothing changes so downstream
// memos keep equality on the common LTR path.
export const substituteSymbolChars = (parts: KeyedPart[], font: SkFont | null): KeyedPart[] => {
  if (!font || parts.length === 0) return parts;
  let out: KeyedPart[] | null = null;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined) continue;
    if (part.type !== "symbol") {
      out?.push(part);
      continue;
    }
    const next = substituteForFont(font, part.char);
    if (next === part.char) {
      out?.push(part);
      continue;
    }
    if (out === null) {
      out = parts.slice(0, i);
    }
    out.push({ ...part, char: next });
  }
  return out ?? parts;
};
