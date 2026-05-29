import { type SkFont, Skia } from "@shopify/react-native-skia";
import { Platform } from "react-native";

// Family names to try when no `font` is supplied. Android's Skia `SkFontMgr`
// only registers concrete families like "sans-serif"; an unregistered name
// ("Roboto") returns a NON-NULL but glyph-less typeface — so "sans-serif" leads
// and `coversDigits` rejects junk matches. iOS resolves these names directly.
const FALLBACK_FAMILIES: readonly string[] = Platform.select({
  ios: ["Helvetica Neue", "Helvetica", "Arial"],
  android: ["sans-serif", "Roboto"],
  default: [""],
}) ?? [""];

// Accept a typeface only if it maps a digit to a real glyph. `matchFamilyStyle`
// can hand back a placeholder (Android, unknown family) whose every codepoint is
// glyph 0 (.notdef) — that renders blank with zero advance.
const coversDigits = (font: SkFont): boolean => {
  const ids = font.getGlyphIDs("0");
  return ids.length > 0 && ids[0] !== 0;
};

/** System-fallback Skia font used when no `font` is supplied. Returns null if unavailable. */
export const resolveSystemFont = (fontSize: number, weight = 700): SkFont | null => {
  const mgr = Skia.FontMgr.System();

  // Named families first, then the manager's own default (index 0 is the
  // system sans-serif on Android) and the empty-name default as last resorts.
  const candidates = [...FALLBACK_FAMILIES];
  if (mgr.countFamilies() > 0) candidates.push(mgr.getFamilyName(0));
  candidates.push("");

  for (const family of candidates) {
    const typeface = mgr.matchFamilyStyle(family, { weight });
    if (!typeface) continue;
    const font = Skia.Font(typeface, fontSize);
    if (coversDigits(font)) return font;
  }
  return null;
};
